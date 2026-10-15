# RoboAvaliador — versão corrigida

## Correções principais

- RuleEngine centralizado para auditoria e bloqueio de emissão.
- Regra mínima de amostras configurada em `REGRAS.MIN_AMOSTRAS`.
- Snapshot só pode ser congelado após cálculo e auditoria técnica sem alertas críticos.
- Emissão formal em `POST /api/v1/avaliacoes/:id/emitir`.
- Registro `LAUDO_EMITIDO` na auditoria.
- Alterações posteriores invalidam o estado calculado e o vínculo do snapshot.
- Exclusão e reativação de amostras registradas.
- Correção do valor usado no cálculo conforme `tipoValor`.
- Fator FP passou a usar parâmetro de expoente no banco (`FP.expoente`).
- Seed corrigido para não deixar parâmetros antigos incorretos em FP/FG e para manter FC/FPC separados.
- Saneamento persiste os indicadores de Chauvenet e do critério de 30%.
- Interface do navegador refeita com dashboard, métricas, matriz completa de fatores, saneamento, auditoria, documentos e formulários de avaliação/amostra.
- Script `db:init` criado para inicialização sem apagar o banco.
- `portable` deixou de executar reset destrutivo.

## Validação nesta sessão

- Backend TypeScript: PASSOU.
- Frontend TypeScript (`tsc -b`): PASSOU.
- Teste direto do CalculationEngine: PASSOU.
- Teste direto do SaneamentoEngine: PASSOU.
- Teste do RuleEngine com avaliação apta: PASSOU.
- Teste do RuleEngine com snapshot ausente: BLOQUEIO correto.
- Teste do RuleEngine com outlier pendente: BLOQUEIO correto.

## Validação dependente do Windows alvo

O `vite build`, `prisma generate/validate` e a suíte Vitest completa devem ser executados no Windows após `npm install`, porque o arquivo original contém dependências/binários nativos para Windows e esta sessão de preparação roda Linux.
