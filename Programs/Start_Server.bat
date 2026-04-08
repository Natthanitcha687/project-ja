@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================
echo    SMA Warranty Platform - Start Script
echo ==========================================

REM Get the directory of the batch script
SET "BASE_DIR=%~dp0"

echo [1/4] Preparing Backend...
cd /d "%BASE_DIR%Backend_Setup"

IF NOT EXIST node_modules (
    echo Dependencies not found. Running npm install...
    echo (This may take a minute)
    call npm.cmd install
) ELSE (
    echo Dependencies found.
)

echo [2/4] Preparing Database...
echo Ensuring database is up to date...
call .\node_modules\.bin\prisma.cmd migrate deploy

echo [3/4] Starting Backend Server...
start "SMA Backend" cmd /k "npm.cmd start"

echo [4/4] Starting Frontends...
echo Serving client frontend on port 5173...
start "SMA Client" cmd /k "npx.cmd serve -s ..\Frontend_Build -l 5173"

echo Serving admin frontend on port 5174...
start "SMA Admin" cmd /k "npx.cmd serve -s ..\Admin_Build -l 5174"

echo.
echo ==========================================
echo Platform is now starting up! 
echo Client: http://localhost:5173
echo Admin:  http://localhost:5174
echo ==========================================
echo.
echo Please keep all terminal windows open while testing.
echo Press any key to exit this launcher...
pause > nul
