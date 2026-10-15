@echo off
setlocal
cd /d "%~dp0"
if not exist "backups" mkdir backups
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set TS=%%i
if exist "data\robo_avaliacao.db" copy /y "data\robo_avaliacao.db" "backups\robo_avaliacao_%TS%.db" >nul && echo Backup criado.
if exist "reports" xcopy "reports" "backups\reports_%TS%\" /E /I /Y >nul
echo Concluido.
pause
