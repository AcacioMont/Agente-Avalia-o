$ErrorActionPreference = "Stop"

$root = "C:\Users\Acacio.DESKTOP-SLKUN50\desktop\roboavaliacao1\roboavaliador"
$backup = Join-Path $root "backup-correcao-organizada-20260930-183445"
$target = Join-Path $root "frontend\src\main.tsx"
$source = Join-Path $backup "frontend\src\main.tsx"

Write-Host "`n=== RECUPERAÇÃO SEGURA DO main.tsx ===" -ForegroundColor Cyan
Write-Host "Projeto: $root"
Write-Host "Backup:  $source"

if (-not (Test-Path $source)) {
    throw "BACKUP_MAIN_TSX_NAO_ENCONTRADO: $source"
}

if (-not (Test-Path $target)) {
    throw "MAIN_TSX_ATUAL_NAO_ENCONTRADO: $target"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$preRestore = Join-Path $root "main.tsx-corrompido-$stamp.bak"

Copy-Item $target $preRestore -Force
Copy-Item $source $target -Force

Write-Host "`nRESTORE CONCLUÍDO." -ForegroundColor Green
Write-Host "Arquivo restaurado: $target"
Write-Host "Cópia do arquivo corrompido preservada em: $preRestore"

Write-Host "`n=== CONFERÊNCIA RÁPIDA ===" -ForegroundColor Cyan
Get-Item $target | Select-Object FullName,Length,LastWriteTime
Select-String -Path $target -Pattern 'bloqueio dos botões do modal de amostra|bloqueio de amostra durante processamento' -SimpleMatch -Quiet |
    ForEach-Object { if ($_){ throw "O texto de corrupção ainda existe no main.tsx restaurado." } }

Write-Host "`nOK: o texto de corrupção não foi encontrado." -ForegroundColor Green
Write-Host "`nNÃO foi executado db:reset e nenhum banco foi alterado." -ForegroundColor Yellow
Write-Host "Próximo passo: executar apenas 'npm run build'." -ForegroundColor Cyan
