# =======================================================================
# CLIENTE DESKTOP NATIVO DO CENTRALIZADOR SIC - WINDOWS 11 (EDGE APP MODE)
# Renderização 100% Chromium/React moderna com verificação inteligente do servidor!
# =======================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ConfigDir = "$env:APPDATA\CentralizadorSIC"
$ConfigFile = "$ConfigDir\client_config.json"

if (-not (Test-Path $ConfigDir)) {
    New-Item -Path $ConfigDir -ItemType Directory -Force | Out-Null
}

$ServerUrl = "http://localhost:3005"
if (Test-Path $ConfigFile) {
    try {
        $json = Get-Content $ConfigFile | ConvertFrom-Json
        if ($json.serverUrl) {
            $ServerUrl = $json.serverUrl
        }
    } catch {}
}

# Função para checar se a porta do servidor está escutando
function Test-ServerPort([string]$urlStr) {
    try {
        $uri = [System.Uri]$urlStr
        $hostName = $uri.Host
        $port = if ($uri.Port -gt 0) { $uri.Port } else { 80 }
        $tcp = New-Object System.Net.Sockets.TcpClient
        $connection = $tcp.BeginConnect($hostName, $port, $null, $null)
        $success = $connection.AsyncWaitHandle.WaitOne(1500, $false)
        if ($success) {
            $tcp.EndConnect($connection)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

# Tecla SHIFT forçada na inicialização
$wkey = [System.Windows.Forms.Control]::ModifierKeys
if ($wkey -eq [System.Windows.Forms.Keys]::Shift) {
    $prompt = [Microsoft.VisualBasic.Interaction]::InputBox("Informe o IP ou URL do Servidor Centralizador SIC (ex: http://192.168.1.100:3005):", "Configurar Servidor SIC", $ServerUrl)
    if ($prompt) {
        $ServerUrl = $prompt
        $configObj = @{ serverUrl = $ServerUrl } | ConvertTo-Json
        Set-Content -Path $ConfigFile -Value $configObj
    }
}

# Se for localhost e a porta 3005 não estiver pronta, tenta iniciar o servidor localmente
if ($ServerUrl -like "*localhost*" -or $ServerUrl -like "*127.0.0.1*") {
    $isReady = Test-ServerPort $ServerUrl
    if (-not $isReady) {
        # Procurar o Start.bat no diretório raiz ou da instalação
        $StartBatCandidate = "$PSScriptRoot\..\Start.bat"
        if (-not (Test-Path $StartBatCandidate)) {
            $StartBatCandidate = "C:\CentralizadorSIC\Start.bat"
        }

        if (Test-Path $StartBatCandidate) {
            Start-Process -FilePath $StartBatCandidate -WorkingDirectory (Split-Path $StartBatCandidate) -WindowStyle Minimized
            # Aguardar até 12 segundos o servidor subir
            for ($i = 0; $i -lt 12; $i++) {
                Start-Sleep -Seconds 1
                if (Test-ServerPort $ServerUrl) {
                    $isReady = $true
                    break
                }
            }
        }
    }

    # Se ainda assim não estiver pronto, pergunta se é um cliente de rede para configurar o IP
    if (-not $isReady) {
        $msgResult = [System.Windows.Forms.MessageBox]::Show(
            "O Servidor Centralizador SIC não está ativo no localhost (porta 3005).\n\nEste computador é um CLIENTE em rede? Clique em SIM para informar o IP do Servidor principal, ou NÃO para aguardar o servidor local.",
            "Centralizador SIC - Servidor Não Localizado",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )

        if ($msgResult -eq [System.Windows.Forms.DialogResult]::Yes) {
            $prompt = [Microsoft.VisualBasic.Interaction]::InputBox(
                "Digite o IP do computador SERVIDOR (Exemplo: 192.168.1.100 ou http://192.168.1.100:3005):",
                "Conectar ao Servidor em Rede",
                "http://192.168.1.100:3005"
            )
            if ($prompt) {
                if (-not ($prompt.StartsWith("http://") -or $prompt.StartsWith("https://"))) {
                    $prompt = "http://" + $prompt
                }
                if (-not ($prompt -like "*:*") -or ($prompt -like "http://*:*")) {
                    if (-not ($prompt.Substring(7) -like "*:*")) {
                        $prompt = $prompt + ":3005"
                    }
                }
                $ServerUrl = $prompt
                $configObj = @{ serverUrl = $ServerUrl } | ConvertTo-Json
                Set-Content -Path $ConfigFile -Value $configObj
            }
        }
    }
}

# Localizar o executável do Microsoft Edge ou Chrome
$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $EdgePath)) {
    $EdgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $EdgePath)) {
    $EdgePath = (Get-Command "msedge.exe" -ErrorAction SilentlyContinue).Path
}

# Executar a aplicação desktop no modo NATIVO (--app)
if ($EdgePath -and (Test-Path $EdgePath)) {
    $userDataDir = "$ConfigDir\EdgeProfile"
    Start-Process -FilePath $EdgePath -ArgumentList "--app=`"$ServerUrl`" --user-data-dir=`"$userDataDir`" --window-size=1360,900 --app-title=`"Centralizador SIC - Cliente Desktop`""
} else {
    # Fallback para o navegador padrão
    Start-Process $ServerUrl
}
