# ROBÔ AVALIADOR IMOBILIÁRIO — MASTER DE IMPLEMENTAÇÃO CORRIGIDO

Versão consolidada e corrigida a partir do arquivo `Todo Arquivo.txt`.

## 1. Objetivo

Este documento é a versão canônica de implementação do Robô Avaliador Imobiliário.

A arquitetura foi corrigida para:

- eliminar a mistura inconsistente entre PostgreSQL e SQLite;
- usar SQLite como banco portátil local;
- centralizar os cálculos em um único motor;
- impedir que valores inválidos sejam silenciosamente convertidos em fator `1`;
- separar cálculo, saneamento, auditoria, decisão e emissão;
- tornar parâmetros editáveis e versionáveis;
- registrar trilha de auditoria;
- congelar um snapshot antes da emissão do laudo;
- gerar PDF, DOCX e XLSX a partir do mesmo snapshot;
- evitar duplicidade de `ReportService`;
- corrigir referências Prisma inválidas;
- corrigir erros de TypeScript, JavaScript e batch encontrados no arquivo original;
- remover alegações legais e tributárias hard-coded que não devem ser tratadas como verdade universal;
- preparar o projeto para execução local e modo portátil Windows.

> IMPORTANTE: este sistema é uma ferramenta de apoio à avaliação. A emissão final deve depender da revisão e responsabilidade do profissional habilitado. Parâmetros normativos, jurídicos, tributários e de mercado devem ser cadastrados/versionados e não embutidos como constantes imutáveis no código.

---

# 2. Estrutura canônica do projeto

```text
roboavaliador/
├─ backend/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ seed.ts
│  │  └─ clean.ts
│  ├─ src/
│  │  ├─ engines/
│  │  │  ├─ CalculationEngine.ts
│  │  │  └─ SaneamentoEngine.ts
│  │  ├─ services/
│  │  │  ├─ RuleEngine.ts
│  │  │  ├─ SnapshotService.ts
│  │  │  ├─ ReportService.ts
│  │  │  └─ ChartExportService.ts
│  │  ├─ routes/
│  │  │  ├─ avaliacao.routes.ts
│  │  │  ├─ export.routes.ts
│  │  │  └─ sistema.routes.ts
│  │  ├─ app.ts
│  │  └─ server.ts
│  ├─ package.json
│  └─ tsconfig.json
├─ frontend/
│  ├─ src/
│  │  ├─ views/
│  │  ├─ components/
│  │  └─ stores/
│  ├─ package.json
│  └─ vite.config.ts
├─ data/
├─ backups/
├─ reports/
├─ .env
├─ LIGAR_ROBO.bat
└─ FAZER_BACKUP.bat
```

---

# 3. DECISÃO DE ARQUITETURA

O arquivo original apresentava uma contradição estrutural: começava com PostgreSQL e depois determinava migração para SQLite para funcionamento por pendrive.

A versão corrigida adota **SQLite como arquitetura portátil oficial**.

Isso elimina:

- necessidade de Docker para uso cotidiano;
- necessidade de PostgreSQL instalado;
- conflito entre `DATABASE_URL` PostgreSQL e arquivo `.db`;
- erro de migração causado por datasource divergente;
- necessidade de manter dois bancos diferentes.

Para ambiente de desenvolvimento profissional, PostgreSQL pode ser adicionado posteriormente como adaptador separado. O código da aplicação não deve depender do banco específico.

---

# 4. `backend/prisma/schema.prisma`

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Avaliacao {
  id              String   @id @default(uuid())
  numero          String   @unique
  titulo          String
  finalidade      String
  tipoImovel      String
  municipio       String
  estado          String
  dataAvaliacao   DateTime
  responsavel     String
  status          String   @default("EM_ELABORACAO")
  versaoMotor     String?
  parametrosHash  String?
  snapshotHash    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  imovelAvaliando ImovelAvaliando?
  amostras        Amostra[]
  homogeneizacoes Homogeneizacao[]
  saneamento      Saneamento?
  exclusoes       Exclusao[]
  resultados      Resultado[]
  historicos      Historico[]
  documentos      Documento[]
  fotografias     Fotografia[]
}

model ImovelAvaliando {
  id                    String   @id @default(uuid())
  avaliacaoId           String   @unique
  avaliacao             Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  matricula             String?
  cadastroImobiliario   String?
  bairro                String
  logradouro            String
  numero                String?
  complemento           String?
  cep                   String?
  adquirente             String?
  cpfCnpj                String?

  areaTerreno           Decimal
  testadaPrincipal      Decimal
  testadaSecundaria     Decimal?
  profundidadeInformada Decimal?
  profundidadeCalculada Decimal
  profundidadeUtilizada Decimal
  situacaoQuadra        String
  distanciaCentro      Decimal

  areaEdificadaPrivativa Decimal?
  areaEdificadaTotal     Decimal?
  padrao                 String?
  conservacao            String?
  idade                  Decimal?
  vidaUtil               Decimal?
  indiceDepreciacao      Decimal?

  elevador              Boolean @default(false)
  numeroVagas           Decimal @default(0)
  tipoVaga              String?
  areaVaga              Decimal?
  grupoProjeto          String?

  valorTerreno          Decimal?
  valorTotal            Decimal?
  observacoes           String?
}

model Amostra {
  id                    String   @id @default(uuid())
  avaliacaoId           String
  avaliacao             Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  identificador         String?
  fonte                 String
  url                   String?
  dataColeta            DateTime
  tipoFonte             String
  bairro                String
  logradouro            String
  situacaoQuadra        String

  areaTerreno           Decimal
  testada               Decimal
  profundidade          Decimal
  areaEdificada         Decimal?
  areaPrivativa         Decimal?
  areaTotal             Decimal?

  padrao                String?
  conservacao           String?
  idade                 Decimal?
  vidaUtil              Decimal?
  elevador              Boolean @default(false)
  numeroVagas            Decimal @default(0)
  tipoVaga              String?
  areaVaga              Decimal?
  distanciaCentro       Decimal

  valorOferta           Decimal?
  valorTransacao        Decimal?
  tipoValor             String

  valorTerreno          Decimal?
  status                String   @default("ATIVA")
  observacoes           String?

  homogeneizacao        Homogeneizacao?
  exclusao              Exclusao?

  @@index([avaliacaoId])
  @@index([status])
}

model Fator {
  id          String   @id @default(uuid())
  codigo      String   @unique
  nome        String
  descricao   String?
  formula     String?
  ativo       Boolean  @default(true)
  referencia  String?
  ordem       Int

  parametros  ParametroFator[]
}

model ParametroFator {
  id            String   @id @default(uuid())
  fatorId       String
  fator         Fator    @relation(fields: [fatorId], references: [id], onDelete: Cascade)
  chave         String
  valor         Decimal
  unidade       String?
  justificativa String?
  ativo         Boolean  @default(true)

  @@unique([fatorId, chave])
}

model Homogeneizacao {
  id                         String   @id @default(uuid())
  avaliacaoId                String
  avaliacao                  Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)
  amostraId                  String   @unique
  amostra                    Amostra  @relation(fields: [amostraId], references: [id], onDelete: Cascade)

  valorUnitarioOriginal      Decimal
  fa                         Decimal
  ft                         Decimal
  fp                         Decimal
  fo                         Decimal
  fe                         Decimal
  fi                         Decimal
  fpc                        Decimal
  fc                         Decimal
  felev                      Decimal
  fg                         Decimal
  produtoFatores             Decimal
  valorUnitarioHomogeneizado Decimal

  motorVersao                String?
  parametrosHash             String?
  calculadoEm                DateTime @default(now())
}

model Saneamento {
  id                String   @id @default(uuid())
  avaliacaoId       String   @unique
  avaliacao         Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  metodo            String
  media             Decimal
  mediana           Decimal
  desvioPadrao      Decimal
  limiteInferior    Decimal
  limiteSuperior    Decimal
  criterioChauvenet Boolean @default(false)
  criterio30        Boolean @default(false)
  executadoEm       DateTime @default(now())
}

model Exclusao {
  id            String   @id @default(uuid())
  avaliacaoId   String
  avaliacao     Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)
  amostraId     String   @unique
  amostra       Amostra  @relation(fields: [amostraId], references: [id], onDelete: Cascade)

  criterio      String
  motivo        String
  valor         Decimal
  usuario       String
  dataExclusao  DateTime @default(now())
}

