@echo off
chcp 65001 >nul
cd /d "%~dp0"
title [NetLix] Vietnam Streaming Proxy Engine
color 0A

echo ================================================================
echo           NETLIX VIETNAM STREAMING PROXY (CHO NGUOI NHA)
echo ================================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :no_node

echo [*] Kiem tra Stream Proxy tai cong 8989...
netstat -aon | findstr :8989 >nul
if errorlevel 1 goto :start_node
echo [*] Stream Proxy tren cong 8989 da san sang.
goto :check_cf

:start_node
if exist "%~dp0scripts\stream-proxy.mjs" (
    start "NetLix Proxy Background" /min node "%~dp0scripts\stream-proxy.mjs"
    ping 127.0.0.1 -n 2 >nul
    goto :check_cf
)
if exist "%~dp0stream-proxy.mjs" (
    start "NetLix Proxy Background" /min node "%~dp0stream-proxy.mjs"
    ping 127.0.0.1 -n 2 >nul
    goto :check_cf
)
echo [!] Khong tim thay file scripts\stream-proxy.mjs!
goto :finish

:check_cf
set "CF_CMD="
if exist "%~dp0cloudflared.exe" set "CF_CMD=%~dp0cloudflared.exe"
if not defined CF_CMD if exist "%~dp0cloudflared-windows-amd64.exe" set "CF_CMD=%~dp0cloudflared-windows-amd64.exe"
if not defined CF_CMD (
    where cloudflared >nul 2>nul
    if not errorlevel 1 set "CF_CMD=cloudflared"
)

if not defined CF_CMD goto :no_cf

echo.
echo ================================================================
echo [*] DANG KET NOI CLOUDFLARE TUNNEL...
echo [*] Tim dong link o khung ben duoi:
echo     https://xxxx-xxxx-xxxx.trycloudflare.com
echo [*] Copy link do va gui cho nguoi nha o nuoc ngoai dan vao web xem!
echo [*] (Luu y: De cua so nay chay lien tuc trong khi nguoi nha dang xem)
echo ================================================================
echo.

"%CF_CMD%" tunnel --url http://localhost:8989
goto :finish

:no_node
echo.
echo [!] May tinh chua cai dat Node.js hoac chua them vao PATH!
goto :finish

:no_cf
echo.
echo [!] CHUA TIM THAY FILE CLOUDFLARED TREN MAY!
echo [*] Ban hay de file cloudflared.exe hoac cloudflared-windows-amd64.exe
echo     ngay trong thu muc netlix nay nhe.
goto :finish

:finish
echo.
echo [!] Tien trinh da dung lai.
pause
