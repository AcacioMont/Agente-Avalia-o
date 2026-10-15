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
  BorderStyle,
  Footer,
  PageNumber
} from 'docx';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { snapshotIntegro } from './SnapshotService.js';
import { RuleEngine } from '../engines/RuleEngine.js';
import { persistArtifactWithCompensation } from '../core/safety-primitives.js';

type Dados = Record<string, any>;

const root = path.resolve(process.cwd(), '../reports');
fs.mkdirSync(root, { recursive: true });

/* ------------------------------------------------------------------ */
/* Formatadores                                                        */
/* ------------------------------------------------------------------ */

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
  return Number.isNaN(d.getTime()) ? txt(v) : d.toLocaleDateString('pt-BR');
};

const dateTimeBR = (v: unknown): string => {
  if (!v) return 'Não informado';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? txt(v) : d.toLocaleString('pt-BR');
};

/* ------------------------------------------------------------------ */
/* Rótulos humanos (evita enum cru no laudo)                           */
/* ------------------------------------------------------------------ */

const L_STATUS: Record<string, string> = {
  EM_ELABORACAO: 'Em elaboração',
  CALCULADA: 'Calculada',
  PRONTA_PARA_EMISSAO: 'Pronta para emissão'
};
const L_QUADRA: Record<string, string> = {
  MEIO_QUADRA: 'Meio de quadra',
  ESQUINA: 'Esquina',
  MAIS_DE_UMA_FRENTE: 'Mais de uma frente'
};
const L_PADRAO: Record<string, string> = { BAIXO: 'Baixo', NORMAL: 'Normal', ALTO: 'Alto', LUXO: 'Luxo' };
const L_CONS: Record<string, string> = {
  REGULAR: 'Regular', NOVO: 'Novo', REPAROS_SIMPLES: 'Reparos simples',
  BAIXO: 'Baixo', NORMAL: 'Normal', ALTO: 'Alto'
};
const L_TVAL: Record<string, string> = { OFERTA: 'Oferta', TRANSACAO: 'Transação' };
const L_TFONTE: Record<string, string> = { MANUAL: 'Manual', PESQUISA_WEB: 'Pesquisa web' };
const L_FINALIDADE: Record<string, string> = {
  AVALIACAO: 'Avaliação imobiliária', COMPRA_VENDA: 'Compra e venda', LOCACAO: 'Locação',
  GARANTIA: 'Garantia', JUDICIAL: 'Judicial', INVENTARIO: 'Inventário', OUTRA: 'Outra finalidade'
};

const lab = (map: Record<string, string>, v: unknown) =>
  v === null || v === undefined || v === '' ? 'Não informado' : (map[String(v)] ?? String(v));

function humanChave(codigo: string, chave: unknown): string {
  const k = String(chave ?? '');
  if (codigo === 'FELEV') return k === 'ELEVADOR' ? 'Com elevador' : k === 'SEM_ELEVADOR' ? 'Sem elevador' : k;
  const mapas: Record<string, Record<string, string>> = { FE: L_QUADRA, FC: L_CONS, FPC: L_PADRAO, FO: L_TVAL };
  return mapas[codigo]?.[k] ?? k;
}

/* ------------------------------------------------------------------ */
/* Valor por extenso (pt-BR)                                           */
/* ------------------------------------------------------------------ */

const UN = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos'];

function extensoGrupo(n: number): string {
  if (n === 0) return '';
  const c = Math.floor(n / 100);
  const rest = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(n === 100 ? 'cem' : CEN[c]);
  if (rest > 0) {
    if (rest < 20) partes.push(UN[rest]);
    else {
      const d = Math.floor(rest / 10);
      const u = rest % 10;
      partes.push(u > 0 ? `${DEZ[d]} e ${UN[u]}` : DEZ[d]);
    }
  }
  return partes.join(' e ');
}

function extensoInteiro(n: number): string {
  if (n === 0) return 'zero';
  const grupos: Array<[number, string, string]> = [
    [Math.floor(n / 1000000000), 'bilhão', 'bilhões'],
    [Math.floor(n / 1000000) % 1000, 'milhão', 'milhões'],
    [Math.floor(n / 1000) % 1000, 'mil', 'mil'],
    [n % 1000, '', '']
  ];
  const partes: string[] = [];
  for (const [valor, sing, plur] of grupos) {
    if (valor === 0) continue;
    const g = extensoGrupo(valor);
    partes.push(sing ? `${g} ${valor === 1 ? sing : plur}` : g);
  }
  if (partes.length === 1) return partes[0];
  const ultima = partes[partes.length - 1];
  const cauda = grupos[3][0];
  const juncao = cauda > 0 && (cauda < 100 || cauda % 100 === 0) ? ' e ' : ', ';
  return partes.slice(0, -1).join(', ') + juncao + ultima;
}

export function valorPorExtenso(v: unknown): string {
  const n = num(v);
  if (n === null) return 'Não informado';
  const int = Math.floor(Math.abs(n));
  const cen = Math.round((Math.abs(n) - int) * 100);
  const partes: string[] = [`${extensoInteiro(int)} ${int === 1 ? 'real' : 'reais'}`];
  if (cen > 0) partes.push(`${extensoInteiro(cen)} ${cen === 1 ? 'centavo' : 'centavos'}`);
  return (n < 0 ? 'menos ' : '') + partes.join(' e ');
}

/* ------------------------------------------------------------------ */
/* Snapshot: validação e normalização                                  */
/* ------------------------------------------------------------------ */

const latestResult = (data: Dados): Dados | undefined => {
  const xs = arr(data.resultados);
  return xs.length ? xs[xs.length - 1] : undefined;
};