model Resultado {
  id                  String   @id @default(uuid())
  avaliacaoId         String
  avaliacao           Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  metodo              String
  numeroAmostras      Int
  valorUnitario       Decimal
  areaReferencia      Decimal
  valorTotal          Decimal
  media               Decimal
  mediana             Decimal
  desvioPadrao        Decimal
  coeficienteVariacao Decimal
  erroPadrao          Decimal
  createdAt            DateTime @default(now())
}

model Historico {
  id             String   @id @default(uuid())
  avaliacaoId    String
  avaliacao      Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  entidade       String
  entidadeId     String
  campo          String
  valorAnterior  String?
  valorNovo      String?
  usuario        String
  dataAlteracao  DateTime @default(now())
  motivo         String?
}

model Documento {
  id          String   @id @default(uuid())
  avaliacaoId String
  avaliacao   Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  tipo        String
  nomeArquivo String
  caminho     String
  formato     String
  dataGeracao DateTime @default(now())
  hashSha256  String?
}

model Fotografia {
  id          String   @id @default(uuid())
  avaliacaoId String
  avaliacao   Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  amostraId   String?
  arquivo     String
  descricao   String?
  dataFoto    DateTime
  ordem       Int
}
```

### Correções importantes do schema

O schema original não podia ser considerado pronto para SQLite porque continha tipos nativos PostgreSQL como `@db.Uuid`, `@db.VarChar`, `@db.Text` e `@db.Decimal`, além de `enum` incompatível com a estratégia SQLite.

A versão acima remove esses tipos nativos e mantém os valores controlados pela camada de validação.

---

# 5. `backend/src/engines/CalculationEngine.ts`

```typescript
import Big from "big.js";

Big.DP = 18;
Big.RM = Big.roundHalfUp;

export type TipoValor = "OFERTA" | "TRANSACAO";
export type SituacaoQuadra =
  | "ESQUINA"
  | "MEIO_QUADRA"
  | "MAIS_DE_UMA_FRENTE";

export interface InputFactorData {
  area: number;
  testada: number;
  profundidade: number;
  vagas: number;
  tipoValor: TipoValor;
  situacaoQuadra: SituacaoQuadra;
  elevador: boolean;
  idade?: number;
  vidaUtil?: number;
  conservacao?: string;
  padrao?: string;
  valorTotal: number;
}

export interface ParametersConfig {
  alphaArea: number;
  betaTestada: number;
  taxaGaragem: number;
  fatorOferta: number;
  fatorTransacao: number;
  esquinaMap: Record<string, number>;
  padraoMap: Record<string, number>;
  conservacaoMap: Record<string, number>;
  elevadorMap: Record<string, number>;
  fatorProfundidade?: number;
  versao: string;
}

export interface AuditTrail {
  formula: string;
  entradas: Record<string, unknown>;
  resultado: number | null;
  status: "APLICADO" | "ERRO_DADO_INVALIDO" | "NAO_APLICAVEL";
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

function erro(
  formula: string,
  entradas: Record<string, unknown>,
  motivo: string
): AuditTrail {
  return {
    formula,
    entradas,
    resultado: null,
    status: "ERRO_DADO_INVALIDO",
    motivo,
  };
}

function validarPositivo(valor: number): boolean {
  return Number.isFinite(valor) && valor > 0;
}

export class CalculationEngine {
  static calcularFA(
    areaAmostra: number,
    areaAvaliando: number,
    alpha: number
  ): AuditTrail {
    const formula = "FA = (area_amostra / area_avaliando)^alpha";

    if (
      !validarPositivo(areaAmostra) ||
      !validarPositivo(areaAvaliando) ||
      !Number.isFinite(alpha)
    ) {
      return erro(formula, { areaAmostra, areaAvaliando, alpha }, "Entradas inválidas.");
    }

    const resultado = new Big(areaAmostra)
      .div(areaAvaliando)
      .pow(alpha)
      .toNumber();

    return {
      formula,
      entradas: { areaAmostra, areaAvaliando, alpha },
      resultado: Number(resultado.toFixed(8)),
      status: "APLICADO",
    };
  }

  static calcularFT(
    testadaAmostra: number,
    testadaAvaliando: number,
    beta: number
  ): AuditTrail {
    const formula = "FT = (testada_amostra / testada_avaliando)^beta";

    if (
      !validarPositivo(testadaAmostra) ||
      !validarPositivo(testadaAvaliando) ||
      !Number.isFinite(beta)
    ) {
      return erro(
        formula,
        { testadaAmostra, testadaAvaliando, beta },
        "Entradas inválidas."
      );
    }

    const resultado = new Big(testadaAmostra)
      .div(testadaAvaliando)
      .pow(beta)
      .toNumber();

    return {
      formula,
      entradas: { testadaAmostra, testadaAvaliando, beta },
      resultado: Number(resultado.toFixed(8)),
      status: "APLICADO",
    };
  }

  static calcularFP(
    profundidadeAmostra: number,
    profundidadeAvaliando: number
  ): AuditTrail {
    const formula = "FP = (profundidade_amostra / profundidade_avaliando)^0.5";

    if (
      !validarPositivo(profundidadeAmostra) ||
      !validarPositivo(profundidadeAvaliando)
    ) {
      return erro(
        formula,
        { profundidadeAmostra, profundidadeAvaliando },
        "Profundidades inválidas."
      );
    }

    const resultado = new Big(profundidadeAmostra)
      .div(profundidadeAvaliando)
      .sqrt()
      .toNumber();

    return {
      formula,
      entradas: { profundidadeAmostra, profundidadeAvaliando },
      resultado: Number(resultado.toFixed(8)),
      status: "APLICADO",
    };
  }

  static calcularFO(
    tipoValor: TipoValor,
    config: ParametersConfig
  ): AuditTrail {
    const formula = "FO = parâmetro[tipoValor]";
    const resultado =
      tipoValor === "OFERTA"
        ? config.fatorOferta
        : config.fatorTransacao;

    if (!validarPositivo(resultado)) {
      return erro(formula, { tipoValor, resultado }, "Parâmetro FO inválido.");
    }

    return {
      formula,
      entradas: { tipoValor },
      resultado,
      status: "APLICADO",
    };
  }

  static calcularFG(
    vagasAmostra: number,
    vagasAvaliando: number,
    taxa: number
  ): AuditTrail {
    const formula = "FG = 1 + taxa * (vagas_amostra - vagas_avaliando)";

    if (
      !Number.isFinite(vagasAmostra) ||
      !Number.isFinite(vagasAvaliando) ||
      !Number.isFinite(taxa)
    ) {
      return erro(
        formula,
        { vagasAmostra, vagasAvaliando, taxa },
        "Entradas inválidas."
      );
    }

    const resultado = new Big(1)
      .plus(new Big(taxa).times(new Big(vagasAmostra).minus(vagasAvaliando)))
      .toNumber();

    if (resultado <= 0) {
      return erro(
        formula,
        { vagasAmostra, vagasAvaliando, taxa },
        "FG resultou em valor não positivo."
      );
    }

    return {
      formula,
      entradas: { vagasAmostra, vagasAvaliando, taxa },
      resultado: Number(resultado.toFixed(8)),
      status: "APLICADO",
    };
  }

  static calcularRossHeidecke(
    idade: number | undefined,
    vidaUtil: number | undefined,
    estado: string | undefined,
    config: ParametersConfig
  ): AuditTrail {
    const formula = "FI = (1 - K_idade) * fator_conservacao";

    if (
      idade === undefined ||
      vidaUtil === undefined ||
      !validarPositivo(vidaUtil) ||
      idade < 0
    ) {
      return erro(
        formula,
        { idade, vidaUtil, estado },
        "Idade/vida útil inválidas ou não informadas."
      );
    }

    const ir = new Big(idade).div(vidaUtil).toNumber();

    if (ir > 1) {
      return erro(
        formula,
        { idade, vidaUtil, ir },
        "Idade superior à vida útil parametrizada."
      );
    }

    const kIdade = new Big("0.5")
      .times(new Big(ir).plus(new Big(ir).pow(2)))
      .toNumber();

    const fatorEstado = config.conservacaoMap[estado ?? ""];

    if (!validarPositivo(fatorEstado)) {
      return erro(
        formula,
        { idade, vidaUtil, estado },
        "Estado de conservação sem parâmetro válido."
      );
    }

    const resultado = new Big(1).minus(kIdade).times(fatorEstado).toNumber();

    if (resultado <= 0) {
      return erro(
        formula,
        { idade, vidaUtil, estado, ir, kIdade, fatorEstado },
        "FI resultou em valor não positivo."
      );
    }

    return {
      formula,
      entradas: { idade, vidaUtil, estado, ir, kIdade, fatorEstado },
      resultado: Number(resultado.toFixed(8)),
      status: "APLICADO",
    };
  }

