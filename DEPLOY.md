# 🚀 Guia Oficial de Deploy em Produção — Centralizador SIC (Coopedu)

Este documento detalha o processo completo de implantação em produção do **Centralizador SIC**, cobrindo arquitetura, requisitos de infraestrutura, segurança, automação de processos em background (Puppeteer/Chromium) e as opções de ambiente (Docker/Linux, Servidor VPS via PM2 e Servidor Local Windows).

---

## 📋 Índice
1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Requisitos Mínimos de Sistema](#2-requisitos-mínimos-de-sistema)
3. [Variáveis de Ambiente (.env)](#3-variáveis-de-ambiente-env)
4. [Opção 1: Deploy com Docker & Docker Compose (Recomendado para Nuvem/Linux)](#4-opção-1-deploy-com-docker--docker-compose-recomendado)
5. [Opção 2: Deploy Linux Bare-Metal / VPS com PM2 e Nginx](#5-opção-2-deploy-linux-bare-metal--vps-com-pm2-e-nginx)
6. [Opção 3: Deploy On-Premises Windows Server (Ambiente Local Coopedu)](#6-opção-3-deploy-on-premises-windows-server-ambiente-local-coopedu)
7. [Configuração de Proxy Reverso Nginx & SSL HTTPS](#7-configuração-de-proxy-reverso-nginx--ssl-https)
8. [Verificação Pós-Deploy e Rotina de Saúde](#8-verificação-pós-deploy-e-rotina-de-saúde)
9. [Backup e Recuperação de Desastres](#9-backup-e-recuperação-de-desastres)
10. [Políticas de Segurança e Hardening](#10-políticas-de-segurança-e-hardening)

---

## 1. Visão Geral da Arquitetura

O **Centralizador SIC** é composto por:
- **Backend**: Node.js 20+ com Express, TypeScript, módulos de automação com Puppeteer Stealth e integração com APIs REST externas (`core.coopedu.app.br`, `c.coopedu.com.br`, Google Drive OAuth 2.0).
- **Frontend SPA**: React 18 / 19 com Vite, Tailwind CSS e Shadcn UI, servido estaticamente pelo Express através de `client/dist`.
- **Banco de Dados**: MySQL 8.0 dedicado (`centralizador_sic_db`), padrão na porta `3307`. O servidor cria e atualiza as tabelas automaticamente na inicialização (`server/db.ts`).
- **Automações em Segundo Plano**: Worker de renovação autônoma de tokens SIC (`startSicAutoRefreshWorker`) com headless browser.

```
                    [ Usuários Web / Cliente Desktop ]
                                    │
                                    ▼
                         [ Proxy Reverso Nginx ] (Porta 80 / 443 HTTPS)
                                    │
                                    ▼
                    [ Centralizador SIC App ] (Porta 3005)
                     ├── Express REST API (/api/*)
                     ├── Frontend Estático SPA (/*)
                     ├── Puppeteer Headless Worker (Chromium)
                     └── Google Drive Sync & OCR Worker
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
       [ MySQL 8.0 Dedicado ]            [ APIs Externas Coopedu ]
       Porta 3307 (centralizador_sic_db)  ├── SIC Core (core.coopedu.app.br)
                                         ├── Adesão/Desligamento (c.coopedu.com.br)
                                         └── Google Cloud Platform (Drive API)
```

---

## 2. Requisitos Mínimos de Sistema

| Recurso | Mínimo Recomendado | Produção Ideal |
| :--- | :--- | :--- |
| **Sistema Operacional** | Ubuntu 22.04 LTS / Debian 12 / Windows Server 2019+ | Ubuntu 24.04 LTS / Debian 12 |
| **Processador (CPU)** | 2 vCPUs | 4 vCPUs (para suportar Puppeteer e PDFs) |
| **Memória RAM** | 4 GB | 8 GB |
| **Armazenamento** | 20 GB SSD | 50 GB+ NVMe SSD |
| **Node.js** | v20.x LTS | v20.x LTS |
| **Banco de Dados** | MySQL 8.0+ | MySQL 8.0+ |
| **Dependências OS** | Chromium, libnss3, libatk, libgbm | Instaladas automaticamente via Docker |

---

## 3. Variáveis de Ambiente (.env)

Crie o arquivo `.env` na raiz do projeto com base no arquivo `.env.example`:

```bash
cp .env.example .env
nano .env
```

### Chaves Obrigatórias:

```ini
# Configuração de Execução
PORT=3005
NODE_ENV=production

# Conexão com o Banco de Dados Dedicado
DB_HOST=localhost            # Se no Docker conectando ao host: host.docker.internal ou db
DB_PORT=3307
DB_USER=root
DB_PASSWORD=SUA_SENHA_FORTE_DO_BANCO
DB_NAME=centralizador_sic_db

# Segurança e Criptografia
JWT_SECRET=CHAVE_ALEATORIA_LONGA_E_SEGURA_MIN_32_CHARS
INITIAL_ADMIN_EMAIL=ricardo.palacio@coopedu.com.br
INITIAL_ADMIN_PASSWORD=SENHA_SUPERADMIN_SEGURA

# Integrações SIC / Coopedu
SIC_API_URL=https://core.coopedu.app.br
SIC_CLIENT_ID=2872a32a-48c0-4949-95f8-3e0cdc677907
SIC_CLIENT_SECRET=SUA_CHAVE_CLIENT_SECRET
DESLIGAMENTO_BASE_URL=https://c.coopedu.com.br
DESLIGAMENTO_API_KEY=SUA_CHAVE_DESLIGAMENTO_API

# Google Drive API (OAuth 2.0)
GOOGLE_DRIVE_FOLDER_ID=1X_pCFmZNmj-EoGi-ltFf0lZWxZ6DPzLP
GOOGLE_DRIVE_DESLIGAMENTO_FOLDER_ID=1Htt4v5GBm23RYuSaoJ6b6LqpobC1NMfb
GOOGLE_OAUTH_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=SEU_CLIENT_SECRET
GOOGLE_OAUTH_REFRESH_TOKEN=SEU_REFRESH_TOKEN
```

---

## 4. Opção 1: Deploy com Docker & Docker Compose (Recomendado)

O Docker empacota o runtime do Node 20, o Chromium e todas as dependências nativas de renderização de PDF e OCR.

### Passo 1: Clonar o Repositório
```bash
git clone https://github.com/ricardopalacio-Coop/centralizadorSIC.git /opt/centralizadorSIC
cd /opt/centralizadorSIC
```

### Passo 2: Configurar o Arquivo `.env`
```bash
cp .env.example .env
nano .env
```

### Passo 3: Executar a Aplicação via Docker Compose
```bash
# Construir a imagem e iniciar em segundo plano
docker compose up -d --build
```

### Passo 4: Verificar se os Contêineres estão Saudáveis
```bash
# Verificar status dos containers
docker compose ps

# Visualizar logs em tempo real
docker compose logs -f --tail=100
```

Para reiniciar a aplicação após atualizações de código:
```bash
git pull origin main
docker compose up -d --build
```

---

## 5. Opção 2: Deploy Linux Bare-Metal / VPS com PM2 e Nginx

Caso opte por rodar diretamente no sistema operacional do servidor Linux sem Docker:

### Passo 1: Instalar Dependências do Sistema
```bash
sudo apt update && sudo apt install -y curl git chromium-browser \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libasound2 \
  python3 python3-pip

# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2 globalmente
sudo npm install -g pm2
```

### Passo 2: Clonar e Instalar Dependências
```bash
git clone https://github.com/ricardopalacio-Coop/centralizadorSIC.git /var/www/centralizador-sic
cd /var/www/centralizador-sic

# Instalar dependências completas
npm install
```

### Passo 3: Compilar Frontend e Backend
```bash
npm run build
```
> O comando compila o backend TypeScript para `dist/server` e o frontend React para `client/dist`.

### Passo 4: Gerenciar com PM2
Crie o arquivo `ecosystem.config.js` na raiz:
```javascript
module.exports = {
  apps: [
    {
      name: "centralizador-sic",
      script: "dist/server/index.js",
      instances: 1, // Puppeteer e workers sincronizados preferem 1 instância principal
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production",
        PORT: 3005,
        PUPPETEER_EXECUTABLE_PATH: "/usr/bin/chromium-browser"
      }
    }
  ]
};
```

Inicie o processo:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 6. Opção 3: Deploy On-Premises Windows Server (Ambiente Local Coopedu)

Para implantações dentro do escritório ou datacenter local da Coopedu em Windows Server:

### Passo 1: Pré-Requisitos no Servidor
1. **Node.js LTS (v20+)**: Baixe e instale a versão oficial x64 em [nodejs.org](https://nodejs.org).
2. **MySQL Server 8.0**: Instale o MySQL na porta `3307` (usuário `root`).
3. **Microsoft Edge**: Instalado por padrão no Windows 10/11 e Windows Server.

### Passo 2: Executar Script de Instalação Automatizada
Execute no PowerShell como Administrador:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\Install_Centralizador_SIC.ps1
```
Esse script:
- Copia a aplicação compilada para `C:\CentralizadorSIC`.
- Abre a porta `3005` no Windows Defender Firewall.
- Cria os atalhos do **Servidor** e do **Cliente Desktop** na Área de Trabalho e no Menu Iniciar.

### Passo 3: Executar como Serviço Windows (Permanente)
Para que o servidor inicie automaticamente com o Windows sem precisar deixar uma janela aberta:
1. Baixe o **NSSM** (Non-Sucking Service Manager).
2. Abra o terminal como Administrador:
```cmd
nssm install CentralizadorSIC "C:\Program Files\nodejs\node.exe" "C:\CentralizadorSIC\dist\server\index.js"
nssm set CentralizadorSIC AppDirectory "C:\CentralizadorSIC"
nssm set CentralizadorSIC Start SERVICE_AUTO_START
nssm start CentralizadorSIC
```

### Passo 4: Distribuição para Estações de Trabalho (Clientes)
Nas máquinas dos operadores que utilizarão o sistema:
1. Instale o pacote usando o instalador gerado: `Centralizador_SIC_Setup_Cliente_Servidor.exe` selecionando a opção **"Cliente Desktop"**.
2. Abra o atalho `Centralizador SIC - Cliente` na Área de Trabalho.
3. Se for o primeiro acesso, pressione `Shift` ao abrir ou execute `Configurar_Servidor.bat` e aponte para o IP do servidor:
   ```
   http://192.168.1.100:3005
   ```

---

## 7. Configuração de Proxy Reverso Nginx & SSL HTTPS

Para publicação com domínio público ou intranet segura com certificado SSL:

### Configuração do Nginx (`/etc/nginx/sites-available/centralizador-sic.conf`):
```nginx
server {
    listen 80;
    server_name centralizadorsic.coopedu.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name centralizadorsic.coopedu.com.br;

    # Certificados SSL (Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/centralizadorsic.coopedu.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/centralizadorsic.coopedu.com.br/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Uploads de PDFs e planilhas grandes
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts estendidos para OCR e geração de PDFs complexos
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

### Ativação do Site e Certificado SSL:
```bash
sudo ln -s /etc/nginx/sites-available/centralizador-sic.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Emitir certificado SSL gratuito Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d centralizadorsic.coopedu.com.br
```

---

## 8. Verificação Pós-Deploy e Rotina de Saúde

Após iniciar a aplicação, realize os testes de validação:

### 1. Healthcheck da API
```bash
curl -I http://localhost:3005/api/health
```
Resposta esperada (Status 200 OK):
```json
{"status":"OK","service":"Centralizador SIC API","db":"centralizador_sic_db"}
```

### 2. Primeiro Login do SuperAdmin
- Acesse a URL no navegador: `http://SEU_IP:3005` ou `https://seu-dominio.com.br`
- Usuário inicial: `ricardo.palacio@coopedu.com.br`
- Senha inicial: conforme definida na variável `INITIAL_ADMIN_PASSWORD` (ou padrão interna `Odracir48@@@`).
- **Ação imediata pós-login**: Altere a senha padrão no painel de perfil do usuário.

---

## 9. Backup e Recuperação de Desastres

### Script de Backup Diário do MySQL (`backup_db.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/centralizador_sic"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

mysqldump -h 127.0.0.1 -P 3307 -u root -p'SUA_SENHA' centralizador_sic_db | gzip > "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Manter apenas os últimos 30 dias de backup
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -delete
```

Configure no Crontab (`crontab -e`):
```cron
0 2 * * * /bin/bash /var/backups/centralizador_sic/backup_db.sh
```

---

## 10. Políticas de Segurança e Hardening

1. **Firewall Restritivo**:
   - Apenas as portas `80` e `443` (HTTP/HTTPS) devem estar abertas para a internet pública.
   - A porta `3307` (MySQL) e a porta `3005` (Node) devem ser restritas a `localhost` ou VPN interna.
2. **Segurança de Senhas**:
   - O `JWT_SECRET` deve conter ao menos 32 caracteres criptograficamente aleatórios.
   - Troque a senha do usuário `root` do MySQL e do SuperAdmin logo após a instalação.
3. **Limite de Requisições (Rate Limiting)**:
   - O backend já inclui rate limiter de 10 tentativas/minuto para autenticação (`/api/auth/login`) e 120 reqs/minuto para a API V1.
4. **Isolamento de Contêineres**:
   - O banco `centralizador_sic_db` roda isolado do banco principal do HelpDesk (`app_db`), garantindo zero colisão.
