[CmdletBinding()]
param(
    [string]$Projeto = (Get-Location).Path,
    [switch]$AtualizarPrisma
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ROBO AVALIADOR - APLICAR CORRECOES" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (!(Test-Path "$Projeto\backend")) {
    throw "Projeto inválido: a pasta backend não foi encontrada em $Projeto"
}

$Base = Split-Path -Parent $MyInvocation.MyCommand.Path
$Patch = Join-Path $Base "CORRIGIDOS"

if (!(Test-Path $Patch)) {
    throw "Pasta CORRIGIDOS não encontrada ao lado deste script."
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Backup = Join-Path $Projeto "_BACKUP_ANTES_CORRECAO_$stamp"

New-Item -ItemType Directory -Force -Path $Backup | Out-Null

$Arquivos = @(
    "backend\src\services\SnapshotService.ts",
    "backend\src\services\ReportService.ts",
    "backend\src\engines\RuleEngine.ts",
    "backend\src\engines\CalculationEngine.ts",
    "backend\src\routes\avaliacao.routes.ts",
    "backend\prisma\schema.prisma",
    "backend\tests\ReportService.contract.test.ts"
)

foreach ($rel in $Arquivos) {
    $origem = Join-Path $Patch $rel
    $destino = Join-Path $Projeto $rel

    if (!(Test-Path $origem)) {
        throw "Arquivo corrigido ausente: $origem"
    }

    if (Test-Path $destino) {
        $backupDestino = Join-Path $Backup $rel
        $backupDir = Split-Path $backupDestino -Parent

        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        Copy-Item $destino $backupDestino -Force
    }

    $destDir = Split-Path $destino -Parent
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null

    Copy-Item $origem $destino -Force

    Write-Host "OK: $rel" -ForegroundColor Green
}

if (Test-Path (Join-Path $Base "ABNT_ESTRUTURA_LAUDO.md")) {
    Copy-Item `
        (Join-Path $Base "ABNT_ESTRUTURA_LAUDO.md") `
        (Join-Path $Projeto "ABNT_ESTRUTURA_LAUDO.md") `
        -Force
}

Write-Host ""
Write-Host "Backup criado em:" -ForegroundColor Yellow
Write-Host $Backup

Write-Host ""
Write-Host "===== PRISMA GENERATE =====" -ForegroundColor Cyan
npm --prefix "$Projeto\backend" run prisma:generate

if ($AtualizarPrisma) {
    Write-Host ""
    Write-Host "===== PRISMA DB PUSH =====" -ForegroundColor Cyan
    Write-Host "O banco será atualizado conforme o schema corrigido." -ForegroundColor Yellow
    npm --prefix "$Projeto\backend" run db:push
}

Write-Host ""
Write-Host "===== BUILD BACKEND =====" -ForegroundColor Cyan
npm --prefix "$Projeto\backend" run build

Write-Host ""
Write-Host "===== TESTES BACKEND =====" -ForegroundColor Cyan
npm --prefix "$Projeto\backend" test

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " CORRECOES APLICADAS E VALIDACAO CONCLUIDA" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backup: $Backup"
Write-Host ""
