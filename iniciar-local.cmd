@echo off
setlocal
set "NODE_LOCAL=%~dp0..\.tools\node-v22.23.4-win-x64\node.exe"
if not exist "%NODE_LOCAL%" (
  echo Node portatil nao encontrado. Consulte docs/administracao.md.
  exit /b 1
)
"%NODE_LOCAL%" "%~dp0scripts\local.cjs" start
