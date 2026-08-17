@echo off
title Configurar IP do Servidor SIC
color 0B
echo =======================================================================
echo          ⚙️ CONFIGURAÇÃO DE IP DO SERVIDORES SIC (CLIENTE DESKTOP)      
echo =======================================================================
echo.
set /p SERVER_URL="Digite o IP ou URL do Servidor (ex: http://192.168.1.100:3005 ou http://localhost:3005): "

if not "%SERVER_URL%"=="" (
    powershell -Command "$config = @{ serverUrl = '%SERVER_URL%' } | ConvertTo-Json; Set-Content -Path '$env:APPDATA\CentralizadorSIC\client_config.json' -Value $config"
    echo.
    echo ✅ IP do Servidor salvo com sucesso!
)

pause
