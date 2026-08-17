# Centralizador SIC & API Core (Coopedu)

[![Docker](https://img.shields.io/badge/Docker-Supported-blue?logo=docker)](./docker-compose.yml)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green?logo=node.js)](./package.json)
[![React](https://img.shields.io/badge/React-v18-sky?logo=react)](./client)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

Aplicação completa de centralização, automação de dados cadastrais (WhatsApp, E-mail, Data de Nascimento), acompanhamento de **Adesão & Desligamentos**, geração de demonstrativos/comprovantes em PDF e integração M2M com as APIs oficiais do **SIC (Coopedu)**.

---

## 🚀 Funcionalidades Principais

- **Módulo de Adesão / Desligamento & Status de Propostas**:
  - Consulta de propostas e desligamentos via API `https://c.coopedu.com.br`.
  - Exibição de estatísticas e filtros por competência, CPF e contratante.
  - Geração nativa de PDFs para Propostas de Adesão e Termos de Desligamento.
  - Botão de fallback para download direto de documentos assinados digitalmente (PlugSign).

- **Automação Cadastral & Renovação de Token (SIC UI)**:
  - Alteração e salvamento de Data de Nascimento (`birthDate` ISO 8601 UTC), WhatsApp (`cellPhone` 11 dígitos) e E-mail (`email`).
  - Renovação automática de Token JWT com cache em memória (TTL) e suporte a robô Headless Puppeteer stealth.

- **Centralização de Demonstrativos & Comprovantes (SIC Core)**:
  - Consulta e download de recibos de repasse financeiro (`/receipt`) e demonstrativos (`/demonstrative`) em PDF via API `https://core.coopedu.app.br`.

- **Cliente Desktop Nativo (Windows)**:
  - Executável desktop em modo Microsoft Edge App sem barras de navegadores.
  - Assistente de rede `Configurar_Servidor.bat` com detecção automática do servidor local ou em rede.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Lucide Icons, Axios, React Router DOM.
- **Backend**: Node.js, Express, TypeScript, MySQL (porta 3307), PDFKit, Puppeteer, Cookie Parser, Cors.
- **DevOps & Deploy**: Docker, Docker Compose, Inno Setup (Windows Installer).

---

## 📦 Como Rodar com Docker

```bash
# 1. Clonar o repositório
git clone https://github.com/ricardopalacio-Coop/centralizadorSIC.git
cd centralizadorSIC

# 2. Iniciar os containers (Aplicação na porta 3005 + MySQL na porta 3307)
docker compose up -d --build
```

Acesse a aplicação no navegador em `http://localhost:3005`.

---

## 💻 Como Rodar Localmente em Desenvolvimento

```bash
# 1. Instalar dependências
npm install

# 2. Compilar e iniciar em modo dev
npm run dev
```

---

## 📄 Licença e Propriedade

Desenvolvido para **Coopedu (Cooperativa de Trabalho)**. Todos os direitos reservados.