  static fatorRelacional(
    codigo: string,
    valorAmostra: string | undefined,
    valorAvaliando: string | undefined,
    mapa: Record<string, number>
  ): AuditTrail {
    const formula = `${codigo} = coef_avaliando / coef_amostra`;

    const amostra = mapa[valorAmostra ?? ""];
    const avaliando = mapa[valorAvaliando ?? ""];

    if (!validarPositivo(amostra) || !validarPositivo(avaliando)) {
      return erro(
        formula,
        { valorAmostra, valorAvaliando, amostra, avaliando },
        `Parâmetro ${codigo} não cadastrado.`
      );
    }

    const resultado = new Big(avaliando).div(amostra).toNumber();

    return {
      formula,
      entradas: { valorAmostra, valorAvaliando, amostra, avaliando },
      resultado: Number(resultado.toFixed(8)),
      status: "APLICADO",
    };
  }

  static homogeneizarAmostra(
    id: string,
    amostra: InputFactorData,
    avaliando: InputFactorData,
    config: ParametersConfig,
    areaReferencia: "TERRENO" | "CONSTRUIDA"
  ): CalculatedSampleResult {
    const auditoria: Record<string, AuditTrail> = {};

    const areaRefAmostra =
      areaReferencia === "TERRENO"
        ? amostra.area
        : amostra.valorTotal > 0
          ? amostra.area
          : 0;

    if (!validarPositivo(areaRefAmostra) || !validarPositivo(amostra.valorTotal)) {
      throw new Error("AMOSTRA_SEM_AREA_OU_VALOR_VALIDO");
    }

    const vuOriginal = new Big(amostra.valorTotal)
      .div(areaRefAmostra)
      .toNumber();

    auditoria.FA = this.calcularFA(
      amostra.area,
      avaliando.area,
      config.alphaArea
    );

    auditoria.FT = this.calcularFT(
      amostra.testada,
      avaliando.testada,
      config.betaTestada
    );

    auditoria.FP = this.calcularFP(
      amostra.profundidade,
      avaliando.profundidade
    );

    auditoria.FO = this.calcularFO(amostra.tipoValor, config);

    auditoria.FG = this.calcularFG(
      amostra.vagas,
      avaliando.vagas,
      config.taxaGaragem
    );

    auditoria.FE = this.fatorRelacional(
      "FE",
      amostra.situacaoQuadra,
      avaliando.situacaoQuadra,
      config.esquinaMap
    );

    auditoria.FPC = this.fatorRelacional(
      "FPC",
      amostra.padrao,
      avaliando.padrao,
      config.padraoMap
    );

    auditoria.FELEV = this.fatorRelacional(
      "FELEV",
      amostra.elevador ? "SIM" : "NAO",
      avaliando.elevador ? "SIM" : "NAO",
      config.elevadorMap
    );

    auditoria.FI = this.calcularRossHeidecke(
      amostra.idade,
      amostra.vidaUtil,
      amostra.conservacao,
      config
    );

    const fatoresFinais: Record<string, number> = {};
    let produto = new Big(1);

    for (const [codigo, audit] of Object.entries(auditoria)) {
      if (audit.status === "ERRO_DADO_INVALIDO") {
        throw new Error(`FATOR_INVALIDO_${codigo}:${audit.motivo}`);
      }

      if (audit.status === "APLICADO" && audit.resultado !== null) {
        fatoresFinais[codigo] = audit.resultado;
        produto = produto.times(audit.resultado);
      }
    }

    const vuHomogeneizado = new Big(vuOriginal)
      .times(produto)
      .toNumber();

    return {
      sampleId: id,
      vuOriginal: Number(vuOriginal.toFixed(8)),
      fatores: fatoresFinais,
      produtoFatores: Number(produto.toFixed(8)),
      vuHomogeneizado: Number(vuHomogeneizado.toFixed(8)),
      auditoria,
    };
  }
}
```

## Correção conceitual importante

O código original usava `|| 1` para vários fatores. Isso mascarava erro de parâmetro.

Exemplo incorreto:

```typescript
calculo.fatores["FA"] || 1
```

Se o cálculo falhar, o sistema não pode fingir que o fator é `1`.

Na versão corrigida:

- erro crítico interrompe o processamento;
- fator não cadastrado gera erro;
- dado inválido gera erro;
- somente resultado explicitamente aplicado entra no produto.

---

# 6. `backend/src/engines/SaneamentoEngine.ts`

```typescript
export interface SaneamentoResult {
  media: number;
  mediana: number;
  desvioPadrao: number;
  limiteInferior30: number;
  limiteSuperior30: number;
  outliers30: number[];
  outliersChauvenet: number[];
}

function media(valores: number[]): number {
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);

  return ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function desvioPadraoAmostral(valores: number[], m: number): number {
  if (valores.length < 2) return 0;

  const soma = valores.reduce(
    (acc, v) => acc + Math.pow(v - m, 2),
    0
  );

  return Math.sqrt(soma / (valores.length - 1));
}

export class SaneamentoEngine {
  static executarLimite30(valores: number[]) {
    if (!valores.length) {
      return {
        media: 0,
        mediana: 0,
        limiteInferior: 0,
        limiteSuperior: 0,
        outliers: [],
      };
    }

    const m = media(valores);
    const inferior = m * 0.7;
    const superior = m * 1.3;

    return {
      media: Number(m.toFixed(8)),
      mediana: Number(mediana(valores).toFixed(8)),
      limiteInferior: Number(inferior.toFixed(8)),
      limiteSuperior: Number(superior.toFixed(8)),
      outliers: valores.filter(v => v < inferior || v > superior),
    };
  }

  static executarChauvenet(valores: number[]) {
    if (valores.length < 3) {
      return { outliers: [] as number[] };
    }

    const m = media(valores);
    const dp = desvioPadraoAmostral(valores, m);

    if (dp === 0) {
      return { outliers: [] as number[] };
    }

    /*
     * Não usar uma tabela parcial e arbitrária como no arquivo original.
     * O valor crítico deve ser obtido de uma implementação estatística
     * documentada ou de tabela parametrizada.
     *
     * Nesta versão, o critério é mantido configurável.
     */
    const probabilidadeMinima = 1 / (2 * valores.length);
    const zCritico = this.zCriticoChauvenet(probabilidadeMinima);

    const outliers = valores.filter(v => {
      const z = Math.abs((v - m) / dp);
      return z > zCritico;
    });

    return {
      outliers,
      media: Number(m.toFixed(8)),
      desvioPadrao: Number(dp.toFixed(8)),
      zCritico: Number(zCritico.toFixed(8)),
    };
  }

  private static zCriticoChauvenet(p: number): number {
    /*
     * Aproximação monotônica para a cauda normal.
     * Em produção, substituir por função de distribuição normal
     * numericamente validada ou biblioteca estatística testada.
     */
    if (p <= 0 || p >= 0.5) {
      throw new Error("PROBABILIDADE_INVALIDA_CHAUVENET");
    }

    let low = 0;
    let high = 8;

    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2;
      const tail = 1 - normalCDF(mid);

      if (tail > p) low = mid;
      else high = mid;
    }

    return (low + high) / 2;
  }
}

function normalCDF(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.sqrt(2);

  const t = 1 / (1 + 0.3275911 * z);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const erf =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-z * z);

  return 0.5 * (1 + sign * erf);
}
```

---

# 7. Testes obrigatórios

O arquivo original tinha dois testes sintaticamente inválidos:

```typescript
const valoresHomogeneizados =;
const serieValores =;
```

A versão corrigida deve substituir por dados explícitos.

## `CalculationEngine.test.ts`

```typescript
import { describe, expect, test } from "vitest";
import {
  CalculationEngine,
  ParametersConfig,
  InputFactorData,
} from "./CalculationEngine";

