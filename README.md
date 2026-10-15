# RoboAvaliador

Sistema de avaliação imobiliária com cálculo comparativo, saneamento estatístico,
governança por snapshot e emissão de laudos nos moldes da série **ABNT NBR 14653**
(14653-1:2019 e 14653-2:2011, conforme aplicabilidade).

> ⚠️ O laudo gerado é um artefato técnico de apoio. A revisão, a assinatura e a
> responsabilidade pelo trabalho cabem ao profissional habilitado.

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + TypeScript + Express 5 + Prisma 6 + SQLite |
| Frontend | Vite + React 19 + TypeScript |
| Testes | Vitest (backend) |
| Relatórios | PDF (pdfkit), DOCX (docx), XLSX (xlsx) |

## Estrutura

```
backend/
  src/
    core/          primitivas de segurança (hash de snapshot, gate de Chauvenet,
                   persistência com compensação) — fonte única
    engines/       CalculationEngine, RuleEngine (auditoria), SaneamentoEngine
    services/      ReportService (laudos NBR 14653), SnapshotService,
                   GovernanceService, ParameterService, AuditService
    routes/        /api/v1/avaliacoes, /api/v1/export, /api/v1/sistema
  prisma/          schema SQLite, seed de fatores e parâmetros
  tests/           testes de contrato e robustez
frontend/src/      interface (App + componentes + modais)
docs/              documentação técnica e normativa
_historico/        scripts e registros de correções antigas (não fazem parte do build)
reports/           laudos gerados (ignorado pelo git)
data/              banco SQLite (ignorado pelo git)
```

## Como rodar

Pré-requisito: Node.js 20+ (os `.bat` da raiz usam o Node portátil de `runtime/`
quando executados no Windows).

```powershell
npm install
npm run install:all          # instala backend e frontend

Copy-Item .env.example backend\.env   # na primeira execução (ou use backend/.env.example)
# edite backend/.env se precisar mudar porta ou caminho do banco

npm run db:init              # gera o client Prisma, cria o banco e semeia fatores/parâmetros
npm run dev                  # backend :3000 + frontend :5173
```

Abra **http://localhost:5173**.

> O arquivo `.env` é lido a partir da pasta `backend/` (cwd do servidor e do Prisma).
> Um `.env` somente na raiz **não** é lido.

### Scripts úteis

| Comando | Efeito |
|---|---|
| `npm run dev` | sobe backend e frontend juntos |
| `npm test` | testes do backend (Vitest) |
| `npm run build` | compila backend (tsc) e frontend (vite) |
| `npm run db:reset` | limpa, recria e semeia o banco |
| `npm run qa` | build + testes |

No Windows, os atalhos operacionais continuam na raiz:
`INICIAR_ROBO_AVALIADOR.bat`, `TESTAR_ROBO.bat`, `FAZER_BACKUP.bat`, `RESTAURAR_BACKUP.bat`.

## Fluxo de trabalho (governança)

1. **Criar avaliação** e cadastrando o imóvel avaliando;
2. **Pesquisar/cadastrar amostras** de mercado (mínimo configurado em `REGRAS.MIN_AMOSTRAS`);
3. **Calcular** — homogeneização por fatores, saneamento (limites + Chauvenet) e resultado;
4. Se Chauvenet sinalizar valores, **registrar decisão técnica** (manter com justificativa ou excluir e recalcular);
5. **Congelar snapshot** — estado técnico vira imutável, com hash SHA-256 (`PRONTA_PARA_EMISSAO`);
6. **Emitir laudo** — o botão habilita automaticamente quando a auditoria de prontidão está APTA;
   gera PDF, DOCX e XLSX a partir **somente** do snapshot congelado.

Qualquer alteração de dados depois do congelamento invalida o snapshot (é preciso recalcular e congelar de novo).

## Laudos (NBR 14653)

O relatório segue o arranjo: capa, resumo executivo (com valor por extenso e intervalo
de confiança), objetivo, identificação, pressupostos e limitações, caracterização do
imóvel, pesquisa de mercado, metodologia, homogeneização, saneamento, cálculo e
resultado, especificação (graus), conclusão, assinatura, anexos (amostras, parâmetros,
trilha de auditoria) e rastreabilidade com SHA-256 do snapshot.

Os **graus de fundamentação e de precisão não são declarados automaticamente**: o motor
explicita que não os determinou, e a classificação normativa é do profissional responsável.
Detalhes em `docs/ABNT_ESTRUTURA_LAUDO.md`.

## Segurança e dados

- `data/` (banco com dados reais), `runtime/` (Node portátil), `reports/` e `node_modules/`
  são ignorados pelo git — nunca os commite;
- segredos ficam apenas em `backend/.env` (ignorado); existe `backend/.env.example` como modelo;
- todo documento gerado registra hash SHA-256 próprio e do snapshot que o originou.
