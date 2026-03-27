@echo off
title Liminal - AI Assistant
echo ========================================
echo   Liminal - Local AI Assistant
echo ========================================
echo.

cd /d "%~dp0.."

REM Check Node.js
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Download from https://nodejs.org
    pause
    exit /b 1
)

REM Check pnpm
pnpm --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pnpm is not installed.
    echo         Install with: npm install -g pnpm
    pause
    exit /b 1
)

REM Check Ollama
ollama list >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Ollama is not running.
    echo           Download from https://ollama.com
    echo           Start with: ollama serve
    echo.
    choice /c YN /m "Continue without Ollama?"
    if %ERRORLEVEL% equ 2 exit /b 1
)

REM Check default model
ollama list 2>nul | findstr "deepseek-r1:8b" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] deepseek-r1:8b model not found.
    choice /c YN /m "Download deepseek-r1:8b now?"
    if %ERRORLEVEL% equ 1 (
        echo [DOWNLOAD] Pulling deepseek-r1:8b...
        ollama pull deepseek-r1:8b
    )
)

REM Create data directory
if not exist "data" mkdir data

echo.
echo [START] Starting API server (port 3001)...
echo [START] Starting Web server (port 3000)...
echo.
echo ========================================
echo   Open http://localhost:3000 in browser
echo ========================================
echo   Press Ctrl+C to stop
echo.

pnpm turbo run dev --filter @liminal/api --filter @liminal/web
