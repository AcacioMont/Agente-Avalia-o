import { describe, it, expect } from 'vitest';
import { evaluateChauvenetEmissionGate } from '../src/engines/safety-primitives.js';

describe('Governança de Chauvenet', () => {
  it('bloqueia sinal sem decisão técnica', () => {
    expect(evaluateChauvenetEmissionGate(true, null)).toEqual({ blocked: true, code: 'SAN004' });
  });

  it('permite emissão quando o sinal foi mantido com justificativa técnica', () => {
    expect(evaluateChauvenetEmissionGate(true, 'MANTER_JUSTIFICADO')).toEqual({ blocked: false, code: null });
  });

  it('mantém bloqueio quando a decisão é excluir até a exclusão formal e recálculo', () => {
    expect(evaluateChauvenetEmissionGate(true, 'EXCLUIR')).toEqual({ blocked: true, code: 'SAN006' });
  });

  it('não bloqueia quando Chauvenet não sinalizou', () => {
    expect(evaluateChauvenetEmissionGate(false, null)).toEqual({ blocked: false, code: null });
  });
});
