@echo off
title CSP Browser
cd /d "%~dp0"

echo ================================
echo   CSP Browser
echo ================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found. Please install:
    echo https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies, please wait...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo Install failed. Check your network and try again.
        pause
        exit /b 1
    )
    echo.
    echo Done.
    echo.
)

echo Starting server...
echo.
node server.js
pause
