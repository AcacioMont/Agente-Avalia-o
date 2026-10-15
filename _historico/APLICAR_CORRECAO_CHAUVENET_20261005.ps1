[CmdletBinding()]
param(
    [string]$Projeto = "$env:USERPROFILE\Desktop\RoboAvaliacao1\roboavaliador",
    [switch]$AtualizarPrisma
)

$ErrorActionPreference = "Stop"
$Base = Split-Path -Parent $MyInvocation.MyCommand.Path
$Patch = Join-Path $Base "CORRECAO_CHAUVENET_20261005"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ROBO AVALIADOR - CORRECAO CONTROLADA DE CHAUVENET" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (!(Test-Path -LiteralPath (Join-Path $Projeto "backend"))) {
    throw "Projeto inválido: backend não encontrado em $Projeto"
}
if (!(Test-Path -LiteralPath $Patch)) {
    throw "Pasta de correção não encontrada: $Patch"
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Backup = Join-Path $Projeto "_BACKUP_ANTES_CHAUVENET_$stamp"
New-Item -ItemType Directory -Force -Path $Backup | Out-Null

$Arquivos = @(
    "backend\prisma\schema.prisma",
    "backend\src\engines\SaneamentoEngine.ts",
    "backend\src\engines\RuleEngine.ts",
    "backend\src\engines\safety-primitives.ts",
    "backend\src\services\safety-primitives.ts",
    "backend\src\services\ReportService.ts",
    "backend\src\routes\avaliacao.routes.ts",
    "backend\tests\SaneamentoEngine.test.ts",
    "backend\tests\ChauvenetGovernance.test.ts"
)

foreach ($rel in $Arquivos) {
    $origem = Join-Path $Patch $rel
    $destino = Join-Path $Projeto $rel
    if (!(Test-Path -LiteralPath $origem)) { throw "Arquivo da correção ausente: $origem" }
    if (Test-Path -LiteralPath $destino) {
        $backupDestino = Join-Path $Backup $rel
        New-Item -ItemType Directory -Force -Path (Split-Path $backupDestino -Parent) | Out-Null
        Copy-Item -LiteralPath $destino -Destination $backupDestino -Force
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $destino -Parent) | Out-Null
    Copy-Item -LiteralPath $origem -Destination $destino -Force
    Write-Host "OK: $rel" -ForegroundColor Green
}

Write-Host ""
Write-Host "Backup criado em: $Backup" -ForegroundColor Yellow
Write-Host ""
Write-Host "===== PRISMA GENERATE =====" -ForegroundColor Cyan
npm --prefix "$Projeto\backend" run prisma:generate

if ($AtualizarPrisma) {
    Write-Host ""
    Write-Host "===== PRISMA DB PUSH =====" -ForegroundColor Cyan
    Write-Host "Aplicando somente as novas colunas do modelo Saneamento. NÃO haverá reset/seed/cálculo/snapshot/emissão." -ForegroundColor Yellow
    npm --prefix "$Projeto\backend" run db:push
}

Write-Host ""
Write-Host "===== TESTES =====" -ForegroundColor Cyan
npm --prefix "$Projeto\backend" test

Write-Host ""
Write-Host "===== BUILD BACKEND =====" -ForegroundColor Cyan
npm --prefix "$Projeto\backend" run build

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " CORRECAO CHAUVENET INSTALADA E VALIDADA NO CODIGO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Nenhum reset de banco, recálculo, snapshot ou emissão foi executado automaticamente." -ForegroundColor Yellow
Write-Host "Para atualizar o SQLite, execute novamente este script com -AtualizarPrisma." -ForegroundColor Yellow
Write-Host ""
