@echo off
title Liminal - Production Build
echo ========================================
echo   Liminal - Production Build
echo ========================================
echo.

cd /d "%~dp0.."

REM Check prerequisites
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    pause
    exit /b 1
)

pnpm --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pnpm is not installed.
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
call pnpm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo [2/3] Building all packages...
call pnpm build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Build complete!
echo.
echo ========================================
echo   Production build ready.
echo   Run scripts\start.bat to start.
echo ========================================
pause
