import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export async function loadParametersHash(prisma: PrismaClient) {
  const fatores = await prisma.fator.findMany({
    where: { ativo: true },
    include: {
      parametros: {
        where: { ativo: true }
      }
    },
    orderBy: { codigo: 'asc' }
  });


  const parametros = fatores.map((f) => ({
    codigo: f.codigo,
    nome: f.nome,
    formula: f.formula ?? null,
    ordem: f.ordem,
    parametros: [...f.parametros]
      .sort((a, b) => a.chave.localeCompare(b.chave))
      .map((p) => ({
        chave: p.chave,
        valor: p.valor,
        unidade: p.unidade ?? null,
        justificativa: p.justificativa ?? null
      }))
  }));

  const canonical = JSON.stringify(parametros);

  return crypto
    .createHash('sha256')
    .update(canonical, 'utf8')
    .digest('hex');
}
