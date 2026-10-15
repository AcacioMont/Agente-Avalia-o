import { PrismaClient } from '@prisma/client';
import { calcularHashSnapshot, evaluateChauvenetEmissionGate } from './safety-primitives.js';
import { loadSystemParameters } from '../services/ParameterService.js';

export type Severidade = 'CRITICO' | 'ALERTA' | 'INFO';
export interface AlertaAuditoria {
  codigo: string;
  severidade: Severidade;
  titulo: string;
  mensagem: string;
}
export interface ResultadoAuditoria {
  podeEmitir: boolean;
  alertas: AlertaAuditoria[];
}

export class RuleEngine {
  constructor(private readonly prisma: PrismaClient) {}

  async auditarAvaliacao(
    avaliacaoId: string,
    options: { exigirSnapshot?: boolean } = {}
  ): Promise<ResultadoAuditoria> {
    const exigirSnapshot = options.exigirSnapshot ?? true;
    const alertas: AlertaAuditoria[] = [];

    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id: avaliacaoId },
      include: {
        imovelAvaliando: true,
        amostras: { include: { homogeneizacao: true, exclusao: true } },
        saneamento: true,
        resultados: true
      }
    });

    if (!avaliacao) {
      return {
        podeEmitir: false,
        alertas: [{
          codigo: 'SYS001',
          severidade: 'CRITICO',
          titulo: 'Avaliação inexistente',
          mensagem: 'A avaliação não foi localizada.'
        }]
      };
    }

    if (!avaliacao.imovelAvaliando) {
      alertas.push({ codigo: 'VAL001', severidade: 'CRITICO', titulo: 'Imóvel avaliando ausente', mensagem: 'O imóvel avaliando deve estar cadastrado.' });
    } else {
      const av = avaliacao.imovelAvaliando;
      if (!(Number(av.areaTerreno) > 0)) alertas.push({ codigo: 'VAL002', severidade: 'CRITICO', titulo: 'Área inválida', mensagem: 'A área do terreno deve ser maior que zero.' });
      if (!(Number(av.testadaPrincipal) > 0)) alertas.push({ codigo: 'VAL003', severidade: 'CRITICO', titulo: 'Testada inválida', mensagem: 'A testada principal deve ser maior que zero.' });
      if (!(Number(av.profundidadeUtilizada) > 0)) alertas.push({ codigo: 'VAL004', severidade: 'CRITICO', titulo: 'Profundidade inválida', mensagem: 'A profundidade utilizada deve ser maior que zero.' });
    }

    const sistema = await loadSystemParameters(this.prisma);
    const minAmostras = sistema.minAmostras;
    const ativas = avaliacao.amostras.filter(a => a.status === 'ATIVA');

    if (ativas.length < minAmostras) {
      alertas.push({
        codigo: 'AMO001',
        severidade: 'CRITICO',
        titulo: 'Amostras ativas insuficientes',
        mensagem: `Existem ${ativas.length} amostras ativas. O mínimo configurado é ${minAmostras}.`
      });
    }

    for (const [index, am] of ativas.entries()) {
      const valor = am.tipoValor === 'OFERTA' ? Number(am.valorOferta ?? 0) : Number(am.valorTransacao ?? 0);
      if (!(valor > 0)) alertas.push({ codigo: 'AMO002', severidade: 'CRITICO', titulo: `Amostra ${index + 1} sem valor`, mensagem: 'A amostra precisa ter valor compatível com seu tipo de valor.' });
      if (!(Number(am.areaTerreno) > 0)) alertas.push({ codigo: 'AMO003', severidade: 'CRITICO', titulo: `Amostra ${index + 1} com área inválida`, mensagem: 'A área da amostra deve ser maior que zero.' });
      if (!am.homogeneizacao) alertas.push({ codigo: 'FAT001', severidade: 'CRITICO', titulo: `Amostra ${index + 1} sem homogeneização`, mensagem: 'A amostra ativa ainda não possui cálculo válido.' });
    }

    if (!avaliacao.saneamento) {
      alertas.push({ codigo: 'SAN001', severidade: 'CRITICO', titulo: 'Saneamento inexistente', mensagem: 'O saneamento deve ser executado antes da emissão.' });
    } else {
      try {
        const outliers = JSON.parse(avaliacao.saneamento.outliersJson || '[]') as Array<{ i?: number; outlier?: boolean }>;
        const chauvenet = JSON.parse(avaliacao.saneamento.outliersChauvenetJson || '[]') as Array<{ i?: number; v?: number; z?: number; zCritico?: number }>;
        const gate = evaluateChauvenetEmissionGate(
          avaliacao.saneamento.criterioChauvenet,
          avaliacao.saneamento.decisaoChauvenet
        );

        if (gate.blocked) {
          if (gate.code === 'SAN006') {
            alertas.push({
              codigo: 'SAN006',
              severidade: 'CRITICO',
              titulo: 'Chauvenet com decisão de exclusão pendente de formalização',
              mensagem: 'A decisão técnica determinou exclusão. Formalize a exclusão das amostras sinalizadas e recalcule antes da emissão.'
            });
          } else {
            const detalhes = chauvenet.length
              ? ` Amostras sinalizadas: ${chauvenet.map(x => (x.i ?? -1) + 1).join(', ')}.`
              : ' O registro é legado e não contém a identificação das amostras sinalizadas.';
            alertas.push({
              codigo: 'SAN004',
              severidade: 'CRITICO',
              titulo: 'Critério de Chauvenet requer decisão técnica',
              mensagem: `O saneamento sinalizou valores pelo critério de Chauvenet.${detalhes} Registre uma decisão técnica fundamentada antes da emissão.`
            });
          }
        } else if (avaliacao.saneamento.criterioChauvenet && avaliacao.saneamento.decisaoChauvenet === 'MANTER_JUSTIFICADO') {
          alertas.push({
            codigo: 'SAN005',
            severidade: 'INFO',
            titulo: 'Chauvenet mantido por decisão técnica',
            mensagem: `O critério de Chauvenet foi sinalizado, mas as amostras foram mantidas mediante justificativa registrada.${chauvenet.length ? ` Amostras: ${chauvenet.map(x => (x.i ?? -1) + 1).join(', ')}.` : ''}`
          });
        }
        for (const item of outliers) {
          if (item.outlier && item.i !== undefined && ativas[item.i]) {
            alertas.push({
              codigo: 'SAN002',
              severidade: 'CRITICO',
              titulo: `Amostra ${item.i + 1} com outlier pendente`,
              mensagem: 'A amostra foi sinalizada pelo critério de saneamento e requer decisão técnica (manter ou excluir) antes da emissão.'
            });
          }
        }
      } catch {
        alertas.push({ codigo: 'SAN003', severidade: 'CRITICO', titulo: 'Saneamento inválido', mensagem: 'Os dados persistidos do saneamento não puderam ser interpretados.' });
      }
    }

    const resultado = avaliacao.resultados[avaliacao.resultados.length - 1];
    if (!resultado || !(resultado.numeroAmostras > 0) || !(resultado.valorUnitario > 0) || !(resultado.valorTotal > 0)) {
      alertas.push({ codigo: 'RES001', severidade: 'CRITICO', titulo: 'Resultado final inexistente ou inválido', mensagem: 'É necessário possuir um resultado final válido antes da emissão.' });
    } else if (resultado.numeroAmostras !== ativas.length) {
      alertas.push({
        codigo: 'RES002',
        severidade: 'CRITICO',
        titulo: 'Resultado incompatível com as amostras ativas',
        mensagem: `O resultado registra ${resultado.numeroAmostras} amostras, mas existem ${ativas.length} amostras ativas. Formalize exclusões antes da emissão.`
      });
    }


    if (exigirSnapshot) {
      const snapshot = avaliacao.snapshotHash
        ? await this.prisma.snapshot.findFirst({
            where: {
              avaliacaoId,
              hashSha256: avaliacao.snapshotHash
            },
            orderBy: { versao: 'desc' }
          })
        : null;
      if (!snapshot) alertas.push({ codigo: 'GOV001', severidade: 'CRITICO', titulo: 'Snapshot não congelado', mensagem: 'É necessário congelar um snapshot antes da emissão.' });
      if (!avaliacao.snapshotHash) alertas.push({ codigo: 'GOV002', severidade: 'CRITICO', titulo: 'Hash do snapshot ausente', mensagem: 'A avaliação não possui hash de snapshot.' });
      if (snapshot && avaliacao.snapshotHash !== snapshot.hashSha256) alertas.push({ codigo: 'GOV003', severidade: 'CRITICO', titulo: 'Hash do snapshot inconsistente', mensagem: 'O hash vinculado à avaliação não corresponde ao snapshot selecionado para emissão.' });
      if (snapshot) {
        const hashConteudo = calcularHashSnapshot(snapshot.dadosJson);
        if (hashConteudo !== snapshot.hashSha256) alertas.push({ codigo: 'GOV005', severidade: 'CRITICO', titulo: 'Conteúdo do snapshot alterado', mensagem: 'O SHA-256 recalculado do conteúdo não corresponde ao hash armazenado.' });
        try {
          const snapshotData = JSON.parse(snapshot.dadosJson) as { snapshotSchemaVersion?: unknown };
          if (snapshotData.snapshotSchemaVersion !== 2) {
            alertas.push({
              codigo: 'GOV007',
              severidade: 'CRITICO',
              titulo: 'Versão de snapshot não suportada',
              mensagem: 'O snapshot não utiliza a versão de estrutura esperada pelo emissor atual.'
            });
          }
        } catch {
          alertas.push({ codigo: 'GOV006', severidade: 'CRITICO', titulo: 'Conteúdo do snapshot inválido', mensagem: 'O conteúdo congelado não é um JSON válido.' });
        }
      }
      if (avaliacao.status !== 'PRONTA_PARA_EMISSAO') alertas.push({ codigo: 'GOV004', severidade: 'CRITICO', titulo: 'Avaliação não está pronta para emissão', mensagem: `Estado atual: ${avaliacao.status}.` });
    }

    const criticos = alertas.some(a => a.severidade === 'CRITICO');
    return { podeEmitir: !criticos, alertas };
  }
}
