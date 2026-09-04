# =======================================================================
# INSTALADOR WINDOWS CLIENTE / SERVIDOR - CENTRALIZADOR SIC (CORE COOPEDU)
# Com suporte a Ícone Personalizado e Conexão de Cliente Desktop Nativo
# =======================================================================

$ErrorActionPreference = "Stop"

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host " 🚀 INSTALADOR CLIENTE / SERVIDOR DO CENTRALIZADOR SIC (COOPEDU)        " -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Elevação de Privilégios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️ Solicitando permissão de Administrador para registrar os atalhos e Firewall..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    Exit
}

$InstallDir = "C:\CentralizadorSIC"
$SourceDir = $PSScriptRoot

Write-Host "[1/6] Criando diretório de instalação em $InstallDir..." -ForegroundColor Green
if (-not (Test-Path $InstallDir)) {
    New-Item -Path $InstallDir -ItemType Directory -Force | Out-Null
}

# 2. Copiar arquivos compilados da aplicação (Servidor Backend + Cliente)
Write-Host "[2/6] Copiando arquivos do Servidor Backend e Cliente Desktop..." -ForegroundColor Green

Copy-Item -Path "$SourceDir\dist" -Destination "$InstallDir\dist" -Recurse -Force
Copy-Item -Path "$SourceDir\client\dist" -Destination "$InstallDir\client\dist" -Recurse -Force
Copy-Item -Path "$SourceDir\client-desktop" -Destination "$InstallDir\client-desktop" -Recurse -Force
Copy-Item -Path "$SourceDir\installer" -Destination "$InstallDir\installer" -Recurse -Force
Copy-Item -Path "$SourceDir\package.json" -Destination "$InstallDir\package.json" -Force
if (Test-Path "$SourceDir\.env") {
    Copy-Item -Path "$SourceDir\.env" -Destination "$InstallDir\.env" -Force
}
Copy-Item -Path "$SourceDir\Start.bat" -Destination "$InstallDir\Start.bat" -Force

if (Test-Path "$SourceDir\node_modules") {
    Write-Host "   -> Copiando dependencias node_modules..." -ForegroundColor DarkGray
    Copy-Item -Path "$SourceDir\node_modules" -Destination "$InstallDir\node_modules" -Recurse -Force
}

if (Test-Path "$SourceDir\scratch\mysql_data") {
    New-Item -Path "$InstallDir\scratch" -ItemType Directory -Force | Out-Null
    Copy-Item -Path "$SourceDir\scratch\mysql_data" -Destination "$InstallDir\scratch\mysql_data" -Recurse -Force
}

# 3. Registrar Firewall para a Porta 3005
Write-Host "[3/6] Liberando a porta 3005 no Windows Defender Firewall..." -ForegroundColor Green
try {
    netsh advfirewall firewall delete rule name="Centralizador SIC (Porta 3005)" | Out-Null
    netsh advfirewall firewall add rule name="Centralizador SIC (Porta 3005)" dir=in action=allow protocol=TCP localport=3005 | Out-Null
    Write-Host "   ✅ Regra de Firewall registrada com sucesso!" -ForegroundColor Green
} catch {}

# 4. Criar Atalho do CLIENTE DESKTOP com Ícone Personalizado na Área de Trabalho
Write-Host "[4/6] Criando atalho do CLIENTE DESKTOP com ÍCONE PERSONALIZADO..." -ForegroundColor Green
$WScriptShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$IconFile = "$InstallDir\installer\app_icon.ico"

# Atalho 1: Cliente Desktop (App com Janela Nativa e Ícone)
$ClientShortcutPath = Join-Path -Path $DesktopPath -ChildPath "Centralizador SIC - Cliente.lnk"
$ClientShortcut = $WScriptShell.CreateShortcut($ClientShortcutPath)
$ClientShortcut.TargetPath = "$InstallDir\client-desktop\Centralizador_SIC_Client.bat"
$ClientShortcut.WorkingDirectory = "$InstallDir\client-desktop"
$ClientShortcut.IconLocation = "$IconFile,0"
$ClientShortcut.Description = "Cliente Desktop Nativo - Centralizador SIC Coopedu"
$ClientShortcut.Save()

# Atalho 2: Servidor Backend
$ServerShortcutPath = Join-Path -Path $DesktopPath -ChildPath "Centralizador SIC - Servidor.lnk"
$ServerShortcut = $WScriptShell.CreateShortcut($ServerShortcutPath)
$ServerShortcut.TargetPath = "$InstallDir\Start.bat"
$ServerShortcut.WorkingDirectory = $InstallDir
$ServerShortcut.IconLocation = "$IconFile,0"
$ServerShortcut.Description = "Servidor Centralizador SIC & API REST (Porta 3005)"
$ServerShortcut.Save()

# 5. Criar Atalhos no Menu Iniciar
Write-Host "[5/6] Criando pasta no Menu Iniciar..." -ForegroundColor Green
$StartMenuPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::CommonPrograms)
$StartFolder = Join-Path -Path $StartMenuPath -ChildPath "Centralizador SIC"
if (-not (Test-Path $StartFolder)) {
    New-Item -Path $StartFolder -ItemType Directory -Force | Out-Null
}

$StartClient = $WScriptShell.CreateShortcut((Join-Path $StartFolder "Centralizador SIC (Cliente).lnk"))
$StartClient.TargetPath = "$InstallDir\client-desktop\Centralizador_SIC_Client.bat"
$StartClient.WorkingDirectory = "$InstallDir\client-desktop"
$StartClient.IconLocation = "$IconFile,0"
$StartClient.Save()

$StartServer = $WScriptShell.CreateShortcut((Join-Path $StartFolder "Centralizador SIC (Servidor).lnk"))
$StartServer.TargetPath = "$InstallDir\Start.bat"
$StartServer.WorkingDirectory = $InstallDir
$StartServer.IconLocation = "$IconFile,0"
$StartServer.Save()

# 6. Desinstalador
$UninstallLines = @(
    '@echo off',
    'title Desinstalar Centralizador SIC',
    'echo Removendo Centralizador SIC...',
    'netsh advfirewall firewall delete rule name="Centralizador SIC (Porta 3005)" > NUL',
    'del "%PUBLIC%\Desktop\Centralizador SIC*.lnk" 2>NUL',
    'del "%USERPROFILE%\Desktop\Centralizador SIC*.lnk" 2>NUL',
    'echo Aplicacao desinstalada com sucesso.',
    'pause'
)
$UninstallLines | Out-File -FilePath "$InstallDir\Desinstalar.bat" -Encoding ascii

Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host " 🎉 INSTALAÇÃO CLIENTE / SERVIDOR CONCLUÍDA NO WINDOWS 11!" -ForegroundColor Green
Write-Host " 📂 Diretório de Instalação: $InstallDir" -ForegroundColor White
Write-Host " 🎨 Ícone do Aplicativo: $IconFile" -ForegroundColor White
Write-Host " 💻 Atalho do Cliente Criado: Centralizador SIC - Cliente" -ForegroundColor White
Write-Host " 🖥️  Atalho do Servidor Criado: Centralizador SIC - Servidor" -ForegroundColor White
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

$choice = Read-Host "Deseja iniciar o Servidor e o Cliente Desktop agora? (S/N)"
if ($choice -eq 'S' -or $choice -eq 's' -or $choice -eq '') {
    Start-Process "$InstallDir\Start.bat" -WorkingDirectory $InstallDir
    Start-Sleep -Seconds 3
    Start-Process "$InstallDir\client-desktop\Centralizador_SIC_Client.bat" -WorkingDirectory "$InstallDir\client-desktop"
}