async function snap(prisma: PrismaClient, id: string) {
  const avaliacao = await prisma.avaliacao.findUnique({
    where: { id },
    select: { id: true, status: true, snapshotHash: true }
  });

  if (!avaliacao) throw new Error('AVALIACAO_NOT_FOUND');
  if (!avaliacao.snapshotHash) throw new Error('SNAPSHOT_HASH_AUSENTE');

  const s = await prisma.snapshot.findFirst({
    where: { avaliacaoId: id, hashSha256: avaliacao.snapshotHash },
    orderBy: { versao: 'desc' }
  });

  if (!s) throw new Error('SNAPSHOT_REQUIRED_BEFORE_EMISSION');
  if (avaliacao.status !== 'PRONTA_PARA_EMISSAO') throw new Error('AVALIACAO_NAO_PRONTA_PARA_EMISSAO');
  if (avaliacao.snapshotHash !== s.hashSha256) throw new Error('SNAPSHOT_NAO_VINCULADO_AO_ESTADO_ATUAL');
  if (!snapshotIntegro(s)) throw new Error('SNAPSHOT_INTEGRO_INVALIDO');

  const readiness = await new RuleEngine(prisma).auditarAvaliacao(id, { exigirSnapshot: true });
  if (!readiness.podeEmitir) {
    throw new Error(`AVALIACAO_NAO_APTA_PARA_EMISSAO:${JSON.stringify(readiness.alertas)}`);
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
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const nomeArquivo = `laudo-${id}-${stamp}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const caminho = path.join(root, nomeArquivo);

  const hashSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const saved = await persistArtifactWithCompensation({
    write: () => {
      fs.writeFileSync(caminho, buffer, { flag: 'wx' });
      return caminho;
    },
    persist: (arquivo: string) =>
      prisma.$transaction(async tx => {
        const doc = await tx.documento.create({
          data: { avaliacaoId: id, tipo, nomeArquivo, caminho, formato, hashSha256, snapshotHash }
        });
        await tx.auditoria.create({
          data: {
            avaliacaoId: id,
            acao: 'GERACAO_DOCUMENTO',
            entidade: 'Documento',
            entidadeId: doc.id,
            depoisJson: JSON.stringify({ formato, tipo, nomeArquivo, caminho, hashSha256, snapshotHash }),
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

/* ------------------------------------------------------------------ */
/* Modelo do laudo (blocos) — única fonte de verdade dos 3 formatos    */
/* ------------------------------------------------------------------ */

export type Bloco =
  | { t: 'h1'; x: string }
  | { t: 'h2'; x: string }
  | { t: 'p'; x: string }
  | { t: 'bullets'; items: string[] }
  | { t: 'kv'; rows: Array<[string, string]> }
  | { t: 'grid'; cols: string[]; rows: string[][] };

const T_STUDENT_80: Record<number, number> = {
  1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476,
  6: 1.440, 7: 1.415, 8: 1.397, 9: 1.383, 10: 1.372
};

function intervaloConfianca80(r: Dados): string {
  const n = num(r?.numeroAmostras) ?? 0;
  const vu = num(r?.valorUnitario);
  const ep = num(r?.erroPadrao);
  if (!n || vu === null || ep === null || ep <= 0) return 'Não determinado (dados insuficientes)';
  const t = T_STUDENT_80[n - 1] ?? 1.282;
  const delta = t * ep;
  return `${money(vu - delta)} a ${money(vu + delta)} (± ${money(delta)}, t de Student 80%, gl=${n - 1})`;
}

function chauvenetDetalhes(d: Dados): Dados[] {
  try {
    return JSON.parse(d.saneamento?.outliersChauvenetJson || '[]');
  } catch {
    return [];
  }
}

function outlierDetalhes(d: Dados): Dados[] {
  try {
    return JSON.parse(d.saneamento?.outliersJson || '[]');
  } catch {
    return [];
  }
}

/**
 * Monta o laudo completo no arranjo da série ABNT NBR 14653
 * (14653-1:2019 procedimentos gerais; 14653-2:2011 imóveis urbanos).
 */
export function montarLaudo(d: Dados, hash: string): Bloco[] {
  const p: Dados = d.imovelAvaliando ?? {};
  const r = latestResult(d);
  const amostras = arr(d.amostras);
  const ativas = amostras.filter(a => a.status === 'ATIVA');
  const homs = arr(d.homogeneizacoes);
  const san: Dados = d.saneamento ?? {};
  const exclusoes = arr(d.exclusoes);
  const fatores = arr(d.fatores);
  const auditorias = arr(d.auditorias);
  const chauv = chauvenetDetalhes(d);
  const b: Bloco[] = [];

  const endereco = [p.logradouro, p.numero, p.bairro].filter(x => x !== null && x !== undefined && x !== '').join(', ');

  /* RESUMO EXECUTIVO ------------------------------------------------- */
  b.push({ t: 'h1', x: 'RESUMO EXECUTIVO' });
  b.push({
    t: 'kv',
    rows: [
      ['Avaliação', `${txt(d.numero)} — ${txt(d.titulo)}`],
      ['Finalidade', lab(L_FINALIDADE, d.finalidade)],
      ['Imóvel avaliando', `${txt(d.tipoImovel)}${endereco ? ` — ${endereco}` : ''}, ${txt(d.municipio)}/${txt(d.estado)}`],
      ['Data de referência da avaliação', dateBR(d.dataAvaliacao)],
      ['Valor total estimado', r ? money(r.valorTotal) : 'Não determinado'],
      ['Valor unitário estimado', r ? `${money(r.valorUnitario)} por m²` : 'Não determinado'],
      ['Área de referência', r ? `${dec(r.areaReferencia)} m²` : 'Não informado'],
      ['Método', r ? 'Comparativo de dados de mercado (média após saneamento)' : 'Não informado'],
      ['Amostras utilizadas', r ? `${txt(r.numeroAmostras)} de ${ativas.length} ativas` : 'Não informado'],
      ['Coeficiente de variação', r ? `${dec(Number(r.coeficienteVariacao) * 100, 2)}%` : 'Não informado'],
      ['Intervalo de confiança (80%)', r ? intervaloConfianca80(r) : 'Não determinado'],
      ['Especificação (graus)', 'Não determinada automaticamente pelo motor — ver seção 10'],
      ['Rastreabilidade', `Snapshot SHA-256 ${hash.slice(0, 16)}… (seção 14)`]
    ]
  });
  if (r) {
    b.push({ t: 'p', x: `Valor total por extenso: ${valorPorExtenso(r.valorTotal)}.` });
  }

  /* 1. OBJETIVO ------------------------------------------------------ */
  b.push({ t: 'h1', x: '1. OBJETIVO DA AVALIAÇÃO' });
  b.push({
    t: 'p',
    x: `Determinar o valor de mercado do imóvel descrito na seção 4, para a finalidade de ${lab(L_FINALIDADE, d.finalidade).toLowerCase()}, ` +
      `com data de referência de ${dateBR(d.dataAvaliacao)}, mediante o método comparativo de dados de mercado com homogeneização ` +
      `de fatores e saneamento estatístico da amostra, conforme registrado neste laudo.`
  });

  /* 2. IDENTIFICAÇÃO ------------------------------------------------- */
  b.push({ t: 'h1', x: '2. IDENTIFICAÇÃO DO SOLICITANTE E DO RESPONSÁVEL' });
  b.push({
    t: 'kv',
    rows: [
      ['Solicitante', 'Não informado (campo não coletado nesta versão do sistema)'],
      ['Responsável pela avaliação', txt(d.responsavel)],
      ['Registro profissional', 'A ser informado pelo profissional habilitado (CREA/CRECI/CAU etc.)'],
      ['Equipe/colaboradores', 'Não informado']
    ]
  });
  b.push({
    t: 'p',
    x: 'A revisão, a assinatura e a responsabilidade técnica deste trabalho cabem exclusivamente ao profissional habilitado. ' +
      'Este laudo é um artefato técnico de apoio gerado automaticamente e não constitui, por si só, anuência profissional.'
  });

  /* 3. PRESSUPOSTOS -------------------------------------------------- */
  b.push({ t: 'h1', x: '3. PRESSUPOSTOS, RESSALVAS E LIMITAÇÕES' });
  b.push({
    t: 'bullets',
    items: [
      'Os valores refletem as informações de mercado registradas nas amostras e o estado congelado (snapshot) da avaliação.',
      'Campos não informados permanecem declarados como não informados; nenhum dado foi estimado por inferência automática.',
      'Não foram considerados documentos, matrículas, certidões, restrições convencionais ou legais não constantes deste laudo.',
      'A vistoria in loco, quando exigível, e a conferência documental são de responsabilidade do profissional habilitado.',
      'O valor refere-se à data de referência informada; oscilações de mercado posteriores não estão refletidas.',
      'Este laudo não constitui parecer jurídico, fiscal ou contábil.'
    ]
  });

  /* 4. IMÓVEL -------------------------------------------------------- */
  b.push({ t: 'h1', x: '4. DESCRIÇÃO E CARACTERIZAÇÃO DO IMÓVEL AVALIANDO' });
  b.push({
    t: 'kv',
    rows: [
      ['Tipo de imóvel', txt(d.tipoImovel)],
      ['Endereço', endereco || 'Não informado'],
      ['Município/UF', `${txt(d.municipio)}/${txt(d.estado)}`],
      ['CEP', txt(p.cep)],
      ['Matrícula', txt(p.matricula)],
      ['Cadastro imobiliário', txt(p.cadastroImobiliario)],
      ['Situação da quadra', lab(L_QUADRA, p.situacaoQuadra)],
      ['Distância do centro', num(p.distanciaCentro) === null ? 'Não informado' : `${dec(p.distanciaCentro)} km`],
      ['Área do terreno', num(p.areaTerreno) === null ? 'Não informado' : `${dec(p.areaTerreno)} m²`],
      ['Testada principal', num(p.testadaPrincipal) === null ? 'Não informado' : `${dec(p.testadaPrincipal)} m`],
      ['Profundidade informada', num(p.profundidadeInformada) === null ? 'Não informado' : `${dec(p.profundidadeInformada)} m`],
      ['Profundidade utilizada', num(p.profundidadeUtilizada) === null ? 'Não informado' : `${dec(p.profundidadeUtilizada)} m`],
      ['Área edificada privativa', num(p.areaEdificadaPrivativa) === null ? 'Não informado' : `${dec(p.areaEdificadaPrivativa)} m²`],
      ['Área edificada total', num(p.areaEdificadaTotal) === null ? 'Não informado' : `${dec(p.areaEdificadaTotal)} m²`],
      ['Padrão construtivo', lab(L_PADRAO, p.padrao)],
      ['Estado de conservação', lab(L_CONS, p.conservacao)],
      ['Idade', num(p.idade) === null ? 'Não informado' : `${dec(p.idade, 0)} anos`],
      ['Vida útil', num(p.vidaUtil) === null ? 'Não informado' : `${dec(p.vidaUtil, 0)} anos`],
      ['Elevador', txt(p.elevador)],
      ['Vagas', num(p.numeroVagas) === null ? 'Não informado' : `${dec(p.numeroVagas, 0)} (${txt(p.tipoVaga)})`],
      ['Observações', txt(p.observacoes)]
    ]
  });

  /* 5. DADOS DE MERCADO ---------------------------------------------- */
  b.push({ t: 'h1', x: '5. PESQUISA DE MERCADO E DADOS UTILIZADOS' });
  b.push({
    t: 'p',
    x: `Foram coletados ${amostras.length} registros de mercado, dos quais ${ativas.length} permanecem ativos no cálculo. ` +
      'As fontes, datas e características de cada registro estão na tabela a seguir e no Anexo A.'
  });
  b.push({
    t: 'grid',
    cols: ['Nº', 'Identificação', 'Fonte', 'Tipo', 'Coleta', 'Localização', 'Área (m²)', 'Valor (R$)', 'VU orig. (R$/m²)', 'Situação'],
    rows: amostras.map((a, i) => {
      const h = homs.find(x => x.amostraId === a.id);
      return [
        String(i + 1),
        txt(a.identificador),
        `${txt(a.fonte)} (${lab(L_TFONTE, a.tipoFonte)})`,
        lab(L_TVAL, a.tipoValor),
        dateBR(a.dataColeta),
        `${txt(a.bairro)} — ${lab(L_QUADRA, a.situacaoQuadra)}`,
        dec(a.areaTerreno),
        dec(a.tipoValor === 'OFERTA' ? a.valorOferta : a.valorTransacao),
        dec(h?.valorUnitarioOriginal),
        a.status === 'ATIVA' ? 'Ativa' : 'Excluída do cálculo'
      ];
    })
  });
  if (exclusoes.length) {
    b.push({ t: 'h2', x: '5.1 Exclusões formais da amostra' });
    b.push({
      t: 'grid',
      cols: ['Nº', 'Amostra', 'Critério', 'Motivo', 'Valor', 'Responsável', 'Data'],
      rows: exclusoes.map((e, i) => [
        String(i + 1),
        txt(e.amostra?.identificador ?? e.amostraId),
        txt(e.criterio),
        txt(e.motivo),
        money(e.valor),
        txt(e.usuario),
        dateTimeBR(e.dataExclusao)
      ])
    });
  } else {
    b.push({ t: 'p', x: 'Nenhuma exclusão formal de amostra foi registrada até o congelamento do snapshot.' });
  }

  /* 6. METODOLOGIA ---------------------------------------------------- */
  b.push({ t: 'h1', x: '6. METODOLOGIA E PROCEDIMENTOS' });
  b.push({
    t: 'p',
    x: 'Adotou-se o método comparativo de dados de mercado, com homogeneização das amostras por fatores multiplicativos ' +
      'referidos às características do imóvel avaliando, seguida de saneamento estatístico (critério de limites e critério de ' +
      'Chauvenet) e estimação do valor unitário pela média aritmética dos valores unitários homogeneizados aprovados no saneamento. ' +
      'O valor total resulta da aplicação do valor unitário à área de referência.'
  });
  b.push({ t: 'h2', x: '6.1 Fatores de homogeneização e fórmulas' });
  b.push({
    t: 'grid',
    cols: ['Fator', 'Denominação', 'Fórmula/modelo'],
    rows: fatores
      .filter(f => f.codigo !== 'REGRAS')
      .map(f => [txt(f.codigo), txt(f.nome), txt(f.formula)])
  });
  b.push({
    t: 'kv',
    rows: [
      ['Versão do motor de cálculo', txt(d.versaoMotor)],
      ['Hash dos parâmetros (SHA-256)', txt(d.parametrosHash)],
      ['Tratamento estatístico', `Saneamento ${txt(san.metodo)} com critério de Chauvenet (seção 8)`]
    ]
  });

  /* 7. HOMOGENEIZAÇÃO ------------------------------------------------- */
  b.push({ t: 'h1', x: '7. HOMOGENEIZAÇÃO DOS DADOS DE MERCADO' });
  b.push({
    t: 'p',
    x: 'Cada amostra teve seu valor unitário original multiplicado pelo produto dos fatores aplicáveis, ' +
      'obtendo-se o valor unitário homogeneizado (VU homog.). Fatores iguais a 1,0000 indicam característica ' +
      'idêntica à do imóvel avaliando ou fator não aplicável ao tipo de imóvel.'
  });
  b.push({
    t: 'grid',
    cols: ['Amostra', 'VU orig.', 'FA', 'FT', 'FP', 'FO', 'FE', 'FPC', 'FC', 'FElev', 'FG', 'FI', 'Produto', 'VU homog.'],
    rows: homs.map(h => {
      const a = amostras.find(x => x.id === h.amostraId);
      return [
        txt(a?.identificador ?? String(h.amostraId).slice(0, 8)),
        dec(h.valorUnitarioOriginal),
        dec(h.fa, 4), dec(h.ft, 4), dec(h.fp, 4), dec(h.fo, 4), dec(h.fe, 4),
        dec(h.fpc, 4), dec(h.fc, 4), dec(h.felev, 4), dec(h.fg, 4), dec(h.fi, 4),
        dec(h.produtoFatores, 4),
        dec(h.valorUnitarioHomogeneizado)
      ];
    })
  });
  b.push({
    t: 'p',
    x: 'Legenda: FA área · FT testada · FP profundidade · FO oferta/transação · FE situação da quadra · ' +
      'FPC padrão construtivo · FC conservação · FElev elevador · FG garagem · FI idade/depreciação.'
  });

  /* 8. SANEAMENTO ----------------------------------------------------- */
  b.push({ t: 'h1', x: '8. SANEAMENTO E TRATAMENTO ESTATÍSTICO DOS DADOS' });
  if (!d.saneamento) {
    b.push({ t: 'p', x: 'Saneamento não registrado no snapshot.' });
  } else {
    b.push({
      t: 'kv',
      rows: [
        ['Método de saneamento', txt(san.metodo)],
        ['Média dos VU homogeneizados', dec(san.media, 4)],
        ['Mediana', dec(san.mediana, 4)],
        ['Desvio padrão', dec(san.desvioPadrao, 4)],
        ['Coeficiente de variação', san.media ? `${dec((Number(san.desvioPadrao) / Number(san.media)) * 100, 2)}%` : 'Não informado'],
        ['Limite inferior', dec(san.limiteInferior, 4)],
        ['Limite superior', dec(san.limiteSuperior, 4)],
        ['Critério de 30% sinalizado', san.criterio30 ? 'Sim' : 'Não'],
        ['Critério de Chauvenet sinalizado', san.criterioChauvenet ? 'Sim' : 'Não'],
        ['Data de execução', dateTimeBR(san.executadoEm)]
      ]
    });
    if (chauv.length) {
      b.push({ t: 'h2', x: '8.1 Valores sinalizados pelo critério de Chauvenet' });
      b.push({
        t: 'grid',
        cols: ['Amostra', 'VU homog.', 'Desvio |z|', 'z crítico', 'Interpretação'],
        rows: chauv.map(c => [
          String((c.i ?? 0) + 1),
          dec(c.v),
          dec(c.z, 4),
          dec(c.zCritico, 4),
          Number(c.z) > Number(c.zCritico) ? 'Acima do limite de Chauvenet' : 'Dentro do limite'
        ])
      });
      b.push({
        t: 'kv',
        rows: [
          ['Decisão técnica registrada', san.decisaoChauvenet === 'MANTER_JUSTIFICADO' ? 'Manter as amostras, com justificativa' : san.decisaoChauvenet === 'EXCLUIR' ? 'Excluir as amostras sinalizadas' : 'Pendente'],
          ['Justificativa técnica', txt(san.justificativaChauvenet)],
          ['Responsável pela decisão', txt(san.decisaoChauvenetPor)],
          ['Data da decisão', dateTimeBR(san.decisaoChauvenetEm)]
        ]
      });
    } else {
      b.push({ t: 'p', x: 'O critério de Chauvenet não sinalizou valores atípicos na amostra homogeneizada.' });
    }
    const outs = outlierDetalhes(d).filter(o => o.outlier);
    if (outs.length) {
      b.push({
        t: 'p',
        x: `Amostras fora dos limites do saneamento (critério de ${txt(san.metodo)}): ${outs.map(o => `nº ${(o.i ?? 0) + 1}`).join(', ')}.`
      });
    }
  }

  /* 9. RESULTADO ------------------------------------------------------ */
  b.push({ t: 'h1', x: '9. CÁLCULO E RESULTADO DA AVALIAÇÃO' });
  if (!r) {
    b.push({ t: 'p', x: 'Não há resultado registrado no snapshot; não é possível apresentar conclusão de valor.' });
  } else {
    b.push({
      t: 'kv',
      rows: [
        ['Método de estimação', 'Média aritmética dos VU homogeneizados aprovados no saneamento'],
        ['Amostras aprovadas no cálculo', txt(r.numeroAmostras)],
        ['Valor unitário estimado', `${money(r.valorUnitario)} por m²`],
        ['Área de referência', `${dec(r.areaReferencia)} m²`],
        ['VALOR TOTAL ESTIMADO', money(r.valorTotal)],
        ['Valor total por extenso', valorPorExtenso(r.valorTotal)],
        ['Média', dec(r.media, 4)],
        ['Mediana', dec(r.mediana, 4)],
        ['Desvio padrão', dec(r.desvioPadrao, 4)],
        ['Coeficiente de variação', `${dec(Number(r.coeficienteVariacao) * 100, 2)}%`],
        ['Erro padrão da média', dec(r.erroPadrao, 4)],
        ['Intervalo de confiança (80%)', intervaloConfianca80(r)],
        ['Data do cálculo', dateTimeBR(r.createdAt)]
      ]
    });
  }

  /* 10. ESPECIFICAÇÃO -------------------------------------------------- */
  b.push({ t: 'h1', x: '10. ESPECIFICAÇÃO DA AVALIAÇÃO (GRAUS)' });
  b.push({
    t: 'bullets',
    items: [
      'Normas de referência estrutural: ABNT NBR 14653-1:2019 e ABNT NBR 14653-2:2011, conforme aplicabilidade ao caso concreto.',
      'Grau de fundamentação: não determinado automaticamente pelo motor nesta versão; a classificação exige a análise dos critérios normativos sobre a documentação e a pesquisa efetivamente utilizadas.',
      'Grau de precisão: não declarado normativamente; o intervalo de confiança da seção 9 é apresentado como medida estatística de dispersão, sem equivalência automática aos graus da norma.',
      'A classificação normativa final deve ser revisada e assumida pelo profissional responsável antes do uso externo do laudo.'
    ]
  });

  /* 11. CONCLUSÃO ------------------------------------------------------ */
  b.push({ t: 'h1', x: '11. CONCLUSÃO DE VALOR' });
  b.push({
    t: 'p',
    x: r
      ? `Diante do exposto, para a finalidade e a data de referência declaradas, o valor de mercado estimado do imóvel avaliando é de ` +
        `${money(r.valorTotal)} (${valorPorExtenso(r.valorTotal)}), correspondente ao valor unitário de ${money(r.valorUnitario)} por m² ` +
        `aplicado à área de referência de ${dec(r.areaReferencia)} m², obtido pelo método comparativo com ${txt(r.numeroAmostras)} amostras ` +
        `aprovadas no saneamento estatístico.`
      : 'Não há resultado válido registrado no snapshot; a conclusão de valor fica impossibilitada.'
  });
  b.push({
    t: 'p',
    x: 'A conclusão deve ser confirmada pelo profissional habilitado, que responderá tecnicamente pelo trabalho após revisão da documentação, da pesquisa e dos pressupostos aqui registrados.'
  });

  /* 12. ASSINATURA ------------------------------------------------------ */
  b.push({ t: 'h1', x: '12. QUALIFICAÇÃO E ASSINATURA DO RESPONSÁVEL TÉCNICO' });
  b.push({
    t: 'kv',
    rows: [
      ['Responsável técnico', txt(d.responsavel)],
      ['Registro profissional', '________________________________ (CREA/CRECI/CAU etc.)'],
      ['Assinatura', '________________________________'],
      ['Local e data', `${txt(d.municipio)}/${txt(d.estado)}, ${dateBR(new Date())}`]
    ]
  });

  /* 13/14 handled below: anexos first, traceability last ---------------- */

  /* ANEXO A ------------------------------------------------------------- */
  b.push({ t: 'h1', x: 'ANEXO A — QUADRO COMPLETO DAS AMOSTRAS DE MERCADO' });
  b.push({
    t: 'grid',
    cols: ['Nº', 'Identificação', 'Fonte/URL', 'Características', 'Valores', 'Observações'],
    rows: amostras.map((a, i) => [
      String(i + 1),
      `${txt(a.identificador)}\n${txt(a.bairro)} — ${lab(L_QUADRA, a.situacaoQuadra)}`,
      `${txt(a.fonte)} (${lab(L_TFONTE, a.tipoFonte)})\n${txt(a.url)}\nColeta: ${dateBR(a.dataColeta)}`,
      `Área ${dec(a.areaTerreno)} m² · testada ${dec(a.testada)} m · prof. ${dec(a.profundidade)} m\n` +
        `Padrão ${lab(L_PADRAO, a.padrao)} · conservação ${lab(L_CONS, a.conservacao)}\n` +
        `Idade ${dec(a.idade, 0)} anos · vagas ${dec(a.numeroVagas, 0)} · elevador ${txt(a.elevador)}`,
      `${lab(L_TVAL, a.tipoValor)}: ${money(a.tipoValor === 'OFERTA' ? a.valorOferta : a.valorTransacao)}\n` +
        `VU original: ${money((() => { const h = homs.find(x => x.amostraId === a.id); return h?.valorUnitarioOriginal; })())}\n` +
        `VU homog.: ${money((() => { const h = homs.find(x => x.amostraId === a.id); return h?.valorUnitarioHomogeneizado; })())}`,
      txt(a.observacoes)
    ])
  });

  /* ANEXO B ------------------------------------------------------------- */
  b.push({ t: 'h1', x: 'ANEXO B — PARÂMETROS E FATORES CONGELADOS NO SNAPSHOT' });
  b.push({
    t: 'grid',
    cols: ['Fator', 'Denominação', 'Parâmetro', 'Valor', 'Unidade', 'Justificativa'],
    rows: fatores.flatMap(f =>
      arr(f.parametros).length
        ? arr(f.parametros).map(pp => [txt(f.codigo), txt(f.nome), humanChave(f.codigo, pp.chave), dec(pp.valor, 8), txt(pp.unidade), txt(pp.justificativa)])
        : [[txt(f.codigo), txt(f.nome), 'Nenhum parâmetro ativo', '—', '—', '—']]
    )
  });

  /* ANEXO C ------------------------------------------------------------- */
  b.push({ t: 'h1', x: 'ANEXO C — TRILHA DE AUDITORIA CONGELADA' });
  b.push({
    t: 'grid',
    cols: ['Data/hora', 'Ação', 'Entidade', 'Responsável', 'Motivo/registro'],
    rows: auditorias.map(a => [
      dateTimeBR(a.dataHora),
      txt(a.acao),
      txt(a.entidade),
      txt(a.usuario),
      txt(a.motivo)
    ])
  });

  /* 14. RASTREABILIDADE -------------------------------------------------- */
  b.push({ t: 'h1', x: '14. RASTREABILIDADE, INTEGRIDADE E RESPONSABILIDADE' });
  b.push({
    t: 'kv',
    rows: [
      ['Identificador da avaliação', txt(d.id)],
      ['Snapshot SHA-256', hash],
      ['Versão da estrutura do snapshot', txt(d.snapshotSchemaVersion)],
      ['Data/hora do congelamento', dateTimeBR(d.congeladoEm)],
      ['Estado técnico ao congelamento', lab(L_STATUS, d.status)],
      ['Versão do motor', txt(d.versaoMotor)],
      ['Hash dos parâmetros', txt(d.parametrosHash)],
      ['Registros congelados', `${amostras.length} amostras · ${homs.length} homogeneizações · ${exclusoes.length} exclusões · ${auditorias.length} auditorias · ${arr(d.fotografias).length} fotografias`],
      ['Data/hora de geração deste arquivo', dateTimeBR(new Date())]
    ]
  });
  b.push({
    t: 'p',
    x: 'Este documento foi estruturado para apoiar a apresentação de avaliação de imóvel urbano nos moldes da ABNT NBR 14653-1:2019 ' +
      'e da ABNT NBR 14653-2:2011. A conformidade integral não é declarada automaticamente: depende do caso concreto, da documentação, ' +
      'da metodologia efetivamente aplicável, da especificação alcançada e da revisão e responsabilidade do profissional habilitado. ' +
      'O conteúdo técnico reproduzido aqui é o estado congelado validado pelo SHA-256 acima; o JSON integral do snapshot permanece ' +
      'disponível na planilha XLSX (aba Snapshot_JSON) e no banco de dados do sistema.'
  });

  return b;
}

function capaBloco(d: Dados, hash: string): { titulo: string; linhas: string[] } {
  const p: Dados = d.imovelAvaliando ?? {};
  const endereco = [p.logradouro, p.numero, p.bairro].filter(x => x !== null && x !== undefined && x !== '').join(', ');
  return {
    titulo: 'LAUDO DE AVALIAÇÃO DE IMÓVEL',
    linhas: [
      `${txt(d.numero)} — ${txt(d.titulo)}`,
      lab(L_FINALIDADE, d.finalidade),
      `${txt(d.tipoImovel)}${endereco ? ` — ${endereco}` : ''}`,
      `${txt(d.municipio)}/${txt(d.estado)}`,
      `Data de referência: ${dateBR(d.dataAvaliacao)}`,
      `Responsável: ${txt(d.responsavel)}`,
      `Motor de cálculo v${txt(d.versaoMotor)}`,
      `Snapshot SHA-256: ${hash.slice(0, 24)}…`,
      `Emitido em ${dateTimeBR(new Date())}`
    ]
  };
}

/* ------------------------------------------------------------------ */
/* Renderizador PDF                                                    */
/* ------------------------------------------------------------------ */

const PDF_X = 55;
const PDF_W = 485;

function pdfKV(doc: PDFKit.PDFDocument, rows: Array<[string, string]>) {
  const col1 = 175;
  const col2 = PDF_W - col1;
  for (const [campo, valor] of rows) {
    const startY = doc.y;
    const hCampo = doc.font('Helvetica-Bold').fontSize(8.5).heightOfString(campo, { width: col1 });
    const hValor = doc.font('Helvetica').fontSize(8.5).heightOfString(valor, { width: col2 });
    const rowH = Math.max(hCampo, hValor) + 6;
    if (startY + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).text(campo, PDF_X, y, { width: col1 });
    doc.font('Helvetica').fontSize(8.5).text(valor, PDF_X + col1, y, { width: col2 });
    doc.y = y + rowH;
    doc.moveTo(PDF_X, doc.y - 2).lineTo(PDF_X + PDF_W, doc.y - 2).strokeColor('#CCCCCC').stroke();
  }
  doc.x = PDF_X;
  doc.moveDown(0.4);
}

function pdfGrid(doc: PDFKit.PDFDocument, cols: string[], rows: string[][]) {
  const fontSize = cols.length > 8 ? 6.8 : cols.length > 6 ? 7.4 : 8;
  const pad = 3;
  const widths = cols.map(() => PDF_W / cols.length);
  const drawRow = (cells: string[], bold: boolean, fill?: string) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    const heights = cells.map((c, i) => doc.heightOfString(c, { width: widths[i] - pad * 2 }));
    const rowH = Math.max(doc.currentLineHeight(), ...heights) + pad * 2;
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(fontSize);
      const y0 = doc.y;
      let cx = PDF_X;
      cols.forEach((c, i) => { doc.text(c, cx + pad, y0 + pad, { width: widths[i] - pad * 2 }); cx += widths[i]; });
      doc.y = y0 + rowH;
      doc.moveTo(PDF_X, y0).lineTo(PDF_X + PDF_W, y0).strokeColor('#999999').stroke();
    }
    const y = doc.y;
    if (fill) doc.rect(PDF_X, y, PDF_W, rowH).fill(fill);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    let cx = PDF_X;
    cells.forEach((c, i) => { doc.text(c, cx + pad, y + pad, { width: widths[i] - pad * 2 }); cx += widths[i]; });
    doc.y = y + rowH;
    let bx = PDF_X;
    for (let i = 0; i <= cols.length; i++) {
      doc.moveTo(bx, y).lineTo(bx, y + rowH).strokeColor('#CCCCCC').stroke();
      bx += widths[i] ?? 0;
    }
    doc.moveTo(PDF_X, y + rowH).lineTo(PDF_X + PDF_W, y + rowH).strokeColor('#CCCCCC').stroke();
  };
  drawRow(cols, true, '#EEEEEE');
  for (const row of rows) drawRow(row, false);
  doc.x = PDF_X;
  doc.moveDown(0.5);
}

function renderPDF(d: Dados, hash: string): Promise<Buffer> {
  const blocos = montarLaudo(d, hash);
  const capa = capaBloco(d, hash);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 84, left: PDF_X, right: PDF_X },
      bufferPages: true,
      info: {
        Title: `Laudo de avaliação ${txt(d.numero)}`,
        Author: txt(d.responsavel),
        Subject: 'Laudo de avaliação de imóvel — método comparativo (ABNT NBR 14653)',
        Keywords: `RoboAvaliador, ${hash}`
      }
    });

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    /* capa */
    doc.moveDown(6);
    doc.font('Helvetica-Bold').fontSize(21).fillColor('#111111').text(capa.titulo, PDF_X, doc.y, { width: PDF_W, align: 'center' });
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(11).fillColor('#333333');
    for (const linha of capa.linhas) {
      doc.text(linha, PDF_X, doc.y, { width: PDF_W, align: 'center' });
      doc.moveDown(0.25);
    }
    doc.moveDown(2);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555555')
      .text('Relatório técnico gerado automaticamente a partir de snapshot congelado e íntegro. ' +
        'Sujeito a revisão e responsabilidade do profissional habilitado.', PDF_X, doc.y, { width: PDF_W, align: 'center' });
    doc.addPage();
    doc.fillColor('#111111');

    /* corpo */
    for (const bl of blocos) {
      if (bl.t === 'h1') {
        if (doc.y > doc.page.height - 160) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text(bl.x, PDF_X, doc.y, { width: PDF_W });
        doc.moveDown(0.35);
      } else if (bl.t === 'h2') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#222222').text(bl.x, PDF_X, doc.y, { width: PDF_W });
        doc.moveDown(0.25);
      } else if (bl.t === 'p') {
        doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(bl.x, PDF_X, doc.y, { width: PDF_W, align: 'justify', lineGap: 1.5 });
        doc.moveDown(0.45);
      } else if (bl.t === 'bullets') {
        doc.font('Helvetica').fontSize(9.5).fillColor('#111111');
        for (const item of bl.items) {
          doc.text(`•  ${item}`, PDF_X + 6, doc.y, { width: PDF_W - 6, lineGap: 1 });
          doc.moveDown(0.15);
        }
        doc.moveDown(0.4);
      } else if (bl.t === 'kv') {
        pdfKV(doc, bl.rows);
      } else if (bl.t === 'grid') {
        pdfGrid(doc, bl.cols, bl.rows);
      }
      doc.x = PDF_X;
    }

    /* rodapé numerado nas páginas buffers */
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // O pdfkit quebra de página quando o texto começa abaixo da margem inferior.
      // Alargamos a margem só durante o desenho do rodapé para posicioná-lo na faixa
      // reservada (o conteúdo flui até maxY antigo, acima do rodapé).
      const pagina = doc.page as PDFKit.PDFDocument['page'] & { margins: { bottom: number } };
      const margemOriginal = pagina.margins.bottom;
      pagina.margins.bottom = 30;
      doc.font('Helvetica').fontSize(7.5).fillColor('#666666');
      doc.text(
        `Laudo ${txt(d.numero)} · Snapshot SHA-256 ${hash.slice(0, 12)}… · Página ${i + 1 - range.start} de ${range.count}`,
        PDF_X,
        doc.page.height - 46,
        { width: PDF_W, align: 'center', lineBreak: false }
      );
      pagina.margins.bottom = margemOriginal;
    }
    doc.fillColor('#111111');
    doc.end();
  });
}

/* ------------------------------------------------------------------ */
/* Renderizador DOCX                                                   */
/* ------------------------------------------------------------------ */

const BORDAS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
} as const;

function docxCell(text: string, bold: boolean, size = 16): TableCell {
  return new TableCell({
    children: String(text).split('\n').map(linha =>
      new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: linha, bold, size })] })
    )
  });
}

function docxKV(rows: Array<[string, string]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDAS,
    rows: rows.map(([c, v]) =>
      new TableRow({ children: [docxCell(c, true, 18), docxCell(v, false, 18)] })
    )
  });
}

function docxGrid(cols: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDAS,
    rows: [
      new TableRow({ children: cols.map(c => docxCell(c, true)) }),
      ...rows.map(r => new TableRow({ children: r.map(c => docxCell(c, false)) }))
    ]
  });
}

async function renderDOCX(d: Dados, hash: string): Promise<Buffer> {
  const blocos = montarLaudo(d, hash);
  const capa = capaBloco(d, hash);
  const children: Array<Paragraph | Table> = [];

  children.push(new Paragraph({ spacing: { before: 2400, after: 240 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: capa.titulo, bold: true, size: 40 })] }));
  for (const linha of capa.linhas) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: linha, size: 22 })] }));
  }
  children.push(new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Relatório técnico gerado automaticamente a partir de snapshot congelado e íntegro. Sujeito a revisão e responsabilidade do profissional habilitado.', italics: true, size: 18 })] }));
  children.push(new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: '' })] }));

  for (const bl of blocos) {
    if (bl.t === 'h1') {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 120 }, children: [new TextRun({ text: bl.x, bold: true })] }));
    } else if (bl.t === 'h2') {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: bl.x, bold: true })] }));
    } else if (bl.t === 'p') {
      children.push(new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: bl.x, size: 20 })] }));
    } else if (bl.t === 'bullets') {
      for (const item of bl.items) {
        children.push(new Paragraph({ spacing: { after: 60 }, bullet: { level: 0 }, children: [new TextRun({ text: item, size: 20 })] }));
      }
    } else if (bl.t === 'kv') {
      children.push(docxKV(bl.rows));
      children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: '' })] }));
    } else if (bl.t === 'grid') {
      children.push(docxGrid(bl.cols, bl.rows));
      children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: '' })] }));
    }
  }

  const doc = new Document({
    creator: txt(d.responsavel),
    title: `Laudo de avaliação ${txt(d.numero)}`,
    description: `Snapshot SHA-256 ${hash}`,
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1100, left: 1200 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Laudo ${txt(d.numero)} · Snapshot SHA-256 ${hash.slice(0, 12)}… · Página `, size: 14, color: '666666' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '666666' }),
              new TextRun({ text: ' de ', size: 14, color: '666666' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '666666' })
            ]
          })]
        })
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

