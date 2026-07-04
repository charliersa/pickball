@echo off
chcp 65001 >nul
title 匹克球計分系統

echo 正在啟動計分伺服器...
start "計分伺服器" cmd /k "cd /d "%~dp0" && node server.js"

timeout /t 2 >nul

echo 正在開啟計分操作台並重置舊資料...
start "計分操作台" http://localhost:3000/control?reset

echo 正在建立手機連線通道...
start "手機連線通道" cmd /k "cloudflared tunnel --url http://localhost:3000 --no-autoupdate"

echo.
echo ✓ 計分伺服器已啟動（視窗一）
echo ✓ 手機通道已啟動（視窗二）
echo.
echo 三種畫面（把 xxxx 換成手機通道視窗顯示的網址）：
echo   觀眾看板   https://xxxx.trycloudflare.com/
echo   計分操作   https://xxxx.trycloudflare.com/control
echo   選手報名   https://xxxx.trycloudflare.com/register
echo.
echo 觀眾開「/」、選手開「/register」、你自己開「/control」
echo.
pause