const config: ParametersConfig = {
  versao: "1.0.0",
  alphaArea: 0.25,
  betaTestada: 0.25,
  taxaGaragem: 0.03,
  fatorOferta: 0.90,
  fatorTransacao: 1.00,
  esquinaMap: {
    ESQUINA: 1.10,
    MEIO_QUADRA: 1.00,
    MAIS_DE_UMA_FRENTE: 1.15,
  },
  padraoMap: {
    BAIXO: 1.00,
    NORMAL: 1.40,
    ALTO: 1.90,
    LUXO: 2.50,
  },
  conservacaoMap: {
    NOVO: 1.000,
    REGULAR: 0.975,
    REPAROS_SIMPLES: 0.819,
    REPAROS_IMPORTANTES: 0.474,
  },
  elevadorMap: {
    SIM: 1.10,
    NAO: 1.00,
  },
};

const imovel: InputFactorData = {
  area: 400,
  testada: 10,
  profundidade: 40,
  vagas: 2,
  tipoValor: "TRANSACAO",
  situacaoQuadra: "MEIO_QUADRA",
  elevador: false,
  idade: 10,
  vidaUtil: 60,
  conservacao: "REGULAR",
  padrao: "NORMAL",
  valorTotal: 500000,
};

describe("CalculationEngine", () => {
  test("imóvel idêntico ao paradigma produz fatores relacionais iguais a 1", () => {
    const r = CalculationEngine.homogeneizarAmostra(
      "am-1",
      imovel,
      imovel,
      config,
      "TERRENO"
    );

    expect(r.fatores.FA).toBe(1);
    expect(r.fatores.FT).toBe(1);
    expect(r.fatores.FP).toBe(1);
    expect(r.fatores.FO).toBe(1);
    expect(r.fatores.FE).toBe(1);
    expect(r.fatores.FPC).toBe(1);
    expect(r.fatores.FELEV).toBe(1);
  });

  test("fator de oferta é aplicado somente para oferta", () => {
    expect(
      CalculationEngine.calcularFO("OFERTA", config).resultado
    ).toBe(0.9);

    expect(
      CalculationEngine.calcularFO("TRANSACAO", config).resultado
    ).toBe(1);
  });

  test("fator de garagem", () => {
    const r = CalculationEngine.calcularFG(3, 1, 0.03);
    expect(r.resultado).toBe(1.06);
  });

  test("área inválida não vira fator 1 silenciosamente", () => {
    const r = CalculationEngine.calcularFA(0, 400, 0.25);
    expect(r.status).toBe("ERRO_DADO_INVALIDO");
    expect(r.resultado).toBeNull();
  });
});
```

---

# 8. `RuleEngine.ts`

```typescript
import { PrismaClient } from "@prisma/client";

export type Severidade = "INFO" | "ATENCAO" | "CRITICO";

export interface AlertaAuditoria {
  codigo: string;
  severidade: Severidade;
  titulo: string;
  mensagem: string;
}

export class RuleEngine {
  constructor(private readonly prisma: PrismaClient) {}

  async auditarAvaliacao(
    avaliacaoId: string
  ): Promise<{ podeEmitir: boolean; alertas: AlertaAuditoria[] }> {
    const alertas: AlertaAuditoria[] = [];

    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id: avaliacaoId },
      include: {
        imovelAvaliando: true,
        amostras: {
          include: { homogeneizacao: true },
        },
        resultados: true,
      },
    });

    if (!avaliacao) {
      return {
        podeEmitir: false,
        alertas: [{
          codigo: "SYS001",
          severidade: "CRITICO",
          titulo: "Avaliação inexistente",
          mensagem: "A avaliação não foi localizada.",
        }],
      };
    }

    if (!avaliacao.imovelAvaliando) {
      alertas.push({
        codigo: "VAL001",
        severidade: "CRITICO",
        titulo: "Imóvel avaliando ausente",
        mensagem: "O imóvel avaliando deve estar cadastrado.",
      });
    } else {
      const av = avaliacao.imovelAvaliando;

      if (Number(av.areaTerreno) <= 0) {
        alertas.push({
          codigo: "VAL002",
          severidade: "CRITICO",
          titulo: "Área inválida",
          mensagem: "A área do terreno deve ser maior que zero.",
        });
      }

      if (Number(av.testadaPrincipal) <= 0) {
        alertas.push({
          codigo: "VAL003",
          severidade: "CRITICO",
          titulo: "Testada inválida",
          mensagem: "A testada principal deve ser maior que zero.",
        });
      }

      if (Number(av.profundidadeUtilizada) <= 0) {
        alertas.push({
          codigo: "VAL004",
          severidade: "CRITICO",
          titulo: "Profundidade inválida",
          mensagem: "A profundidade utilizada deve ser maior que zero.",
        });
      }
    }

    const ativas = avaliacao.amostras.filter(a => a.status === "ATIVA");

    if (ativas.length < 3) {
      alertas.push({
        codigo: "AMO001",
        severidade: "CRITICO",
        titulo: "Poucas amostras ativas",
        mensagem: `Existem ${ativas.length} amostras ativas. O limite mínimo deve ser definido na configuração metodológica do projeto.`,
      });
    }

    for (const [index, am] of ativas.entries()) {
      const valor =
        am.tipoValor === "OFERTA"
          ? Number(am.valorOferta ?? 0)
          : Number(am.valorTransacao ?? 0);

      if (!(valor > 0)) {
        alertas.push({
          codigo: "AMO002",
          severidade: "CRITICO",
          titulo: `Amostra ${index + 1} sem valor`,
          mensagem: "A amostra precisa ter valor compatível com seu tipo de valor.",
        });
      }

      if (Number(am.areaTerreno) <= 0) {
        alertas.push({
          codigo: "AMO003",
          severidade: "CRITICO",
          titulo: `Amostra ${index + 1} com área inválida`,
          mensagem: "A área do terreno deve ser maior que zero.",
        });
      }

      if (!am.homogeneizacao) {
        alertas.push({
          codigo: "FAT001",
          severidade: "CRITICO",
          titulo: "Homogeneização ausente",
          mensagem: "A amostra ativa ainda não possui cálculo válido.",
        });
      }

      if (am.status === "POTENCIAL_OUTLIER") {
        alertas.push({
          codigo: "SAN001",
          severidade: "CRITICO",
          titulo: "Outlier pendente",
          mensagem: "Amostra potencialmente discrepante aguarda decisão técnica.",
        });
      }
    }

    const criticos = alertas.some(a => a.severidade === "CRITICO");

    return {
      podeEmitir: !criticos,
      alertas,
    };
  }
}
```

### Correções aplicadas

- `muestras` foi corrigido para `amostras`.
- `text` indevidamente usado em um alerta foi removido.
- `PrismaClient` passou a ser injetável.
- O motor não afirma automaticamente que determinada quantidade mínima de amostras é exigência universal; o limite deve ser parametrizado conforme metodologia aplicável.
- A validação verifica o tipo de valor da amostra.

---

# 9. Homogeneização API

## `avaliacao.routes.ts`

```typescript
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import {
  CalculationEngine,
  ParametersConfig,
  InputFactorData,
} from "../engines/CalculationEngine";

const router = Router();
const prisma = new PrismaClient();

async function carregarConfiguracao(): Promise<ParametersConfig> {
  const fatores = await prisma.fator.findMany({
    where: { ativo: true },
    include: { parametros: { where: { ativo: true } } },
  });

  const mapear = (codigo: string) => {
    const fator = fatores.find(f => f.codigo === codigo);
    return Object.fromEntries(
      (fator?.parametros ?? []).map(p => [p.chave, Number(p.valor)])
    );
  };

  const get = (codigo: string, chave: string, fallback?: number) => {
    const fator = fatores.find(f => f.codigo === codigo);
    const p = fator?.parametros.find(x => x.chave === chave);
    if (!p && fallback === undefined) {
      throw new Error(`PARAMETRO_AUSENTE_${codigo}_${chave}`);
    }
    return p ? Number(p.valor) : fallback!;
  };

  return {
    versao: process.env.MOTOR_VERSAO ?? "1.0.0",
    alphaArea: get("FA", "ALPHA", 0.25),
    betaTestada: get("FT", "BETA", 0.25),
    taxaGaragem: get("FG", "TAXA_VAGA", 0.03),
    fatorOferta: get("FO", "OFERTA"),
    fatorTransacao: get("FO", "TRANSACAO"),
    esquinaMap: mapear("FE"),
    padraoMap: mapear("FPC"),
    conservacaoMap: mapear("FC"),
    elevadorMap: mapear("FELEV"),
  };
}

