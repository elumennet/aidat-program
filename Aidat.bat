@echo off
chcp 65001 >nul
title Aidat Programi
cd /d "%~dp0"

rem ==================================================
rem  AIDAT - Bina Gelir Gider
rem  (C) 2026 Cemal Solmaz - Tum haklari saklidir.
rem  Cift tiklayin: program ayri bir pencerede,
rem  uygulama gibi acilir.
rem ==================================================

rem Yerlesim 1: dosyalar "Uygulama" alt klasorunde (kurulum paketi)
if exist "Uygulama\index.html" (
  where node >nul 2>nul
  if not errorlevel 1 (
    start "" /min cmd /c ""node" "Uygulama\Uygulama-baslat.js""
    exit /b
  )
  start "" "Uygulama\index.html"
  exit /b
)

rem Yerlesim 2: dosyalar ayni klasorde (zip/klasor kopyasi)
where node >nul 2>nul
if errorlevel 1 (
  start "" "index.html"
  exit /b
)
start "" /min cmd /c ""node" "Uygulama-baslat.js""
exit /b
