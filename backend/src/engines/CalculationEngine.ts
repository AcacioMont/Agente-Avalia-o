import Big from 'big.js';

Big.DP = 18;
Big.RM = Big.roundHalfUp;

export interface ParametersConfig {
  alphaArea: number;
  betaTestada: number;
  expoenteProfundidade: number;
  taxaGaragem: number;
  fatorOferta: number;
  fatorTransacao: number;
  esquinaMap: Record<string, number>;
  padraoMap: Record<string, number>;
  conservacaoMap: Record<string, number>;
  elevadorMap: Record<string, number>;
  versao: string;
}

export interface SampleInput {
  area: number;
  testada: number;
  profundidade: number;
  vagas: number;
  tipoValor: 'OFERTA' | 'TRANSACAO';
  situacaoQuadra: string;
  elevador: boolean;
  idade?: number;
  vidaUtil?: number;
  conservacao?: string;
  padrao?: string;
  valorTotal: number;
}

export interface SubjectInput extends SampleInput {
  tipoImovel?: string;
}

export interface AuditTrail {
  formula: string;
  entradas: Record<string, unknown>;
  resultado: number | null;
  status: 'APLICADO' | 'ERRO_DADO_INVALIDO' | 'NAO_APLICAVEL';
  motivo?: string;
}

export interface CalculatedSampleResult {
  sampleId: string;
  vuOriginal: number;
  fatores: Record<string, number>;
  produtoFatores: number;
  vuHomogeneizado: number;
  auditoria: Record<string, AuditTrail>;
}

const pos = (v: number) =>
  Number.isFinite(v) && v > 0;

const fail = (
  formula: string,
  entradas: Record<string, unknown>,
  motivo: string
): AuditTrail => ({
  formula,
  entradas,
  resultado: null,
  status: 'ERRO_DADO_INVALIDO',
  motivo
});

export class CalculationEngine {
  static pot(
    formula: string,
    a: number,
    b: number,
    p: number,
    entradas: Record<string, unknown>
  ): AuditTrail {
    if (
      !pos(a) ||
      !pos(b) ||
      !Number.isFinite(p)
    ) {
      return fail(
        formula,
        entradas,
        'Entradas inválidas.'
      );
    }

    const base = a / b;

    if (!Number.isFinite(base) || base <= 0) {
      return fail(
        formula,
        entradas,
        'Base da potência inválida.'
      );
    }

    const resultado = Math.pow(base, p);

    if (!Number.isFinite(resultado) || resultado <= 0) {
      return fail(
        formula,
        entradas,
        'Resultado da potência inválido.'
      );
    }

    return {
      formula,
      entradas,
      resultado: Number(resultado.toFixed(8)),
      status: 'APLICADO'
    };
  }

  static rel(
    c: string,
    a: string | undefined,
    b: string | undefined,
    map: Record<string, number>
  ): AuditTrail {
    const x = map[a ?? ''];
    const y = map[b ?? ''];

    const f =
      `${c} = coef_avaliando / coef_amostra`;

    if (!pos(x) || !pos(y)) {
      return fail(
        f,
        { a, b, x, y },
        `Parâmetro ${c} não cadastrado.`
      );
    }

    return {
      formula: f,
      entradas: { a, b, x, y },
      resultado: Number(
        new Big(y).div(x).toFixed(8)
      ),
      status: 'APLICADO'
    };
  }

