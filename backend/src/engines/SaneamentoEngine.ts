export interface SaneamentoOutlier {
  i: number;
  v: number;
  outlier: boolean;
}

export interface SaneamentoResult {
  media: number;
  mediana: number;
  desvioPadrao: number;
  limiteInferior: number;
  limiteSuperior: number;
  outliers: SaneamentoOutlier[];
  outliersChauvenet: number[];
  outliersChauvenetDetalhes: Array<{ i: number; v: number; z: number; zCritico: number }>;
  zCriticoChauvenet: number;
}

export class SaneamentoEngine {
  private static arredondar(v: number): number {
    if (!Number.isFinite(v)) {
      throw new Error('RESULTADO_NAO_FINITO');
    }
    return Number(v.toFixed(8));
  }

  private static normalCDF(z: number): number {
    // Aproximação da CDF normal padrão. O método é usado somente para
    // determinar o limite crítico aproximado de Chauvenet.
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
    const p = d * t * (
      0.319381530 +
      t * (
        -0.356563782 +
        t * (
          1.781477937 +
          t * (-1.821255978 + t * 1.330274429)
        )
      )
    );
    return z >= 0 ? 1 - p : p;
  }

  private static executarChauvenet(
    valores: number[],
    media: number,
    desvioPadrao: number
  ): {
    outliers: number[];
    detalhes: Array<{ i: number; v: number; z: number; zCritico: number }>;
    zCritico: number;
  } {
    const n = valores.length;

    if (n < 3 || desvioPadrao === 0) {
      return { outliers: [], detalhes: [], zCritico: 0 };
    }

    const probabilidadeMinima = 1 / (2 * n);
    let baixo = 0;
    let alto = 10;

    for (let i = 0; i < 60; i++) {
      const meio = (baixo + alto) / 2;
      const cauda = 1 - SaneamentoEngine.normalCDF(meio);
      if (cauda > probabilidadeMinima) {
        baixo = meio;
      } else {
        alto = meio;
      }
    }

    const zCritico = (baixo + alto) / 2;
    const zCriticoArredondado = SaneamentoEngine.arredondar(zCritico);
    const detalhes = valores
      .map((v, i) => {
        const zBruto = Math.abs((v - media) / desvioPadrao);
        return {
          i,
          v,
          zBruto,
          z: SaneamentoEngine.arredondar(zBruto),
          zCritico: zCriticoArredondado
        };
      })
      .filter(item => item.zBruto > zCritico)
      .map(({ zBruto: _zBruto, ...item }) => item);

    return {
      outliers: detalhes.map(item => item.v),
      detalhes,
      zCritico: zCriticoArredondado
    };
  }

  static executar(valores: number[]): SaneamentoResult {
    if (!Array.isArray(valores) || valores.length === 0) {
      throw new Error('BASE_VAZIA');
    }

    if (valores.some(v => !Number.isFinite(v) || v <= 0)) {
      throw new Error('VALOR_INVALIDO');
    }

    const ordenados = [...valores].sort((a, b) => a - b);
    const n = valores.length;
    const soma = valores.reduce((s, v) => s + v, 0);
    const mediaBruta = soma / n;

    if (!Number.isFinite(mediaBruta) || mediaBruta <= 0) {
      throw new Error('RESULTADO_NAO_FINITO');
    }

    const meio = Math.floor(n / 2);
    const medianaBruta = n % 2 === 1
      ? ordenados[meio]
      : ordenados[meio - 1] / 2 + ordenados[meio] / 2;

    const somaQuadrados = valores.reduce(
      (s, v) => s + (v - mediaBruta) ** 2,
      0
    );
    const desvioPadraoBruto = n < 2
      ? 0
      : Math.sqrt(somaQuadrados / (n - 1));

    const limiteInferiorBruto = mediaBruta * 0.7;
    const limiteSuperiorBruto = mediaBruta * 1.3;

    if (
      !Number.isFinite(medianaBruta) ||
      !Number.isFinite(desvioPadraoBruto) ||
      !Number.isFinite(limiteInferiorBruto) ||
      !Number.isFinite(limiteSuperiorBruto)
    ) {
      throw new Error('RESULTADO_NAO_FINITO');
    }

    const outliers = valores.map((v, i) => ({
      i,
      v,
      outlier: v < limiteInferiorBruto || v > limiteSuperiorBruto
    }));

    const chauvenet = SaneamentoEngine.executarChauvenet(
      valores,
      mediaBruta,
      desvioPadraoBruto
    );

    return {
      media: SaneamentoEngine.arredondar(mediaBruta),
      mediana: SaneamentoEngine.arredondar(medianaBruta),
      desvioPadrao: SaneamentoEngine.arredondar(desvioPadraoBruto),
      limiteInferior: SaneamentoEngine.arredondar(limiteInferiorBruto),
      limiteSuperior: SaneamentoEngine.arredondar(limiteSuperiorBruto),
      outliers,
      outliersChauvenet: chauvenet.outliers,
      outliersChauvenetDetalhes: chauvenet.detalhes,
      zCriticoChauvenet: chauvenet.zCritico
    };
  }
}
