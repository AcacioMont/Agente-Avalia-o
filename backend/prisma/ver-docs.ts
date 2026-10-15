import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const docs = await prisma.documento.findMany({
  orderBy: { dataGeracao: 'asc' }
});

for (const d of docs) {
  console.log(d.formato, '|', d.tipo, '|', d.nomeArquivo, '|', d.dataGeracao);
}

console.log('TOTAL:', docs.length);

await prisma.$disconnect();
