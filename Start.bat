@echo off
title Centralizador SIC - Iniciador Automatico
color 0A
echo =======================================================================
echo              🚀 CENTRALIZADOR SIC & API REST (CORE COOPEDU)            
echo =======================================================================
echo.
echo [1/2] Iniciando Banco de Dados MySQL dedicado na porta 3307...
start "MySQL 3307 (Centralizador SIC)" /min "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --datadir="C:\Users\ricar\DevCoopedu\Centralizador SIC\scratch\mysql_data" --port=3307

echo [2/2] Aguardando inicializacao do MySQL (3 segundos)...
timeout /t 3 /nobreak > NUL

echo.
echo =======================================================================
echo 🚀 Iniciando Servidor Web e API REST na porta 3005...
echo 🌐 URL do Sistema: http://localhost:3005
echo =======================================================================
echo.

cd /d "%~dp0"
npm run dev
