import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const docs = await prisma.documento.findMany({
  orderBy: { dataGeracao: 'asc' }
});

const seen = new Set<string>();

for (const d of docs) {
  if (!seen.has(d.formato)) {
    seen.add(d.formato);
    continue;
  }

  await prisma.documento.delete({
    where: { id: d.id }
  });

  console.log('REMOVIDO:', d.formato, d.id);
}

await prisma.$disconnect();
