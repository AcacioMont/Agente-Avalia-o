import { describe, it, expect } from 'vitest';
import { CalculationEngine } from '../src/engines/CalculationEngine.js';

const parametros = {
  alphaArea: 0.25,
  betaTestada: 0.25,
  expoenteProfundidade: 0.5,
  taxaGaragem: 0.03,
  fatorOferta: 0.98,
  fatorTransacao: 1,
  esquinaMap: { ESQUINA: 1, MEIO_QUADRA: 1 },
  padraoMap: { NORMAL: 1, ALTO: 1.05 },
  conservacaoMap: { REGULAR: 1, NOVO: 1.05 },
  elevadorMap: { SIM: 1.02, NAO: 1 },
  versao: '1'
};

const amostra = {
  area: 500,
  testada: 20,
  profundidade: 25,
  vagas: 2,
  tipoValor: 'OFERTA' as const,
  situacaoQuadra: 'MEIO_QUADRA',
  elevador: false,
  idade: 10,
  vidaUtil: 60,
  conservacao: 'REGULAR',
  padrao: 'NORMAL',
  valorTotal: 500000
};

const avaliando = {
  ...amostra,
  area: 600,
  testada: 20,
  profundidade: 30,
  tipoImovel: 'Casa'
};

describe('CalculationEngine - robustez e limites', () => {
  it('produz resultados idênticos para entradas idênticas', () => {
    const r1 = CalculationEngine.homogeneizarAmostra(
      'T1', amostra, avaliando, parametros
    );
    const r2 = CalculationEngine.homogeneizarAmostra(
      'T1', amostra, avaliando, parametros
    );
    expect(r1).toEqual(r2);
  });

  it('rejeita área de amostra negativa', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T2', { ...amostra, area: -10 }, avaliando, parametros
      )
    ).toThrow('AMOSTRA_SEM_AREA_OU_VALOR_VALIDO');
  });

  it('rejeita valor total não finito', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T3', { ...amostra, valorTotal: Infinity }, avaliando, parametros
      )
    ).toThrow('AMOSTRA_SEM_AREA_OU_VALOR_VALIDO');
  });

  it('rejeita área do imóvel avaliando igual a zero', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T4', amostra, { ...avaliando, area: 0 }, parametros
      )
    ).toThrow('FATOR_INVALIDO_FA');
  });

  it('rejeita testada da amostra igual a zero', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T5', { ...amostra, testada: 0 }, avaliando, parametros
      )
    ).toThrow('FATOR_INVALIDO_FT');
  });

  it('rejeita profundidade da amostra igual a zero', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T6', { ...amostra, profundidade: 0 }, avaliando, parametros
      )
    ).toThrow('FATOR_INVALIDO_FP');
  });

  it('rejeita fator de oferta igual a zero', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T7', amostra, avaliando, { ...parametros, fatorOferta: 0 }
      )
    ).toThrow('FATOR_INVALIDO_FO');
  });

  it('rejeita idade negativa para imóvel construído', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T8', { ...amostra, idade: -1 }, avaliando, parametros
      )
    ).toThrow('FATOR_INVALIDO_FI');
  });

  it('rejeita vida útil zero para imóvel construído', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T9', { ...amostra, vidaUtil: 0 }, avaliando, parametros
      )
    ).toThrow('FATOR_INVALIDO_FI');
  });

  it('rejeita idade igual à vida útil quando FI resulta em zero', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T10', { ...amostra, idade: 60, vidaUtil: 60 }, avaliando, parametros
      )
    ).toThrow('FATOR_INVALIDO_FI');
  });

  it('rejeita tipo de valor desconhecido', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T11',
        { ...amostra, tipoValor: 'DESCONHECIDO' as any },
        avaliando,
        parametros
      )
    ).toThrow();
  });

  it('rejeita quantidade negativa de vagas', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'T12', { ...amostra, vagas: -1 }, avaliando, parametros
      )
    ).toThrow();
  });

  it('mantém fatores não aplicáveis a terrenos iguais a um', () => {
    const terreno = {
      ...avaliando,
      tipoImovel: 'Terreno',
      vagas: 0,
      padrao: undefined,
      conservacao: undefined,
      idade: undefined,
      vidaUtil: undefined
    };
    const amostraTerreno = {
      ...amostra,
      vagas: 0,
      padrao: undefined,
      conservacao: undefined,
      idade: undefined,
      vidaUtil: undefined
    };

    const r = CalculationEngine.homogeneizarAmostra(
      'T13', amostraTerreno, terreno, parametros
    );

    for (const fator of ['FG', 'FPC', 'FC', 'FI', 'FELEV']) {
      expect(r.fatores[fator]).toBe(1);
      expect(r.auditoria[fator].status).toBe('NAO_APLICAVEL');
    }
  });

  it('registra a fórmula e as entradas usadas em cada fator', () => {
    const r = CalculationEngine.homogeneizarAmostra(
      'T14', amostra, avaliando, parametros
    );

    for (const fator of [
      'FA', 'FT', 'FP', 'FO', 'FG',
      'FE', 'FPC', 'FELEV', 'FC', 'FI'
    ]) {
      expect(r.auditoria[fator]).toBeDefined();
      expect(r.auditoria[fator].formula.length).toBeGreaterThan(0);
      expect(r.auditoria[fator].entradas).toBeDefined();
      expect(r.auditoria[fator].resultado).not.toBeNull();
    }
  });
});
