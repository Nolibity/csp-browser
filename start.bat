@echo off
chcp 65001 >nul
title CSP Browser

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 未检测到 Node.js，请先安装：https://nodejs.org
    echo 下载左边的 LTS 版本，安装后重新运行本程序。
    pause
    exit /b 1
)

:: Install dependencies on first run
if not exist "node_modules\" (
    echo 首次运行，正在安装依赖...
    call npm install
    echo.
    echo 依赖安装完成，正在启动...
    echo.
)

:: Start server (opens browser automatically)
node server.js
pause
