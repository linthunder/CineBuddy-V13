@echo off
title CineBuddy - Servidor
cd /d "%~dp0"
echo.
echo Iniciando CineBuddy...
echo Quando estiver pronto, abra no navegador: http://localhost:3000
echo Para parar: feche esta janela ou pressione Ctrl+C
echo.
call npx next dev
pause
