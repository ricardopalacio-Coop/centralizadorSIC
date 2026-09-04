import puppeteer, { Browser, Page } from "puppeteer-core";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

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

export interface PlugSignRowResult {
  rowNumber: number;
  name: string;
  cpf: string;
  contract: string;
  regional: string;
  contact: string;
  phoneStatus: string;
  url: string;
  isSigned: boolean;
  statusText: "Assinado" | "Não Assinado";
  details?: string;
  checkedAt: string;
}

export interface PlugSignProgressUpdate {
  jobId: string;
  totalRows: number;
  processedRows: number;
  signedCount: number;
  unsignedCount: number;
  currentRow?: PlugSignRowResult;
  percent: number;
  isCompleted: boolean;
  error?: string;
}

interface StoredJob {
  jobId: string;
  originalFileName: string;
  totalRows: number;
  processedRows: number;
  signedCount: number;
  unsignedCount: number;
  results: PlugSignRowResult[];
  buffer?: Buffer;
  isCompleted: boolean;
  isCancelled: boolean;
  createdAt: number;
}

// Armazenamento em memória dos jobs e downloads concluídos (com expiração automática)
const activeJobs = new Map<string, StoredJob>();

// Limpeza de jobs com mais de 2 horas
setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [jobId, job] of activeJobs.entries()) {
    if (job.createdAt < twoHoursAgo) {
      activeJobs.delete(jobId);
    }
  }
}, 15 * 60 * 1000);

export function getJob(jobId: string): StoredJob | undefined {
  return activeJobs.get(jobId);
}

export function cancelJob(jobId: string): boolean {
  const job = activeJobs.get(jobId);
  if (job && !job.isCompleted) {
    job.isCancelled = true;
    return true;
  }
  return false;
}

/**
 * Inspeciona uma URL do PlugSign abrindo uma aba temporária e fechando-a logo após a verificação
 * para liberar memória RAM.
 */
export async function checkPlugSignUrl(browser: Browser, rawUrl: string): Promise<{ isSigned: boolean; details?: string }> {
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  let page: Page | null = null;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Otimização de performance: desabilitar downloads e dialogs automáticos
    await page.setRequestInterception(false).catch(() => {});

    // Navega até a URL do PlugSign
    await page.goto(url, {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 25000,
    });

    // Aguarda um pequeno intervalo para montagem de componentes dinâmicos (React)
    await new Promise((r) => setTimeout(r, 2000));

    // Avalia o DOM da página procurando pelo botão "Opções"
    const isSigned = await page.evaluate(() => {
      // 1. Procura por qualquer botão ou elemento interativo com texto "Opções" / "Opcoes"
      const candidates = Array.from(
        document.querySelectorAll("button, a, div[role='button'], [class*='button'], [class*='btn'], span, p")
      );

      const hasOptionsButton = candidates.some((el) => {
        const text = (el.textContent || "").trim().toLowerCase();
        // Remove acentos e caracteres especiais para comparação segura
        const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalized.includes("opcoes") || normalized.includes("opcoes");
      });

      // 2. Se a página tiver indicação explícita de "Assinado" ou menu superior de documento finalizado
      return hasOptionsButton;
    });

    return {
      isSigned: !!isSigned,
      details: isSigned ? "Botão 'Opções' localizado (Documento Assinado)" : "Botão 'Opções' não localizado",
    };
  } catch (err: any) {
    console.warn(`[PlugSign Check Error] Erro ao carregar ${url}:`, err.message);
    return {
      isSigned: false,
      details: `Erro no acesso: ${err.message || "Timeout/Falha de carregamento"}`,
    };
  } finally {
    // FECHAMENTO IMEDIATO DA ABA: Regra estrita para não derrubar a memória do computador
    if (page) {
      try {
        await page.close();
      } catch (e) {}
    }
  }
}

function getCellValue(cell?: ExcelJS.Cell): string {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object") {
    return String((cell.value as any).text || (cell.value as any).result || (cell.value as any).hyperlink || "").trim();
  }
  return String(cell.value).trim();
}

function formatCpfDisplay(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return val;
}

/**
 * Processa a planilha Excel enviada, inspecionando os links na Coluna I e preenchendo a Coluna J
 */
