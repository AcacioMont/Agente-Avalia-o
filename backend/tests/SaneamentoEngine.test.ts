import { describe, it, expect } from 'vitest';
import { SaneamentoEngine } from '../src/engines/SaneamentoEngine.js';

describe('SaneamentoEngine', () => {
  it('detecta limite de 30%', () => {
    const r = SaneamentoEngine.executar([100, 105, 95, 200]);

    expect(r.limiteSuperior).toBe(162.5);

    expect(
      r.outliers.find(
        (x: (typeof r.outliers)[number]) => x.v === 200
      )?.outlier
    ).toBe(true);
  });

  it('calcula mediana', () => {
    expect(
      SaneamentoEngine.executar([1, 2, 3, 4]).mediana
    ).toBe(2.5);
  });

  it('calcula Chauvenet sem quebrar o contrato atual', () => {
    const r = SaneamentoEngine.executar([
      100,
      102,
      98,
      101,
      99,
      500
    ]);

    expect(Array.isArray(r.outliersChauvenet)).toBe(true);
    expect(Array.isArray(r.outliersChauvenetDetalhes)).toBe(true);
    expect(r.outliersChauvenetDetalhes.length).toBe(r.outliersChauvenet.length);
    expect(r.outliersChauvenetDetalhes.every(x => x.z > x.zCritico)).toBe(true);
    expect(r.zCriticoChauvenet).toBeGreaterThan(0);
  });
});
