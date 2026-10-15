@echo off
setlocal
cd /d "%~dp0"
set "NODEEXE=%~dp0runtime\node\node.exe"
if not exist "%NODEEXE%" (
  echo Node.js portatil nao encontrado. Baixando Node.js LTS...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip';$z='%TEMP%\robo-node.zip';Invoke-WebRequest $u -OutFile $z;Expand-Archive $z -DestinationPath '%TEMP%\robo-node' -Force;New-Item -ItemType Directory -Force -Path 'runtime\node'|Out-Null;Copy-Item '%TEMP%\robo-node\node-v22.14.0-win-x64\*' 'runtime\node' -Recurse -Force"
)
if not exist "%NODEEXE%" (echo Falha ao preparar Node.js portatil.&pause&exit /b 1)
set "NPM=%NODEEXE% %~dp0runtime\node\node_modules\npm\bin\npm-cli.js"
if not exist "backend\node_modules\.bin\prisma.cmd" %NPM% --prefix backend install
if not exist "frontend\node_modules\.bin\vite.cmd" %NPM% --prefix frontend install
%NPM% --prefix backend run prisma:generate
if errorlevel 1 goto :erro
%NPM% --prefix backend run db:push
if errorlevel 1 goto :erro
%NPM% --prefix backend run db:seed
if errorlevel 1 goto :erro
%NPM% --prefix backend test
if errorlevel 1 goto :erro
%NPM% --prefix backend run build
if errorlevel 1 goto :erro
%NPM% --prefix frontend run build
if errorlevel 1 goto :erro
echo.
echo RoboAvaliador preparado com sucesso.
start "RoboAvaliador" cmd /k "%NPM% --prefix backend run start"
timeout /t 3 >nul
start http://localhost:3000
exit /b 0
:erro
echo.
echo ERRO: uma etapa falhou. O RoboAvaliador NAO sera iniciado.
pause
exit /b 1