/* ------------------------------------------------------------------ */
/* Renderizador XLSX                                                   */
/* ------------------------------------------------------------------ */

function xlsxStyleWorkbook(wb: XLSX.WorkBook) {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let c = range.s.c; c <= range.e.c; c++) {
      const address = XLSX.utils.encode_cell({ r: range.s.r, c });
      if (ws[address]) {
        ws[address].s = { font: { bold: true }, alignment: { vertical: 'center' } };
      }
    }
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  }
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

function laudoSheetAOA(d: Dados, hash: string): (string | number)[][] {
  const aoa: (string | number)[][] = [];
  const capa = capaBloco(d, hash);
  aoa.push([capa.titulo]);
  for (const l of capa.linhas) aoa.push([l]);
  aoa.push([]);
  for (const bl of montarLaudo(d, hash)) {
    if (bl.t === 'h1' || bl.t === 'h2') aoa.push([bl.x]);
    else if (bl.t === 'p') aoa.push([bl.x]);
    else if (bl.t === 'bullets') bl.items.forEach(i => aoa.push(['• ' + i]));
    else if (bl.t === 'kv') bl.rows.forEach(([c, v]) => aoa.push([c, v]));
    else if (bl.t === 'grid') {
      aoa.push(bl.cols);
      bl.rows.forEach(r => aoa.push(r));
    }
    aoa.push([]);
  }
  return aoa;
}

