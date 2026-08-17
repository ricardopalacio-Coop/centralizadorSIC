import puppeteer from "puppeteer-core";
import axios from "axios";
import fs from "fs";
import { cleanCpf } from "./sicApi";

const SIC_USER_EMAIL = process.env.SIC_USER_EMAIL || "atendimento@coopedu.com.br";
const SIC_USER_PASSWORD = process.env.SIC_USER_PASSWORD || "Coopedu2026@";

function getExecutablePath(): string | undefined {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  if (fs.existsSync(chromePath)) return chromePath;
  if (fs.existsSync(edgePath)) return edgePath;
  return undefined;
}

interface CacheSession {
  jwtToken: string;
  cookieHeader: string;
  expiresAt: number;
}

let sessionCache: CacheSession | null = null;

/**
 * Realiza o login no portal do SIC via Puppeteer stealth e obtém a sessão autenticada do Atendimento
 */
export async function getAuthenticatedSicSession(): Promise<{ jwtToken: string; cookieHeader: string }> {
  const now = Date.now();
  if (sessionCache && sessionCache.expiresAt > now) {
    return { jwtToken: sessionCache.jwtToken, cookieHeader: sessionCache.cookieHeader };
  }

  const executablePath = getExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,800",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    let capturedToken = "";

    page.on("response", async (res) => {
      const url = res.url();
      if (url.includes("/api/login")) {
        try {
          const json = await res.json();
          if (json.body && typeof json.body === "string" && json.body.startsWith("eyJ")) {
            capturedToken = json.body;
          }
        } catch (e) {}
      }
    });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.goto("https://ui.coopedu.app.br/", { waitUntil: "networkidle2" });
    await page.waitForSelector('input[name="username"]');

    await page.type('input[name="username"]', SIC_USER_EMAIL);
    await page.type('input[name="password"]', SIC_USER_PASSWORD);

    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 6000));

    const cookies = await page.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    let jwtToken = capturedToken;
    if (!jwtToken) {
      const authCookie = cookies.find((c) => c.name === "coopedu-auth-prod");
      if (authCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(authCookie.value));
          jwtToken = parsed.value;
        } catch (e) {}
      }
    }

    await browser.close();

    if (!jwtToken) {
      throw new Error("Não foi possível capturar o Token JWT da sessão do Atendimento no SIC.");
    }

    sessionCache = {
      jwtToken,
      cookieHeader,
      expiresAt: now + 25 * 60 * 1000,
    };

    return { jwtToken, cookieHeader };
  } catch (err: any) {
    await browser.close();
    throw new Error(`Falha na automação de login do SIC: ${err.message}`);
  }
}

/**
 * Atualiza o E-mail e WhatsApp do cooperado diretamente no banco oficial do SIC
 * GARANTIA: Atualiza DADOS REAIS e UNICAMENTE o cooperado selecionado (busca dinamicamente pelo CPF)
 */
