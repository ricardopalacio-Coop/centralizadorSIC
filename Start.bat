@echo off
title Centralizador SIC - Iniciador Automatico
color 0A
setlocal enabledelayedexpansion

echo =======================================================================
echo              * CENTRALIZADOR SIC e API REST (CORE COOPEDU) *           
echo =======================================================================
echo.

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

:: 1. Checar se o Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo =======================================================================
    echo  [AVISO] Node.js nao foi detectado neste computador!
    echo.
    echo  - Se esta maquina for o SERVIDOR PRINCIPAL:
    echo    Por favor, instale o Node.js (v20 ou superior) de https://nodejs.org
    echo.
    echo  - Se esta maquina for apenas um CLIENTE (Estacao de Trabalho):
    echo    Voce nao precisa executar o Servidor aqui.
    echo    Abra o atalho "Centralizador SIC - Cliente" na Area de Trabalho.
    echo =======================================================================
    echo.
    pause
    exit /b 1
)

:: 2. Checar se o MySQL está rodando na porta 3307
echo [1/2] Verificando conexao com Banco de Dados MySQL na porta 3307...
netstat -ano | findstr :3307 > nul
if %errorlevel% neq 0 (
    echo    MySQL nao detectado ativo na porta 3307. Verificando executavel local...
    set "MYSQL_EXE="
    if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" set "MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
    if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" set "MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
    if exist "C:\Program Files\MySQL\MySQL Server 9.0\bin\mysqld.exe" set "MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 9.0\bin\mysqld.exe"

    if defined MYSQL_EXE (
        if exist "%APP_DIR%\scratch\mysql_data" (
            echo    Iniciando MySQL dedicado na porta 3307...
            start "MySQL 3307 (Centralizador SIC)" /min "!MYSQL_EXE!" --datadir="%APP_DIR%\scratch\mysql_data" --port=3307
            echo    Aguardando inicializacao do MySQL (3 segundos)...
            timeout /t 3 /nobreak > nul
        ) else (
            echo    [INFO] scratch\mysql_data local nao encontrado. Conectando a banco configurado no .env / Docker.
        )
    ) else (
        echo    [INFO] mysqld.exe local nao encontrado. Assumindo banco externo, Docker ou servico.
    )
) else (
    echo    Banco de Dados MySQL na porta 3307 ja ativo!
)

echo.
echo =======================================================================
echo 🚀 [2/2] Iniciando Servidor Web e API REST na porta 3005...
echo 🌐 URL do Sistema: http://localhost:3005
echo =======================================================================
echo.

cd /d "%APP_DIR%"

:: 3. Iniciar Servidor (Produção ou Desenvolvimento)
if exist "%APP_DIR%\dist\server\index.js" (
    node "%APP_DIR%\dist\server\index.js"
) else (
    npm run dev
)


