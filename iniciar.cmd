@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Gremlin Rush - Servidor local

if exist "node_modules\vite" goto :recursos
echo  Primera ejecución: se instalará lo necesario.
call "%~dp0setup.cmd" nopause
if errorlevel 1 goto :fin_error

:recursos
if exist "public\models\hand_landmarker.task" goto :arrancar
call npm run prepare-assets --silent
if errorlevel 1 goto :fin_error

:arrancar
echo.
echo  ==============================================================
echo   GREMLIN RUSH - servidor local con HTTPS para probar en móvil
echo  ==============================================================
echo.
echo   1. Conecta el PC y el móvil a la MISMA red Wi-Fi.
echo   2. En el móvil abre la dirección "Network" que aparece abajo,
echo      por ejemplo  https://192.168.1.23:8443/
echo   3. Verás un aviso de certificado: es normal, el certificado es local.
echo        iPhone Safari:  Mostrar detalles - Visitar este sitio web
echo        Android Chrome: Configuración avanzada - Acceder
echo   4. Si Windows pregunta por el Firewall, permite Node.js en redes privadas.
echo   5. En este PC puedes abrir la dirección "Local".
echo.
echo   Para detener el servidor: Ctrl + C, o cierra esta ventana.
echo.
call npm run dev:movil
goto :fin

:fin_error
echo.
echo  No se pudo arrancar. Revisa los mensajes anteriores.
:fin
echo.
pause
