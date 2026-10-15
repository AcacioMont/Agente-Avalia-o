import { describe, it, expect } from 'vitest';
import { CalculationEngine } from '../src/engines/CalculationEngine.js';

const c = {
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

const s = {
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

const a = { ...s, area: 600, testada: 20, profundidade: 30 };

describe('CalculationEngine', () => {
  it('calcula sem mascarar fatores', () => {
    const r = CalculationEngine.homogeneizarAmostra('A1', s, a, c);
    expect(r.vuOriginal).toBe(1000);
    expect(r.produtoFatores).toBeGreaterThan(0);
    expect(r.auditoria.FA.status).toBe('APLICADO');
  });

  it('rejeita valor inválido', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra('A1', { ...s, valorTotal: 0 }, a, c)
    ).toThrow('AMOSTRA_SEM_AREA_OU_VALOR_VALIDO');
  });

  it('rejeita parâmetro ausente', () => {
    expect(() =>
      CalculationEngine.homogeneizarAmostra(
        'A1', { ...s, situacaoQuadra: 'DESCONHECIDA' }, a, c
      )
    ).toThrow('FATOR_INVALIDO_FE');
  });

  it('ignora o fator garagem para terrenos e registra na auditoria', () => {
    const terreno = { ...a, tipoImovel: 'Terreno', vagas: 2 };
    const amostraSemGaragem = { ...s, vagas: 0 };
    const r = CalculationEngine.homogeneizarAmostra(
      'TERRENO-1', amostraSemGaragem, terreno, c
    );

    expect(r.fatores.FG).toBe(1);
    expect(r.auditoria.FG.status).toBe('NAO_APLICAVEL');
    expect(r.auditoria.FG.resultado).toBe(1);
  });

  it('não exige fatores de construção para terreno baldio', () => {
    const terreno = {
      ...a,
      tipoImovel: 'Terreno',
      padrao: undefined,
      conservacao: undefined,
      idade: undefined,
      vidaUtil: undefined,
      elevador: false,
      vagas: 0
    };
    const amostraTerreno = {
      ...s,
      padrao: undefined,
      conservacao: undefined,
      idade: undefined,
      vidaUtil: undefined,
      elevador: false,
      vagas: 0
    };

    const r = CalculationEngine.homogeneizarAmostra(
      'TERRENO-SEM-CONSTRUCAO', amostraTerreno, terreno, c
    );

    for (const fator of ['FG', 'FPC', 'FC', 'FI', 'FELEV']) {
      expect(r.fatores[fator]).toBe(1);
      expect(r.auditoria[fator].status).toBe('NAO_APLICAVEL');
      expect(r.auditoria[fator].resultado).toBe(1);
    }
  });

  it('continua validando padrão construtivo para imóvel construído', () => {
    const casa = { ...a, tipoImovel: 'Casa', padrao: undefined };

    expect(() =>
      CalculationEngine.homogeneizarAmostra('CASA-1', s, casa, c)
    ).toThrow('FATOR_INVALIDO_FPC');
  });
});