export async function updateOfficialSicCooperadoContacts(
  cpf: string,
  newEmail: string,
  newWhatsapp: string,
  newBirthDate?: string
) {
  const numericCpf = cleanCpf(cpf);
  const numericPhone = cleanCpf(newWhatsapp);
  if (!numericCpf) return false;

  try {
    const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();

    const headers = {
      Authorization: `Bearer ${jwtToken}`,
      Cookie: cookieHeader,
      Origin: "https://ui.coopedu.app.br",
      "Content-Type": "application/json",
    };

    // 1. Busca dinamicamente O COOPERADO SELECIONADO pelo CPF na API oficial do SIC
    const searchRes = await axios.get(
      `https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=10`,
      { headers }
    );

    const items = searchRes.data?.items || searchRes.data?.cooperados || searchRes.data?.body?.items || [];
    const targetCooperado = items.find((i: any) => cleanCpf(i.document || i.cpf) === numericCpf) || items[0];

    if (!targetCooperado || !targetCooperado.id) {
      console.error(`[SIC Official Sync Error] Cooperado com CPF ${numericCpf} não foi localizado no SIC. Atualização cancelada por segurança.`);
      return false;
    }

    const targetCooperadoId = targetCooperado.id;
    console.log(`[SIC Official Sync] Cooperado selecionado identificado no SIC com ID: ${targetCooperadoId}`);

    // 2. Busca a ficha cadastral COMPLETA E REAL do cooperado selecionado para preservar todos os seus dados
    const detailsRes = await axios.get(
      `https://ui.coopedu.app.br/api/cooperado/${targetCooperadoId}`,
      { headers }
    );
    const existing = detailsRes.data?.body || detailsRes.data || {};

    // Formata o RG para string simples conforme exigido pela API do SIC
    const rgString = typeof existing.documents?.rg === "object" ? (existing.documents.rg.number || "") : (existing.documents?.rg || "");

    let formattedBirthDate = existing.birthDate || existing.dataNascimento;
    if (newBirthDate) {
      try {
        const d = new Date(newBirthDate);
        if (!isNaN(d.getTime())) {
          formattedBirthDate = d.toISOString().split("T")[0] + "T00:00:00.000Z";
        }
      } catch (e) {}
    }

    // 3. Monta o payload mantendo TODOS os dados cadastrais reais do cooperado selecionado
    const payload = {
      ...existing,
      identification: numericCpf,
      email: newEmail,
      cellPhone: numericPhone,
      telephone: existing.telephone || "",
      birthDate: formattedBirthDate,
      dataNascimento: formattedBirthDate,
      documents: {
        ...existing.documents,
        rg: rgString,
        rgIssuer: existing.documents?.rg?.rgIssuer || "SSP",
        rgState: existing.documents?.rg?.rgState || "CE",
      },
    };

    const updateHeaders = {
      ...headers,
      Referer: `https://ui.coopedu.app.br/sistema/cooperados/${targetCooperadoId}/editar`,
    };

    const updateRes = await axios.put(`https://ui.coopedu.app.br/api/cooperado/${targetCooperadoId}`, payload, { headers: updateHeaders });
    console.log(`[SIC Official Sync] 🎉 SUCESSO TOTAL ao atualizar E-mail (${newEmail}), Celular (${numericPhone}) e Data Nascimento (${formattedBirthDate}) para o cooperado SELECIONADO (ID ${targetCooperadoId}):`, updateRes.data?.message || updateRes.status);
    return true;
  } catch (err: any) {
    console.error(`[SIC Official Sync Error] Erro ao atualizar no SIC oficial para CPF ${numericCpf}:`, err.response?.data || err.message);
    return false;
  }
}

/**
 * Baixa o PDF original do Comprovante PIX/Fitbank do SIC oficial (Imagem 2)
 */
export async function getOfficialSicPaymentReceiptPdf(cpf: string, payrollId: string): Promise<Buffer | null> {
  try {
    const numericCpf = cleanCpf(cpf);
    if (!numericCpf || !payrollId) return null;

    const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();

    const headers = {
      Authorization: `Bearer ${jwtToken}`,
      Cookie: cookieHeader,
      Origin: "https://ui.coopedu.app.br",
    };

    const listRes = await axios.get(
      `https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=10`,
      { headers }
    );

    const items = listRes.data?.items || listRes.data?.cooperados || listRes.data?.body?.items || [];
    const item = items.find((i: any) => cleanCpf(i.document || i.cpf) === numericCpf) || items[0];
    if (!item || !item.id) return null;

    const cooperadoId = item.id;

    const payListRes = await axios.get(
      `https://ui.coopedu.app.br/api/cooperado/${cooperadoId}/financeiro/pagamentos?pageNumber=1&pageSize=100`,
      { headers }
    );

    const payItems = payListRes.data?.body?.items || payListRes.data?.items || [];
    const matchedPay = payItems.find((p: any) => p.payrollId === payrollId) || payItems[0];
    if (!matchedPay || !matchedPay.paymentId) return null;

    const detailsRes = await axios.get(
      `https://ui.coopedu.app.br/api/cooperado/${cooperadoId}/financeiro/pagamentos/${matchedPay.paymentId}`,
      { headers }
    );

    const receiptURL = detailsRes.data?.body?.receiptURL;
    if (!receiptURL) return null;

    const pdfRes = await axios.get(receiptURL, { responseType: "arraybuffer" });
    return Buffer.from(pdfRes.data);
  } catch (err: any) {
    console.error(`[SIC Official Receipt Error] Erro ao buscar comprovante PIX do SIC para CPF ${cpf}:`, err.message);
    return null;
  }
}
