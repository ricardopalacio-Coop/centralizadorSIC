; =======================================================================
; INSTALADOR WINDOWS CLIENTE/SERVIDOR DA COOPEDU - CENTRALIZADOR SIC v1.0
; =======================================================================

#define MyAppName "Centralizador SIC"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Coopedu"
#define MyAppURL "https://c.coopedu.com.br"

[Setup]
AppId={{D37A8C2B-4819-4F42-892B-6C3D794F024A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName=C:\CentralizadorSIC
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=..\package.json
OutputDir=..\dist_installer
OutputBaseFilename=Centralizador_SIC_Setup_Cliente_Servidor
SetupIconFile=app_icon.ico
UninstallDisplayIcon={app}\installer\app_icon.ico
Compression=zip/1
SolidCompression=no
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Types]
Name: "full"; Description: "Instalação Completa (Servidor Backend + Cliente Desktop)"; Flags: iscustom
Name: "server"; Description: "Instalação Apenas do Servidor Backend e Banco (Servidor)"
Name: "client"; Description: "Instalação Apenas do Cliente Desktop (Estação de Trabalho)"

[Components]
Name: "server"; Description: "Servidor Centralizador SIC & API (Porta 3005 e Banco 3307)"; Types: full server
Name: "client"; Description: "Cliente Desktop Nativo (Janela do Usuário com Ícone)"; Types: full client

[Tasks]
Name: "desktopicon_client"; Description: "Criar atalho do CLIENTE DESKTOP na Área de Trabalho"; GroupDescription: "{cm:AdditionalIcons}"; Components: client
Name: "desktopicon_server"; Description: "Criar atalho do SERVIDOR na Área de Trabalho"; GroupDescription: "{cm:AdditionalIcons}"; Components: server

[Files]
; Ícones e Configurações Globais
Source: "app_icon.ico"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "app_icon.png"; DestDir: "{app}\installer"; Flags: ignoreversion

; Arquivos do Servidor Backend
Source: "..\dist\*"; DestDir: "{app}\dist"; Components: server; Flags: recursesubdirs createallsubdirs
Source: "..\client\dist\*"; DestDir: "{app}\client\dist"; Components: server; Flags: recursesubdirs createallsubdirs
Source: "..\node_modules\*"; DestDir: "{app}\node_modules"; Components: server; Flags: recursesubdirs createallsubdirs; Excludes: "*.d.ts;*.ts;*.tsx;*.map;*.md;*\typescript\*;*\@types\*;*\vite\*;*\esbuild\*;*\caniuse-lite\*;*\browserslist\*;*\lucide-react\*;*\chromium-bidi\*"
Source: "..\package.json"; DestDir: "{app}"; Components: server; Flags: ignoreversion
Source: "..\.env"; DestDir: "{app}"; Components: server; Flags: ignoreversion
Source: "..\Start.bat"; DestDir: "{app}"; Components: server; Flags: ignoreversion

; Arquivos do Cliente Desktop
Source: "..\client-desktop\*"; DestDir: "{app}\client-desktop"; Components: client; Flags: recursesubdirs createallsubdirs
Source: "app_icon.ico"; DestDir: "{app}\client-desktop"; Components: client; Flags: ignoreversion

[Icons]
; Atalhos do Cliente Desktop (Com o ícone app_icon.ico)
Name: "{autodesktop}\Centralizador SIC (Cliente)"; Filename: "{app}\client-desktop\Centralizador_SIC_Client.bat"; IconFilename: "{app}\installer\app_icon.ico"; Tasks: desktopicon_client; Components: client
Name: "{group}\Centralizador SIC (Cliente Desktop)"; Filename: "{app}\client-desktop\Centralizador_SIC_Client.bat"; IconFilename: "{app}\installer\app_icon.ico"; Components: client

; Atalhos do Servidor Backend
Name: "{autodesktop}\Centralizador SIC (Servidor)"; Filename: "{app}\Start.bat"; IconFilename: "{app}\installer\app_icon.ico"; Tasks: desktopicon_server; Components: server
Name: "{group}\Centralizador SIC (Iniciar Servidor)"; Filename: "{app}\Start.bat"; IconFilename: "{app}\installer\app_icon.ico"; Components: server

; Desinstalador
Name: "{group}\Desinstalar Centralizador SIC"; Filename: "{uninstallexe}"

[Run]
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""Centralizador SIC (Porta 3005)"" dir=in action=allow protocol=TCP localport=3005"; Components: server; Flags: runhidden
Filename: "{app}\Start.bat"; Description: "Iniciar o Servidor Centralizador SIC agora"; Components: server; Flags: shellexec postinstall skipifsilent
Filename: "{app}\client-desktop\Centralizador_SIC_Client.bat"; Description: "Iniciar o Cliente Desktop do Centralizador SIC agora"; Components: client; Flags: shellexec postinstall skipifsilent

[UninstallRun]
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""Centralizador SIC (Porta 3005)"""; Flags: runhidden
