import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const resultados = await prisma.resultado.findMany({
  orderBy: { createdAt: 'asc' }
});

for (const r of resultados) {
  console.log(r.id, '|', r.avaliacaoId, '|', r.valorUnitario, '|', r.valorTotal, '|', r.createdAt);
}

console.log('TOTAL:', resultados.length);

await prisma.$disconnect();
