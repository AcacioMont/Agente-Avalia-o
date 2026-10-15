
## CORRECAO_BUILD_2026-09-23
- CalculationEngine: corrigido calculo numerico de vuHomogeneizado (Big x numero), removendo multiplicacao por string de toFixed.
- avaliacao.routes.ts: tipagem explicita do callback de amostras.
- ParameterService.ts: tipagem explicita dos callbacks find/map.
- tests: imports ESM com extensao .js e tipagem do callback de outliers.
- Observacao: o ambiente de empacotamento nao conseguiu concluir npm install dentro do limite de execucao; portanto dependencias nao foram embutidas e a compilacao final nao pode ser declarada como validada aqui.


CORRECAO V4 (2026-09-23): o build do frontend apresentou TS7026 em src/main.tsx por ausência de @types/react e @types/react-dom. As dependências foram adicionadas em frontend/package.json. O código React/JSX não foi alterado.
