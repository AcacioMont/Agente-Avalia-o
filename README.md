# RoboAvaliador — pacote executável local

Este pacote foi montado a partir do `RoboAvaliador_MASTER_CORRIGIDO.md` e segue a ordem solicitada:

1. Banco: SQLite, schema Prisma, limpeza, generate, db push, seed idempotente.
2. Core: CalculationEngine + SaneamentoEngine + testes Vitest.
3. API: rotas, parâmetros carregados do banco, auditoria e snapshot SHA-256.
4. Relatórios: um único ReportService para PDF, DOCX e XLSX; hash dos arquivos.
5. Interface: dashboard, cálculo, saneamento, snapshot, emissão.
6. Portabilidade: scripts BAT, SQLite, backup/restauração e Node.js portátil.

## Primeira execução

### Opção A — computador com Node instalado

PowerShell:

```powershell
npm install
npm run install:all
npm run db:init
npm run build
npm run start
```

Abra `http://localhost:3000`.

### Opção B — computador sem Node instalado

Execute `INICIAR_ROBO_AVALIADOR.bat`.

O script prepara um Node.js portátil em `runtime\node`, instala as dependências, cria o SQLite, executa o seed, compila o frontend e inicia a API.

A primeira execução precisa de internet para baixar o runtime Node.js e os pacotes npm. Depois disso, o diretório pode ser copiado para outro PC Windows com a mesma arquitetura.

## Fluxo de uso

1. Criar uma avaliação pela interface.
2. Cadastrar pelo menos o número mínimo de amostras configurado.
3. Calcular.
4. Revisar matriz, saneamento e alertas.
5. Resolver tecnicamente eventuais outliers.
6. Congelar snapshot.
7. Auditar e emitir o laudo formal.
8. Baixar PDF/DOCX/XLSX.
9. Fazer backup.

## Regra de emissão

A emissão formal é bloqueada quando a auditoria encontra alerta crítico, amostra ativa sem homogeneização, outlier pendente, resultado inválido/inexistente, snapshot ausente ou hash inconsistente. O mínimo de amostras é parametrizado no banco pelo fator `REGRAS.MIN_AMOSTRAS`.

## Regra de segurança técnica

Outlier não deve ser apagado automaticamente. O sistema apenas sinaliza. A exclusão técnica precisa ser registrada e auditável antes de um novo cálculo.

Parâmetros jurídicos, tributários e normativos não são hard-coded como verdade universal. Devem ser cadastrados e versionados conforme o município, finalidade e referência técnica aplicável.

## Estrutura

- `backend/prisma/schema.prisma`: banco.
- `backend/src/engines`: cálculo e saneamento.
- `backend/src/services`: parâmetros, auditoria, snapshot e relatórios.
- `backend/src/routes`: API.
- `frontend/src`: dashboard.
- `data`: SQLite.
- `reports`: documentos emitidos.
- `backups`: cópias do banco e relatórios.
