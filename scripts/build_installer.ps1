# =======================================================================
# SCRIPT DE COMPILAÇÃO E GERAÇÃO DO INSTALADOR WINDOWS CLIENTE / SERVIDOR
# Centralizador SIC - Coopedu
# =======================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path "$ProjectRoot\package.json")) {
    $ProjectRoot = $PSScriptRoot
}

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host " 📦 GERADOR DO INSTALADOR WINDOWS CLIENTE/SERVIDOR - CENTRALIZADOR SIC  " -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "📂 Diretorio do Projeto: $ProjectRoot" -ForegroundColor White
Write-Host ""

# 1. Compilar Backend e Frontend
Write-Host "[1/3] Compilando Servidor TypeScript e Frontend React/Vite..." -ForegroundColor Green
Set-Location $ProjectRoot
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao compilar a aplicacao com npm run build!" -ForegroundColor Red
    Exit 1
}

# 2. Localizar Compilador Inno Setup (ISCC.exe)
Write-Host "[2/3] Localizando compilador Inno Setup..." -ForegroundColor Green
$ISCC = "$ProjectRoot\scratch\is_compiler\ISCC.exe"
if (-not (Test-Path $ISCC)) {
    $ISCC = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
}
if (-not (Test-Path $ISCC)) {
    $ISCC = (Get-Command "ISCC.exe" -ErrorAction SilentlyContinue).Path
}

if (-not (Test-Path $ISCC)) {
    Write-Host "❌ Compilador Inno Setup (ISCC.exe) nao encontrado!" -ForegroundColor Red
    Exit 1
}

Write-Host "   Compilador detectado em: $ISCC" -ForegroundColor DarkGray

# 3. Compilar Instalador (.iss)
Write-Host "[3/3] Gerando executavel do Instalador com Inno Setup..." -ForegroundColor Green
$IssFile = "$ProjectRoot\installer\Centralizador_SIC_Setup.iss"

& "$ISCC" "$IssFile"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao compilar instalador Inno Setup!" -ForegroundColor Red
    Exit 1
}

$InstallerPath = "$ProjectRoot\dist_installer\Centralizador_SIC_Setup_Cliente_Servidor.exe"
if (Test-Path $InstallerPath) {
    $fileItem = Get-Item $InstallerPath
    $sizeMb = [Math]::Round($fileItem.Length / 1MB, 2)
    Write-Host ""
    Write-Host "=======================================================================" -ForegroundColor Cyan
    Write-Host " 🎉 INSTALADOR WINDOWS GERADO COM SUCESSO!" -ForegroundColor Green
    Write-Host " 📂 Arquivo: $InstallerPath" -ForegroundColor White
    Write-Host " 📊 Tamanho: $sizeMb MB" -ForegroundColor White
    Write-Host " 🕒 Ultima modificacao: $($fileItem.LastWriteTime)" -ForegroundColor White
    Write-Host "=======================================================================" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ Instalador nao foi encontrado no destino esperado: $InstallerPath" -ForegroundColor Yellow
}
