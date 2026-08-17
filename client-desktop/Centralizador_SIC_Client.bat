@echo off
title Centralizador SIC - Cliente Desktop
color 0B
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Centralizador_SIC_Client.ps1"
