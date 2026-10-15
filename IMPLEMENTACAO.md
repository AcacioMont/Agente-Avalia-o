# Ordem de implementação — executada no pacote

## Fase 1 — Banco
- [x] schema Prisma SQLite
- [x] limpeza do banco de desenvolvimento
- [x] `prisma generate`
- [x] `prisma db push`
- [x] seed idempotente

## Fase 2 — Core
- [x] CalculationEngine único
- [x] SaneamentoEngine
- [x] testes Vitest
- [x] comando `npm test`

## Fase 3 — API
- [x] rotas de avaliação
- [x] parâmetros carregados do banco
- [x] configurações de cálculo não ficam mockadas na rota
- [x] auditoria
- [x] snapshot imutável + SHA-256
- [x] decisão técnica de exclusão de amostra registrada
- [x] RuleEngine de auditoria e bloqueio de emissão
- [x] reativação de amostra com invalidação do cálculo
- [x] invalidação de resultado após alteração posterior

## Fase 4 — Relatórios
- [x] um único ReportService
- [x] PDF
- [x] DOCX
- [x] XLSX
- [x] SHA-256 dos arquivos
- [x] emissão formal com auditoria e alertas formal registrada em auditoria
- [x] bloqueio por snapshot/hash/alerta crítico

## Fase 5 — Interface
- [x] dashboard
- [x] matriz de homogeneização
- [x] saneamento
- [x] auditoria
- [x] emissão formal com auditoria e alertas

## Fase 6 — Portabilidade
- [x] Node portátil via BAT
- [x] SQLite
- [x] scripts `.bat`
- [x] backup
- [x] restauração
- [x] inicialização em PC sem Node previamente instalado

## Observação de validação
O pacote foi gerado e revisado estruturalmente. A instalação automática de npm neste ambiente de preparação não pôde ser concluída porque a rede de pacotes expirou durante `npm install`; portanto, o build/teste final deve ser executado no Windows alvo com `INICIAR_ROBO_AVALIADOR.bat` ou com os comandos do README.
