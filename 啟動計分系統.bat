@echo off
chcp 65001 >nul
title 匹克球計分系統

echo 正在啟動計分伺服器...
start "計分伺服器" cmd /k "cd /d "%~dp0" && node server.js"

timeout /t 2 >nul

echo 正在開啟計分畫面並重置舊資料...
start "計分畫面" http://localhost:3000/?reset

echo 正在建立手機連線通道...
start "手機連線通道" cmd /k "cloudflared tunnel --url http://localhost:3000 --no-autoupdate"

echo.
echo ✓ 計分伺服器已啟動（視窗一）
echo ✓ 手機通道已啟動（視窗二）
echo.
echo 請在「手機連線通道」視窗裡找 https://xxxx.trycloudflare.com 網址
echo 把那個網址傳給手機即可連線
echo.
pause
