import { describe, it, expect } from 'vitest';
import { SaneamentoEngine } from '../src/engines/SaneamentoEngine.js';

describe('SaneamentoEngine - robustez e limites', () => {
  it('calcula média, mediana, desvio padrão amostral e limites de 30%', () => {
    const r = SaneamentoEngine.executar([10, 20, 30]);
    expect(r.media).toBe(20);
    expect(r.mediana).toBe(20);
    expect(r.desvioPadrao).toBe(10);
    expect(r.limiteInferior).toBe(14);
    expect(r.limiteSuperior).toBe(26);
    expect(r.outliers.map(x => x.outlier)).toEqual([true, false, true]);
  });

  it('calcula a mediana corretamente para quantidade par', () => {
    const r = SaneamentoEngine.executar([10, 20, 30, 40]);
    expect(r.mediana).toBe(25);
  });

  it('não altera a lista recebida', () => {
    const valores = [30, 10, 20];
    const copia = [...valores];
    SaneamentoEngine.executar(valores);
    expect(valores).toEqual(copia);
  });

  it('rejeita lista vazia', () => {
    expect(() => SaneamentoEngine.executar([])).toThrow('BASE_VAZIA');
  });

  it('rejeita entrada que não seja uma lista', () => {
    expect(() => SaneamentoEngine.executar(null as unknown as number[])).toThrow('BASE_VAZIA');
  });

  it.each([NaN, Infinity, -Infinity, 0, -1])('rejeita valor inválido: %s', valor => {
    expect(() => SaneamentoEngine.executar([10, valor, 20])).toThrow('VALOR_INVALIDO');
  });

  it('para uma única observação, desvio padrão é zero e Chauvenet não marca outliers', () => {
    const r = SaneamentoEngine.executar([100]);
    expect(r.media).toBe(100);
    expect(r.mediana).toBe(100);
    expect(r.desvioPadrao).toBe(0);
    expect(r.outliersChauvenet).toEqual([]);
    expect(r.zCriticoChauvenet).toBe(0);
  });

  it('para valores iguais, desvio padrão é zero e Chauvenet não marca outliers', () => {
    const r = SaneamentoEngine.executar([100, 100, 100, 100]);
    expect(r.desvioPadrao).toBe(0);
    expect(r.outliersChauvenet).toEqual([]);
    expect(r.zCriticoChauvenet).toBe(0);
  });

  it('não marca outliers de Chauvenet quando há menos de três observações', () => {
    const r = SaneamentoEngine.executar([100, 200]);
    expect(r.outliersChauvenet).toEqual([]);
    expect(r.zCriticoChauvenet).toBe(0);
  });

  it('identifica valor extremo pelo critério de Chauvenet em uma amostra com dispersão', () => {
    const r = SaneamentoEngine.executar([100, 101, 99, 100, 102, 98, 500]);
    expect(r.outliersChauvenet).toContain(500);
    expect(r.zCriticoChauvenet).toBeGreaterThan(0);
  });

  it('é determinístico para entradas idênticas', () => {
    const valores = [100, 120, 90, 110, 105];
    expect(SaneamentoEngine.executar(valores)).toEqual(SaneamentoEngine.executar(valores));
  });

  it('rejeita dados finitos cuja soma causa resultado não finito', () => {
    expect(() => SaneamentoEngine.executar([Number.MAX_VALUE, Number.MAX_VALUE])).toThrow('RESULTADO_NAO_FINITO');
  });
});