export async function processPlugSignWorkbook(
  fileBuffer: Buffer,
  originalFileName: string,
  onProgress?: (update: PlugSignProgressUpdate) => void
): Promise<{ jobId: string; buffer: Buffer; summary: StoredJob }> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const job: StoredJob = {
    jobId,
    originalFileName,
    totalRows: 0,
    processedRows: 0,
    signedCount: 0,
    unsignedCount: 0,
    results: [],
    isCompleted: false,
    isCancelled: false,
    createdAt: Date.now(),
  };

  activeJobs.set(jobId, job);

  // 1. Carrega o arquivo Excel via ExcelJS preservando estilos e estruturas existentes
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("A planilha enviada não contém nenhuma aba válida.");
  }

  // 2. Identifica dinamicamente as colunas pelo cabeçalho (Linha 1)
  const headerRow = worksheet.getRow(1);
  const totalCols = Math.max(worksheet.columnCount || 10, 15);

  let colIndexName = -1;
  let colIndexCpf = -1;
  let colIndexContract = -1;
  let colIndexRegional = -1;
  let colIndexContact = -1;
  let colIndexPhoneStatus = -1;
  let colIndexUrl = 9; // Padrão: Coluna I (índice 9)

  for (let c = 1; c <= totalCols; c++) {
    const rawVal = getCellValue(headerRow.getCell(c)).toLowerCase();
    const normalized = rawVal.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (normalized.includes("status") && (normalized.includes("tel") || normalized.includes("contato") || normalized.includes("fone") || normalized.includes("situacao"))) {
      colIndexPhoneStatus = c;
    } else if (normalized.includes("contato") || normalized.includes("telefone") || normalized.includes("celular") || normalized.includes("whatsapp") || normalized.includes("fone")) {
      if (colIndexContact === -1) colIndexContact = c;
    } else if (normalized.includes("nucleo") || normalized.includes("regional") || normalized.includes("polo") || normalized.includes("cidade")) {
      colIndexRegional = c;
    } else if (normalized.includes("contrato") || normalized.includes("projeto") || normalized.includes("convenio")) {
      colIndexContract = c;
    } else if (normalized.includes("cpf") || normalized.includes("documento") || normalized.includes("doc")) {
      colIndexCpf = c;
    } else if (normalized.includes("nome") || normalized.includes("cooperado") || normalized.includes("associado")) {
      colIndexName = c;
    } else if (normalized.includes("plugsign") || normalized.includes("link") || normalized.includes("proposta") || normalized.includes("adesao") || normalized.includes("termo")) {
      colIndexUrl = c;
    }
  }

  // Fallbacks inteligentes por posicionamento padrão se não identificados pelo nome
  if (colIndexName === -1) colIndexName = 2; // Padrão: Coluna B
  if (colIndexCpf === -1) colIndexCpf = 3; // Padrão: Coluna C
  if (colIndexContract === -1) colIndexContract = 4; // Padrão: Coluna D
  if (colIndexRegional === -1) colIndexRegional = 5; // Padrão: Coluna E
  if (colIndexContact === -1) colIndexContact = 6; // Padrão: Coluna F
  if (colIndexPhoneStatus === -1) colIndexPhoneStatus = 7; // Padrão: Coluna G

  // 3. Mapeia as linhas com links na Coluna de URL (padrão Coluna I / 9)
  interface RowToProcess {
    rowNumber: number;
    name: string;
    cpf: string;
    contract: string;
    regional: string;
    contact: string;
    phoneStatus: string;
    url: string;
  }

  const rowsToProcess: RowToProcess[] = [];
  const rowCount = worksheet.rowCount;

  for (let r = 2; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    const cellUrl = row.getCell(colIndexUrl);
    let urlValue = getCellValue(cellUrl);

    // Se na coluna identificada não tiver URL, checa explicitamente a Coluna I (índice 9)
    if (!urlValue && colIndexUrl !== 9) {
      urlValue = getCellValue(row.getCell(9));
    }

    if (urlValue && (urlValue.includes("http") || urlValue.includes("plugsign") || urlValue.includes(".com") || urlValue.includes("view"))) {
      const rawName = getCellValue(row.getCell(colIndexName));
      const rawCpf = getCellValue(row.getCell(colIndexCpf));
      const rawContract = getCellValue(row.getCell(colIndexContract));
      const rawRegional = getCellValue(row.getCell(colIndexRegional));
      const rawContact = getCellValue(row.getCell(colIndexContact));
      const rawPhoneStatus = getCellValue(row.getCell(colIndexPhoneStatus));

      rowsToProcess.push({
        rowNumber: r,
        name: rawName || "Não Informado",
        cpf: formatCpfDisplay(rawCpf) || "-",
        contract: rawContract || "-",
        regional: rawRegional || "-",
        contact: rawContact || "-",
        phoneStatus: rawPhoneStatus || "Normal",
        url: urlValue.trim(),
      });
    }
  }

  // Se a linha 1 da Coluna J (Coluna 10) estiver vazia, define o cabeçalho
  const cellJHeader = headerRow.getCell(10);
  if (!cellJHeader.value) {
    cellJHeader.value = "Status Assinatura";
    cellJHeader.font = { bold: true };
  }

  job.totalRows = rowsToProcess.length;

  if (job.totalRows === 0) {
    job.isCompleted = true;
    const finalBuffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    job.buffer = Buffer.from(finalBuffer);
    if (onProgress) {
      onProgress({
        jobId,
        totalRows: 0,
        processedRows: 0,
        signedCount: 0,
        unsignedCount: 0,
        percent: 100,
        isCompleted: true,
      });
    }
    return { jobId, buffer: job.buffer, summary: job };
  }

  // 3. Inicializa o Puppeteer para navegar com alta estabilidade
  const executablePath = getExecutablePath();
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
    for (let i = 0; i < rowsToProcess.length; i++) {
      if (job.isCancelled) {
        console.log(`[PlugSign] Job ${jobId} cancelado pelo usuário.`);
        break;
      }

      const item = rowsToProcess[i];
      const checkResult = await checkPlugSignUrl(browser, item.url);

      const statusText: "Assinado" | "Não Assinado" = checkResult.isSigned ? "Assinado" : "Não Assinado";
      if (checkResult.isSigned) {
        job.signedCount++;
      } else {
        job.unsignedCount++;
      }
      job.processedRows++;

      // Atualiza a Coluna J (Coluna 10) na planilha
      const row = worksheet.getRow(item.rowNumber);
      const cellJ = row.getCell(10); // Coluna J
      cellJ.value = statusText;

      if (checkResult.isSigned) {
        // Marcador de texto amarelo brilhante (#FFFF00) e texto em negrito
        cellJ.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFF00" },
        };
        cellJ.font = {
          bold: true,
          color: { argb: "FF000000" },
        };
        cellJ.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        // Texto normal
        cellJ.font = {
          bold: false,
          color: { argb: "FF555555" },
        };
        cellJ.alignment = { vertical: "middle", horizontal: "center" };
      }

      const rowResult: PlugSignRowResult = {
        rowNumber: item.rowNumber,
        name: item.name,
        cpf: item.cpf,
        contract: item.contract,
        regional: item.regional,
        contact: item.contact,
        phoneStatus: item.phoneStatus,
        url: item.url,
        isSigned: checkResult.isSigned,
        statusText,
        details: checkResult.details,
        checkedAt: new Date().toLocaleTimeString("pt-BR"),
      };

      job.results.push(rowResult);

      const percent = Math.round((job.processedRows / job.totalRows) * 100);

      if (onProgress) {
        onProgress({
          jobId,
          totalRows: job.totalRows,
          processedRows: job.processedRows,
          signedCount: job.signedCount,
          unsignedCount: job.unsignedCount,
          currentRow: rowResult,
          percent,
          isCompleted: i === rowsToProcess.length - 1 || job.isCancelled,
        });
      }
    }

    // 4. Salva a planilha finalizada no buffer
    const finalBuffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    job.buffer = Buffer.from(finalBuffer);
    job.isCompleted = true;

    return { jobId, buffer: job.buffer, summary: job };
  } finally {
    try {
      await browser.close();
    } catch (e) {}
  }
}
