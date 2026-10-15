import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fatores = [
    [
      'FA',
      'Área',
      'FA = (área amostra / área avaliando)^alpha',
      1
    ],
    [
      'FT',
      'Testada',
      'FT = (testada amostra / testada avaliando)^beta',
      2
    ],
    [
      'FP',
      'Profundidade',
      'FP = (profundidade amostra / profundidade avaliando)^expoente',
      3
    ],
    [
      'FO',
      'Oferta/Transação',
      'Fator conforme tipo de valor',
      4
    ],
    [
      'FE',
      'Esquina',
      'Fator de situação',
      5
    ],
    [
      'FC',
      'Conservação',
      'Fator de conservação',
      6
    ],
    [
      'FELEV',
      'Elevador',
      'Fator de elevador',
      7
    ],
    [
      'FG',
      'Garagem',
      'Fator de garagem',
      8
    ],
    [
      'FPC',
      'Padrão Construtivo',
      'Fator de padrão construtivo',
      9
    ],
    [
      'REGRAS',
      'Regras metodológicas',
      'Parâmetros configuráveis do fluxo de avaliação e emissão',
      10
    ]
  ] as const;

  const defaultValue = (codigo: string, chave: string): number => {
    if (codigo === 'FA' && chave === 'alpha') return 0.25;
    if (codigo === 'FT' && chave === 'beta') return 0.25;
    if (codigo === 'FP' && chave === 'expoente') return 0.5;
    if (codigo === 'FO' && chave === 'OFERTA') return 0.98;
    if (codigo === 'FO' && chave === 'TRANSACAO') return 1;
    if (codigo === 'FE') return 1;
    if (codigo === 'FC') return 1;
    if (codigo === 'FELEV' && chave === 'ELEVADOR') return 1.02;
    if (codigo === 'FELEV' && chave === 'SEM_ELEVADOR') return 1;
    if (codigo === 'FG' && chave === 'NORMAL') return 1;
    if (codigo === 'FPC' && chave === 'BAIXO') return 1;
    if (codigo === 'FPC' && chave === 'NORMAL') return 1.4;
    if (codigo === 'FPC' && chave === 'ALTO') return 1.9;
    if (codigo === 'FPC' && chave === 'LUXO') return 2.5;
    if (codigo === 'REGRAS' && chave === 'MIN_AMOSTRAS') return 3;
    return 1;
  };

  for (const [codigo, nome, formula, ordem] of fatores) {
    const f = await prisma.fator.upsert({
      where: {
        codigo
      },
      update: {
        nome,
        formula,
        ordem,
        ativo: true
      },
      create: {
        codigo,
        nome,
        formula,
        ordem,
        ativo: true
      }
    });

    let keys: string[];

    if (codigo === 'FA') {
      keys = ['alpha'];
    } else if (codigo === 'FT') {
      keys = ['beta'];
    } else if (codigo === 'FP') {
      keys = ['expoente'];
    } else if (codigo === 'FO') {
      keys = ['OFERTA', 'TRANSACAO'];
    } else if (codigo === 'FE') {
      keys = [
        'ESQUINA',
        'MEIO_QUADRA',
        'MAIS_DE_UMA_FRENTE'
      ];
    } else if (codigo === 'FC') {
      keys = [
        'REGULAR', 'NOVO', 'REPAROS_SIMPLES', 'BAIXO', 'NORMAL', 'ALTO'
      ];
    } else if (codigo === 'FELEV') {
      keys = [
        'ELEVADOR',
        'SEM_ELEVADOR'
      ];
    } else if (codigo === 'FG') {
      keys = ['NORMAL'];
    } else if (codigo === 'FPC') {
      keys = [
        'BAIXO',
        'NORMAL',
        'ALTO',
        'LUXO'
      ];
    } else if (codigo === 'REGRAS') {
      keys = ['MIN_AMOSTRAS'];
    } else {
      keys = [];
    }

    await prisma.parametroFator.deleteMany({ where: { fatorId: f.id, ...(keys.length ? { chave: { notIn: keys } } : {}) } });

    for (const chave of keys) {
      await prisma.parametroFator.upsert({
        where: {
          fatorId_chave: {
            fatorId: f.id,
            chave
          }
        },
        update: {
          valor: defaultValue(codigo, chave),
          ativo: true
        },
        create: {
          fatorId: f.id,
          chave,
          valor: defaultValue(codigo, chave),
          ativo: true
        }
      });
    }
  }

  console.log(
    'Seed OK. Fatores:',
    await prisma.fator.count()
  );

  console.log(
    'Seed OK. Parâmetros:',
    await prisma.parametroFator.count()
  );

}

main()
  .catch((error) => {
    console.error('Erro no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
