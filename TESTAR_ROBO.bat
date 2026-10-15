@echo off
setlocal
cd /d "%~dp0"
if not exist "runtime\node\node.exe" (
  echo Node portatil nao encontrado. Execute INICIAR_ROBO_AVALIADOR.bat primeiro.
  pause
  exit /b 1
)
set "NPM=%~dp0runtime\node\node.exe %~dp0runtime\node\node_modules\npm\bin\npm-cli.js"
%NPM% --prefix backend test
if errorlevel 1 (echo Testes falharam.&pause&exit /b 1)
echo Testes concluídos com sucesso.
pause
