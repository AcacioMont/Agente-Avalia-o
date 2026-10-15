[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$Projeto = "$env:USERPROFILE\Desktop\RoboAvaliacao1\roboavaliador",
    [switch]$AtualizarBanco
)

$ErrorActionPreference = 'Stop'

Write-Host ""; Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ROBO AVALIADOR - SNAPSHOT INTEGRAL / EMISSAO GOVERNADA" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Projeto: $Projeto" -ForegroundColor Gray

if (!(Test-Path "$Projeto\backend")) { throw "Projeto inválido: backend não encontrado em $Projeto" }
$Base = Split-Path -Parent $MyInvocation.MyCommand.Path
$Patch = Join-Path $Base 'CORRIGIDOS'
if (!(Test-Path $Patch)) { throw "Pasta CORRIGIDOS não encontrada ao lado deste script." }

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Backup = Join-Path $Projeto "_BACKUP_SNAPSHOT_INTEGRAL_$stamp"
New-Item -ItemType Directory -Force -Path $Backup | Out-Null

$Arquivos = @(
    'backend\src\services\ReportService.ts',
    'backend\src\engines\RuleEngine.ts',
    'backend\prisma\schema.prisma',
    'backend\tests\ReportService.contract.test.ts'
)

foreach ($rel in $Arquivos) {
    $src = Join-Path $Patch $rel
    $dst = Join-Path $Projeto $rel
    if (!(Test-Path $src)) { throw "Patch ausente: $src" }
    if (Test-Path $dst) {
        $bd = Join-Path $Backup $rel
        New-Item -ItemType Directory -Force -Path (Split-Path $bd -Parent) | Out-Null
        Copy-Item $dst $bd -Force
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
    Copy-Item $src $dst -Force
    Write-Host "OK  $rel" -ForegroundColor Green
}

Write-Host ""; Write-Host '===== PRISMA GENERATE =====' -ForegroundColor Cyan
npm --prefix "$Projeto\backend" run prisma:generate

if ($AtualizarBanco) {
    Write-Host ""; Write-Host '===== PRISMA DB PUSH =====' -ForegroundColor Cyan
    npm --prefix "$Projeto\backend" run db:push
} else {
    Write-Host ""; Write-Host 'DB PUSH não executado. Para aplicar o novo campo Documento.snapshotHash:' -ForegroundColor Yellow
    Write-Host '  .\APLICAR_CORRECOES_SNAPSHOT_INTEGRAL_20261005.ps1 -AtualizarBanco' -ForegroundColor Yellow
}

Write-Host ""; Write-Host '===== BUILD BACKEND =====' -ForegroundColor Cyan
npm --prefix "$Projeto\backend" run build

Write-Host ""; Write-Host '===== TESTES BACKEND =====' -ForegroundColor Cyan
npm --prefix "$Projeto\backend" test

Write-Host ""; Write-Host '============================================================' -ForegroundColor Green
Write-Host ' CORRECAO APLICADA' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Gray
Write-Host ""; Write-Host 'REGRA NOVA:' -ForegroundColor Cyan
Write-Host 'O relatório não usa mais o último snapshot por versão.'
Write-Host 'Ele usa exclusivamente o snapshot cujo SHA-256 está vinculado em Avaliacao.snapshotHash,'
Write-Host 'valida novamente o conteúdo e gera PDF/DOCX/XLSX a partir desse estado congelado.'
Write-Host 'PDF/DOCX recebem o JSON integral do snapshot; XLSX recebe a aba Snapshot_JSON.'
