$ErrorActionPreference = 'Stop'
$Projeto = if ($env:ROBOAVALIADOR_PROJETO) { $env:ROBOAVALIADOR_PROJETO } else { Join-Path $env:USERPROFILE 'Desktop\RoboAvaliacao1\roboavaliador' }
$Arquivo = Join-Path $Projeto 'backend\src\services\ReportService.ts'
if (-not (Test-Path -LiteralPath $Arquivo)) { throw "ReportService.ts não encontrado: $Arquivo" }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = "$Arquivo.bak-final-$stamp"
Copy-Item -LiteralPath $Arquivo -Destination $backup -Force
$utf8 = New-Object System.Text.UTF8Encoding($false)
$s = [System.IO.File]::ReadAllText($Arquivo, $utf8)
$old = 'return factors.flatMap((f) => {'
$new = 'return factors.flatMap((f): Dados[] => {'
if ($s.Contains($new)) { Write-Host 'Correção já aplicada.' -ForegroundColor Yellow }
elseif ($s.Contains($old)) {
  $s = $s.Replace($old, $new)
  [System.IO.File]::WriteAllText($Arquivo, $s, $utf8)
  Write-Host 'Correção aplicada em factorRows().' -ForegroundColor Green
} else { throw 'Trecho esperado de factorRows() não encontrado; arquivo não foi alterado.' }
Write-Host "Backup: $backup"
Write-Host "Arquivo: $Arquivo"
Write-Host 'Próximo passo: npm --prefix backend run build'
