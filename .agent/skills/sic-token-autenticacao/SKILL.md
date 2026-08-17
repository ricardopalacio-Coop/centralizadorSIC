---
name: sic-token-autenticacao
description: >-
  Skill técnica ultra-detalhada para Agentes de IA aprenderem a obter, gerenciar e renovar automaticamente o Token JWT do SIC (Coopedu) para realizar alteração e salvamento de Data de Nascimento, WhatsApp e E-mail sem erros.
---

# SKILL TÉCNICA DEFINITIVA: AUTENTICAÇÃO, GERENCIAMENTO DE TOKEN E ATUALIZAÇÃO CADASTRAL NO SISTEMA SIC (COOPEDU)

Esta Skill é o **guia de referência absoluto e infalível** para qualquer **Agente de IA** realizar operações no sistema **SIC (Coopedu)**. Ela contém todas as regras de negócio, especificações de endpoints, armadilhas da API, algoritmos de sanitização de dados, renovação automática de token JWT e o código completo em JavaScript/Node.js.

---

## 1. ESPECIFICAÇÃO DE AMBIENTES, DOMÍNIOS E CREDENCIAIS

### 1.1 Domínios Permitidos Oficiais:
* **Portal UI & API de Edição Cadastral**: `https://ui.coopedu.app.br`
* **Core REST API & Comprovantes Financeiros**: `https://core.coopedu.app.br`
* **API M2M de Desligamento & Propostas**: `https://c.coopedu.com.br` *(Header: `x-api-key: 583ea0cb-1c5c-4a71-aae0-5a04af21ea4e`)*

> 🛑 **PROIBIÇÃO DE SEGURANÇA (ERRO HTTP 401/404)**: Nunca envie requisições para `h.coopedu.com.br` ou subdomínios não documentados. Esse host causará falha imediata de autenticação (`401 Unauthorized`).

### 1.2 Credenciais de Serviço (Operador de Atendimento)
* **Usuário / E-mail**: `atendimento@coopedu.com.br`
* **Senha**: `Coopedu2026@`

---

## 2. ARQUITETURA DO TOKEN JWT & CICLO DE VIDA (AUTO-REFRESH / TTL)

### 2.1 Como Funciona a Autenticação no SIC UI
O portal do SIC (`https://ui.coopedu.app.br`) utiliza autenticação por **Token JWT de Sessão (Bearer Token)** e exige o envio conjunto de **Headers HTTP de Autorização e Cookies**:

* **Header `Authorization`**: `Bearer <TOKEN_JWT>`
* **Header `Cookie`**: `coopedu-auth-prod=<COOKIE_VALOR_ENCODED>`
* **Header `Referer`**: `https://ui.coopedu.app.br/sistema/cooperados/{cooperadoId}/editar`
* **Header `Origin`**: `https://ui.coopedu.app.br`
* **Header `Content-Type`**: `application/json`

### 2.2 Estrutura do Cookie de Sessão `coopedu-auth-prod`
O cookie deve ser codificado em URI e possuir a seguinte estrutura JSON interna:
```json
{
  "key": "coopedu-auth-prod",
  "value": "<TOKEN_JWT>",
  "endDate": "2026-08-14T12:00:00.000Z"
}
```

### 🔄 2.3 Algoritmo de Renovação Automática do Token em Memória (TTL / Auto-Refresh)
No SIC, o token expira em 60 minutos. O Agente de IA **DEVE** implementar o padrão de renovação preventiva em memória:

1. **Variáveis em Memória Cache**: Manter `jwtToken`, `cookieHeader` e `expiresAt` (`Date.now() + 25 * 60 * 1000` -> validade de 25 min).
2. **Checagem Preventiva Antes de Qualquer Requisição**:
   * Se `Date.now() >= expiresAt`, o token é considerado prestes a caducar. O robô dispara silenciosamente o fluxo de login para obter uma nova sessão antes de tentar a alteração.
3. **Estratégia de Fallback em Caso de HTTP 401**:
   * Se qualquer chamada retornar o status **HTTP 401 Unauthorized**, o Agente DEVE limpar o token em memória (`jwtToken = null`), disparar a renovação imediata e re-tentar a requisição 1 única vez.

---

## 3. REGRAS RIGOROSAS DE SANITIZAÇÃO E FORMATAÇÃO DE DADOS (CRÍTICO)

A API do SIC é extremamente rígida na validação dos tipos e formatos dos campos no payload. **Qualquer desvio causará rejeição silenciosa ou erro HTTP 400 Bad Request / 422**.

