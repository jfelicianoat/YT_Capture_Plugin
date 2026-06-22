@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js 20 o superior no esta instalado o no esta en PATH.
  exit /b 1
)

echo Validando la extension...
call npm.cmd run verify
if errorlevel 1 exit /b 1

echo Generando ZIP reproducible...
call npm.cmd run package
if errorlevel 1 exit /b 1

echo.
echo ZIP generado en:
echo %~dp0dist\
endlocal
