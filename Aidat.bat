@echo off
chcp 65001 >nul
title Aidat Programi
cd /d "%~dp0"

rem ==================================================
rem  AIDAT - Bina Gelir Gider
rem  (C) 2026 Cemal Solmaz - Tum haklari saklidir.
rem  Bu dosyaya cift tiklayin: program ayri bir
rem  pencerede, uygulama gibi acilir.
rem ==================================================

where node >nul 2>nul
if errorlevel 1 (
  start "" "index.html"
  exit /b
)

start "" /min cmd /c ""node" "Uygulama-baslat.js""
exit /b