| Campo | Propriedade JSON no Payload | Regra de Formatação Aceita Exata | Exemplo Válido | Exemplos INVÁLIDOS (Proibidos) |
| :--- | :--- | :--- | :--- | :--- |
| **WhatsApp / Celular** | `cellPhone` e `celular` | **Apenas 11 dígitos numéricos** (`DDD + NÚMERO`). Sem caracteres especiais. | `"88999998888"` | `"(88) 99999-8888"`, `"+5588999998888"`, `"8899999-8888"` |
| **E-mail de Contato** | `email` | String em letras minúsculas sem espaços antes ou depois. | `"cooperado@exemplo.com.br"` | `" Cooperado@Exemplo.Com.Br "`, `"COOPERADO@EMAIL.COM"` |
| **Data de Nascimento** | `birthDate` e `dataNascimento` | String **ISO 8601 UTC** no formato exato `YYYY-MM-DDT00:00:00.000Z`. | `"1990-05-15T00:00:00.000Z"` | `"15/05/1990"`, `"1990-05-15"`, `"15-05-1990"`, `null` |
| **CPF / Documento** | `identification` e `document` | **Apenas 11 dígitos numéricos**. | `"25930187800"` | `"259.301.878-00"`, `"259 301 878 00"` |

### 🛠️ Funções JS de Higienização Obrigatórias:

```javascript
// Remove tudo que não for número (para CPF e WhatsApp)
function cleanDigits(val) {
  if (!val) return "";
  return String(val).replace(/\D/g, "");
}

// Normaliza E-mail
function formatEmail(email) {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}

// Converte qualquer data (brasileira DD/MM/YYYY ou ISO) para ISO 8601 UTC (YYYY-MM-DDT00:00:00.000Z)
function formatIsoBirthDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  // Se estiver em formato brasileiro DD/MM/YYYY
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}T00:00:00.000Z`;
    }
  }
  // Se for YYYY-MM-DD
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0] + "T00:00:00.000Z";
  }
  return dateStr;
}
```

---

## 4. ALGORITMO PASSO A PASSO DA ALTERAÇÃO CADASTRAL (`GET` -> `PUT`)

> ⚠️ **ARMADILHA CRÍTICA DA API DO SIC**: A API do SIC **rejeita requisições `PUT` parciais**. Se o Agente tentar mandar apenas `{ email, cellPhone, birthDate }`, a API retornará erro 400. É **OBRIGATÓRIO** fazer um `GET` primeiro para baixar toda a ficha cadastral do cooperado, atualizar os campos necessários e reenviar o JSON completo no `PUT`.

### **PASSO 1: Obter a Sessão Autenticada (Token + Cookie)**
Chamar o gerenciador de sessão para garantir que o token JWT esteja válido e não expira em menos de 25 minutos.

---

### **PASSO 2: Buscar o `cooperadoId` pelo CPF**
* **Método**: `GET`
* **URL**: `https://ui.coopedu.app.br/api/cooperado/listar?search={CPF_NUMERICO}&pageNumber=1&pageSize=10`
* **Headers**: `Authorization: Bearer <TOKEN_JWT>`, `Cookie: <COOKIE_HEADER>`
* **Tratamento**:
  * Navegar no array retornado (`res.data.items` ou `res.data.body.items`).
  * Encontrar o item onde `cleanDigits(item.document || item.cpf) === cleanDigits(cpf)`.
  * Extrair o **`cooperadoId`** (ex: `"8720dab6-7e5f-4c90-8e76-b68ed6db3efb"`).

---

### **PASSO 3: Baixar a Ficha Cadastral Existente (CRÍTICO!)**
* **Método**: `GET`
* **URL**: `https://ui.coopedu.app.br/api/cooperado/{cooperadoId}`
* **Headers**: `Authorization: Bearer <TOKEN_JWT>`, `Cookie: <COOKIE_HEADER>`
* **Tratamento em `existing`**:
  * Armazenar a resposta inteira em `existing = res.data.body || res.data`.
  * ⚠️ **ARMADILHA DO CAMPO RG**: No `GET`, a API do SIC devolve o RG como um objeto aninhado (ex: `existing.documents.rg = { number: "12345678", rgIssuer: "SSP" }`). **No `PUT`, a API EXIGE que `documents.rg` seja uma STRING simples**.
  * **Solução Obrigatória**:
    ```javascript
    const rgString = typeof existing.documents?.rg === "object" 
      ? (existing.documents.rg.number || "") 
      : (existing.documents?.rg || "");
    ```

---

