import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fatores = await prisma.fator.findMany({
    include: {
      parametros: true
    },
    orderBy: {
      ordem: 'asc'
    }
  });

  for (const fator of fatores) {
    console.log(`\n=== ${fator.codigo} - ${fator.nome} ===`);

    for (const parametro of fator.parametros) {
      console.log(
        `${parametro.chave} = ${parametro.valor} | ativo=${parametro.ativo}`
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });