---
name: sic-operacoes
description: >-
  Skill completa de operações no Sistema SIC (Coopedu): alteração e salvamento de dados cadastrais (E-mail, WhatsApp e Data de Nascimento) e captura/download direto de comprovantes e demonstrativos de repasse financeiro em PDF.
---

# SKILL TÉCNICA: OPERAÇÕES NO SISTEMA SIC (COOPEDU)

Esta Skill fornece a qualquer Agente de IA os procedimentos exatos, regras de sanitização de dados, especificação de endpoints e o código completo em JavaScript para realizar duas tarefas fundamentais no **SIC (Sistema Integrado de Cooperativas)**:

1. **Alteração Cadastral no SIC**: Atualizar **WhatsApp**, **E-mail** e **Data de Nascimento** do cooperado no portal oficial (`ui.coopedu.app.br`).
2. **Captura de Comprovantes Finaceiros (PDF)**: Baixar **Comprovante de Pagamento (`/receipt`)** e **Demonstrativo de Repasse (`/demonstrative`)** diretamente da API Core do SIC (`core.coopedu.app.br`).

---

## 1. ENDPOINTS OFICIAIS & CREDENCIAIS DE ACESSO

### Credenciais de Serviço (Operador de Atendimento)
* **Usuário / E-mail**: `atendimento@coopedu.com.br`
* **Senha**: `Coopedu2026@`

### Domínios Permitidos Oficiais:
* **Portal UI & Edição Cadastral**: `https://ui.coopedu.app.br`
* **Core REST API & Comprovantes Financeiros**: `https://core.coopedu.app.br`
* **API de Desligamento & Propostas**: `https://c.coopedu.com.br` *(Chave M2M: `583ea0cb-1c5c-4a71-aae0-5a04af21ea4e`)*

> 🛑 **ATENÇÃO DE SEGURANÇA**: Domínios não autorizados como `h.coopedu.com.br` geram erro HTTP 401 Unauthorized / 404 Not Found. Use sempre os domínios oficiais acima.

---

## 2. MÓDULO 1: ALTERAÇÃO E SALVAMENTO DE DADOS CADASTRAIS

### 2.1 Regras de Sanitização de Campos (CRÍTICO)

| Campo | Propriedade JSON | Formato Aceito Exato | Exemplo Válido | O que NÃO Enviar |
| :--- | :--- | :--- | :--- | :--- |
| **WhatsApp / Celular** | `cellPhone` e `celular` | Apenas números (11 dígitos). | `"88999998888"` | `"(88) 99999-8888"`, `"+5588999998888"` |
| **E-mail de Contato** | `email` | String em minúsculas sem espaços. | `"cooperado@exemplo.com.br"` | `" Cooperado@Exemplo.Com.Br "` |
| **Data de Nascimento** | `birthDate` e `dataNascimento` | ISO 8601 UTC (`YYYY-MM-DDT00:00:00.000Z`). | `"1990-05-15T00:00:00.000Z"` | `"15/05/1990"`, `"15-05-1990"` |
| **CPF / Documento** | `identification` e `document` | Apenas números (11 dígitos). | `"25930187800"` | `"259.301.878-00"` |

### 2.2 Fluxo Obrigatório de Atualização (`GET` -> `PUT`)
1. **Autenticar no SIC**: Fazer login e obter o `jwtToken` de sessão.
2. **Buscar o `cooperadoId`**: Fazer `GET https://ui.coopedu.app.br/api/cooperado/listar?search={CPF_NUMERICO}&pageNumber=1&pageSize=10`.
3. **Baixar Ficha Existente**: Fazer `GET https://ui.coopedu.app.br/api/cooperado/{cooperadoId}`.
   * *Motivo*: O SIC rejeita payloads parciais. Deve-se mesclar os dados novos na ficha antiga.
   * *Tratamento de RG*: Se `documents.rg` for retornado como um objeto no `GET`, ele DEVE ser convertido para string simples no `PUT` (ex: `"12345678"`).
4. **Enviar Salvamento `PUT`**: Fazer `PUT https://ui.coopedu.app.br/api/cooperado/{cooperadoId}` com a ficha cadastral completa e atualizada.

---

## 3. MÓDULO 2: CAPTURA E DOWNLOAD DE COMPROVANTES FINANCEIROS (PDF)

### 3.1 Passo a Passo do Processo Financeiro
1. **Autenticação JWT**:
   * **URL**: `POST https://core.coopedu.app.br/api/login`
   * **Body**: `{ "email": "atendimento@coopedu.com.br", "password": "Coopedu2026@" }`
   * **Retorno**: `token` JWT Bearer.

2. **Obter ID da Folha de Pagamento (`payrollId`)**:
   * **URL**: `GET https://core.coopedu.app.br/payrolls`
   * **Header**: `Authorization: Bearer <TOKEN>`
   * **Resultado**: Lista de folhas. Filtrar pela competência/mês desejado para capturar o `id` da folha (ex: `"26c5bd10-8b17-48f8-b3d2-c2e3a1f4967a"`).

3. **Download do Comprovante de Pagamento (`/receipt`)**:
   * **URL**: `GET https://core.coopedu.app.br/payrolls/{payrollId}/cooperados/{CPF_NUMERICO}/receipt`
   * **Header**: `Authorization: Bearer <TOKEN>`
   * **Resposta**: Buffer do arquivo PDF (`application/pdf`).

