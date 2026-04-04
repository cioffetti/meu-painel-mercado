@echo off
color 0A
echo ===================================================
echo   INICIANDO O MOTOR DE ANALISE FUNDAMENTALISTA
echo ===================================================
echo.
cd /d "%~dp0"
node robo.js
echo.
echo ===================================================
echo  ROBO FINALIZADO! ABRINDO O GITHUB PARA UPLOAD...
echo ===================================================
timeout /t 3 > nul
start https://github.com/cioffetti/meu-painel-mercado/upload/main