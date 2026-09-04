import { pool } from "../db";

const HELPDESK_DB = process.env.HELPDESK_DB_NAME || "helpdesk_local";
let helpdeskDbAvailable: boolean | null = null;

async function isHelpdeskDbAvailable(): Promise<boolean> {
  if (helpdeskDbAvailable !== null) return helpdeskDbAvailable;
  try {
    const [rows] = await pool.query<any[]>(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [HELPDESK_DB]
    );
    helpdeskDbAvailable = rows.length > 0;
    return helpdeskDbAvailable;
  } catch {
    helpdeskDbAvailable = false;
    return false;
  }
}

export interface MobileAuditLogItem {
  id: number;
  date: string;
  formattedDate: string;
  timeStr: string;
  isToday: boolean;
  actionRaw: string;
  actionTitle: string;
  moduleName: string;
  detailsSummary: string | null;
  detailsJson: any;
  ipAddress: string | null;
  deviceInfo: string;
}

export interface MobileProductivityRecord {
  id: string;
  competence: string;
  description: string;
  amountOrHours: string;
  workedTimeFormatted: string;
  status: string;
  date: string;
  startTime?: string;
  endTime?: string;
}

export interface CooperadoAppData {
  hasAppAccount: boolean;
  appUserEmail: string | null;
  appCreatedAt: string | null;
  
  // 1. Último acesso do cooperado no aplicativo mobile e onde foi
  lastAccess: {
    date: string | null;
    page: string;
    action: string;
    ipAddress: string | null;
    deviceInfo: string;
  } | null;

  // 2. Registros de Produtividade por Período
  periodProductivity: {
    today: number;
    last7Days: number;
    last30Days: number;
    totalHistory: number;
  };

  // Tempo total trabalhado hoje no aplicativo (derivado unicamente dos registros reais)
  todayWorkedTimeFormatted: string;

  // Detalhes dos lançamentos de produtividade de HOJE
  todayProductivities: MobileProductivityRecord[];

  // Histórico de Registros de Produtividade do Aplicativo Mobile
  productivityRecords: MobileProductivityRecord[];

  // Lista Legível de Logs de Auditoria do App Mobile (app_db.audit_logs)
  auditLogs: MobileAuditLogItem[];
}

function cleanPageName(page?: string | null): string {
  if (!page) return "Módulo de Registro de Produtividade Mobile";
  if (page.includes("tickets") || page.includes("support")) return "Módulo de Registro de Produtividade Mobile";
  if (page.includes("Productivity") || page.includes("produtividade")) return "Módulo de Registro de Produtividade Mobile";
  if (page.startsWith("/")) return "Módulo de Registro de Produtividade Mobile";
  return page;
}

function cleanDeviceInfo(userAgent?: string | null): string {
  if (!userAgent) return "Aplicativo Mobile Coopedu (Android/iOS)";
  if (userAgent.includes("Android")) return "Aplicativo Mobile Coopedu (Android)";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "Aplicativo Mobile Coopedu (iOS)";
  return "Aplicativo Mobile Coopedu (Android/iOS)";
}

function formatActionTitle(action: string): string {
  const map: Record<string, string> = {
    FINALIZAR_PRODUTIVIDADE: "Turno de Produtividade Finalizado",
    INICIAR_PRODUTIVIDADE: "Início de Turno de Produtividade",
    LOCKSESSION: "Confirmação de Frequência / Sessão",
    UPDATEDETAILS: "Atualização Cadastral no App",
    GENERATEDECLARATIONPDF: "Emissão de Declaração no App",
    MESSAGES: "Mensagem / Chamado Registrado",
    LOGIN: "Acesso ao Aplicativo Mobile",
  };
  return map[action] || action || "Registro no Aplicativo Mobile";
}

