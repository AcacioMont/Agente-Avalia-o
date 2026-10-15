import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const resultados = await prisma.resultado.findMany({
  orderBy: { createdAt: 'asc' }
});

console.log('\nRESULTADOS EXISTENTES:\n');

for (const r of resultados) {
  console.log({
    id: r.id,
    avaliacaoId: r.avaliacaoId,
    metodo: r.metodo,
    valorUnitario: r.valorUnitario,
    valorTotal: r.valorTotal,
    createdAt: r.createdAt
  });
}

const grupos = await prisma.resultado.groupBy({
  by: ['avaliacaoId'],
  _count: {
    avaliacaoId: true
  }
});

console.log('\nDUPLICIDADES:\n');

for (const g of grupos.filter(x => x._count.avaliacaoId > 1)) {
  console.log(g);
}

await prisma.$disconnect();