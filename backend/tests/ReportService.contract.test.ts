import { describe, expect, it } from 'vitest';
import { normalizarDadosSnapshot, tableColumns } from '../src/services/ReportService.js';

describe('contrato do snapshot v2 para relatórios', () => {
  it('normaliza o envelope congelado sem perder as relações técnicas', () => {
    const data = normalizarDadosSnapshot({
      snapshotSchemaVersion: 2,
      congeladoEm: '2026-10-05T00:00:00.000Z',
      avaliacao: {
        id: 'AV-1',
        numero: 'AV-001',
        status: 'CALCULADA',
        amostras: [{ id: 'A1', status: 'ATIVA' }],
        exclusoes: [{ amostraId: 'A2', motivo: 'outlier' }],
        resultados: [{ valorUnitario: 1000 }]
      },
      fatores: [
        {
          codigo: 'FA',
          parametros: [{ chave: 'alpha', valor: 0.25 }]
        }
      ]
    });

    expect(data.id).toBe('AV-1');
    expect(data.numero).toBe('AV-001');
    expect(data.amostras).toHaveLength(1);
    expect(data.exclusoes).toHaveLength(1);
    expect(data.fatores).toHaveLength(1);
    expect(data.snapshotSchemaVersion).toBe(2);
  });

  it('rejeita snapshot de versão incompatível', () => {
    expect(() =>
      normalizarDadosSnapshot({ snapshotSchemaVersion: 1, avaliacao: {} })
    ).toThrow('SNAPSHOT_SCHEMA_NAO_SUPORTADO');
  });

  it('detecta colunas para tabela de rotulo/valor', () => {
    expect(
      tableColumns([
        { Campo: 'Método', Valor: 'Comparativo' },
        { Campo: 'Área', Valor: '300 m²' }
      ])
    ).toEqual(['Campo', 'Valor']);
  });

  it('detecta colunas para tabela multicoluna (exclusões)', () => {
    expect(
      tableColumns([
        { Ordem: 1, Amostra: 'A1', Critério: 'Chauvenet', Motivo: 'outlier' },
        { Ordem: 2, Amostra: 'A2', Critério: '30%', Motivo: 'discrepante' }
      ])
    ).toEqual(['Ordem', 'Amostra', 'Critério', 'Motivo']);
  });

  it('detecta colunas para tabela de fatores/parametros', () => {
    expect(
      tableColumns([
        { Fator: 'FA', Nome: 'Área', Chave: 'alpha', Valor: 0.25, Unidade: null, Justificativa: 'mercado' },
        { Fator: 'FA', Nome: 'Área', Chave: 'alpha', Valor: 0.25 }
      ])
    ).toEqual(['Fator', 'Nome', 'Chave', 'Valor', 'Unidade', 'Justificativa']);
  });
});