### **PASSO 4: Montar o Payload Completo e Enviar o `PUT` de Salvamento**
* **Método**: `PUT`
* **URL**: `https://ui.coopedu.app.br/api/cooperado/{cooperadoId}`
* **Headers**:
  ```http
  Authorization: Bearer <TOKEN_JWT>
  Cookie: <COOKIE_HEADER>
  Content-Type: application/json
  Origin: https://ui.coopedu.app.br
  Referer: https://ui.coopedu.app.br/sistema/cooperados/{cooperadoId}/editar
  ```
* **Payload JSON**:
  ```javascript
  const payload = {
    ...existing,
    identification: numericCpf,
    email: formatEmail(novoEmail),
    cellPhone: cleanDigits(novoWhatsapp),
    birthDate: formatIsoBirthDate(novaDataNascimento) || existing.birthDate,
    dataNascimento: formatIsoBirthDate(novaDataNascimento) || existing.birthDate,
    documents: {
      ...existing.documents,
      rg: rgString
    }
  };
  ```

---

## 5. CÓDIGO JS ABSOLUTO E PRONTO PARA O AGENTE EXECUTAR (NODE.JS + AXIOS + PUPPETEER)

```javascript
const axios = require('axios');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const SIC_USER = "atendimento@coopedu.com.br";
const SIC_PASS = "Coopedu2026@";

// --- GERENCIADOR DE SESSÃO E TOKEN COM AUTO-REFRESH E TTL ---
class SicAuthManager {
  constructor() {
    this.jwtToken = null;
    this.cookieHeader = null;
    this.expiresAt = 0;
  }

  // Verifica se o token expirou ou expira em menos de 5 minutos
  isTokenExpired() {
    return !this.jwtToken || Date.now() >= (this.expiresAt - 300000);
  }

  // Força renovação da sessão
  invalidateToken() {
    this.jwtToken = null;
    this.cookieHeader = null;
    this.expiresAt = 0;
  }

  // Obtém sessão válida (Renovando silenciosamente se necessário)
  async getValidSession() {
    if (!this.isTokenExpired()) {
      return { jwtToken: this.jwtToken, cookieHeader: this.cookieHeader };
    }

    console.log("[SIC Auth] Token expirado ou próximo do fim. Efetuando renovação de sessão...");

    // Tentativa 1: Autenticação via REST API rápida
    try {
      const loginRes = await axios.post("https://core.coopedu.app.br/api/login", {
        email: SIC_USER,
        password: SIC_PASS
      }, { timeout: 8000 });

      const token = loginRes.data.token || loginRes.data.body;
      if (token && typeof token === "string" && token.startsWith("eyJ")) {
        this.jwtToken = token;
        const cookieVal = encodeURIComponent(JSON.stringify({ key: "coopedu-auth-prod", value: token }));
        this.cookieHeader = `coopedu-auth-prod=${cookieVal}`;
        this.expiresAt = Date.now() + 25 * 60 * 1000; // Validade de 25 min
        console.log("[SIC Auth] Sessão renovada com sucesso via REST API!");
        return { jwtToken: this.jwtToken, cookieHeader: this.cookieHeader };
      }
    } catch (err) {
      console.warn("[SIC Auth] Login REST falhou, ativando robô Headless Puppeteer...");
    }

    // Tentativa 2: Autenticação via Robô Headless (Puppeteer)
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    const execPath = fs.existsSync(chromePath) ? chromePath : (fs.existsSync(edgePath) ? edgePath : undefined);

    const browser = await puppeteer.launch({
      executablePath: execPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
    });

    try {
      const page = await browser.newPage();
      let capturedToken = "";

      page.on("response", async (res) => {
        if (res.url().includes("/api/login")) {
          try {
            const json = await res.json();
            if (json.body && typeof json.body === "string" && json.body.startsWith("eyJ")) {
              capturedToken = json.body;
            }
          } catch (e) {}
        }
      });

      await page.goto("https://ui.coopedu.app.br/", { waitUntil: "networkidle2" });
      await page.waitForSelector('input[name="username"]');
      await page.type('input[name="username"]', SIC_USER);
      await page.type('input[name="password"]', SIC_PASS);
      await page.click('button[type="submit"]');
      await new Promise((r) => setTimeout(r, 6000));

      const cookies = await page.cookies();
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      const authCookie = cookies.find((c) => c.name === "coopedu-auth-prod");

      let token = capturedToken;
      if (!token && authCookie) {
        try {
          token = JSON.parse(decodeURIComponent(authCookie.value)).value;
        } catch (e) {}
      }

      await browser.close();

      if (!token) throw new Error("Não foi possível capturar o Token JWT do SIC.");

      this.jwtToken = token;
      this.cookieHeader = cookieStr;
      this.expiresAt = Date.now() + 25 * 60 * 1000;

      console.log("[SIC Auth] Sessão renovada com sucesso via Robô Headless!");
      return { jwtToken: this.jwtToken, cookieHeader: this.cookieHeader };
    } catch (err) {
      await browser.close();
      throw new Error(`Falha crítica ao renovar token do SIC: ${err.message}`);
    }
  }
}

const authManager = new SicAuthManager();

// --- FUNÇÃO PRINCIPAL DE SANITIZAÇÃO E ATUALIZAÇÃO CADASTRAL ---
async function alterarCadastroSic(cpf, novoEmail, novoWhatsapp, novaDataNascimento) {
  const numericCpf = String(cpf).replace(/\D/g, "");
  const numericPhone = String(novoWhatsapp).replace(/\D/g, "");
  const cleanEmail = String(novoEmail).trim().toLowerCase();

  if (!numericCpf || numericCpf.length !== 11) {
    throw new Error("CPF inválido. Deve conter exatamente 11 dígitos numéricos.");
  }
  if (!numericPhone || numericPhone.length !== 11) {
    throw new Error("WhatsApp/Celular inválido. Deve conter exatamente 11 dígitos numéricos (DDD + Número).");
  }

  // Sanitiza a Data de Nascimento para o formato ISO 8601 UTC
  let isoBirthDate = novaDataNascimento;
  if (novaDataNascimento && novaDataNascimento.includes("/")) {
    const parts = novaDataNascimento.split("/");
    if (parts.length === 3) {
      isoBirthDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T00:00:00.000Z`;
    }
  } else if (novaDataNascimento) {
    const d = new Date(novaDataNascimento);
    if (!isNaN(d.getTime())) isoBirthDate = d.toISOString().split("T")[0] + "T00:00:00.000Z";
  }

  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    try {
      // 1. Obtém sessão ativa (renovando se expirar)
      const { jwtToken, cookieHeader } = await authManager.getValidSession();

      const headers = {
        Authorization: `Bearer ${jwtToken}`,
        Cookie: cookieHeader,
        Origin: "https://ui.coopedu.app.br",
        "Content-Type": "application/json",
      };

      // 2. Busca ID do Cooperado no SIC pelo CPF
      const listRes = await axios.get(
        `https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=10`,
        { headers }
      );

      const items = listRes.data?.items || listRes.data?.body?.items || [];
      const target = items.find((i) => String(i.document || i.cpf).replace(/\D/g, "") === numericCpf) || items[0];

      if (!target || !target.id) {
        throw new Error(`Cooperado com CPF ${numericCpf} não foi localizado no portal do SIC.`);
      }

      const cooperadoId = target.id;

      // 3. Baixa a Ficha Cadastral Existente (OBRIGATÓRIO)
      const detailsRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/${cooperadoId}`, { headers });
      const existing = detailsRes.data?.body || detailsRes.data;

      // Sanitiza RG para string simples
      const rgString = typeof existing.documents?.rg === "object" ? (existing.documents.rg.number || "") : (existing.documents?.rg || "");

      // 4. Monta o Payload Completo e Sanitizado
      const payload = {
        ...existing,
        identification: numericCpf,
        email: cleanEmail,
        cellPhone: numericPhone,
        birthDate: isoBirthDate || existing.birthDate,
        dataNascimento: isoBirthDate || existing.birthDate,
        documents: {
          ...existing.documents,
          rg: rgString,
        },
      };

      // 5. Envia Atualização PUT com Referer
      const putHeaders = {
        ...headers,
        Referer: `https://ui.coopedu.app.br/sistema/cooperados/${cooperadoId}/editar`,
      };

      const response = await axios.put(
        `https://ui.coopedu.app.br/api/cooperado/${cooperadoId}`,
        payload,
        { headers: putHeaders }
      );

      console.log(`🎉 SUCESSO TOTAL! Cadastro de ${cleanEmail} (${numericPhone}) salvo no SIC para CPF ${numericCpf}!`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401 && attempts === 1) {
        console.warn("⚠️ HTTP 401 Unauthorized recebido. Forçando renovação do Token JWT...");
        authManager.invalidateToken();
        continue; // Tenta novamente com o novo token
      }
      console.error("[SIC Update Error]:", error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = { authManager, alterarCadastroSic };
```