  static homogeneizarAmostra(
    id: string,
    s: SampleInput,
    a: SubjectInput,
    c: ParametersConfig
  ): CalculatedSampleResult {
    // Validações de entrada: impedem que valores desconhecidos sejam
    // tratados silenciosamente como TRANSACAO ou usados nos fatores.
    if (
      s.tipoValor !== 'OFERTA' &&
      s.tipoValor !== 'TRANSACAO'
    ) {
      throw new Error('TIPO_VALOR_INVALIDO');
    }

    if (!Number.isFinite(s.vagas) || s.vagas < 0) {
      throw new Error('QUANTIDADE_VAGAS_INVALIDA');
    }

    if (!Number.isFinite(a.vagas) || a.vagas < 0) {
      throw new Error('QUANTIDADE_VAGAS_AVALIANDO_INVALIDA');
    }

    if (
      !pos(s.valorTotal) ||
      !pos(s.area)
    ) {
      throw new Error(
        'AMOSTRA_SEM_AREA_OU_VALOR_VALIDO'
      );
    }

    const vu = new Big(s.valorTotal)
      .div(s.area)
      .toNumber();

    const aud: Record<string, AuditTrail> = {};

    aud.FA = this.pot(
      'FA=(area_amostra/area_avaliando)^alpha',
      s.area,
      a.area,
      c.alphaArea,
      {
        s: s.area,
        a: a.area,
        alpha: c.alphaArea
      }
    );

    aud.FT = this.pot(
      'FT=(testada_amostra/testada_avaliando)^beta',
      s.testada,
      a.testada,
      c.betaTestada,
      {
        s: s.testada,
        a: a.testada,
        beta: c.betaTestada
      }
    );

    aud.FP = this.pot(
      'FP=(profundidade_amostra/profundidade_avaliando)^0.5',
      s.profundidade,
      a.profundidade,
      c.expoenteProfundidade,
      {
        s: s.profundidade,
        a: a.profundidade,
        expoente: c.expoenteProfundidade
      }
    );

    const fo =
      s.tipoValor === 'OFERTA'
        ? c.fatorOferta
        : c.fatorTransacao;

    aud.FO = pos(fo)
      ? {
          formula:
            'FO=parâmetro[tipoValor]',
          entradas: {
            tipo: s.tipoValor
          },
          resultado: fo,
          status: 'APLICADO'
        }
      : fail(
          'FO=parâmetro[tipoValor]',
          { tipo: s.tipoValor },
          'FO inválido'
        );

    const tipoImovelNormalizado = String(a.tipoImovel ?? '').trim().toUpperCase();
    const isTerreno = tipoImovelNormalizado.startsWith('TERRENO');
    const fg = isTerreno
      ? 1
      : 1 + c.taxaGaragem * (s.vagas - a.vagas);

    aud.FG = isTerreno
      ? {
          formula: 'FG=1 (não aplicável a terreno)',
          entradas: { tipoImovel: a.tipoImovel },
          resultado: 1,
          status: 'NAO_APLICAVEL'
        }
      : Number.isFinite(fg) && fg > 0
        ? {
            formula: 'FG=1+taxa*(vagas_amostra-vagas_avaliando)',
            entradas: {
              s: s.vagas,
              a: a.vagas,
              t: c.taxaGaragem
            },
            resultado: Number(fg.toFixed(8)),
            status: 'APLICADO'
          }
        : fail(
            'FG=1+taxa*(vagas_amostra-vagas_avaliando)',
            {},
            'FG inválido'
          );
aud.FE = this.rel(
      'FE',
      s.situacaoQuadra,
      a.situacaoQuadra,
      c.esquinaMap
    );

    aud.FPC = isTerreno
      ? {
          formula: 'FPC=1 (não aplicável a terreno)',
          entradas: { tipoImovel: a.tipoImovel },
          resultado: 1,
          status: 'NAO_APLICAVEL'
        }
      : this.rel('FPC', s.padrao, a.padrao, c.padraoMap);

    aud.FELEV = isTerreno
      ? {
          formula: 'FELEV=1 (não aplicável a terreno)',
          entradas: { tipoImovel: a.tipoImovel },
          resultado: 1,
          status: 'NAO_APLICAVEL'
        }
      : this.rel(
          'FELEV',
          s.elevador ? 'SIM' : 'NAO',
          a.elevador ? 'SIM' : 'NAO',
          c.elevadorMap
        );

    const estado = c.conservacaoMap[s.conservacao ?? ''];

    aud.FC = isTerreno
      ? {
          formula: 'FC=1 (não aplicável a terreno)',
          entradas: { tipoImovel: a.tipoImovel },
          resultado: 1,
          status: 'NAO_APLICAVEL'
        }
      : pos(estado)
        ? {
            formula: 'FC=parametro[conservacao]',
            entradas: { conservacao: s.conservacao },
            resultado: Number(estado.toFixed(8)),
            status: 'APLICADO'
          }
        : fail(
            'FC=parametro[conservacao]',
            { conservacao: s.conservacao },
            'Fator de conservação inválido'
          );

    const ir = (s.idade ?? 0) / (s.vidaUtil ?? 0);

    const fi =
      pos(s.vidaUtil ?? 0) &&
      s.idade !== undefined &&
      s.idade >= 0 &&
      ir <= 1
        ? 1 - 0.5 * (ir + ir * ir)
        : 0;

    aud.FI = isTerreno
      ? {
          formula: 'FI=1 (não aplicável a terreno)',
          entradas: { tipoImovel: a.tipoImovel },
          resultado: 1,
          status: 'NAO_APLICAVEL'
        }
      : fi > 0
        ? {
            formula: 'FI=(1-K_idade)',
            entradas: { idade: s.idade, vidaUtil: s.vidaUtil, ir },
            resultado: Number(fi.toFixed(8)),
            status: 'APLICADO'
          }
        : fail(
            'FI=(1-K_idade)',
            { idade: s.idade, vidaUtil: s.vidaUtil, ir },
            'Idade/vida útil inválidos'
          );
    const fatores: Record<string, number> = {};
    let produto = new Big(1);

    for (const [k, v] of Object.entries(aud)) {
      if (
        v.status ===
        'ERRO_DADO_INVALIDO'
      ) {
        throw new Error(
          `FATOR_INVALIDO_${k}:${v.motivo}`
        );
      }

      fatores[k] = v.resultado!;
      produto = produto.times(
        v.resultado!
      );
    }

    const p = Number(
      produto.toFixed(8)
    );

    return {
      sampleId: id,
      vuOriginal: Number(
        vu.toFixed(8)
      ),
      fatores,
      produtoFatores: p,
      vuHomogeneizado: Number(
        new Big(vu)
          .times(p)
          .toFixed(8)
      ),
      auditoria: aud
    };
  }
}
