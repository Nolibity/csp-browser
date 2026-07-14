@echo off
title CSP Browser
cd /d "%~dp0"

echo ================================
echo   CSP Browser
echo ================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found. Please install: https://nodejs.org
    pause
    exit /b 1
)

:: Kill any existing node server on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do (
    echo Stopping previous instance...
    taskkill /f /pid %%a >nul 2>nul
)

if not exist "node_modules\" (
    echo.
    echo Installing dependencies, please wait...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo Install failed. Check your network.
        pause
        exit /b 1
    )
)

echo.
echo Starting server...
echo ================================
echo.

node server.js
pause
