import { PrismaClient } from '@prisma/client';
import { calcularHashSnapshot, assertSnapshotCanBeCreated } from './safety-primitives.js';
export { calcularHashSnapshot, snapshotIntegro } from './safety-primitives.js';

const SNAPSHOT_SCHEMA_VERSION = 2;

/**
 * Congela o estado técnico relevante da avaliação.
 *
 * O snapshot não deve depender de relações que sejam criadas depois da emissão
 * (por exemplo, Documento). Relações técnicas e de rastreabilidade são
 * explicitamente ordenadas para tornar o JSON determinístico.
 */
export async function createSnapshot(prisma: PrismaClient, avaliacaoId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const avaliacao = await tx.avaliacao.findUnique({
        where: { id: avaliacaoId },
        include: {
          imovelAvaliando: true,
          amostras: {
            orderBy: [{ status: 'asc' }, { dataColeta: 'asc' }, { id: 'asc' }]
          },
          homogeneizacoes: {
            orderBy: [{ calculadoEm: 'asc' }, { id: 'asc' }]
          },
          saneamento: true,
          exclusoes: {
            orderBy: [{ dataExclusao: 'asc' }, { id: 'asc' }],
            include: { amostra: true }
          },
          resultados: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
          },
          historicos: {
            orderBy: [{ dataAlteracao: 'asc' }, { id: 'asc' }]
          },
          fotografias: {
            orderBy: [{ ordem: 'asc' }, { dataFoto: 'asc' }, { id: 'asc' }]
          },
          auditorias: {
            orderBy: [{ dataHora: 'asc' }, { id: 'asc' }]
          }
        }
      });

      if (!avaliacao) throw new Error('AVALIACAO_NOT_FOUND');
      assertSnapshotCanBeCreated(avaliacao.status);

      const fatores = await tx.fator.findMany({
        where: { ativo: true },
        orderBy: [{ ordem: 'asc' }, { codigo: 'asc' }],
        include: {
          parametros: {
            where: { ativo: true },
            orderBy: [{ chave: 'asc' }, { id: 'asc' }]
          }
        }
      });

      // O snapshot congela exatamente o estado da avaliação
      // retornado pelo include acima.
      //
      // Documentos e outros snapshots não fazem parte do conteúdo
      // técnico congelado e não devem ser desestruturados aqui.
      const avaliacaoBase = avaliacao;

      const dados = {
        snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
        congeladoEm: new Date().toISOString(),
        avaliacao: avaliacaoBase,
        fatores,
        observacaoGovernanca:
          'Snapshot congelado antes da emissão; documentos gerados posteriormente não fazem parte do conteúdo técnico congelado.'
      };

      const dadosJson = JSON.stringify(dados);
      const hashSha256 = calcularHashSnapshot(dadosJson);

      const ultimo = await tx.snapshot.findFirst({
        where: { avaliacaoId },
        orderBy: { versao: 'desc' },
        select: { versao: true }
      });

      const versao = (ultimo?.versao ?? 0) + 1;

      const snapshot = await tx.snapshot.create({
        data: { avaliacaoId, versao, dadosJson, hashSha256 }
      });

      const atualizacao = await tx.avaliacao.updateMany({
        where: { id: avaliacaoId, status: 'CALCULADA' },
        data: {
          snapshotHash: hashSha256,
          status: 'PRONTA_PARA_EMISSAO'
        }
      });

      if (atualizacao.count !== 1) {
        throw new Error('AVALIACAO_ALTERADA_DURANTE_SNAPSHOT');
      }

      await tx.auditoria.create({
        data: {
          avaliacaoId,
          acao: 'SNAPSHOT_CONGELADO',
          entidade: 'Snapshot',
          entidadeId: snapshot.id,
          depoisJson: JSON.stringify({
            versao: snapshot.versao,
            hashSha256,
            snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION
          }),
          usuario: 'sistema',
          motivo: 'Congelamento do estado técnico da avaliação'
        }
      });

      return snapshot;
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    ) {
      throw new Error('CONFLITO_DE_CONCORRENCIA_AO_CRIAR_SNAPSHOT');
    }

    throw error;
  }
}

export async function getLatestSnapshot(prisma: PrismaClient, id: string) {
  return prisma.snapshot.findFirst({
    where: { avaliacaoId: id },
    orderBy: { versao: 'desc' }
  });
}