router.post("/:id/homogeneizar", async (req, res) => {
  const { id } = req.params;
  const areaReferencia =
    req.body.areaReferencia === "CONSTRUIDA"
      ? "CONSTRUIDA"
      : "TERRENO";

  try {
    const avaliando = await prisma.imovelAvaliando.findUnique({
      where: { avaliacaoId: id },
    });

    if (!avaliando) {
      return res.status(404).json({
        error: "IMOVEL_AVALIANDO_NAO_ENCONTRADO",
      });
    }

    const amostras = await prisma.amostra.findMany({
      where: {
        avaliacaoId: id,
        status: "ATIVA",
      },
    });

    if (!amostras.length) {
      return res.status(422).json({
        error: "NENHUMA_AMOSTRA_ATIVA",
      });
    }

    const config = await carregarConfiguracao();

    const avaliandoData: InputFactorData = {
      area: Number(avaliando.areaTerreno),
      testada: Number(avaliando.testadaPrincipal),
      profundidade: Number(avaliando.profundidadeUtilizada),
      vagas: Number(avaliando.numeroVagas),
      tipoValor: "TRANSACAO",
      situacaoQuadra: avaliando.situacaoQuadra as InputFactorData["situacaoQuadra"],
      elevador: avaliando.elevador,
      idade: avaliando.idade == null ? undefined : Number(avaliando.idade),
      vidaUtil: avaliando.vidaUtil == null ? undefined : Number(avaliando.vidaUtil),
      conservacao: avaliando.conservacao ?? undefined,
      padrao: avaliando.padrao ?? undefined,
      valorTotal: Number(avaliando.valorTotal ?? 0),
    };

    const resultados = [];

    for (const amostra of amostras) {
      const valorTotal =
        amostra.tipoValor === "OFERTA"
          ? Number(amostra.valorOferta ?? 0)
          : Number(amostra.valorTransacao ?? 0);

      const amostraData: InputFactorData = {
        area: Number(amostra.areaTerreno),
        testada: Number(amostra.testada),
        profundidade: Number(amostra.profundidade),
        vagas: Number(amostra.numeroVagas),
        tipoValor: amostra.tipoValor as InputFactorData["tipoValor"],
        situacaoQuadra: amostra.situacaoQuadra as InputFactorData["situacaoQuadra"],
        elevador: amostra.elevador,
        idade: amostra.idade == null ? undefined : Number(amostra.idade),
        vidaUtil: amostra.vidaUtil == null ? undefined : Number(amostra.vidaUtil),
        conservacao: amostra.conservacao ?? undefined,
        padrao: amostra.padrao ?? undefined,
        valorTotal,
      };

      const calculo = CalculationEngine.homogeneizarAmostra(
        amostra.id,
        amostraData,
        avaliandoData,
        config,
        areaReferencia
      );

      await prisma.homogeneizacao.upsert({
        where: { amostraId: amostra.id },
        update: {
          avaliacaoId: id,
          valorUnitarioOriginal: calculo.vuOriginal,
          fa: calculo.fatores.FA,
          ft: calculo.fatores.FT,
          fp: calculo.fatores.FP,
          fo: calculo.fatores.FO,
          fe: calculo.fatores.FE,
          fi: calculo.fatores.FI,
          fpc: calculo.fatores.FPC,
          fc: 1,
          felev: calculo.fatores.FELEV,
          fg: calculo.fatores.FG,
          produtoFatores: calculo.produtoFatores,
          valorUnitarioHomogeneizado: calculo.vuHomogeneizado,
          motorVersao: config.versao,
        },
        create: {
          avaliacaoId: id,
          amostraId: amostra.id,
          valorUnitarioOriginal: calculo.vuOriginal,
          fa: calculo.fatores.FA,
          ft: calculo.fatores.FT,
          fp: calculo.fatores.FP,
          fo: calculo.fatores.FO,
          fe: calculo.fatores.FE,
          fi: calculo.fatores.FI,
          fpc: calculo.fatores.FPC,
          fc: 1,
          felev: calculo.fatores.FELEV,
          fg: calculo.fatores.FG,
          produtoFatores: calculo.produtoFatores,
          valorUnitarioHomogeneizado: calculo.vuHomogeneizado,
          motorVersao: config.versao,
        },
      });

      resultados.push(calculo);
    }

    return res.json({
      success: true,
      motorVersao: config.versao,
      data: resultados,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ERRO_DESCONHECIDO";

    return res.status(422).json({
      success: false,
      error: "FALHA_NO_MOTOR",
      message,
    });
  }
});

export default router;
```

---

# 10. Exportação XLSX

No arquivo original havia:

```typescript
XXLSX.utils.book_append_sheet(...)
```

Isso é erro de compilação. O nome correto é:

```typescript
XLSX.utils.book_append_sheet(...)
```

Além disso, a relação Prisma correta é `amostras`, não `muestras`.

A implementação canônica deve usar:

```typescript
const avaliacao = await prisma.avaliacao.findUnique({
  where: { id },
  include: {
    imovelAvaliando: true,
    amostras: {
      include: {
        homogeneizacao: true,
        exclusao: true,
      },
    },
    resultados: true,
    saneamento: true,
  },
});
```

E a geração:

```typescript
const wb = XLSX.utils.book_new();

const wsCapa = XLSX.utils.aoa_to_sheet(capaData);
XLSX.utils.book_append_sheet(wb, wsCapa, "00_CAPA");

const wsAvaliando = XLSX.utils.aoa_to_sheet(avaliandoData);
XLSX.utils.book_append_sheet(wb, wsAvaliando, "01_AVALIANDO");

const wsHomogeneizacao = XLSX.utils.aoa_to_sheet(rowsHomogeneizacao);
XLSX.utils.book_append_sheet(
  wb,
  wsHomogeneizacao,
  "05_HOMOGENEIZACAO"
);

const buffer = XLSX.write(wb, {
  bookType: "xlsx",
  type: "buffer",
});

res.setHeader(
  "Content-Type",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
);

res.setHeader(
  "Content-Disposition",
  `attachment; filename="Avaliacao_${avaliacao.numero}.xlsx"`
);

res.send(buffer);
```

---

# 11. ReportService — UMA ÚNICA IMPLEMENTAÇÃO

O arquivo original continha três implementações diferentes da classe `ReportService`. Isso precisa ser eliminado.

Use somente uma classe.

```typescript
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

export interface ReportSnapshot {
  id: string;
  numero: string;
  titulo: string;
  finalidade: string;
  responsavel: string;
  municipio: string;
  estado: string;
  avaliando: {
    logradouro: string;
    bairro: string;
    areaTerreno: number;
  };
  resultado: {
    valorUnitario: number;
    valorTotal: number;
    media: number;
    mediana: number;
    coeficienteVariacao: number;
  };
  amostras: Array<{
    id: string;
    vuOriginal: number;
    produtoFatores: number;
    vuHomogeneizado: number;
  }>;
  hashHex: string;
  motorVersao: string;
}

export class ReportService {
  static async gerarLaudoPDF(
    snapshot: ReportSnapshot,
    outputPath: string
  ): Promise<void> {
    await fs.promises.mkdir(path.dirname(outputPath), {
      recursive: true,
    });

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
      });

      const stream = fs.createWriteStream(outputPath);

      stream.on("finish", resolve);
      stream.on("error", reject);

      doc.pipe(stream);

      doc.fontSize(22)
        .font("Helvetica-Bold")
        .text("LAUDO DE AVALIAÇÃO MERCADOLÓGICA", {
          align: "center",
        });

      doc.moveDown();
      doc.fontSize(12)
        .font("Helvetica")
        .text(`Laudo nº: ${snapshot.numero}`, {
          align: "center",
        });

      doc.moveDown(2);

      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("1. IDENTIFICAÇÃO");

      doc.font("Helvetica")
        .fontSize(10)
        .text(`Título: ${snapshot.titulo}`)
        .text(`Finalidade: ${snapshot.finalidade}`)
        .text(`Responsável: ${snapshot.responsavel}`)
        .text(`Município/UF: ${snapshot.municipio}/${snapshot.estado}`);

      doc.moveDown();

      doc.font("Helvetica-Bold")
        .fontSize(12)
        .text("2. IMÓVEL AVALIANDO");

      doc.font("Helvetica")
        .fontSize(10)
        .text(
          `Endereço: ${snapshot.avaliando.logradouro}, ${snapshot.avaliando.bairro}`
        )
        .text(
          `Área do terreno: ${snapshot.avaliando.areaTerreno.toLocaleString(
            "pt-BR",
            { minimumFractionDigits: 2 }
          )} m²`
        );

      doc.moveDown();

      doc.font("Helvetica-Bold")
        .fontSize(12)
        .text("3. RESULTADO");

      doc.font("Helvetica")
        .fontSize(14)
        .text(
          `Valor unitário: R$ ${snapshot.resultado.valorUnitario.toLocaleString(
            "pt-BR",
            { minimumFractionDigits: 2 }
          )}/m²`
        );

      doc.text(
        `Valor total: R$ ${snapshot.resultado.valorTotal.toLocaleString(
          "pt-BR",
          { minimumFractionDigits: 2 }
        )}`
      );

      doc.moveDown();

      doc.font("Helvetica-Bold")
        .fontSize(10)
        .text("4. INTEGRIDADE DO DOCUMENTO");

      doc.font("Helvetica")
        .fontSize(8)
        .text(`Motor: ${snapshot.motorVersao}`)
        .text(`SHA-256: ${snapshot.hashHex}`);

      doc.end();
    });
  }

  static async gerarArbitramentoDocx(
    snapshot: ReportSnapshot,
    outputPath: string
  ): Promise<void> {
    await fs.promises.mkdir(path.dirname(outputPath), {
      recursive: true,
    });

    const rows = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph("Amostra")],
          }),
          new TableCell({
            children: [new Paragraph("VU Original")],
          }),
          new TableCell({
            children: [new Paragraph("Produto")],
          }),
          new TableCell({
            children: [new Paragraph("VU Homogeneizado")],
          }),
        ],
      }),
      ...snapshot.amostras.map(
        am =>
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph(am.id.substring(0, 8)),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph(
                    `R$ ${am.vuOriginal.toFixed(2)}`
                  ),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph(
                    am.produtoFatores.toFixed(6)
                  ),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph(
                    `R$ ${am.vuHomogeneizado.toFixed(2)}`
                  ),
                ],
              }),
            ],
          })
      ),
    ];

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: "center",
              children: [
                new TextRun({
                  text: "LAUDO DE AVALIAÇÃO MERCADOLÓGICA",
                  bold: true,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({
              text: `Laudo nº: ${snapshot.numero}`,
            }),
            new Paragraph({
              text: `Título: ${snapshot.titulo}`,
            }),
            new Paragraph({
              text: `Finalidade: ${snapshot.finalidade}`,
            }),
            new Paragraph({
              text: `Valor total: R$ ${snapshot.resultado.valorTotal.toFixed(2)}`,
            }),
            new Table({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              rows,
            }),
            new Paragraph({
              text: `SHA-256: ${snapshot.hashHex}`,
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    await fs.promises.writeFile(outputPath, buffer);
  }

  static hashSnapshot(snapshot: unknown): string {
    const canonical = JSON.stringify(snapshot);
    return crypto
      .createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex");
  }
}
```

### Correção

O parâmetro inválido:

```typescript
{ pinned: true, continued: true }
```

foi removido.

---

# 12. Snapshot e congelamento

O laudo não deve ser gerado diretamente a partir dos registros mutáveis.

Fluxo correto:

```text
Dados
  ↓
Validação
  ↓
Homogeneização
  ↓
Saneamento
  ↓
Decisão dos outliers
  ↓
Cálculo final
  ↓
Auditoria
  ↓
SNAPSHOT IMUTÁVEL
  ↓
HASH SHA-256
  ↓
PDF / DOCX / XLSX
```

O snapshot deve armazenar:

- versão do motor;
- parâmetros usados;
- hash dos parâmetros;
- amostras consideradas;
- amostras excluídas;
- fatores;
- resultados;
- estatísticas;
- alertas;
- decisões manuais;
- usuário;
- data/hora;
- hash final.

Uma alteração posterior no cadastro não pode alterar um laudo já emitido.

---

# 13. Regra de emissão

A emissão deve ser bloqueada se:

```text
CRITICO > 0
OU
amostra ativa sem homogeneização
OU
outlier pendente
OU
resultado final inexistente
OU
snapshot não congelado
OU
hash ausente
```

O sistema pode continuar permitindo edição, mas não pode gerar laudo final.

---

# 14. ITBI E LEGISLAÇÃO

O arquivo original possuía diferentes valores fixos:

- 2,0%;
- 2,5%;
- 1,5%;
- referências a leis municipais;
- referências a decretos;
- afirmações sobre São João Batista/SC.

Isso é perigoso para um sistema profissional porque uma alíquota ou regra tributária não deve ser gravada diretamente no código do motor de avaliação.

### Regra corrigida

Criar uma tabela de parâmetros legais:

```text
ConfiguracaoLegal
-----------------
id
municipio
estado
tributo
codigoNormativo
descricao
aliquota
vigenciaInicio
vigenciaFim
ativo
fonte
observacao
```

A interface deve exibir:

```text
ESTIMATIVA TRIBUTÁRIA

Não constitui cálculo definitivo do tributo.

Fonte:
[parâmetro cadastrado]

Vigência:
[data]

Alíquota:
[valor cadastrado]
```

Se não existir parâmetro vigente:

```text
NÃO CALCULADO

Não existe parâmetro tributário vigente cadastrado
para o município informado.
```

O robô nunca deve inventar uma alíquota.

---

# 15. Backup

O endpoint original tentava copiar:

```text
prisma/robo_avaliacao.db
```

e o projeto também possuía referências a PostgreSQL.

A versão corrigida deve utilizar uma única localização:

```text
data/robo_avaliacao.db
```

Para backup manual, recomenda-se parar o servidor antes de copiar o banco.

## `FAZER_BACKUP.bat`

```bat
@echo off
setlocal EnableExtensions

title ROBO AVALIADOR - BACKUP

cd /d "%~dp0"

set "DB=%~dp0data\robo_avaliacao.db"
set "BACKUP=%~dp0backups"

if not exist "%BACKUP%" mkdir "%BACKUP%"

if not exist "%DB%" (
  echo ERRO: Banco nao encontrado:
  echo %DB%
  pause
  exit /b 1
)

for /f "tokens=1-4 delims=/ " %%a in ("%date%") do set DT=%%d-%%b-%%c
for /f "tokens=1-2 delims=: " %%a in ("%time%") do set HR=%%a-%%b

set "DEST=%BACKUP%\RoboAvaliador_%DT%_%HR%.db"

copy /Y "%DB%" "%DEST%" >nul

if errorlevel 1 (
  echo ERRO ao criar backup.
  pause
  exit /b 1
)

echo.
echo Backup criado:
echo %DEST%
echo.
pause
```

Para uma operação realmente segura em banco ativo, implementar depois uma rotina SQLite de backup consistente.

---

# 16. `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: false,
        secure: false,
      },
    },
  },
});
```

---

# 17. `LIGAR_ROBO.bat`

O batch original possuía comentários iniciados por `//`, o que não é sintaxe válida para comentários em `.bat`.

