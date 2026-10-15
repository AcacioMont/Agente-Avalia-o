import { PrismaClient } from '@prisma/client';
import { audit } from './AuditService.js';

export async function invalidateCalculation(
  prisma: PrismaClient,
  avaliacaoId: string,
  motivo: string,
  usuario = 'sistema'
) {
  const avaliacao = await prisma.avaliacao.findUnique({ where: { id: avaliacaoId } });
  if (!avaliacao) throw new Error('AVALIACAO_NOT_FOUND');

  const resultado = await prisma.resultado.findUnique({ where: { avaliacaoId } });

  await prisma.$transaction(async (tx) => {
    await tx.avaliacao.update({
      where: { id: avaliacaoId },
      data: { status: 'EM_ELABORACAO', snapshotHash: null }
    });

    await tx.historico.create({
      data: {
        avaliacaoId,
        entidade: 'Avaliacao',
        entidadeId: avaliacaoId,
        campo: 'status',
        valorAnterior: avaliacao.status,
        valorNovo: 'EM_ELABORACAO',
        usuario,
        motivo: resultado ? `Resultado invalidado: ${motivo}` : motivo
      }
    });
  });

  const emissaoAnterior = await prisma.auditoria.findFirst({ where: { avaliacaoId, acao: 'LAUDO_EMITIDO' }, orderBy: { dataHora: 'desc' } });
  if (emissaoAnterior) {
    await audit(prisma, {
      avaliacaoId,
      acao: 'LAUDO_INVALIDADO',
      entidade: 'Documento',
      entidadeId: emissaoAnterior.entidadeId ?? undefined,
      antes: emissaoAnterior.depoisJson ? JSON.parse(emissaoAnterior.depoisJson) : undefined,
      depois: { motivo },
      usuario,
      motivo: 'Alteração posterior aos dados do laudo emitido'
    });
  }

  if (resultado) {
    await audit(prisma, {
      avaliacaoId,
      acao: 'RESULTADO_INVALIDADO',
      entidade: 'Resultado',
      entidadeId: resultado.id,
      antes: { status: avaliacao.status },
      depois: { status: 'EM_ELABORACAO' },
      usuario,
      motivo
    });
  }

  await audit(prisma, {
    avaliacaoId,
    acao: 'DADOS_ALTERADOS',
    entidade: 'Avaliacao',
    entidadeId: avaliacaoId,
    usuario,
    motivo
  });
}
