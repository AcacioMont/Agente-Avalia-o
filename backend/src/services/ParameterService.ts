import { PrismaClient } from '@prisma/client';

export async function loadParameters(prisma: PrismaClient) {
  const fs = await prisma.fator.findMany({
    where: { ativo: true },
    include: {
      parametros: {
        where: { ativo: true }
      }
    },
    orderBy: { ordem: 'asc' }
  });

  const m = (code: string) =>
    Object.fromEntries(
      (
        fs.find((f) => f.codigo === code)?.parametros ?? []
      ).map((p) => [p.chave, p.valor])
    );

  const getRequired = (code: string, key: string) => {
    const value = m(code)[key];

    if (value === undefined || value === null) {
      throw new Error(`PARAMETRO_NAO_ENCONTRADO:${code}.${key}`);
    }

    return value;
  };

  const versao = process.env.MOTOR_VERSAO;

  if (!versao) {
    throw new Error('MOTOR_VERSAO_NAO_CONFIGURADA');
  }

  return {
    alphaArea: getRequired('FA', 'alpha'),
    betaTestada: getRequired('FT', 'beta'),
    expoenteProfundidade: getRequired('FP', 'expoente'),

    taxaGaragem: getRequired('FG', 'NORMAL'),

    fatorOferta: getRequired('FO', 'OFERTA'),
    fatorTransacao: getRequired('FO', 'TRANSACAO'),

    esquinaMap: m('FE'),
    padraoMap: m('FPC'),
    conservacaoMap: m('FC'),

    elevadorMap: {
      SIM: getRequired('FELEV', 'ELEVADOR'),
      NAO: getRequired('FELEV', 'SEM_ELEVADOR')
    },

    versao
  };
}


export async function loadSystemParameters(prisma: PrismaClient) {
  const rows = await prisma.fator.findUnique({ where: { codigo: 'REGRAS' }, include: { parametros: { where: { ativo: true } } } });
  const value = rows?.parametros.find((p) => p.chave === 'MIN_AMOSTRAS')?.valor;
  if (value === undefined || value < 1) throw new Error('PARAMETRO_SISTEMA_NAO_ENCONTRADO:MIN_AMOSTRAS');
  return { minAmostras: Math.floor(value) };
}