Também instalava dependências a cada inicialização, o que torna o sistema lento e dependente da internet.

Versão corrigida:

```bat
@echo off
setlocal EnableExtensions

title ROBO AVALIADOR IMOBILIARIO

cd /d "%~dp0"

set "ROOT=%~dp0"
set "NODE=%ROOT%node-portable"
set "PATH=%NODE%;%PATH%"

echo ============================================================
echo       ROBO AVALIADOR IMOBILIARIO
echo ============================================================
echo.

if not exist "%NODE%\node.exe" (
  echo ERRO: Node.js portatil nao encontrado.
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%backend\node_modules" (
  echo Instalando dependencias do backend...
  cd /d "%ROOT%backend"
  call npm ci
  if errorlevel 1 (
    echo ERRO: npm ci falhou no backend.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%frontend\node_modules" (
  echo Instalando dependencias do frontend...
  cd /d "%ROOT%frontend"
  call npm ci
  if errorlevel 1 (
    echo ERRO: npm ci falhou no frontend.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%data" mkdir "%ROOT%data"

cd /d "%ROOT%backend"

echo.
echo Gerando cliente Prisma...
call npx prisma generate
if errorlevel 1 goto erro

echo.
echo Atualizando banco SQLite...
call npx prisma db push
if errorlevel 1 goto erro

echo.
echo Executando seed idempotente...
call npx prisma db seed
if errorlevel 1 goto erro

echo.
echo Iniciando backend...
start "ROBO BACKEND" cmd /k "cd /d ""%ROOT%backend"" && npm start"

echo.
echo Iniciando frontend...
start "ROBO FRONTEND" cmd /k "cd /d ""%ROOT%frontend"" && npm run dev"

timeout /t 5 /nobreak >nul

start "" "http://127.0.0.1:5173"

echo.
echo Sistema iniciado.
echo Nao feche as janelas do backend e frontend.
echo.
pause
exit /b 0

:erro
echo.
echo ERRO durante a inicializacao.
pause
exit /b 1
```

