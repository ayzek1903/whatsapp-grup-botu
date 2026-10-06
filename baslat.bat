@echo off
chcp 65001 >nul
title WhatsApp Grup Botu
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi.
  echo Once https://nodejs.org adresinden "LTS" surumunu indirip kur,
  echo sonra bu dosyayi tekrar calistir.
  echo.
  pause
  exit /b
)

node -e "process.exit(+process.versions.node.split('.')[0] < 18 ? 1 : 0)"
if errorlevel 1 (
  echo Bilgisayardaki Node.js surumu cok eski. https://nodejs.org adresinden
  echo "LTS" surumunu indirip kur, sonra bu dosyayi tekrar calistir.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo Ilk kurulum yapiliyor, birkac dakika surebilir...
  set PUPPETEER_SKIP_DOWNLOAD=true
  call npm install --no-audit --no-fund --loglevel=error
  if errorlevel 1 (
    echo Kurulum basarisiz oldu. Internet baglantini kontrol edip tekrar dene.
    pause
    exit /b
  )
)

node bot.js
echo.
pause
