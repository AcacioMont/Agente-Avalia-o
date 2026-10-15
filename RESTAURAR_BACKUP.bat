@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (echo Arraste um .db de backup sobre este arquivo ou execute: RESTAURAR_BACKUP.bat caminho\backup.db&pause&exit /b 1)
if not exist "%~1" (echo Arquivo nao encontrado.&pause&exit /b 1)
if exist "data\robo_avaliacao.db" copy /y "data\robo_avaliacao.db" "backups\antes-restauracao.db" >nul
copy /y "%~1" "data\robo_avaliacao.db" >nul
echo Banco restaurado. Reinicie o RoboAvaliador.
pause
