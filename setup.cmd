@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Gremlin Rush - Instalación

echo.
echo  ==============================================
echo   GREMLIN RUSH - instalación para Windows 11
echo  ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :instalar_node

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 22 goto :node_antiguo
for /f "delims=" %%v in ('node -v') do echo  [1/3] Node.js %%v encontrado.
goto :dependencias

:instalar_node
echo  Node.js no está instalado. Se intentará instalar con winget...
where winget >nul 2>nul
if errorlevel 1 goto :sin_winget
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
echo.
echo  Node.js instalado. CIERRA esta ventana y vuelve a ejecutar setup.cmd
echo  para que Windows reconozca el nuevo programa.
goto :fin_error

:sin_winget
echo  No se encontró winget. Descarga e instala Node.js LTS desde:
echo      https://nodejs.org
echo  y después vuelve a ejecutar setup.cmd
goto :fin_error

:node_antiguo
echo  Tu Node.js es demasiado antiguo. Se necesita la versión 22 o superior.
echo  Actualízalo con:  winget upgrade -e --id OpenJS.NodeJS.LTS
echo  o descárgalo desde https://nodejs.org y vuelve a ejecutar setup.cmd
goto :fin_error

:dependencias
echo  [2/3] Instalando dependencias del proyecto, puede tardar unos minutos...
call npm install --no-fund --no-audit
if errorlevel 1 goto :fallo_npm

echo  [3/3] Preparando el detector de mano, descarga única de unos 8 MB...
call npm run prepare-assets --silent
if errorlevel 1 goto :fallo_recursos

echo.
echo  Instalación completa. Ejecuta iniciar.cmd para arrancar el juego.
echo.
if /i not "%~1"=="nopause" pause
exit /b 0

:fallo_npm
echo.
echo  ERROR: no se pudieron instalar las dependencias. Revisa tu conexión a Internet
echo  y vuelve a ejecutar setup.cmd
goto :fin_error

:fallo_recursos
echo.
echo  ERROR: no se pudo preparar el detector de mano. Revisa tu conexión a Internet
echo  y vuelve a ejecutar setup.cmd
goto :fin_error

:fin_error
echo.
if /i not "%~1"=="nopause" pause
exit /b 1
