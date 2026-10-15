import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from 'docx';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { snapshotIntegro } from './SnapshotService.js';
import { RuleEngine } from '../engines/RuleEngine.js';
import { persistArtifactWithCompensation } from './safety-primitives.js';

type Dados = Record<string, any>;

const root = path.resolve(process.cwd(), '../reports');
fs.mkdirSync(root, { recursive: true });

const arr = (v: unknown): Dados[] => Array.isArray(v) ? v : [];

const txt = (v: unknown): string =>
  v === null || v === undefined || v === ''
    ? 'Não informado'
    : typeof v === 'boolean'
      ? (v ? 'Sim' : 'Não')
      : String(v);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const dec = (v: unknown, casas = 2): string => {
  const n = num(v);
  return n === null
    ? 'Não informado'
    : n.toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
      });
};

const money = (v: unknown): string => {
  const n = num(v);
  return n === null
    ? 'Não informado'
    : n.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
};

const dateBR = (v: unknown): string => {
  if (!v) return 'Não informado';

  const d = new Date(String(v));

  return Number.isNaN(d.getTime())
    ? txt(v)
    : d.toLocaleDateString('pt-BR');
};

const dateTimeBR = (v: unknown): string => {
  if (!v) return 'Não informado';

  const d = new Date(String(v));

  return Number.isNaN(d.getTime())
    ? txt(v)
    : d.toLocaleString('pt-BR');
};

const latestResult = (data: Dados): Dados | undefined => {
  const xs = arr(data.resultados);
  return xs.length ? xs[xs.length - 1] : undefined;
};

async function snap(prisma: PrismaClient, id: string) {
  const avaliacao = await prisma.avaliacao.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      snapshotHash: true
    }
  });

  if (!avaliacao) {
    throw new Error('AVALIACAO_NOT_FOUND');
  }

  if (!avaliacao.snapshotHash) {
    throw new Error('SNAPSHOT_HASH_AUSENTE');
  }

  const s = await prisma.snapshot.findFirst({
    where: {
      avaliacaoId: id,
      hashSha256: avaliacao.snapshotHash
    },
    orderBy: { versao: 'desc' }
  });

  if (!s) {
    throw new Error('SNAPSHOT_REQUIRED_BEFORE_EMISSION');
  }

  if (avaliacao.status !== 'PRONTA_PARA_EMISSAO') {
    throw new Error('AVALIACAO_NAO_PRONTA_PARA_EMISSAO');
  }

  if (!avaliacao.snapshotHash || avaliacao.snapshotHash !== s.hashSha256) {
    throw new Error('SNAPSHOT_NAO_VINCULADO_AO_ESTADO_ATUAL');
  }

  if (!snapshotIntegro(s)) {
    throw new Error('SNAPSHOT_INTEGRO_INVALIDO');
  }

  const readiness = await new RuleEngine(prisma).auditarAvaliacao(
    id,
    { exigirSnapshot: true }
  );

  if (!readiness.podeEmitir) {
    throw new Error(
      `AVALIACAO_NAO_APTA_PARA_EMISSAO:${JSON.stringify(readiness.alertas)}`
    );
  }

  const raw = JSON.parse(s.dadosJson) as Dados;
  const data = normalizarDadosSnapshot(raw);

  // A partir daqui nenhum dado do banco corrente é consultado para compor o laudo.
  // O conteúdo técnico é exclusivamente o estado congelado e validado pelo hash.
  return { s, data };
}

export function normalizarDadosSnapshot(raw: Dados): Dados {
  const data: Dados = raw?.avaliacao
    ? {
        ...raw.avaliacao,
        fatores: raw.fatores ?? [],
        snapshotSchemaVersion: raw.snapshotSchemaVersion,
        congeladoEm: raw.congeladoEm,
        observacaoGovernanca: raw.observacaoGovernanca
      }
    : raw;

  if (data.snapshotSchemaVersion !== 2) {
    throw new Error('SNAPSHOT_SCHEMA_NAO_SUPORTADO');
  }

  return data;
}

