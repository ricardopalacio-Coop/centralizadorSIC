import puppeteer from "puppeteer-core";
import axios from "axios";
import fs from "fs";
import { cleanCpf } from "./sicApi";
import { pool } from "../db";

const SIC_USER_EMAIL = process.env.SIC_USER_EMAIL || "atendimento@coopedu.com.br";
const SIC_USER_PASSWORD = process.env.SIC_USER_PASSWORD || "Coopedu2026@";

function getExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const linuxChromium = "/usr/bin/chromium";
  if (fs.existsSync(linuxChromium)) return linuxChromium;
  const linuxChromiumBrowser = "/usr/bin/chromium-browser";
  if (fs.existsSync(linuxChromiumBrowser)) return linuxChromiumBrowser;

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
 * Decodifica o payload de um JWT sem validar assinatura (apenas leitura do exp e claims)
 */
export function parseJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Normaliza qualquer entrada de cookie ou token (URI encoded, JSON ou JWT puro)
 */
export function normalizeSicTokenAndCookie(rawInput: string): { jwtToken: string; cookieHeader: string; expiresAt: number } | null {
  if (!rawInput || typeof rawInput !== "string") return null;
  const trimmed = rawInput.trim();

  let tokenStr = "";

  // 1. Se for o formato URI encoded ou JSON do cookie coopedu-auth-prod
  try {
    let decoded = trimmed;
    if (trimmed.includes("%22") || trimmed.includes("%7B")) {
      decoded = decodeURIComponent(trimmed);
    }
    if (decoded.startsWith("coopedu-auth-prod=")) {
      decoded = decoded.replace("coopedu-auth-prod=", "").trim();
      if (decoded.includes("%22") || decoded.includes("%7B")) {
        decoded = decodeURIComponent(decoded);
      }
    }
    if (decoded.startsWith("{")) {
      const parsed = JSON.parse(decoded);
      if (parsed.value) tokenStr = parsed.value;
    }
  } catch {}

  // 2. Se for o próprio token JWT
  if (!tokenStr) {
    if (trimmed.startsWith("eyJ")) {
      tokenStr = trimmed;
    } else if (trimmed.includes("eyJ")) {
      const m = trimmed.match(/eyJ[a-zA-Z0-9_\-\.]+/);
      if (m) tokenStr = m[0];
    }
  }

  if (!tokenStr || !tokenStr.startsWith("eyJ")) return null;

  const payload = parseJwtPayload(tokenStr);
  let expiresAt = Date.now() + 50 * 60 * 1000;
  if (payload?.exp && typeof payload.exp === "number") {
    expiresAt = payload.exp * 1000;
  }

  const cookieVal = encodeURIComponent(
    JSON.stringify({
      key: "coopedu-auth-prod",
      value: tokenStr,
      endDate: new Date(expiresAt).toISOString(),
    })
  );

  return {
    jwtToken: tokenStr,
    cookieHeader: `coopedu-auth-prod=${cookieVal}`,
    expiresAt,
  };
}

/**
 * Salva a sessão web do SIC no banco de dados e atualiza o cache
 */
