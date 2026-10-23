@echo off
chcp 65001 >nul
cd /d "%~dp0"
title [NetLix] Stop Proxy Engine
color 0C

echo ================================================================
echo           DANG DUNG TOAN BO PROXY VA CLOUDFLARE TUNNEL
echo ================================================================
echo.

taskkill /f /im cloudflared.exe >nul 2>nul
taskkill /f /im cloudflared-windows-amd64.exe >nul 2>nul

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8989') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo [OK] Da tat toan bo Proxy va giai phong 100%% tai nguyen may tinh!
ping 127.0.0.1 -n 2 >nul
exit /b