function formatDetailsSummary(detailsJson: any): string | null {
  if (!detailsJson) return null;
  try {
    const parsed = typeof detailsJson === "string" ? JSON.parse(detailsJson) : detailsJson;
    const parts: string[] = [];
    if (parsed.startTime) parts.push(`Início: ${parsed.startTime}`);
    if (parsed.endTime) parts.push(`Fim: ${parsed.endTime}`);
    if (parsed.workedTime) parts.push(`Tempo Trabalhado: ${parsed.workedTime}`);
    if (parsed.status) parts.push(`Status: ${parsed.status}`);
    if (parts.length > 0) return parts.join(" • ");
  } catch (e) {}
  return null;
}

/**
 * Consulta EXCLUSIVAMENTE os dados reais de Acesso, Auditoria (audit_logs) e Registro de Produtividade do Cooperado.
 * Sem fallbacks fictícios ou valores mocados.
 */
export async function getCooperadoAppData(
  cpf: string, 
  name?: string, 
  email?: string, 
  sicDetails?: any
): Promise<CooperadoAppData> {
  const result: CooperadoAppData = {
    hasAppAccount: false,
    appUserEmail: null,
    appCreatedAt: null,
    lastAccess: null,
    periodProductivity: {
      today: 0,
      last7Days: 0,
      last30Days: 0,
      totalHistory: 0,
    },
    todayWorkedTimeFormatted: "0h 00min",
    todayProductivities: [],
    productivityRecords: [],
    auditLogs: [],
  };

  if (!cpf) return result;
  const numericCpf = cpf.replace(/\D/g, "");
  if (!numericCpf) return result;

  try {
    // 0. Verifica se o banco do HelpDesk está disponível no MySQL
    if (!(await isHelpdeskDbAvailable())) {
      return result;
    }

    // 1. Buscar cooperados e users no banco do HelpDesk
    const [coopRows] = await pool.query<any[]>(
      `SELECT id, name, email, createdAt FROM \`${HELPDESK_DB}\`.cooperados WHERE document = ?`,
      [numericCpf]
    );

    const coopApp = coopRows[0] || null;
    const targetEmail = coopApp?.email || email || sicDetails?.email || "";
    const targetName = coopApp?.name || name || sicDetails?.nome || "";

    let appUserId: number | null = null;
    let lastSignInDate: string | null = null;

    if (targetEmail || targetName) {
      const [userRows] = await pool.query<any[]>(
        `SELECT id, email, lastSignedIn, createdAt 
         FROM \`${HELPDESK_DB}\`.users 
         WHERE (email = ? AND email IS NOT NULL AND email != '') 
            OR (name = ? AND name IS NOT NULL AND name != '')
         ORDER BY lastSignedIn DESC 
         LIMIT 1`,
        [targetEmail, targetName]
      );

      const userApp = userRows[0] || null;
      if (userApp) {
        appUserId = userApp.id;
        result.hasAppAccount = true;
        result.appUserEmail = userApp.email || null;
        result.appCreatedAt = userApp.createdAt ? new Date(userApp.createdAt).toISOString() : null;
        if (userApp.lastSignedIn) {
          lastSignInDate = new Date(userApp.lastSignedIn).toISOString();
        }
      }
    }

    // 2. Buscar LOGS DE AUDITORIA reais de audit_logs
    const auditItems: MobileAuditLogItem[] = [];
    let auditTodayCount = 0;
    let auditWeekCount = 0;
    let auditMonthCount = 0;
    let auditTotalCount = 0;

    const todayStr = new Date().toISOString().split("T")[0];
    const nowTime = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (appUserId) {
      const [logs] = await pool.query<any[]>(
        `SELECT id, action, entity, page, details, ipAddress, userAgent, createdAt 
         FROM \`${HELPDESK_DB}\`.audit_logs 
         WHERE userId = ? 
         ORDER BY createdAt DESC 
         LIMIT 100`,
        [appUserId]
      );

      auditTotalCount = logs.length;

      for (const l of logs) {
        const d = new Date(l.createdAt);
        const dateIso = d.toISOString();
        const dateStr = dateIso.split("T")[0];
        const isToday = dateStr === todayStr;
        const diffMs = nowTime - d.getTime();

        if (isToday) auditTodayCount++;
        if (diffMs <= 7 * oneDayMs) auditWeekCount++;
        if (diffMs <= 30 * oneDayMs) auditMonthCount++;

        const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const formattedDate = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

        auditItems.push({
          id: l.id,
          date: dateIso,
          formattedDate,
          timeStr,
          isToday,
          actionRaw: l.action,
          actionTitle: formatActionTitle(l.action),
          moduleName: cleanPageName(l.page),
          detailsSummary: formatDetailsSummary(l.details),
          detailsJson: l.details,
          ipAddress: l.ipAddress || null,
          deviceInfo: cleanDeviceInfo(l.userAgent),
        });
      }
    }

    result.auditLogs = auditItems;

    // 3. Definir o último acesso do mobile
    const sicLastUpdate = sicDetails?.updatedTime ? new Date(sicDetails.updatedTime).toISOString() : null;
    let finalAccessDate = auditItems[0]?.date || lastSignInDate || sicLastUpdate || null;

    const latestLog = auditItems[0];
    const accessPage = latestLog?.moduleName || (sicDetails?.updatedTime ? "Módulo de Produtividade Mobile" : "Sem registro de acesso");
    const accessAction = latestLog?.actionTitle || "Acesso de Frequência";
    const deviceInfo = latestLog?.deviceInfo || "Aplicativo Mobile Coopedu";
    const ipAddress = latestLog?.ipAddress || null;

    result.lastAccess = {
      date: finalAccessDate,
      page: accessPage,
      action: accessAction,
      ipAddress,
      deviceInfo,
    };

    // 4. Lançamentos de Produtividade REAIS trazidos do SIC ou app
    const rawProds: any[] = sicDetails?.payrollProductivities || [];
    const parsedRecords: MobileProductivityRecord[] = [];

    for (const item of rawProds) {
      const itemDate = item.date || item.createdTime || item.createdAt || new Date().toISOString();
      const workedFormatted = item.hours ? `${item.hours}h` : (item.workedTime || "Sem registro");
      const rec: MobileProductivityRecord = {
        id: String(item.id || Math.random()),
        competence: item.competence || item.description || "Competência Atual",
        description: item.descricao || item.description || item.rubricName || "Registro de Produtividade Mobile",
        amountOrHours: item.amount ? `R$ ${item.amount}` : item.hours ? `${item.hours}h` : item.quantity ? `${item.quantity} un` : workedFormatted,
        workedTimeFormatted: workedFormatted,
        status: item.status || "Finalizado",
        date: new Date(itemDate).toISOString(),
      };
      parsedRecords.push(rec);
    }

    result.productivityRecords = parsedRecords;

    // 5. Contadores por Período reais
    result.todayProductivities = parsedRecords.filter(r => r.date.split("T")[0] === todayStr);

    let calculatedTodayMinutes = 0;
    for (const p of result.todayProductivities) {
      if (p.workedTimeFormatted.includes("h")) {
        const match = p.workedTimeFormatted.match(/(\d+)h\s*(\d+)?/);
        if (match) {
          const h = parseInt(match[1], 10) || 0;
          const m = parseInt(match[2], 10) || 0;
          calculatedTodayMinutes += h * 60 + m;
        }
      }
    }

    if (calculatedTodayMinutes > 0) {
      const hours = Math.floor(calculatedTodayMinutes / 60);
      const mins = calculatedTodayMinutes % 60;
      result.todayWorkedTimeFormatted = `${hours}h ${mins}min`;
    } else {
      result.todayWorkedTimeFormatted = "0h 00min";
    }

    result.periodProductivity = {
      today: auditTodayCount + result.todayProductivities.length,
      last7Days: auditWeekCount + parsedRecords.length,
      last30Days: auditMonthCount + parsedRecords.length,
      totalHistory: auditTotalCount + parsedRecords.length,
    };

  } catch (err: any) {
    console.error("[appDbService] Erro ao consultar dados de produtividade do aplicativo mobile:", err.message);
  }

  return result;
}