async function saveDocument(
  prisma: PrismaClient,
  id: string,
  formato: 'PDF' | 'DOCX' | 'XLSX',
  tipo: 'LAUDO' | 'PLANILHA',
  buffer: Buffer,
  snapshotHash: string
) {
  const ext = formato.toLowerCase();

  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '');

  const nomeArquivo =
    `laudo-${id}-${stamp}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

  const caminho = path.join(root, nomeArquivo);

  const hashSha256 = crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex');

  const saved = await persistArtifactWithCompensation({
    write: () => {
      fs.writeFileSync(caminho, buffer, { flag: 'wx' });
      return caminho;
    },

    persist: (arquivo: string) =>
      prisma.$transaction(async tx => {
        const doc = await tx.documento.create({
          data: {
            avaliacaoId: id,
            tipo,
            nomeArquivo,
            caminho: arquivo,
            formato,
            hashSha256,
            snapshotHash
          }
        });

        await tx.auditoria.create({
          data: {
            avaliacaoId: id,
            acao: 'GERACAO_DOCUMENTO',
            entidade: 'Documento',
            entidadeId: doc.id,
            depoisJson: JSON.stringify({
              formato,
              tipo,
              nomeArquivo,
              caminho: arquivo,
              hashSha256,
              snapshotHash
            }),
            usuario: 'sistema',
            motivo: 'Geração de documento a partir de snapshot congelado'
          }
        });

        return doc;
      }),

    remove: (arquivo: string) => fs.unlinkSync(arquivo)
  });

  return saved.record.caminho;
}


function allResultRows(d: Dados): Dados[] {
  return arr(d.resultados).map((r, i) => ({
    Ordem: i + 1,
    ID: txt(r.id),
    Método: txt(r.metodo),
    NúmeroAmostras: r.numeroAmostras ?? null,
    ValorUnitário: r.valorUnitario ?? null,
    ÁreaReferência: r.areaReferencia ?? null,
    ValorTotal: r.valorTotal ?? null,
    Média: r.media ?? null,
    Mediana: r.mediana ?? null,
    DesvioPadrão: r.desvioPadrao ?? null,
    CoeficienteVariação: r.coeficienteVariacao ?? null,
    ErroPadrão: r.erroPadrao ?? null,
    CriadoEm: dateTimeBR(r.createdAt)
  }));
}

function historyRows(d: Dados): Dados[] {
  return arr(d.historicos).map((h, i) => ({
    Ordem: i + 1,
    ID: txt(h.id),
    Campo: txt(h.campo),
    ValorAnterior: txt(h.valorAnterior),
    ValorNovo: txt(h.valorNovo),
    Usuário: txt(h.usuario),
    Data: dateTimeBR(h.dataAlteracao),
    Motivo: txt(h.motivo)
  }));
}

function auditRows(d: Dados): Dados[] {
  return arr(d.auditorias).map((a, i) => ({
    Ordem: i + 1,
    ID: txt(a.id),
    Ação: txt(a.acao),
    Entidade: txt(a.entidade),
    EntidadeID: txt(a.entidadeId),
    AntesJSON: txt(a.antesJson),
    DepoisJSON: txt(a.depoisJson),
    Usuário: txt(a.usuario),
    Data: dateTimeBR(a.dataHora),
    Motivo: txt(a.motivo)
  }));
}

function photoRows(d: Dados): Dados[] {
  return arr(d.fotografias).map((f, i) => ({
    Ordem: i + 1,
    ID: txt(f.id),
    AmostraID: txt(f.amostraId),
    Arquivo: txt(f.arquivo),
    Descrição: txt(f.descricao),
    DataFoto: dateTimeBR(f.dataFoto),
    OrdemOriginal: f.ordem ?? null
  }));
}

function snapshotJsonRows(dadosJson: string): Dados[] {
  const chunkSize = 30000;
  const rows: Dados[] = [];
  for (let i = 0, parte = 1; i < dadosJson.length; i += chunkSize, parte++) {
    rows.push({
      Parte: parte,
      Inicio: i,
      Fim: Math.min(i + chunkSize, dadosJson.length),
      JSON: dadosJson.slice(i, i + chunkSize)
    });
  }
  return rows;
}

function generalRows(d: Dados): Dados[] {
  return [
    ['Número da avaliação', d.numero],
    ['Título', d.titulo],
    ['Finalidade', d.finalidade],
    ['Tipo de imóvel', d.tipoImovel],
    ['Município', d.municipio],
    ['Estado', d.estado],
    ['Data da avaliação', dateBR(d.dataAvaliacao)],
    ['Responsável', d.responsavel],
    ['Status no snapshot', d.status],
    ['Versão do motor', d.versaoMotor],
    ['Hash dos parâmetros', d.parametrosHash],
    ['Identificador interno', d.id]
  ].map(([Campo, Valor]) => ({
    Campo,
    Valor: txt(Valor)
  }));
}

function propertyRows(p: Dados): Dados[] {
  const labels: Record<string, string> = {
    matricula: 'Matrícula',
    cadastroImobiliario: 'Cadastro imobiliário',
    logradouro: 'Logradouro',
    numero: 'Número',
    complemento: 'Complemento',
    bairro: 'Bairro',
    cep: 'CEP',
    areaTerreno: 'Área do terreno (m²)',
    testadaPrincipal: 'Testada principal (m)',
    profundidadeInformada: 'Profundidade informada (m)',
    profundidadeCalculada: 'Profundidade calculada (m)',
    profundidadeUtilizada: 'Profundidade utilizada (m)',
    situacaoQuadra: 'Situação da quadra',
    distanciaCentro: 'Distância do centro',
    areaEdificadaPrivativa: 'Área edificada privativa (m²)',
    areaEdificadaTotal: 'Área edificada total (m²)',
    padrao: 'Padrão construtivo',
    conservacao: 'Estado de conservação',
    idade: 'Idade (anos)',
    vidaUtil: 'Vida útil',
    elevador: 'Possui elevador',
    numeroVagas: 'Número de vagas',
    tipoVaga: 'Tipo de vaga',
    valorTotal: 'Valor total informado',
    observacoes: 'Observações'
  };

  return Object.entries(labels).map(([key, label]) => ({
    Campo: label,
    Valor:
      key === 'valorTotal'
        ? money(p?.[key])
        : txt(p?.[key])
  }));
}

function sampleRows(d: Dados): Dados[] {
  const homs = arr(d.homogeneizacoes);
  const samples = arr(d.amostras);

  return samples.map((a, i) => {
    const h = homs.find(x => x.amostraId === a.id);

    return {
      Ordem: i + 1,
      Identificador: txt(a.identificador),
      Fonte: txt(a.fonte),
      URL: txt(a.url),
      DataColeta: dateBR(a.dataColeta),
      TipoFonte: txt(a.tipoFonte),
      Bairro: txt(a.bairro),
      SituacaoQuadra: txt(a.situacaoQuadra),
      AreaTerreno_m2: a.areaTerreno ?? null,
      Testada_m: a.testada ?? null,
      Profundidade_m: a.profundidade ?? null,
      AreaEdificada_m2: a.areaEdificada ?? null,
      AreaPrivativa_m2: a.areaPrivativa ?? null,
      Padrao: txt(a.padrao),
      Conservacao: txt(a.conservacao),
      Idade: a.idade ?? null,
      VidaUtil: a.vidaUtil ?? null,
      Elevador: txt(a.elevador),
      Vagas: a.numeroVagas ?? null,
      DistanciaCentro: a.distanciaCentro ?? null,
      ValorOferta: a.valorOferta ?? null,
      ValorTransacao: a.valorTransacao ?? null,
      TipoValor: txt(a.tipoValor),
      Status: txt(a.status),
      Observacoes: txt(a.observacoes),
      ValorUnitarioOriginal: h?.valorUnitarioOriginal ?? null,
      ValorUnitarioHomogeneizado:
        h?.valorUnitarioHomogeneizado ?? null
    };
  });
}

function homRows(d: Dados): Dados[] {
  const samples = arr(d.amostras);

  return arr(d.homogeneizacoes).map((h, i) => {
    const a = samples.find(x => x.id === h.amostraId);

    return {
      Ordem: i + 1,
      Amostra: txt(a?.identificador ?? h.amostraId),
      Bairro: txt(a?.bairro),
      ValorUnitarioOriginal: h.valorUnitarioOriginal,
      FA: h.fa,
      FT: h.ft,
      FP: h.fp,
      FO: h.fo,
      FE: h.fe,
      FI: h.fi,
      FPC: h.fpc,
      FC: h.fc,
      FELEV: h.felev,
      FG: h.fg,
      ProdutoFatores: h.produtoFatores,
      ValorUnitarioHomogeneizado:
        h.valorUnitarioHomogeneizado,
      MotorVersao: txt(h.motorVersao),
      ParametrosHash: txt(h.parametrosHash),
      CalculadoEm: dateBR(h.calculadoEm),
      AuditoriaCalculo: txt(h.auditoriaJson)
    };
  });
}

function resultRows(d: Dados): Dados[] {
  const r = latestResult(d);

  if (!r) {
    return [
      {
        Campo: 'Resultado',
        Valor: 'Não registrado no snapshot'
      }
    ];
  }

  return [
    { Campo: 'Método', Valor: txt(r.metodo) },
    {
      Campo: 'Número de amostras',
      Valor: txt(r.numeroAmostras)
    },
    {
      Campo: 'Valor unitário estimado',
      Valor: money(r.valorUnitario)
    },
    {
      Campo: 'Área de referência (m²)',
      Valor: dec(r.areaReferencia)
    },
    {
      Campo: 'Valor total estimado',
      Valor: money(r.valorTotal)
    },
    {
      Campo: 'Média',
      Valor: money(r.media)
    },
    {
      Campo: 'Mediana',
      Valor: money(r.mediana)
    },
    {
      Campo: 'Desvio padrão',
      Valor: dec(r.desvioPadrao, 4)
    },
    {
      Campo: 'Coeficiente de variação',
      Valor: dec(r.coeficienteVariacao, 4)
    },
    {
      Campo: 'Erro padrão',
      Valor: dec(r.erroPadrao, 4)
    },
    {
      Campo: 'Data do resultado',
      Valor: dateBR(r.createdAt)
    }
  ];
}

function sanitationRows(d: Dados): Dados[] {
  const s = d.saneamento;

  if (!s) {
    return [
      {
        Campo: 'Saneamento',
        Valor: 'Não registrado no snapshot'
      }
    ];
  }

  return [
    ['Método', s.metodo],
    ['Média', dec(s.media, 4)],
    ['Mediana', dec(s.mediana, 4)],
    ['Desvio padrão', dec(s.desvioPadrao, 4)],
    ['Limite inferior', dec(s.limiteInferior, 4)],
    ['Limite superior', dec(s.limiteSuperior, 4)],
    ['Critério de Chauvenet', s.criterioChauvenet],
    ['Decisão técnica Chauvenet', s.decisaoChauvenet ?? 'PENDENTE'],
    ['Justificativa Chauvenet', s.justificativaChauvenet],
    ['Responsável pela decisão Chauvenet', s.decisaoChauvenetPor],
    ['Data da decisão Chauvenet', dateTimeBR(s.decisaoChauvenetEm)],
    ['Amostras sinalizadas por Chauvenet', s.outliersChauvenetJson],
    ['Critério de 30%', s.criterio30],
    ['Outliers registrados', s.outliersJson],
    ['Data de execução', dateBR(s.executadoEm)]
  ].map(([Campo, Valor]) => ({
    Campo,
    Valor: txt(Valor)
  }));
}

function exclusionRows(d: Dados): Dados[] {
  const exclusions = arr(d.exclusoes);

  if (!exclusions.length) {
    return [{
      Campo: 'Exclusões formais',
      Valor: 'Nenhuma exclusão formal registrada no snapshot'
    }];
  }

  return exclusions.map((e, i) => ({
    Ordem: i + 1,
    Amostra: txt(e.amostra?.identificador ?? e.amostraId),
    Critério: txt(e.criterio),
    Motivo: txt(e.motivo),
    Valor: money(e.valor),
    Usuário: txt(e.usuario),
    Data: dateTimeBR(e.dataExclusao),
    StatusAmostra: txt(e.amostra?.status)
  }));
}

function factorRows(d: Dados): Array<Record<string, string | undefined>> {
  const factors = arr(d.fatores);

  if (!factors.length) {
    return [{
      Fator: 'Parâmetros',
      Valor: 'Parâmetros detalhados não registrados no snapshot'
    }];
  }

  return factors.flatMap((f): Dados[] => {
    const params = arr(f.parametros);

    if (!params.length) {
      return [{
        Fator: txt(f.codigo),
        Nome: txt(f.nome),
        Fórmula: txt(f.formula),
        Parâmetro: 'Nenhum parâmetro ativo'
      }];
    }

    return params.map((p) => ({
      Fator: txt(f.codigo),
      Nome: txt(f.nome),
      Fórmula: txt(f.formula),
      Chave: txt(p.chave),
      Valor: dec(p.valor, 8),
      Unidade: txt(p.unidade),
      Justificativa: txt(p.justificativa)
    }));
  });
}

function governanceRows(d: Dados, hash: string): Dados[] {
  return [
    { Campo: 'Versão da estrutura do snapshot', Valor: txt(d.snapshotSchemaVersion) },
    { Campo: 'Versão do motor', Valor: txt(d.versaoMotor) },
    { Campo: 'Hash dos parâmetros', Valor: txt(d.parametrosHash) },
    { Campo: 'Snapshot SHA-256', Valor: hash },
    { Campo: 'Data/hora do congelamento', Valor: dateTimeBR(d.congeladoEm) },
    { Campo: 'Status congelado', Valor: txt(d.status) },
    { Campo: 'Exclusões formais registradas', Valor: String(arr(d.exclusoes).length) },
    { Campo: 'Fotografias/metadata registrados', Valor: String(arr(d.fotografias).length) },
    { Campo: 'Registros de histórico congelados', Valor: String(arr(d.historicos).length) },
    { Campo: 'Auditorias congeladas', Valor: String(arr(d.auditorias).length) }
  ];
}

function reportSections(
  d: Dados,
  hash: string
): { title: string; rows?: Dados[]; lines?: string[] }[] {
  const p = d.imovelAvaliando ?? {};
  const r = latestResult(d);
  const samples = arr(d.amostras);
  const homs = arr(d.homogeneizacoes);

  const sampleLines: string[] = [
    `Quantidade de registros no snapshot: ${samples.length}`
  ];

  samples.forEach((a, i) => {
    const h = homs.find(x => x.amostraId === a.id);

    sampleLines.push(
      `Amostra ${i + 1} — ${txt(a.identificador)}`
    );

    sampleLines.push(
      `Fonte: ${txt(a.fonte)} | URL: ${txt(a.url)} | Coleta: ${dateBR(a.dataColeta)} | Status: ${txt(a.status)}`
    );

    sampleLines.push(
      `Localização: ${txt(a.bairro)} | Situação da quadra: ${txt(a.situacaoQuadra)}`
    );

    sampleLines.push(
      `Terreno: ${dec(a.areaTerreno)} m² | Testada: ${dec(a.testada)} m | Profundidade: ${dec(a.profundidade)} m | Área edificada: ${dec(a.areaEdificada)} m² | Área privativa: ${dec(a.areaPrivativa)} m²`
    );

    sampleLines.push(
      `Oferta: ${money(a.valorOferta)} | Transação: ${money(a.valorTransacao)} | Tipo de valor: ${txt(a.tipoValor)} | Valor unitário homogeneizado: ${money(h?.valorUnitarioHomogeneizado)}`
    );

    sampleLines.push(
      `Características: padrão ${txt(a.padrao)}; conservação ${txt(a.conservacao)}; idade ${txt(a.idade)}; vagas ${txt(a.numeroVagas)}; distância do centro ${txt(a.distanciaCentro)}. Observações: ${txt(a.observacoes)}`
    );
  });

  const homLines: string[] = [
    `Quantidade de registros: ${homs.length}`
  ];

  homs.forEach(h => {
    const a = samples.find(x => x.id === h.amostraId);

    homLines.push(
      `Amostra: ${txt(a?.identificador ?? h.amostraId)} | VU original: ${money(h.valorUnitarioOriginal)} | VU homogeneizado: ${money(h.valorUnitarioHomogeneizado)}`
    );

    homLines.push(
      `Fatores: FA=${txt(h.fa)}; FT=${txt(h.ft)}; FP=${txt(h.fp)}; FO=${txt(h.fo)}; FE=${txt(h.fe)}; FI=${txt(h.fi)}; FPC=${txt(h.fpc)}; FC=${txt(h.fc)}; FELEV=${txt(h.felev)}; FG=${txt(h.fg)}; Produto=${txt(h.produtoFatores)}`
    );

    homLines.push(
      `Motor: ${txt(h.motorVersao)} | Hash parâmetros: ${txt(h.parametrosHash)} | Calculado em: ${dateBR(h.calculadoEm)}`
    );
  });

  const resultLines = r
    ? [
        `Método declarado: ${txt(r.metodo)}`,
        `Número de amostras: ${txt(r.numeroAmostras)}`,
        `Valor unitário estimado: ${money(r.valorUnitario)}`,
        `Área de referência: ${dec(r.areaReferencia)} m²`,
        `Valor total estimado: ${money(r.valorTotal)}`,
        `Média: ${money(r.media)} | Mediana: ${money(r.mediana)}`,
        `Desvio padrão: ${dec(r.desvioPadrao, 4)} | Coeficiente de variação: ${dec(r.coeficienteVariacao, 4)} | Erro padrão: ${dec(r.erroPadrao, 4)}`,
        `Data do resultado: ${dateBR(r.createdAt)}`
      ]
    : ['Não há resultado registrado no snapshot.'];

  return [
    {
      title: '1. IDENTIFICAÇÃO DA AVALIAÇÃO',
      rows: generalRows(d)
    },
    {
      title: '2. OBJETO, FINALIDADE E IDENTIFICAÇÃO DO IMÓVEL',
      rows: propertyRows(p)
    },
    {
      title: '3. PRESSUPOSTOS, RESSALVAS E LIMITAÇÕES',
      lines: [
        'Este relatório reproduz os dados disponíveis no snapshot congelado.',
        'Campos ausentes são identificados como não informados e não foram preenchidos por estimativa automática.',
        'A validade técnica depende da conferência dos documentos, da vistoria quando aplicável, da adequação da amostra, dos pressupostos do método e da revisão e responsabilidade do profissional habilitado.',
        'Não foram inferidos fatos, documentos, condições físicas ou características não presentes no snapshot.'
      ]
    },
    {
      title: '4. METODOLOGIA E PROCEDIMENTOS',
      lines: [
        `Método registrado no resultado: ${txt(r?.metodo)}`,
        `Versão do motor: ${txt(d.versaoMotor)}`,
        `Hash dos parâmetros: ${txt(d.parametrosHash)}`,
        'A metodologia descrita nesta seção limita-se ao método e aos fatores efetivamente registrados no snapshot. A escolha e justificativa técnica final devem ser validadas pelo responsável técnico.'
      ]
    },
    {
      title: '5. PESQUISA DE MERCADO E AMOSTRAS',
      lines: sampleLines
    },
    {
      title: '6. HOMOGENEIZAÇÃO E FATORES',
      lines: homLines
    },
    {
      title: '7. SANEAMENTO E TRATAMENTO DOS DADOS',
      rows: sanitationRows(d)
    },
    {
      title: '8. ANÁLISE ESTATÍSTICA E RESULTADO',
      lines: resultLines
    },
    {
      title: '9. EXCLUSÕES E DECISÕES DE SANEAMENTO',
      rows: exclusionRows(d)
    },
    {
      title: '10. PARÂMETROS E FATORES REGISTRADOS',
      rows: factorRows(d)
    },
    {
      title: '11. ESPECIFICAÇÃO DA AVALIAÇÃO',
      lines: [
        'Norma de referência estrutural: ABNT NBR 14653-1:2019 e ABNT NBR 14653-2:2011, conforme aplicabilidade ao caso concreto.',
        'Método e tratamento utilizados: somente os efetivamente registrados no snapshot.',
        'Grau de fundamentação: não determinado automaticamente pelo motor nesta versão; não deve ser inferido a partir de dados insuficientes.',
        'Grau de precisão: não determinado automaticamente pelo motor nesta versão; não deve ser apresentado como grau normativo sem os cálculos e requisitos correspondentes.',
        'A classificação normativa deve ser revisada pelo profissional responsável antes da utilização externa.'
      ]
    },
    {
      title: '12. CONCLUSÃO DE VALOR',
      lines: r
        ? [
            `Com base no resultado registrado no snapshot, o valor unitário estimado é ${money(r.valorUnitario)} e o valor total estimado é ${money(r.valorTotal)}, considerando a área de referência de ${dec(r.areaReferencia)} m².`,
            `Método: ${txt(r.metodo)}. Quantidade de amostras registrada no resultado: ${txt(r.numeroAmostras)}.`,
            'A conclusão deve ser confirmada pelo profissional responsável antes do uso externo.'
          ]
        : [
            'Não há resultado registrado no snapshot; não é possível apresentar conclusão de valor.'
          ]
    },
    {
      title: '13. QUALIFICAÇÃO E ASSINATURA DO RESPONSÁVEL TÉCNICO',
      lines: [
        `Responsável técnico: ${txt(d.responsavel)}`,
        'Registro profissional (CREA/CRECI/CAU etc.): a ser informado pelo profissional habilitado.',
        'A identificação final, a revisão, a assinatura e a responsabilidade técnica deste trabalho cabem exclusivamente ao profissional habilitado. Este documento é um artefato técnico de apoio gerado automaticamente e não constitui, por si só, assinatura ou anuência profissional.',
        `Local e data: ${txt(d.municipio)} - ${txt(d.estado)}, ${dateBR(new Date())}`
      ]
    },
    {
      title: '14. RASTREABILIDADE, INTEGRIDADE E RESPONSABILIDADE',
      lines: [
        `ID da avaliação: ${txt(d.id)}`,
        `Snapshot SHA-256: ${hash}`,
        `Data de geração do arquivo: ${dateTimeBR(new Date())}`,
        `Status no snapshot: ${txt(d.status)}`,
        `Versão do motor: ${txt(d.versaoMotor)}`,
        `Hash dos parâmetros: ${txt(d.parametrosHash)}`,
        'Este documento foi estruturado para apoiar a apresentação de uma avaliação de imóvel urbano e referencia a ABNT NBR 14653-1:2019 e a ABNT NBR 14653-2:2011. A conformidade integral não é declarada automaticamente: depende do caso concreto, da documentação, da metodologia efetivamente aplicável, da especificação alcançada e da revisão e responsabilidade do profissional habilitado.'
      ]
    }
  ];
}

export function tableColumns(rows: Dados[]): string[] {
  const cols: string[] = [];

  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!cols.includes(k)) cols.push(k);
    }
  }

  return cols;
}

function isKeyValueRows(cols: string[]): boolean {
  return (
    cols.length === 2 &&
    cols[0] === 'Campo' &&
    cols[1] === 'Valor'
  );
}

function pdfTable(
  doc: PDFKit.PDFDocument,
  rows: Dados[]
) {
  if (!rows.length) return;

  const x = 55;
  const width = 485;

  const cols = tableColumns(rows);

  if (!isKeyValueRows(cols)) {
    const cellPad = 3;
    const colWidths = cols.map(() => width / cols.length);

    const drawRow = (cells: string[], bold: boolean) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8);

      const heights = cells.map((c, i) =>
        doc.heightOfString(c, {
          width: colWidths[i] - cellPad * 2
        })
      );

      const rowHeight =
        Math.max(doc.currentLineHeight(), ...heights) + cellPad * 2;

      const pageBottom = doc.page.height - doc.page.margins.bottom;

      if (doc.y + rowHeight > pageBottom) {
        doc.addPage();
      }

      const startY = doc.y;

      cells.forEach((c, i) => {
        const cellX =
          x + colWidths.slice(0, i).reduce((a, b) => a + b, 0);

        doc.text(c, cellX + cellPad, startY + cellPad, {
          width: colWidths[i] - cellPad * 2,
          lineBreak: true
        });
      });

      for (let i = 0; i <= cols.length; i++) {
        const bx =
          x + colWidths.slice(0, i).reduce((a, b) => a + b, 0);

        doc
          .moveTo(bx, startY)
          .lineTo(bx, startY + rowHeight)
          .stroke();
      }

      doc
        .moveTo(x, startY + rowHeight)
        .lineTo(x + width, startY + rowHeight)
        .stroke();

      doc.y = startY + rowHeight;
    };

    drawRow(cols, true);

    for (const row of rows) {
      drawRow(
        cols.map(c => txt(row[c])),
        false
      );
    }

    doc.moveDown(0.15);
    return;
  }

  const col1 = 190;
  const col2 = width - col1;

  for (const row of rows) {
    const campo = txt(row.Campo);
    const valor = txt(row.Valor);

    const startY = doc.y;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(campo, x, startY, {
        width: col1,
        continued: false
      });

    const afterCampo = doc.y;

    doc
      .font('Helvetica')
      .fontSize(8)
      .text(valor, x + col1, startY, {
        width: col2,
        continued: false
      });

    const afterValor = doc.y;

    doc.y = Math.max(afterCampo, afterValor) + 3;

    doc
      .moveTo(x, doc.y)
      .lineTo(x + width, doc.y)
      .stroke();

    doc.moveDown(0.15);
  }
}

function docxTable(rows: Dados[]): Table | null {
  if (!rows.length) return null;

  const cols = tableColumns(rows);
  const keyValue = isKeyValueRows(cols);

  const makeCell = (text: string, bold: boolean) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold
            })
          ]
        })
      ]
    });

  const tableRows: TableRow[] = [];

  if (!keyValue) {
    tableRows.push(
      new TableRow({
        children: cols.map(c => makeCell(c, true))
      })
    );
  }

  for (const row of rows) {
    tableRows.push(
      new TableRow({
        children: keyValue
          ? [
              makeCell(txt(row.Campo), true),
              makeCell(txt(row.Valor), false)
            ]
          : cols.map(c => makeCell(txt(row[c]), false))
      })
    );
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '999999'
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '999999'
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '999999'
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: '999999'
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: 'CCCCCC'
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: 'CCCCCC'
      }
    },
    rows: tableRows
  });
}

function xlsxStyleWorkbook(wb: XLSX.WorkBook) {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];

    if (!ws['!ref']) continue;

    const range = XLSX.utils.decode_range(ws['!ref']);

    for (let c = range.s.c; c <= range.e.c; c++) {
      const address = XLSX.utils.encode_cell({
        r: range.s.r,
        c
      });

      if (ws[address]) {
        ws[address].s = {
          font: {
            bold: true
          },
          alignment: {
            vertical: 'center'
          }
        };
      }
    }

    ws['!freeze'] = {
      xSplit: 0,
      ySplit: 1
    };

    ws['!autofilter'] = {
      ref: ws['!ref']
    };
  }
}

export class ReportService {
  static async pdf(
    prisma: PrismaClient,
    id: string
  ) {
    const { s, data } = await snap(prisma, id);

    const sections = reportSections(
      data,
      s.hashSha256
    );

    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 58,
          bottom: 58,
          left: 55,
          right: 55
        },
        bufferPages: true,
        info: {
          Title: `Laudo de avaliação ${txt(data.numero)}`,
          Author: txt(data.responsavel),
          Subject: 'Relatório técnico de avaliação imobiliária',
          Keywords: `RoboAvaliador, ${s.hashSha256}`
        }
      });

      doc.on('data', (c: Buffer) => chunks.push(c));

      doc.on('error', reject);

      doc.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);

          const p = await saveDocument(
            prisma,
            id,
            'PDF',
            'LAUDO',
            buffer,
            s.hashSha256
          );

          resolve(p);
        } catch (e) {
          reject(e);
        }
      });

      doc
        .font('Helvetica-Bold')
        .fontSize(19)
        .text(
          'LAUDO DE AVALIAÇÃO IMOBILIÁRIA',
          {
            align: 'center'
          }
        );

      doc.moveDown(0.5);

      doc
        .font('Helvetica')
        .fontSize(10)
        .text(
          `${txt(data.numero)} — ${txt(data.titulo)}`,
          {
            align: 'center'
          }
        );

      doc.moveDown(0.4);

      doc
        .fontSize(8)
        .text(
          `Snapshot SHA-256: ${s.hashSha256}`,
          {
            align: 'center'
          }
        );

      doc.moveDown(1);

      for (const sec of sections) {
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(sec.title);

        doc.moveDown(0.25);

        if (sec.rows) {
          pdfTable(doc, sec.rows);
        }

        if (sec.lines) {
          doc
            .font('Helvetica')
            .fontSize(9);

          for (const line of sec.lines) {
            doc.text(line, {
              width: 485,
              lineGap: 2
            });

            doc.moveDown(0.08);
          }
        }

        doc.moveDown(0.65);
      }

      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(12).text('15. DADOS INTEGRAIS DO SNAPSHOT');
      doc.moveDown(0.25);
      doc.font('Helvetica').fontSize(7);
      doc.text(`SHA-256: ${s.hashSha256}`);
      doc.text('A seção abaixo reproduz integralmente o JSON congelado e validado pelo SHA-256.');
      doc.moveDown(0.3);
      doc.fontSize(6.5);
      const jsonPretty = JSON.stringify(JSON.parse(s.dadosJson), null, 2);
      doc.text(jsonPretty, { width: 485, lineGap: 0.5 });

      const range = doc.bufferedPageRange();

      for (
        let i = range.start;
        i < range.start + range.count;
        i++
      ) {
        doc.switchToPage(i);

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .text(
            `Avaliação ${txt(data.numero)} | Snapshot SHA-256: ${s.hashSha256} | Página ${i + 1 - range.start} de ${range.count}`,
            55,
            doc.page.height - 36,
            {
              width: 485,
              align: 'center'
            }
          );
      }

      doc.end();
    });
  }

  static async docx(
    prisma: PrismaClient,
    id: string
  ) {
    const { s, data } = await snap(prisma, id);

    const sections = reportSections(
      data,
      s.hashSha256
    );

    const children: Array<Paragraph | Table> = [];

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 240
        },
        children: [
          new TextRun({
            text: 'LAUDO DE AVALIAÇÃO IMOBILIÁRIA',
            bold: true,
            size: 32
          })
        ]
      })
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 180
        },
        children: [
          new TextRun({
            text: `${txt(data.numero)} — ${txt(data.titulo)}`,
            bold: true,
            size: 24
          })
        ]
      })
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 300
        },
        children: [
          new TextRun({
            text: `Snapshot SHA-256: ${s.hashSha256}`,
            size: 16
          })
        ]
      })
    );

    for (const sec of sections) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 280,
            after: 120
          },
          children: [
            new TextRun({
              text: sec.title,
              bold: true
            })
          ]
        })
      );

      if (sec.rows) {
        const table = docxTable(sec.rows);

        if (table) {
          children.push(table);
        }
      }

      if (sec.lines) {
        for (const line of sec.lines) {
          children.push(
            new Paragraph({
              spacing: {
                after: 100
              },
              children: [
                new TextRun({
                  text: line,
                  size: 20
                })
              ]
            })
          );
        }
      }
    }

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: '15. DADOS INTEGRAIS DO SNAPSHOT', bold: true })]
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `SHA-256: ${s.hashSha256}`, bold: true })]
      })
    );
    const jsonPretty = JSON.stringify(JSON.parse(s.dadosJson), null, 2);
    for (const line of jsonPretty.split('\n')) {
      children.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: line, size: 12, font: 'Courier New' })] }));
    }

    const doc = new Document({
      creator: txt(data.responsavel),
      title: `Laudo de avaliação ${txt(data.numero)}`,
      description: `Snapshot SHA-256 ${s.hashSha256}`,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1000,
                right: 1000,
                bottom: 1000,
                left: 1200
              }
            }
          },
          children
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);

    return saveDocument(
      prisma,
      id,
      'DOCX',
      'LAUDO',
      buffer,
      s.hashSha256
    );
  }

  static async xlsx(
    prisma: PrismaClient,
    id: string
  ) {
    const { s, data } = await snap(prisma, id);

    const wb = XLSX.utils.book_new();

    const p = data.imovelAvaliando ?? {};

    const add = (
      name: string,
      rows: Dados[]
    ) => {
      const dataRows = rows.length
        ? rows
        : [{ Informação: 'Sem registros no snapshot' }];

      const ws = XLSX.utils.json_to_sheet(dataRows);

      const firstRow = dataRows[0] ?? {};

      ws['!cols'] = Object.keys(firstRow).map(
        key => ({
          wch: Math.min(
            55,
            Math.max(14, key.length + 4)
          )
        })
      );

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        name.slice(0, 31)
      );
    };

    add(
      'Identificação',
      generalRows(data)
    );

    add(
      'Imóvel',
      propertyRows(p)
    );

    add(
      'Amostras',
      sampleRows(data)
    );

    add(
      'Homogeneização',
      homRows(data)
    );

    add(
      'Saneamento',
      sanitationRows(data)
    );

    add(
      'Resultado',
      resultRows(data)
    );

    add(
      'Exclusões',
      exclusionRows(data)
    );

    add(
      'Fatores',
      factorRows(data)
    );

    add('Resultados', allResultRows(data));
    add('Histórico', historyRows(data));
    add('Auditorias', auditRows(data));
    add('Fotografias', photoRows(data));
    add('Snapshot_JSON', snapshotJsonRows(s.dadosJson));

    add(
      'Especificação',
      [
        { Item: 'Referência estrutural', Valor: 'ABNT NBR 14653-1:2019 / ABNT NBR 14653-2:2011' },
        { Item: 'Grau de fundamentação', Valor: 'Não determinado automaticamente' },
        { Item: 'Grau de precisão', Valor: 'Não determinado automaticamente' },
        { Item: 'Observação', Valor: 'Revisão do profissional responsável necessária antes da emissão externa.' }
      ]
    );

    add(
      'Controle',
      [
        {
          AvaliacaoId: txt(data.id),
          Numero: txt(data.numero),
          StatusSnapshot: txt(data.status),
          StatusAtual: 'Validado no momento da emissão',
          SnapshotSHA256: s.hashSha256,
          ParametrosHash: txt(data.parametrosHash),
          VersaoMotor: txt(data.versaoMotor),
          Responsavel: txt(data.responsavel),
          GeradoEm: new Date().toISOString(),
          Aviso:
            'Planilha derivada do snapshot congelado; não substitui revisão técnica.'
        }
      ]
    );

    xlsxStyleWorkbook(wb);

    const buffer = XLSX.write(
      wb,
      {
        type: 'buffer',
        bookType: 'xlsx',
        cellDates: true
      }
    ) as Buffer;

    return saveDocument(
      prisma,
      id,
      'XLSX',
      'PLANILHA',
      buffer,
      s.hashSha256
    );
  }

  static async generateAll(
    prisma: PrismaClient,
    id: string
  ) {
    /*
     * Cada formato executa novamente a validação do snapshot.
     * Isso mantém a proteção mesmo quando PDF, DOCX ou XLSX
     * são solicitados individualmente.
     */

    const pdf = await ReportService.pdf(
      prisma,
      id
    );

    const docx = await ReportService.docx(
      prisma,
      id
    );

    const xlsx = await ReportService.xlsx(
      prisma,
      id
    );

    return {
      pdf,
      docx,
      xlsx
    };
  }
}