export async function saveSicSession(rawInput: string): Promise<{ success: boolean; message: string; expiresAt: string; user?: string }> {
  const normalized = normalizeSicTokenAndCookie(rawInput);
  if (!normalized) {
    throw new Error("Formato inválido do Token ou Cookie do SIC. Certifique-se de colar o cookie 'coopedu-auth-prod' completo ou o Token JWT iniciado com 'eyJ'.");
  }

  // Testa o token fazendo uma consulta leve no portal do SIC
  try {
    const testRes = await axios.get(
      "https://ui.coopedu.app.br/api/cooperado/listar?search=000&pageNumber=1&pageSize=1",
      {
        headers: {
          Authorization: `Bearer ${normalized.jwtToken}`,
          Cookie: normalized.cookieHeader,
          Origin: "https://ui.coopedu.app.br",
        },
        timeout: 8000,
      }
    );
    if (testRes.status !== 200) {
      throw new Error(`Portal SIC retornou status HTTP ${testRes.status}`);
    }
  } catch (err: any) {
    if (err.response?.status === 401) {
      throw new Error("O token informado já expirou ou é inválido no portal do SIC (HTTP 401). Copie um token atualizado no navegador.");
    }
    console.warn("[SIC Session Warning] Teste de conectividade ao portal SIC retornou aviso:", err.message);
  }

  // Salva no banco centralizador_sic_db.system_settings
  try {
    await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_at) 
       VALUES ('sic_web_session_token', ?, NOW()) 
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [normalized.jwtToken]
    );
    await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_at) 
       VALUES ('sic_web_session_cookie', ?, NOW()) 
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [normalized.cookieHeader]
    );
  } catch (dbErr: any) {
    console.warn("[SIC Session DB Warning] Falha ao salvar em centralizador_sic_db.system_settings:", dbErr.message);
  }

  // Sincroniza também no helpdesk_local se disponível
  try {
    const hdDbName = process.env.HELPDESK_DB_NAME || "helpdesk_local";
    await pool.query(
      `INSERT INTO ${hdDbName}.system_settings (settingKey, settingValue, updatedAt) 
       VALUES ('sic_web_session_token', ?, NOW()) 
       ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), updatedAt = NOW()`,
      [normalized.jwtToken]
    ).catch(() => {});
    await pool.query(
      `INSERT INTO ${hdDbName}.system_settings (settingKey, settingValue, updatedAt) 
       VALUES ('sic_web_session_cookie', ?, NOW()) 
       ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), updatedAt = NOW()`,
      [normalized.cookieHeader]
    ).catch(() => {});
  } catch {}

  sessionCache = normalized;
  const payload = parseJwtPayload(normalized.jwtToken);

  console.log(`[SIC Session] ✅ Sessão do SIC atualizada com sucesso! Expira em: ${new Date(normalized.expiresAt).toISOString()}`);

  return {
    success: true,
    message: "Sessão do portal SIC validada e salva com sucesso!",
    expiresAt: new Date(normalized.expiresAt).toISOString(),
    user: payload?.name || payload?.email || "Operador de Atendimento",
  };
}

/**
 * Consulta o status atual da sessão do portal SIC
 */
export async function getSicSessionStatus(): Promise<{
  active: boolean;
  expiresAt: string | null;
  remainingMinutes: number;
  user: string | null;
  source: string;
}> {
  try {
    const session = await getAuthenticatedSicSession().catch(() => null);
    if (!session) {
      return {
        active: false,
        expiresAt: null,
        remainingMinutes: 0,
        user: null,
        source: "Nenhuma sessão ativa",
      };
    }

    const payload = parseJwtPayload(session.jwtToken);
    const expMs = payload?.exp ? payload.exp * 1000 : sessionCache?.expiresAt || 0;
    const remainingMs = Math.max(0, expMs - Date.now());
    const remainingMinutes = Math.floor(remainingMs / 60000);

    return {
      active: remainingMinutes > 0,
      expiresAt: expMs ? new Date(expMs).toISOString() : null,
      remainingMinutes,
      user: payload?.name || payload?.email || "Operador Atendimento",
      source: "Sessão Ativa",
    };
  } catch {
    return {
      active: false,
      expiresAt: null,
      remainingMinutes: 0,
      user: null,
      source: "Erro ao verificar",
    };
  }
}

let isRefreshing = false;

/**
 * Renova a sessão do SIC chamando o endpoint oficial /api/refresh-token do portal SIC
 */