4. **Download do Demonstrativo de Pagamento (`/demonstrative`)**:
   * **URL**: `GET https://core.coopedu.app.br/payrolls/{payrollId}/cooperados/{CPF_NUMERICO}/demonstrative`
   * **Header**: `Authorization: Bearer <TOKEN>`
   * **Resposta**: Buffer do arquivo PDF (`application/pdf`).

---

## 4. CÓDIGO JS COMPLETO E PRONTO PARA O AGENTE EXECUTAR (NODE.JS + AXIOS)

```javascript
const axios = require('axios');
const fs = require('fs');

const SIC_USER = "atendimento@coopedu.com.br";
const SIC_PASS = "Coopedu2026@";

// --- FUNÇÕES DE HIGIENIZAÇÃO DE DADOS ---
function cleanDigits(val) {
  return val ? String(val).replace(/\D/g, "") : "";
}

function formatEmail(email) {
  return email ? String(email).trim().toLowerCase() : "";
}

function formatIsoBirthDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T00:00:00.000Z`;
    }
  }
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) ? d.toISOString().split("T")[0] + "T00:00:00.000Z" : dateStr;
}

// --- MÓDULO 1: ALTERAÇÃO CADASTRAL ---
async function alterarCadastroSic(cpf, novoEmail, novoWhatsapp, novaDataNascimento) {
  const numericCpf = cleanDigits(cpf);
  console.log(`[SIC] Iniciando alteração cadastral para CPF: ${numericCpf}`);

  // 1. Login no Core para obter Token
  const loginRes = await axios.post("https://core.coopedu.app.br/api/login", {
    email: SIC_USER,
    password: SIC_PASS
  });
  const token = loginRes.data.token || loginRes.data.body;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 2. Busca ID do Cooperado no SIC UI
  const listRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=10`, { headers });
  const items = listRes.data?.items || listRes.data?.body?.items || [];
  const cooperado = items.find(i => cleanDigits(i.document || i.cpf) === numericCpf) || items[0];

  if (!cooperado || !cooperado.id) throw new Error("Cooperado não localizado no portal do SIC.");
  const cooperadoId = cooperado.id;

  // 3. Obtém Ficha Cadastral Atual (OBRIGATÓRIO)
  const detailsRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/${cooperadoId}`, { headers });
  const existing = detailsRes.data?.body || detailsRes.data;

  // 4. Converte RG para String Simples
  const rgString = typeof existing.documents?.rg === "object" ? (existing.documents.rg.number || "") : (existing.documents?.rg || "");
  const birthFormatted = formatIsoBirthDate(novaDataNascimento) || existing.birthDate;

  // 5. Monta Payload Completo e Atualiza
  const payload = {
    ...existing,
    identification: numericCpf,
    email: formatEmail(novoEmail),
    cellPhone: cleanDigits(novoWhatsapp),
    birthDate: birthFormatted,
    dataNascimento: birthFormatted,
    documents: {
      ...existing.documents,
      rg: rgString
    }
  };

  const putRes = await axios.put(`https://ui.coopedu.app.br/api/cooperado/${cooperadoId}`, payload, { headers });
  console.log("✅ Cadastro atualizado com sucesso no SIC!", putRes.data);
  return putRes.data;
}

// --- MÓDULO 2: CAPTURA DE COMPROVANTES (PDF) ---
async function baixarComprovantesSic(cpf, destinoPasta = "./") {
  const numericCpf = cleanDigits(cpf);
  console.log(`[SIC] Baixando comprovantes financeiros para CPF: ${numericCpf}`);

  // 1. Autenticação JWT
  const loginRes = await axios.post("https://core.coopedu.app.br/api/login", {
    email: SIC_USER,
    password: SIC_PASS
  });
  const token = loginRes.data.token || loginRes.data.body;
  const headers = { Authorization: `Bearer ${token}` };

  // 2. Busca lista de folhas de pagamento
  const payrollsRes = await axios.get("https://core.coopedu.app.br/payrolls", { headers });
  const payrolls = payrollsRes.data?.items || payrollsRes.data || [];
  if (!payrolls.length) throw new Error("Nenhuma folha de pagamento cadastrada no SIC.");

  const payrollId = payrolls[0].id; // Pega a folha mais recente

  // 3. Download do Comprovante de Pagamento (/receipt)
  const receiptRes = await axios.get(`https://core.coopedu.app.br/payrolls/${payrollId}/cooperados/${numericCpf}/receipt`, {
    headers,
    responseType: "arraybuffer"
  });
  const receiptPath = `${destinoPasta}/Comprovante_${numericCpf}.pdf`;
  fs.writeFileSync(receiptPath, receiptRes.data);
  console.log(`✅ Comprovante salvo em: ${receiptPath}`);

  // 4. Download do Demonstrativo (/demonstrative)
  const demoRes = await axios.get(`https://core.coopedu.app.br/payrolls/${payrollId}/cooperados/${numericCpf}/demonstrative`, {
    headers,
    responseType: "arraybuffer"
  });
  const demoPath = `${destinoPasta}/Demonstrativo_${numericCpf}.pdf`;
  fs.writeFileSync(demoPath, demoRes.data);
  console.log(`✅ Demonstrativo salvo em: ${demoPath}`);

  return { receiptPath, demoPath };
}

module.exports = { alterarCadastroSic, baixarComprovantesSic };
```