function renderXLSX(d: Dados, hash: string, dadosJson: string): Buffer {
  const wb = XLSX.utils.book_new();
  const p: Dados = d.imovelAvaliando ?? {};

  const laudo = XLSX.utils.aoa_to_sheet(laudoSheetAOA(d, hash));
  laudo['!cols'] = [{ wch: 42 }, { wch: 60 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, laudo, 'Laudo');

  const add = (name: string, rows: Dados[]) => {
    const dataRows = rows.length ? rows : [{ Informação: 'Sem registros no snapshot' }];
    const ws = XLSX.utils.json_to_sheet(dataRows);
    const firstRow = dataRows[0] ?? {};
    ws['!cols'] = Object.keys(firstRow).map(key => ({ wch: Math.min(55, Math.max(14, key.length + 4)) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  const homs = arr(d.homogeneizacoes);

  add('Imóvel', Object.entries({
    Tipo: txt(d.tipoImovel), Logradouro: txt(p.logradouro), Numero: txt(p.numero), Bairro: txt(p.bairro),
    Municipio: txt(d.municipio), UF: txt(d.estado), CEP: txt(p.cep), Matricula: txt(p.matricula),
    Cadastro: txt(p.cadastroImobiliario), SituacaoQuadra: lab(L_QUADRA, p.situacaoQuadra),
    AreaTerreno_m2: p.areaTerreno ?? null, Testada_m: p.testadaPrincipal ?? null,
    ProfundidadeUtilizada_m: p.profundidadeUtilizada ?? null, Padrao: lab(L_PADRAO, p.padrao),
    Conservacao: lab(L_CONS, p.conservacao), Idade_anos: p.idade ?? null, VidaUtil_anos: p.vidaUtil ?? null,
    Elevador: txt(p.elevador), Vagas: p.numeroVagas ?? null, Observacoes: txt(p.observacoes)
  }).map(([Campo, Valor]) => ({ Campo, Valor: txt(Valor) })));

  add('Amostras', arr(d.amostras).map((a, i) => {
    const h = homs.find(x => x.amostraId === a.id);
    return {
      N: i + 1,
      Identificador: txt(a.identificador),
      Fonte: txt(a.fonte),
      TipoFonte: lab(L_TFONTE, a.tipoFonte),
      URL: txt(a.url),
      Coleta: dateBR(a.dataColeta),
      Bairro: txt(a.bairro),
      SituacaoQuadra: lab(L_QUADRA, a.situacaoQuadra),
      Area_m2: a.areaTerreno ?? null,
      Testada_m: a.testada ?? null,
      Profundidade_m: a.profundidade ?? null,
      Padrao: lab(L_PADRAO, a.padrao),
      Conservacao: lab(L_CONS, a.conservacao),
      TipoValor: lab(L_TVAL, a.tipoValor),
      Valor: a.tipoValor === 'OFERTA' ? a.valorOferta ?? null : a.valorTransacao ?? null,
      VU_Original: h?.valorUnitarioOriginal ?? null,
      VU_Homogeneizado: h?.valorUnitarioHomogeneizado ?? null,
      Situacao: a.status === 'ATIVA' ? 'Ativa' : 'Excluída',
      Observacoes: txt(a.observacoes)
    };
  }));

  add('Homogeneização', homs.map((h, i) => {
    const a = arr(d.amostras).find(x => x.id === h.amostraId);
    return {
      N: i + 1,
      Amostra: txt(a?.identificador ?? h.amostraId),
      VU_Original: h.valorUnitarioOriginal,
      FA: h.fa, FT: h.ft, FP: h.fp, FO: h.fo, FE: h.fe, FPC: h.fpc, FC: h.fc,
      FELEV: h.felev, FG: h.fg, FI: h.fi,
      Produto: h.produtoFatores,
      VU_Homogeneizado: h.valorUnitarioHomogeneizado
    };
  }));

  const r = latestResult(d);
  add('Resultado', r ? [{
    Campo: 'Método', Valor: 'Média aritmética após saneamento'
  }, {
    Campo: 'Amostras aprovadas', Valor: txt(r.numeroAmostras)
  }, {
    Campo: 'Valor unitário (R$/m²)', Valor: txt(r.valorUnitario)
  }, {
    Campo: 'Área de referência (m²)', Valor: txt(r.areaReferencia)
  }, {
    Campo: 'VALOR TOTAL (R$)', Valor: txt(r.valorTotal)
  }, {
    Campo: 'Valor por extenso', Valor: valorPorExtenso(r.valorTotal)
  }, {
    Campo: 'Coeficiente de variação', Valor: txt(r.coeficienteVariacao)
  }, {
    Campo: 'Erro padrão', Valor: txt(r.erroPadrao)
  }, {
    Campo: 'Intervalo de confiança 80%', Valor: intervaloConfianca80(r)
  }] : [{ Campo: 'Resultado', Valor: 'Não registrado no snapshot' }]);

  add('Saneamento', d.saneamento ? [{
    Campo: 'Método', Valor: txt(d.saneamento.metodo)
  }, {
    Campo: 'Média', Valor: txt(d.saneamento.media)
  }, {
    Campo: 'Mediana', Valor: txt(d.saneamento.mediana)
  }, {
    Campo: 'Desvio padrão', Valor: txt(d.saneamento.desvioPadrao)
  }, {
    Campo: 'Limite inferior', Valor: txt(d.saneamento.limiteInferior)
  }, {
    Campo: 'Limite superior', Valor: txt(d.saneamento.limiteSuperior)
  }, {
    Campo: 'Chauvenet sinalizado', Valor: d.saneamento.criterioChauvenet ? 'Sim' : 'Não'
  }, {
    Campo: 'Decisão técnica', Valor: txt(d.saneamento.decisaoChauvenet ?? 'PENDENTE')
  }, {
    Campo: 'Justificativa', Valor: txt(d.saneamento.justificativaChauvenet)
  }, {
    Campo: 'Responsável pela decisão', Valor: txt(d.saneamento.decisaoChauvenetPor)
  }, {
    Campo: 'Data da decisão', Valor: dateTimeBR(d.saneamento.decisaoChauvenetEm)
  }] : [{ Campo: 'Saneamento', Valor: 'Não registrado no snapshot' }]);

  add('Exclusões', arr(d.exclusoes).map((e, i) => ({
    N: i + 1,
    Amostra: txt(e.amostra?.identificador ?? e.amostraId),
    Criterio: txt(e.criterio),
    Motivo: txt(e.motivo),
    Valor: e.valor ?? null,
    Usuario: txt(e.usuario),
    Data: dateTimeBR(e.dataExclusao)
  })));

  add('Fatores', arr(d.fatores).flatMap(f =>
    arr(f.parametros).length
      ? arr(f.parametros).map(pp => ({ Fator: txt(f.codigo), Nome: txt(f.nome), Formula: txt(f.formula), Chave: humanChave(f.codigo, pp.chave), Valor: pp.valor ?? null, Unidade: txt(pp.unidade), Justificativa: txt(pp.justificativa) }))
      : [{ Fator: txt(f.codigo), Nome: txt(f.nome), Formula: txt(f.formula), Chave: '—', Valor: null, Unidade: '—', Justificativa: '—' }]
  ));

  add('Auditoria', arr(d.auditorias).map((a, i) => ({
    N: i + 1,
    DataHora: dateTimeBR(a.dataHora),
    Acao: txt(a.acao),
    Entidade: txt(a.entidade),
    Usuario: txt(a.usuario),
    Motivo: txt(a.motivo)
  })));

  add('Controle', [{
    AvaliacaoId: txt(d.id),
    Numero: txt(d.numero),
    StatusSnapshot: lab(L_STATUS, d.status),
    StatusAtual: 'Validado no momento da emissão',
    SnapshotSHA256: hash,
    ParametrosHash: txt(d.parametrosHash),
    VersaoMotor: txt(d.versaoMotor),
    Responsavel: txt(d.responsavel),
    GeradoEm: new Date().toISOString(),
    Aviso: 'Planilha derivada do snapshot congelado; não substitui revisão técnica.'
  }]);

  const chunkSize = 30000;
  const snapRows: Dados[] = [];
  for (let i = 0, parte = 1; i < dadosJson.length; i += chunkSize, parte++) {
    snapRows.push({ Parte: parte, Inicio: i, Fim: Math.min(i + chunkSize, dadosJson.length), JSON: dadosJson.slice(i, i + chunkSize) });
  }
  add('Snapshot_JSON', snapRows);

  xlsxStyleWorkbook(wb);

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true }) as Buffer;
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

export class ReportService {
  static async pdf(prisma: PrismaClient, id: string) {
    const { s, data } = await snap(prisma, id);
    const buffer = await renderPDF(data, s.hashSha256);
    return saveDocument(prisma, id, 'PDF', 'LAUDO', buffer, s.hashSha256);
  }

  static async docx(prisma: PrismaClient, id: string) {
    const { s, data } = await snap(prisma, id);
    const buffer = await renderDOCX(data, s.hashSha256);
    return saveDocument(prisma, id, 'DOCX', 'LAUDO', buffer, s.hashSha256);
  }

  static async xlsx(prisma: PrismaClient, id: string) {
    const { s, data } = await snap(prisma, id);
    const buffer = renderXLSX(data, s.hashSha256, s.dadosJson);
    return saveDocument(prisma, id, 'XLSX', 'PLANILHA', buffer, s.hashSha256);
  }

  static async generateAll(prisma: PrismaClient, id: string) {
    /*
     * Cada formato executa novamente a validação do snapshot.
     * Isso mantém a proteção mesmo quando PDF, DOCX ou XLSX
     * são solicitados individualmente.
     */
    const pdf = await ReportService.pdf(prisma, id);
    const docx = await ReportService.docx(prisma, id);
    const xlsx = await ReportService.xlsx(prisma, id);
    return { pdf, docx, xlsx };
  }
}