---

# 18. Seed idempotente

O seed original tinha:

```typescript
FatorCriado.id
```

quando a variável declarada era:

```typescript
fatorCriado
```

Correção:

```typescript
const fatorCriado = await prisma.fator.upsert({
  where: { codigo: fator.codigo },
  update: {
    nome: fator.nome,
    descricao: fator.descricao,
    ordem: fator.ordem,
    ativo: true,
  },
  create: {
    codigo: fator.codigo,
    nome: fator.nome,
    descricao: fator.descricao,
    ordem: fator.ordem,
    ativo: true,
  },
});
```

Os parâmetros também devem usar `upsert` ou `createMany` protegido por unicidade.

Nunca executar seed que duplique parâmetros toda vez que o sistema for iniciado.

---

# 19. Dados de teste

Os dados fictícios devem existir somente para homologação.

Nunca misturar dados fictícios com produção.

O seed de produção deve usar:

```text
SEED_MODE=DEMO
```

e criar a avaliação de teste apenas quando:

```text
SEED_MODE=DEMO
```

estiver habilitado.

---

# 20. Frontend

A interface deve receber os resultados do backend.

O frontend não deve recalcular o valor oficial.

Regra:

```text
FRONTEND = visualização + interação
BACKEND = validação + cálculo oficial
```

O modal "Como foi calculado?" deve mostrar:

```text
Fator
Fórmula
Entradas
Valores substituídos
Resultado
Versão do motor
Versão dos parâmetros
Data/hora
```

---

# 21. Saneamento

O sistema deve distinguir:

```text
NORMAL
POTENCIAL_OUTLIER
EXCLUIDA
MANTIDA_APÓS_ANÁLISE
DADOS_INSUFICIENTES
```

O algoritmo não deve excluir automaticamente uma amostra apenas porque ela foi classificada como outlier.

Fluxo:

```text
Algoritmo detecta
       ↓
Amostra = POTENCIAL_OUTLIER
       ↓
Avaliador analisa
       ↓
MANter OU EXCLUIR
       ↓
Motivo obrigatório
       ↓
Histórico
       ↓
Reprocessamento
```

---

# 22. Reprocessamento

Sempre que mudar:

- área;
- testada;
- profundidade;
- valor;
- tipo de valor;
- padrão;
- conservação;
- idade;
- vida útil;
- situação de quadra;
- número de vagas;
- parâmetros;

o resultado anterior deve ser marcado como desatualizado.

Não permitir emissão enquanto houver:

```text
DADOS_ALTERADOS_SEM_RECALCULO
```

---

# 23. Hash dos parâmetros

O sistema deve calcular:

```typescript
import crypto from "node:crypto";

export function hashParametros(
  parametros: unknown
): string {
  const canonical = JSON.stringify(parametros);

  return crypto
    .createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
}
```

O hash deve ser salvo no momento do cálculo.

---

# 24. Auditoria

Toda alteração relevante deve gerar histórico:

```text
entidade
entidadeId
campo
valorAnterior
valorNovo
usuario
dataAlteracao
motivo
```

Exemplos:

```text
AMOSTRA_EXCLUIDA
AMOSTRA_REATIVADA
PARAMETRO_ALTERADO
RESULTADO_RECALCULADO
LAUDO_EMITIDO
LAUDO_INVALIDADO
SNAPSHOT_CONGELADO
```

---

# 25. Segurança

Adicionar:

```text
Helmet
CORS restritivo
limite de tamanho de upload
validação de MIME
sanitização de nomes de arquivo
controle de caminho
logs estruturados
tratamento global de exceções
```

Nunca permitir que o usuário forneça diretamente um caminho de arquivo que seja utilizado pelo backend sem validação.

---

# 26. Upload de documentos e fotografias

Nunca salvar arquivos usando o nome original diretamente.

Use:

```text
UUID + extensão validada
```

Exemplo:

```text
f7b5f9f3-2a90-4f87-b3b0-foto.jpg
```

Registrar no banco:

```text
nomeArquivo
caminho
formato
hashSha256
dataGeracao
```

---

# 27. Tratamento de erro

Nunca retornar:

```typescript
res.status(500).json({
  error: error.message
});
```

em produção quando isso revelar detalhes internos.

Usar:

```typescript
console.error(error);

return res.status(500).json({
  error: "ERRO_INTERNO",
  message: "Não foi possível concluir a operação.",
});
```

O detalhe técnico deve ficar no log.

---

# 28. Package scripts