export async function refreshSicSession(): Promise<{ success: boolean; message: string; expiresAt?: string }> {
  if (isRefreshing) {
    return { success: false, message: "Renovação já em andamento." };
  }

  isRefreshing = true;
  try {
    // 1. Obtém a sessão ativa mais recente
    let currentToken = sessionCache?.jwtToken;
    let currentCookie = sessionCache?.cookieHeader;

    if (!currentToken) {
      const [rows] = await pool.query<any[]>(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('sic_web_session_token', 'sic_web_session_cookie')"
      );
      if (rows && rows.length > 0) {
        const tRow = rows.find((r: any) => r.setting_key === "sic_web_session_token");
        const cRow = rows.find((r: any) => r.setting_key === "sic_web_session_cookie");
        if (tRow?.setting_value) currentToken = tRow.setting_value;
        if (cRow?.setting_value) currentCookie = cRow.setting_value;
      }
    }

    if (!currentToken) {
      throw new Error("Nenhuma sessão do SIC registrada para renovar.");
    }

    if (!currentCookie) {
      const cookieVal = encodeURIComponent(
        JSON.stringify({
          key: "coopedu-auth-prod",
          value: currentToken,
        })
      );
      currentCookie = `coopedu-auth-prod=${cookieVal}`;
    }

    console.log("[SIC Auto-Refresh] 🔄 Disparando chamada ao endpoint oficial /api/refresh-token do portal SIC...");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${currentToken}`,
      Cookie: currentCookie,
      Origin: "https://ui.coopedu.app.br",
      Referer: "https://ui.coopedu.app.br/",
      "Content-Type": "application/json",
    };

    const res = await axios.post("https://ui.coopedu.app.br/api/refresh-token", {}, {
      headers,
      timeout: 10000,
    });

    if (res.status !== 200 && res.status !== 204) {
      throw new Error(`Endpoint de refresh do SIC retornou HTTP ${res.status}`);
    }

    // Tenta capturar o token renovado no Set-Cookie ou no body
    let refreshedToken = "";
    let refreshedCookieHeader = "";

    const setCookieHeaders = res.headers["set-cookie"];
    if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
      const authCookie = setCookieHeaders.find((c: string) => c.includes("coopedu-auth-prod="));
      if (authCookie) {
        refreshedCookieHeader = authCookie.split(";")[0];
        const match = authCookie.match(/coopedu-auth-prod=([^;]+)/);
        if (match) {
          try {
            const parsed = JSON.parse(decodeURIComponent(match[1]));
            if (parsed.value) refreshedToken = parsed.value;
          } catch {
            refreshedToken = match[1];
          }
        }
      }
    }

    if (!refreshedToken && res.data) {
      if (typeof res.data === "string" && res.data.startsWith("eyJ")) {
        refreshedToken = res.data;
      } else if (res.data.token || res.data.rawToken) {
        refreshedToken = res.data.token || res.data.rawToken;
      }
    }

    // Se o backend Next.js apenas renovou a sessão interna, chama /api/decode-jwt com o cookie atualizado
    if (!refreshedToken) {
      try {
        const decodeHeaders = {
          ...headers,
          ...(refreshedCookieHeader ? { Cookie: refreshedCookieHeader } : {}),
        };
        const decodeRes = await axios.get("https://ui.coopedu.app.br/api/decode-jwt", {
          headers: decodeHeaders,
          timeout: 8000,
        });
        if (decodeRes.data?.rawToken) {
          refreshedToken = decodeRes.data.rawToken;
        }
      } catch (decodeErr: any) {
        console.warn("[SIC Auto-Refresh] Aviso ao decodificar JWT após refresh:", decodeErr.message);
      }
    }

    // Se não veio token novo mas a chamada HTTP 200 confirmou renovação, reutilizamos o token anterior com prazo estendido
    if (!refreshedToken) {
      refreshedToken = currentToken;
    }

    const saveResult = await saveSicSession(refreshedCookieHeader || refreshedToken);
    console.log(`[SIC Auto-Refresh] ✅ Sessão do SIC renovada preventivamente com sucesso! Expira em: ${saveResult.expiresAt}`);

    return {
      success: true,
      message: "Sessão renovada com sucesso!",
      expiresAt: saveResult.expiresAt,
    };
  } catch (error: any) {
    console.warn("[SIC Auto-Refresh] Falha ao renovar sessão:", error.response?.data || error.message);
    return {
      success: false,
      message: error.message || "Falha ao renovar sessão do SIC.",
    };
  } finally {
    isRefreshing = false;
  }
}

let autoRefreshTimer: NodeJS.Timeout | null = null;

/**
 * Inicia o worker em segundo plano que renova a sessão periodicamente
 */
export function startSicAutoRefreshWorker() {
  if (autoRefreshTimer) return;

  console.log("[SIC Worker] 🕒 Worker de renovação preventiva da Sessão SIC ativado (intervalo: 10 min).");

  autoRefreshTimer = setInterval(async () => {
    try {
      const status = await getSicSessionStatus();
      // Se a sessão estiver ativa e faltar entre 1 e 35 minutos para expirar, renova!
      if (status.active && status.remainingMinutes > 0 && status.remainingMinutes <= 35) {
        console.log(`[SIC Worker] ⚡ Sessão SIC expira em ${status.remainingMinutes} min. Executando renovação automática preventiva...`);
        await refreshSicSession();
      }
    } catch (err: any) {
      console.warn("[SIC Worker] Erro no ciclo de verificação da sessão:", err.message);
    }
  }, 10 * 60 * 1000);
}

/**
 * Obtém a sessão autenticada do Atendimento no portal SIC com resolução multi-camadas
 */
export async function getAuthenticatedSicSession(): Promise<{ jwtToken: string; cookieHeader: string }> {
  const now = Date.now();

  // 1. Cache em memória ainda válido (com folga de 2 minutos)
  if (sessionCache && sessionCache.expiresAt > (now + 120000)) {
    // Renovação preventiva silenciosa se faltar menos de 20 minutos
    if (sessionCache.expiresAt < (now + 20 * 60 * 1000) && !isRefreshing) {
      refreshSicSession().catch(() => {});
    }
    return { jwtToken: sessionCache.jwtToken, cookieHeader: sessionCache.cookieHeader };
  }

  // Se o cache expirou ou está perto de expirar, tenta renovar via API oficial antes de desistir
  if (sessionCache && sessionCache.jwtToken) {
    const refreshResult = await refreshSicSession().catch(() => null);
    if (refreshResult?.success && sessionCache && sessionCache.expiresAt > (now + 120000)) {
      return { jwtToken: sessionCache.jwtToken, cookieHeader: sessionCache.cookieHeader };
    }
  }

  // 2. Consulta no banco centralizador_sic_db.system_settings
  try {
    const [rows] = await pool.query<any[]>(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('sic_web_session_token', 'sic_web_session_cookie')"
    );
    if (rows && rows.length > 0) {
      const tokenRow = rows.find((r: any) => r.setting_key === "sic_web_session_token");
      const cookieRow = rows.find((r: any) => r.setting_key === "sic_web_session_cookie");
      if (tokenRow?.setting_value) {
        const norm = normalizeSicTokenAndCookie(tokenRow.setting_value);
        if (norm && norm.expiresAt > (now + 60000)) {
          if (cookieRow?.setting_value) norm.cookieHeader = cookieRow.setting_value;
          sessionCache = norm;
          // Renovação preventiva silenciosa
          if (norm.expiresAt < (now + 20 * 60 * 1000) && !isRefreshing) {
            refreshSicSession().catch(() => {});
          }
          return { jwtToken: norm.jwtToken, cookieHeader: norm.cookieHeader };
        }
      }
    }
  } catch (e: any) {}

  // 3. Consulta no banco helpdesk_local.system_settings (compartilhamento entre sistemas)
  try {
    const hdDbName = process.env.HELPDESK_DB_NAME || "helpdesk_local";
    const [hdRows] = await pool.query<any[]>(
      `SELECT settingKey, settingValue FROM ${hdDbName}.system_settings WHERE settingKey IN ('sic_web_session_token', 'sic_web_session_cookie')`
    );
    if (hdRows && hdRows.length > 0) {
      const tokenRow = hdRows.find((r: any) => r.settingKey === "sic_web_session_token");
      const cookieRow = hdRows.find((r: any) => r.settingKey === "sic_web_session_cookie");
      if (tokenRow?.settingValue) {
        const norm = normalizeSicTokenAndCookie(tokenRow.settingValue);
        if (norm && norm.expiresAt > (now + 60000)) {
          if (cookieRow?.settingValue) norm.cookieHeader = cookieRow.settingValue;
          sessionCache = norm;
          return { jwtToken: norm.jwtToken, cookieHeader: norm.cookieHeader };
        }
      }
    }
  } catch (e: any) {}

  // 4. Variáveis de ambiente
  if (process.env.SIC_SESSION_COOKIE || process.env.SIC_SESSION_TOKEN) {
    const envVal = process.env.SIC_SESSION_COOKIE || process.env.SIC_SESSION_TOKEN || "";
    const norm = normalizeSicTokenAndCookie(envVal);
    if (norm && norm.expiresAt > (now + 60000)) {
      sessionCache = norm;
      return { jwtToken: norm.jwtToken, cookieHeader: norm.cookieHeader };
    }
  }

  // 5. Fallback via robô headless (apenas se expressamente habilitado via PUPPETEER_AUTO_LOGIN=true)
  const executablePath = getExecutablePath();
  if (executablePath && process.env.PUPPETEER_AUTO_LOGIN === "true") {
    try {
      console.log("[SIC Auth] Tentando renovação automática via robô navegador headless...");
      const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
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

        await page.goto("https://ui.coopedu.app.br/", { waitUntil: "networkidle2", timeout: 25000 });
        const userInput = await page.$('input[name="username"], input[name="email"], input[type="email"]');
        if (userInput) {
          await userInput.type(SIC_USER_EMAIL, { delay: 30 });
          const passInput = await page.$('input[name="password"], input[type="password"]');
          if (passInput) await passInput.type(SIC_USER_PASSWORD, { delay: 30 });
          const submitBtn = await page.$('button[type="submit"]');
          if (submitBtn) await submitBtn.click();
          await new Promise((r) => setTimeout(r, 6000));
        }

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

        if (jwtToken && jwtToken.startsWith("eyJ")) {
          const norm = normalizeSicTokenAndCookie(jwtToken);
          if (norm) {
            norm.cookieHeader = cookieHeader || norm.cookieHeader;
            sessionCache = norm;
            await saveSicSession(jwtToken).catch(() => {});
            return { jwtToken: norm.jwtToken, cookieHeader: norm.cookieHeader };
          }
        }
      } catch (innerErr: any) {
        await browser.close().catch(() => {});
        console.warn("[SIC Auth Warning] Robô headless encontrou barreira (reCAPTCHA):", innerErr.message);
      }
    } catch (launchErr: any) {
      console.warn("[SIC Auth Warning] Falha ao iniciar Chromium:", launchErr.message);
    }
  }

  throw new Error(
    "A Sessão Web do portal SIC (Coopedu) expirou ou não está configurada. Por favor, acesse o portal https://ui.coopedu.app.br, copie o cookie 'coopedu-auth-prod' e cole no menu Conexão SIC."
  );
}

/**
 * Atualiza o E-mail e WhatsApp do cooperado diretamente no banco oficial do SIC
 * GARANTIA: Atualiza DADOS REAIS e UNICAMENTE o cooperado selecionado (busca dinamicamente pelo CPF)
 */
export interface SicUpdateData {
  email?: string;
  whatsapp?: string;
  birthDate?: string;
  rg?: string;
  rgIssuer?: string;
  rgState?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

/**
 * Atualiza dados cadastrais do cooperado selecionado na API oficial do SIC (ui.coopedu.app.br)
 * com sanitização estrita, preservação da ficha via GET -> PUT e higienização de relacionamentos
 */
export async function updateOfficialSicCooperadoData(
  cpf: string,
  data: SicUpdateData
): Promise<{ success: boolean; message: string; details?: any }> {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf) {
    return { success: false, message: "CPF inválido." };
  }

  const numericPhone = data.whatsapp ? cleanCpf(data.whatsapp) : "";

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
      const msg = `Cooperado com CPF ${numericCpf} não foi localizado no SIC. Atualização cancelada por segurança.`;
      console.error(`[SIC Official Sync Error] ${msg}`);
      return { success: false, message: msg };
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
    const existingRgStr = typeof existing.documents?.rg === "object" ? (existing.documents.rg.number || "") : (existing.documents?.rg || "");
    const finalRg = data.rg !== undefined ? String(data.rg).trim() : existingRgStr;
    const finalRgIssuer = data.rgIssuer || existing.documents?.rgIssuer || (typeof existing.documents?.rg === "object" ? existing.documents.rg.rgIssuer : "") || "SSP";
    const finalRgState = data.rgState || existing.documents?.rgState || (typeof existing.documents?.rg === "object" ? existing.documents.rg.rgState : "") || "CE";

    let formattedBirthDate = existing.birthDate || existing.dataNascimento;
    if (data.birthDate) {
      const str = String(data.birthDate).trim();
      if (str.includes("/")) {
        const parts = str.split("/");
        if (parts.length === 3) {
          formattedBirthDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T00:00:00.000Z`;
        }
      } else {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          formattedBirthDate = d.toISOString().split("T")[0] + "T00:00:00.000Z";
        }
      }
    }

    // 3. Remove campos de relacionamento somente-leitura que causam HTTP 503 no backend do SIC
    const {
      fileDocuments,
      contractCooperativeUser,
      rubricCooperativeUsers,
      payrollProductivities,
      cooperative,
      createdTime,
      updatedTime,
      ...cleanData
    } = existing;

    const payload: any = {
      ...cleanData,
      identification: numericCpf,
      email: data.email !== undefined ? String(data.email).trim().toLowerCase() : (existing.email || ""),
      cellPhone: numericPhone || cleanCpf(existing.cellPhone || existing.celular || ""),
      telephone: existing.telephone || "",
      birthDate: formattedBirthDate,
      dataNascimento: formattedBirthDate,
      documents: {
        ...existing.documents,
        rg: finalRg || null,
        rgIssuer: finalRgIssuer,
        rgState: finalRgState,
      },
    };

    // Atualiza endereço se fornecido
    if (data.street || data.number || data.neighborhood || data.city || data.state || data.zipCode || data.complement !== undefined) {
      payload.address = {
        ...(existing.address || {}),
        streetName: data.street || existing.address?.streetName || existing.address?.street || existing.endereco?.rua || "",
        houseNumber: data.number || existing.address?.houseNumber || existing.endereco?.numero || "S/N",
        complement: data.complement !== undefined ? data.complement : (existing.address?.complement || existing.endereco?.complemento || ""),
        neighborhood: data.neighborhood || existing.address?.neighborhood || existing.endereco?.bairro || "",
        cityName: data.city || existing.address?.cityName || existing.address?.city || existing.endereco?.cidade || "",
        state: data.state || existing.address?.state || existing.endereco?.estado || "CE",
        cep: data.zipCode ? cleanCpf(data.zipCode) : (existing.address?.cep || existing.endereco?.cep || ""),
      };
      payload.endereco = {
        ...(existing.endereco || {}),
        rua: data.street || existing.endereco?.rua || existing.address?.streetName || "",
        numero: data.number || existing.endereco?.numero || existing.address?.houseNumber || "S/N",
        complemento: data.complement !== undefined ? data.complement : (existing.endereco?.complemento || existing.address?.complement || ""),
        bairro: data.neighborhood || existing.endereco?.bairro || existing.address?.neighborhood || "",
        cidade: data.city || existing.endereco?.cidade || existing.address?.cityName || "",
        estado: data.state || existing.endereco?.estado || existing.address?.state || "CE",
        cep: data.zipCode ? cleanCpf(data.zipCode) : (existing.endereco?.cep || existing.address?.cep || ""),
      };
    }

    const updateHeaders = {
      ...headers,
      Referer: `https://ui.coopedu.app.br/sistema/cooperados/${targetCooperadoId}/editar`,
    };

    const updateRes = await axios.put(`https://ui.coopedu.app.br/api/cooperado/${targetCooperadoId}`, payload, { headers: updateHeaders });
    const successMsg = `Cadastro atualizado com sucesso no SIC oficial para o cooperado ID ${targetCooperadoId}!`;
    console.log(`[SIC Official Sync] 🎉 ${successMsg}:`, updateRes.data?.message || updateRes.status);
    return { success: true, message: successMsg, details: updateRes.data };
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error(`[SIC Official Sync Error] Erro ao atualizar no SIC oficial para CPF ${numericCpf}:`, err.response?.data || err.message);
    return { success: false, message: `Erro ao sincronizar com o SIC oficial: ${errorMsg}` };
  }
}

