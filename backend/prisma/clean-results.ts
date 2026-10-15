import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const resultados = await prisma.resultado.findMany({
  where: {
    avaliacaoId: '3535360d-e5b4-4c1c-8703-510abcb32c42'
  },
  orderBy: {
    createdAt: 'desc'
  }
});

if (resultados.length <= 1) {
  console.log('Nenhuma duplicidade encontrada.');
} else {
  const manter = resultados[0];
  const remover = resultados.slice(1);

  console.log('MANTER:', manter.id);
  console.log('REMOVER:', remover.map(r => r.id));

  for (const r of remover) {
    await prisma.resultado.delete({
      where: { id: r.id }
    });
  }

  console.log(`OK. ${remover.length} duplicados removidos.`);
}

await prisma.$disconnect();