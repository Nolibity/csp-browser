@echo off
title CSP Browser
cd /d "%~dp0"

echo ================================
echo   CSP Browser 正在启动...
echo ================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js
    echo 请先安装：https://nodejs.org （下载左边 LTS 版本）
    echo.
    pause
    exit /b 1
)

:: Install dependencies on first run
if not exist "node_modules\" (
    echo [1/2] 首次运行，正在下载依赖文件，请耐心等待...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败，请检查网络后重试
        pause
        exit /b 1
    )
    echo.
    echo [完成] 依赖安装完毕
    echo.
)

echo [2/2] 启动服务，浏览器即将自动打开...
echo.
echo 关闭本窗口即可退出程序。
echo ================================
echo.

node server.js
pause