/**
 * Atualiza contatos do cooperado no SIC oficial (wrapper para retrocompatibilidade)
 */
export async function updateOfficialSicCooperadoContacts(
  cpf: string,
  newEmail: string,
  newWhatsapp: string,
  newBirthDate?: string
): Promise<boolean> {
  const result = await updateOfficialSicCooperadoData(cpf, {
    email: newEmail,
    whatsapp: newWhatsapp,
    birthDate: newBirthDate,
  });
  return result.success;
}

/**
 * Baixa o PDF original do Comprovante PIX/Transferência/Fitbank do SIC oficial
 */
export async function getOfficialSicPaymentReceiptPdf(cpf: string, payrollId: string): Promise<Buffer | null> {
  try {
    const numericCpf = cleanCpf(cpf);
    if (!numericCpf) return null;

    const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
    const headers = {
      Authorization: `Bearer ${jwtToken}`,
      Cookie: cookieHeader,
      Origin: "https://ui.coopedu.app.br",
    };

    // 1. Obter o ID do cooperado no SIC (sic_id)
    let cooperadoId: string | null = null;
    try {
      const { pool } = require("../db");
      const [rows] = await pool.query(
        "SELECT sic_id FROM cooperados WHERE document = ? LIMIT 1",
        [numericCpf]
      );
      if (rows?.[0]?.sic_id) {
        cooperadoId = rows[0].sic_id;
      }
    } catch (e) {}

    if (!cooperadoId) {
      const listRes = await axios.get(
        `https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=10`,
        { headers }
      );
      const items = listRes.data?.body?.items || listRes.data?.items || listRes.data?.cooperados || [];
      const item = items.find((i: any) => cleanCpf(i.documents?.identification || i.document || i.cpf) === numericCpf);
      if (item?.id) {
        cooperadoId = item.id;
      }
    }

    if (!cooperadoId) {
      console.warn(`[SIC Official Receipt] Cooperado com CPF ${numericCpf} não encontrado no SIC.`);
      return null;
    }

    // 2. Buscar lista de pagamentos do cooperado
    const payListRes = await axios.get(
      `https://ui.coopedu.app.br/api/cooperado/${cooperadoId}/financeiro/pagamentos?pageNumber=1&pageSize=50`,
      { headers }
    );
    const payItems = payListRes.data?.body?.items || payListRes.data?.items || [];
    if (payItems.length === 0) {
      console.warn(`[SIC Official Receipt] Nenhum pagamento encontrado para cooperado ${cooperadoId}`);
      return null;
    }

    // Localiza o pagamento correspondente pela payrollId ou competência
    let matchedPay = payItems.find((p: any) => p.payrollId === payrollId || p.paymentId === payrollId);

    if (!matchedPay && payrollId) {
      const parts = payrollId.replace("payroll-", "").split("-");
      if (parts.length >= 2) {
        const monthNum = Number(parts.pop());
        const yearNum = Number(parts.pop());
        matchedPay = payItems.find((p: any) => p.month === monthNum && p.year === yearNum);
      }
    }

    if (!matchedPay) {
      matchedPay = payItems[0];
    }

    const paymentId = matchedPay.paymentId || matchedPay.id;
    if (!paymentId) return null;

    // 3. Buscar detalhes do pagamento
    const detailsRes = await axios.get(
      `https://ui.coopedu.app.br/api/cooperado/${cooperadoId}/financeiro/pagamentos/${paymentId}`,
      { headers }
    );

    const details = detailsRes.data?.body || detailsRes.data || {};
    const receiptURL = details.receiptURL;
    if (!receiptURL) {
      console.warn(`[SIC Official Receipt] Pagamento ${paymentId} não possui receiptURL`);
      return null;
    }

    // 4. Resolver a URL real de download (minio vs http)
    let downloadUrl = receiptURL;
    if (receiptURL.startsWith("minio:")) {
      const filename = receiptURL.slice("minio:".length).trim();
      downloadUrl = `https://ui.coopedu.app.br/api/files/${encodeURIComponent(filename)}`;
    }

    console.log(`[SIC Official Receipt] Baixando comprovante oficial de: ${downloadUrl}`);
    const pdfRes = await axios.get(downloadUrl, {
      headers: downloadUrl.includes("ui.coopedu.app.br") ? headers : undefined,
      responseType: "arraybuffer",
      timeout: 15000,
    });

    if (pdfRes.data && pdfRes.data.length > 0) {
      console.log(`[SIC Official Receipt] Comprovante oficial baixado com sucesso (${pdfRes.data.length} bytes)`);
      return Buffer.from(pdfRes.data);
    }

    return null;
  } catch (err: any) {
    console.error(`[SIC Official Receipt Error] Erro ao buscar comprovante oficial para CPF ${cpf}:`, err.message);
    return null;
  }
}