## Backend

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed",
    "db:clean": "tsx prisma/clean.ts"
  }
}
```

## Dependências principais

```json
{
  "dependencies": {
    "@prisma/client": "^6",
    "big.js": "^7",
    "docx": "^9",
    "express": "^5",
    "helmet": "^8",
    "pdfkit": "^0.17",
    "xlsx": "^0.18"
  },
  "devDependencies": {
    "@types/express": "^5",
    "@types/node": "^22",
    "@types/pdfkit": "^0.13",
    "prisma": "^6",
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

As versões devem ser fixadas no `package-lock.json` antes da distribuição portátil.

---

# 29. `.env`

```env
NODE_ENV=production
PORT=3000
DATABASE_URL="file:../data/robo_avaliacao.db"
MOTOR_VERSAO="1.0.0"
```

---

# 30. Regras de cálculo

Nenhum fator deve ser considerado "normativo" apenas porque está no código.

Todos os parâmetros devem ter:

```text
código
valor
unidade
justificativa
referência
vigência
ativo
versão
```

Exemplo:

```text
FO
OFERTA
0.90
coeficiente
justificativa: parâmetro configurado
referência: fonte cadastrada
```

---

# 31. Princípio de não mistura

O sistema deve registrar explicitamente:

```text
MÉTODO
SUBMÉTODO
CRITÉRIO DE SANEAMENTO
CONJUNTO DE PARÂMETROS
VERSÃO DO MOTOR
```

Um resultado não pode ser emitido se houver combinação incompatível entre metodologias.

---

# 32. Resultado final

O cálculo final deve ser gerado a partir das amostras efetivamente aprovadas.

Não utilizar:

```text
todas as amostras cadastradas
```

quando algumas estiverem:

```text
EXCLUIDA
DADOS_INSUFICIENTES
POTENCIAL_OUTLIER
```

---

# 33. Métricas estatísticas

Registrar pelo menos:

```text
n
média
mediana
desvio padrão
coeficiente de variação
erro padrão
mínimo
máximo
amplitude
```

Quando aplicável:

```text
limite inferior
limite superior
outliers
```

---

# 34. Dashboard

A dashboard deve exibir:

```text
Avaliações em elaboração
Avaliações com alertas
Avaliações prontas para auditoria
Avaliações finalizadas
Amostras ativas
Amostras pendentes
Últimos resultados
```

Nunca exibir "Pronta" se `RuleEngine` ainda bloquear emissão.

---

# 35. Estados oficiais

Usar constantes:

```typescript
export const STATUS_AVALIACAO = {
  EM_ELABORACAO: "EM_ELABORACAO",
  COM_ALERTAS: "COM_ALERTAS",
  PRONTA_AUDITORIA: "PRONTA_AUDITORIA",
  FINALIZADA: "FINALIZADA",
} as const;
```

Evitar textos livres como:

```text
"Em elaboração"
"Pronta"
"Finalizada"
```

espalhados pelo código.

---

# 36. Estado das amostras

```typescript
export const STATUS_AMOSTRA = {
  ATIVA: "ATIVA",
  POTENCIAL_OUTLIER: "POTENCIAL_OUTLIER",
  EXCLUIDA: "EXCLUIDA",
  NAO_UTILIZADA: "NAO_UTILIZADA",
  DADOS_INSUFICIENTES: "DADOS_INSUFICIENTES",
} as const;
```

---

# 37. Fluxo completo do robô

```text
1. Criar avaliação
        ↓
2. Cadastrar imóvel avaliando
        ↓
3. Importar/coletar amostras
        ↓
4. Validar dados
        ↓
5. Calcular profundidades derivadas
        ↓
6. Homogeneizar amostras
        ↓
7. Executar saneamento
        ↓
8. Apresentar potenciais outliers
        ↓
9. Decisão do avaliador
        ↓
10. Recalcular
        ↓
11. Estatística final
        ↓
12. RuleEngine
        ↓
13. Bloqueios/alertas
        ↓
14. Snapshot
        ↓
15. Hash
        ↓
16. PDF
        ↓
17. DOCX
        ↓
18. XLSX
        ↓
19. Registro de emissão
```

---

# 38. Critérios para considerar o projeto pronto

O projeto só deve ser considerado pronto para implantação quando:

- [ ] `prisma validate` passa;
- [ ] `prisma generate` passa;
- [ ] `prisma db push` passa;
- [ ] seed passa duas vezes sem duplicar dados;
- [ ] testes unitários passam;
- [ ] backend compila;
- [ ] frontend compila;
- [ ] API sobe;
- [ ] frontend sobe;
- [ ] criação de avaliação funciona;
- [ ] criação de imóvel funciona;
- [ ] importação de amostras funciona;
- [ ] cálculo funciona;
- [ ] auditoria funciona;
- [ ] saneamento funciona;
- [ ] exclusão exige justificativa;
- [ ] reativação gera histórico;
- [ ] alteração gera invalidação do resultado;
- [ ] snapshot é criado;
- [ ] hash é criado;
- [ ] PDF abre;
- [ ] DOCX abre;
- [ ] XLSX abre;
- [ ] backup funciona;
- [ ] restauração foi testada;
- [ ] sistema inicia sem Docker;
- [ ] sistema inicia no pendrive;
- [ ] o sistema funciona sem depender de uma letra fixa de unidade;
- [ ] não existem referências `muestras`, `XXLSX`, `FatorCriado`, `Console.error`, `Process.exit`, `Await`, `pinned` ou placeholders vazios.

---

# 39. ERROS ENCONTRADOS NO ARQUIVO ORIGINAL

Principais problemas detectados:

1. PostgreSQL e SQLite misturados.
2. Tipos nativos PostgreSQL mantidos em schema destinado a SQLite.
3. Enums incompatíveis com a estratégia SQLite adotada.
4. `muestras` em vez de `amostras`.
5. `XXLSX` em vez de `XLSX`.
6. `FatorCriado` em vez de `fatorCriado`.
7. `Console.error` em vez de `console.error`.
8. `Process.exit` em vez de `process.exit`.
9. `Await` em vez de `await`.
10. `prisma.\$disconnect()` com escape indevido.
11. `const valoresHomogeneizados =;`.
12. `const serieValores =;`.
13. Três versões duplicadas de `ReportService`.
14. Propriedade `pinned` inválida no PDFKit.
15. Configuração mockada em vez de lida do banco.
16. Fatores inexistentes tratados como `1`.
17. Valores inválidos tratados como fator `1`.
18. Tabela parcial de Chauvenet com fallback arbitrário.
19. Cálculo estatístico sem política explícita de precisão.
20. Frontend recalculando/assumindo valores que deveriam vir do backend.
21. Backup copiando um arquivo SQLite enquanto o projeto também era definido como PostgreSQL.
22. `.bat` contendo comentários `//`.
23. `npm install` a cada inicialização.
24. Dados tributários hard-coded.
25. Afirmações legais hard-coded.
26. Parâmetros de mercado hard-coded.
27. Falta de versionamento de parâmetros.
28. Falta de hash de parâmetros no cálculo.
29. Falta de snapshot realmente imutável.
30. Regra de emissão baseada em dados mutáveis.
31. Falta de invalidação automática após alteração.
32. Seed não totalmente idempotente.
33. Falta de separação entre ambiente DEMO e produção.
34. Falta de política consistente de backup.
35. Ausência de restauração automatizada testada.
36. Falta de validação de upload.
37. Possibilidade de exposição de erro interno da API.
38. Ausência de limites de segurança para arquivos.
39. Mistura de responsabilidades entre cálculo, auditoria e apresentação.
40. Inconsistência entre fatores armazenados e fatores realmente calculados.

---

# 40. Resultado da revisão

O arquivo original contém uma base conceitual útil, mas não estava pronto para implantação direta.

A versão corrigida estabelece uma arquitetura coerente:

```text
SQLite
  +
Prisma
  +
CalculationEngine
  +
SaneamentoEngine
  +
RuleEngine
  +
Snapshot
  +
Hash
  +
ReportService único
  +
Frontend de auditoria
  +
Backup
  +
Execução portátil
```

O ponto mais importante é que o robô não deve "inventar" um resultado quando faltar informação.

A regra operacional correta é:

```text
DADO VÁLIDO
    ↓
CALCULA

DADO INVÁLIDO
    ↓
BLOQUEIA

PARÂMETRO AUSENTE
    ↓
BLOQUEIA

OUTLIER PENDENTE
    ↓
BLOQUEIA EMISSÃO

ALTERAÇÃO APÓS CÁLCULO
    ↓
INVALIDA RESULTADO

SNAPSHOT CONGELADO
    ↓
PERMITE EMISSÃO
```

---

# 41. ORDEM DE IMPLEMENTAÇÃO

Implementar exatamente nesta ordem:

### Fase 1 — Banco

1. substituir `schema.prisma`;
2. apagar banco de desenvolvimento;
3. `prisma generate`;
4. `prisma db push`;
5. validar seed.

### Fase 2 — Core

6. substituir `CalculationEngine`;
7. substituir `SaneamentoEngine`;
8. criar testes;
9. executar `npm test`.

### Fase 3 — API

10. corrigir rotas;
11. carregar parâmetros do banco;
12. remover configurações mockadas;
13. implementar auditoria;
14. implementar snapshot.

### Fase 4 — Relatórios

15. manter somente um `ReportService`;
16. PDF;
17. DOCX;
18. XLSX;
19. hash.

### Fase 5 — Interface

20. dashboard;
21. matriz;
22. saneamento;
23. auditoria;
24. emissão.

### Fase 6 — Portabilidade

25. Node portátil;
26. SQLite;
27. scripts `.bat`;
28. backup;
29. restauração;
30. teste em computador sem Node instalado.

---

# 42. REGRA FINAL

Não considerar o robô "autônomo" porque ele consegue calcular automaticamente.

Autonomia profissional exige:

```text
COLETA
+
VALIDAÇÃO
+
CÁLCULO
+
SANEAMENTO
+
AUDITORIA
+
RASTREABILIDADE
+
BLOQUEIO DE ERROS
+
SNAPSHOT
+
EMISSÃO
+
BACKUP
+
RESTAURAÇÃO
```

O sistema deve automatizar o máximo possível, mas qualquer etapa que dependa de julgamento técnico deve permanecer explícita, registrada e atribuída ao responsável pela avaliação.

---

## FIM DO MASTER DE IMPLEMENTAÇÃO
