import { PDFDocument } from "pdf-lib";
import { pool } from "../db";
import {
  getEasycoopCooperadoFull,
  getEasycoopFinancialHistory,
  getEasycoopCooperadoFolha,
  toUpperNoAccents,
  toUpperWithAccents,
} from "./easycoopService";
import {
  generateEasycoopLancamentosPdf,
  generateEasycoopFolhaLotePdf,
} from "./pdfService";
import { googleDriveService } from "./googleDriveService";

export interface DossierCooperadoInfo {
  matricula: string | number;
  nome: string;
  cpf: string;
  contrato_principal: string;
  admission_date: string | null;
  termination_date: string | null;
  status: string;
  has_ficha: boolean;
  ficha_id?: string;
  ficha_filename?: string;
  total_competencias: number;
  total_contratos: number;
}

/**
 * Gera o nome de arquivo padronizado no formato: NOME_DO_COOPERADO_DDMMAAAA.pdf
 */
export function generateDossierFilename(cooperadoName: string, date: Date = new Date()): string {
  const cleanName = (cooperadoName || "COOPERADO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const ddmmaaaa = `${dd}${mm}${yyyy}`;

  return `${cleanName}_${ddmmaaaa}.pdf`;
}

/**
 * Busca dados cadastrais e de auditoria para exibição prévia no Dossiê
 */
export async function getDossierInfo(cpfOrMatricula: string): Promise<DossierCooperadoInfo | null> {
  const cleaned = String(cpfOrMatricula || "").trim();
  const numericOnly = cleaned.replace(/\D/g, "");
  if (!cleaned) return null;

  // 1. Busca dados cadastrais principais
  const [rows] = await pool.query<any[]>(
    `SELECT id, document, registration_number, name, contract_name, position,
            DATE_FORMAT(admission_date, '%Y-%m-%d') AS admission_date,
            DATE_FORMAT(termination_date, '%Y-%m-%d') AS termination_date,
            status, email, whatsapp_number, city, state
     FROM cooperados
     WHERE (REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', '') = ?
            OR document = ?
            OR (registration_number IS NOT NULL AND registration_number != '' AND CAST(registration_number AS CHAR) = ?))
     ORDER BY (CASE WHEN status = 'Ativo' THEN 0 ELSE 1 END) ASC, id DESC
     LIMIT 1`,
    [numericOnly, cleaned, numericOnly || cleaned]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const coop = rows[0];
  const docDigits = (coop.document || "").replace(/\D/g, "");
  const matr = coop.registration_number ? String(coop.registration_number) : "";

  // 2. Verifica se possui Ficha de Adesão cadastrada
  const [adesaoRows] = await pool.query<any[]>(
    `SELECT id, file_id, file_name, cooperado_name, cpf, matricula, web_view_link, web_content_link, created_at
     FROM fichas_cadastrais
     WHERE (REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = ?
            OR (matricula IS NOT NULL AND matricula != '' AND matricula = ?))
     ORDER BY id DESC LIMIT 1`,
    [docDigits, matr]
  );

  const hasFicha = adesaoRows.length > 0;
  const fichaRow = hasFicha ? adesaoRows[0] : null;

  // 3. Contagem de contratos e competências históricas
  const [compRows] = await pool.query<any[]>(
    `SELECT COUNT(DISTINCT CONCAT(ano, '-', mes, '-', folha)) AS total_comp,
            COUNT(DISTINCT tomador) AS total_tomadores
     FROM easycoop_fechamentos
     WHERE document = ?`,
    [docDigits]
  );

  const totalComp = compRows && compRows.length > 0 ? Number(compRows[0].total_comp || 0) : 0;
  const totalContratos = compRows && compRows.length > 0 ? Number(compRows[0].total_tomadores || 0) : 0;

  return {
    matricula: coop.registration_number || "-",
    nome: toUpperWithAccents(coop.name),
    cpf: coop.document,
    contrato_principal: toUpperWithAccents(coop.contract_name || "NÃO INFORMADO"),
    admission_date: coop.admission_date || null,
    termination_date: coop.termination_date || null,
    status: coop.status || "Ativo",
    has_ficha: hasFicha,
    ficha_id: fichaRow?.file_id,
    ficha_filename: fichaRow?.file_name,
    total_competencias: totalComp,
    total_contratos: totalContratos,
  };
}

/**
 * Gera o arquivo PDF unificado com os 3 documentos:
 * 1. Extrato de Repasses e Lançamentos Selecionados (todos os contratos)
 * 2. Demonstrativo de Produtividade e Repasse (todos os anos e meses históricos)
 * 3. Ficha de Adesão Easy (se disponível e autorizada)
 */
export async function generateDossierPdf(
  cpf: string,
  options: { includeFicha?: boolean } = {}
): Promise<{ buffer: Buffer; filename: string; pagesCount: number; hasFichaAttached: boolean }> {
  const numericCpf = cpf.replace(/\D/g, "");
  if (!numericCpf) {
    throw new Error("CPF inválido para geração do Dossiê.");
  }

  console.log(`[Dossier] Iniciando geração unificada para cooperado CPF: ${numericCpf}...`);

  // 1. Coleta dados completos do cooperado
  const coop = await getEasycoopCooperadoFull(numericCpf);
  if (!coop) {
    throw new Error("Cooperado não encontrado na base de dados do EasyCoop.");
  }

  // PARTE 1: Extrato de Repasses e Lançamentos (com todos os contratos)
  console.log(`[Dossier] 1/3 Compilando Extrato de Repasses (todos os contratos)...`);
  const financial = await getEasycoopFinancialHistory(numericCpf);
  const lancamentos = financial.fechamentos || [];
  const part1Buffer = await generateEasycoopLancamentosPdf(coop, lancamentos);

  // PARTE 2: Demonstrativo de Produtividade e Repasse (com todos os anos e meses, sem limite de 36)
  console.log(`[Dossier] 2/3 Compilando Demonstrativo de Produtividade de todos os anos e meses...`);
  const [dbCompRows] = await pool.query<any[]>(
    `SELECT DISTINCT ano, mes, folha
     FROM easycoop_fechamentos
     WHERE document = ?
     ORDER BY ano DESC, mes DESC, folha DESC`,
    [numericCpf]
  );

  const folhasList: any[] = [];
  for (const r of dbCompRows) {
    const folhaData = await getEasycoopCooperadoFolha(numericCpf, r.ano, r.mes, r.folha || 1);
    if (folhaData && folhaData.folha) {
      folhasList.push(folhaData.folha);
    }
  }

  // Se não encontrou folhas nos fechamentos, tenta recuperar a folha padrão cadastrada
  if (folhasList.length === 0) {
    const singleFolha = await getEasycoopCooperadoFolha(numericCpf);
    if (singleFolha && singleFolha.folha) {
      folhasList.push(singleFolha.folha);
    }
  }

  const part2Buffer = await generateEasycoopFolhaLotePdf(coop, folhasList);

  // PARTE 3: Ficha de Adesão Easy (se existir e includeFicha !== false)
  let part3Buffer: Buffer | null = null;
  let hasFichaAttached = false;
  const includeFicha = options.includeFicha !== false;

  if (includeFicha) {
    const matr = coop.registration_number ? String(coop.registration_number) : "";
    const [adesaoRows] = await pool.query<any[]>(
      `SELECT id, file_id, file_name
       FROM fichas_cadastrais
       WHERE (REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = ?
              OR (matricula IS NOT NULL AND matricula != '' AND matricula = ?))
       ORDER BY id DESC LIMIT 1`,
      [numericCpf, matr]
    );

    if (adesaoRows.length > 0 && adesaoRows[0].file_id) {
      const fileId = adesaoRows[0].file_id;
      console.log(`[Dossier] 3/3 Baixando Ficha de Adesão Easy do Google Drive (fileId: ${fileId})...`);
      try {
        const { stream } = await googleDriveService.getDownloadStream(fileId);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        part3Buffer = Buffer.concat(chunks);
        hasFichaAttached = true;
        console.log(`[Dossier] Ficha de Adesão baixada com sucesso (${part3Buffer.length} bytes).`);
      } catch (err: any) {
        console.warn(`[Dossier] Aviso: Não foi possível obter a Ficha de Adesão do Google Drive (${err.message}). Continuando geração sem a ficha.`);
      }
    } else {
      console.log(`[Dossier] Cooperado não possui registro de Ficha de Adesão na tabela fichas_cadastrais.`);
    }
  }

  // UNIFICAÇÃO DOS PDFS VIA pdf-lib
  console.log(`[Dossier] Unificando os documentos em ordem com pdf-lib...`);
  const mergedPdf = await PDFDocument.create();

  // 1. Adicionar Extrato de Repasses
  if (part1Buffer && part1Buffer.length > 0) {
    try {
      const doc1 = await PDFDocument.load(part1Buffer, { ignoreEncryption: true });
      const pages1 = await mergedPdf.copyPages(doc1, doc1.getPageIndices());
      pages1.forEach((page) => mergedPdf.addPage(page));
    } catch (err: any) {
      console.error("[Dossier] Erro ao anexar Extrato de Repasses:", err.message);
    }
  }

  // 2. Adicionar Demonstrativo de Produtividade
  if (part2Buffer && part2Buffer.length > 0) {
    try {
      const doc2 = await PDFDocument.load(part2Buffer, { ignoreEncryption: true });
      const pages2 = await mergedPdf.copyPages(doc2, doc2.getPageIndices());
      pages2.forEach((page) => mergedPdf.addPage(page));
    } catch (err: any) {
      console.error("[Dossier] Erro ao anexar Demonstrativo de Produtividade:", err.message);
    }
  }

  // 3. Adicionar Ficha de Adesão
  if (part3Buffer && part3Buffer.length > 0) {
    try {
      const doc3 = await PDFDocument.load(part3Buffer, { ignoreEncryption: true });
      const pages3 = await mergedPdf.copyPages(doc3, doc3.getPageIndices());
      pages3.forEach((page) => mergedPdf.addPage(page));
    } catch (err: any) {
      console.warn("[Dossier] Falha ao anexar páginas da Ficha de Adesão:", err.message);
      hasFichaAttached = false;
    }
  }

  const mergedBytes = await mergedPdf.save();
  const buffer = Buffer.from(mergedBytes);
  const pagesCount = mergedPdf.getPageCount();
  const filename = generateDossierFilename(coop.name || "COOPERADO");

  console.log(`[Dossier] Dossiê gerado com sucesso! Total de páginas: ${pagesCount}. Arquivo: ${filename}`);

  return {
    buffer,
    filename,
    pagesCount,
    hasFichaAttached,
  };
}

export interface BatchCooperadoItem {
  id?: number;
  originalName: string;
  found: boolean;
  name: string;
  cpf: string | null;
  matricula: string | number | null;
  contractName: string | null;
  status: string | null;
  base: "SIC" | "EasyCoop" | "Ambas" | "Não Localizado";
  hasExtrato: boolean;
  hasDemonstrativo: boolean;
  hasFicha: boolean;
  hasMissingItems: boolean;
}

export interface BatchCheckResult {
  items: BatchCooperadoItem[];
  total: number;
  foundCount: number;
  notFoundCount: number;
  completeCount: number;
  partialCount: number;
}

/**
 * Processa lote de nomes, identifica o cooperado, sua base e diagnostica a presença dos 3 relatórios
 */
export async function checkBatchDossierCooperados(rawNames: string[]): Promise<BatchCheckResult> {
  const cleanNames = Array.from(
    new Set(
      (rawNames || [])
        .map((n) => String(n || "").trim().replace(/\s+/g, " "))
        .filter((n) => n.length >= 3)
    )
  );

  const items: BatchCooperadoItem[] = [];

  for (const origName of cleanNames) {
    // 1. Busca por nome com correspondência exata ou por fragmentos
    const words = origName.split(/\s+/).filter((w) => w.length > 1);

    let sql = `
      SELECT id, document, registration_number, name, contract_name, status, sic_id
      FROM cooperados
      WHERE name = ? OR name LIKE ?
    `;
    const params: any[] = [origName, `%${origName}%`];

    if (words.length >= 2) {
      const wordClauses = words.map(() => `name LIKE ?`).join(" AND ");
      sql += ` OR (${wordClauses})`;
      words.forEach((w) => params.push(`%${w}%`));
    }

    sql += ` ORDER BY (CASE WHEN status = 'Ativo' THEN 0 ELSE 1 END) ASC, id DESC LIMIT 1`;

    let [coopRows] = await pool.query<any[]>(sql, params);
    let coop = coopRows && coopRows.length > 0 ? coopRows[0] : null;

    // Se não encontrou em cooperados, tenta buscar por nome em fichas_cadastrais
    if (!coop && words.length >= 2) {
      const [fichaNameRows] = await pool.query<any[]>(
        `SELECT id, cooperado_name AS name, cpf AS document, matricula AS registration_number, contract_name
         FROM fichas_cadastrais
         WHERE cooperado_name LIKE ?
         ORDER BY id DESC LIMIT 1`,
        [`%${origName}%`]
      );
      if (fichaNameRows && fichaNameRows.length > 0) {
        coop = {
          ...fichaNameRows[0],
          status: "Ativo",
          sic_id: null,
        };
      }
    }

    if (!coop) {
      items.push({
        originalName: origName,
        found: false,
        name: origName,
        cpf: null,
        matricula: null,
        contractName: null,
        status: null,
        base: "Não Localizado",
        hasExtrato: false,
        hasDemonstrativo: false,
        hasFicha: false,
        hasMissingItems: true,
      });
      continue;
    }

    const docDigits = (coop.document || "").replace(/\D/g, "");
    const matr = coop.registration_number ? String(coop.registration_number) : "";

    // 2. Diagnóstico da Base (SIC / EasyCoop / Ambas)
    const hasSicData = Boolean(coop.sic_id);

    let hasEasycoopData = false;
    if (docDigits) {
      const [alocRows] = await pool.query<any[]>(
        `SELECT 1 FROM easycoop_alocacoes WHERE document = ? LIMIT 1`,
        [docDigits]
      );
      const [fechRows] = await pool.query<any[]>(
        `SELECT 1 FROM easycoop_fechamentos WHERE document = ? LIMIT 1`,
        [docDigits]
      );
      hasEasycoopData = (alocRows && alocRows.length > 0) || (fechRows && fechRows.length > 0);
    }

    let base: "SIC" | "EasyCoop" | "Ambas" = "SIC";
    if (hasSicData && hasEasycoopData) {
      base = "Ambas";
    } else if (hasEasycoopData) {
      base = "EasyCoop";
    } else {
      base = "SIC";
    }

    // 3. Verificação dos 3 Relatórios
    // Relatório 1: Extrato de Repasses e Lançamentos
    let hasExtrato = false;
    if (docDigits) {
      const [extRows] = await pool.query<any[]>(
        `SELECT 1 FROM easycoop_fechamentos WHERE document = ? LIMIT 1`,
        [docDigits]
      );
      hasExtrato = Boolean(extRows && extRows.length > 0);
    }

    // Relatório 2: Demonstrativo de Produtividade e Repasse
    let hasDemonstrativo = false;
    if (docDigits) {
      const [demRows] = await pool.query<any[]>(
        `SELECT 1 FROM easycoop_fechamentos WHERE document = ? AND (ano IS NOT NULL AND mes IS NOT NULL) LIMIT 1`,
        [docDigits]
      );
      hasDemonstrativo = Boolean(demRows && demRows.length > 0);
    }

    // Relatório 3: Ficha de Adesão Easy
    let hasFicha = false;
    if (docDigits || matr) {
      const [fichaRows] = await pool.query<any[]>(
        `SELECT id FROM fichas_cadastrais
         WHERE (REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = ?
                OR (matricula IS NOT NULL AND matricula != '' AND matricula = ?))
         LIMIT 1`,
        [docDigits, matr]
      );
      hasFicha = Boolean(fichaRows && fichaRows.length > 0);
    }

    const hasMissingItems = !hasExtrato || !hasDemonstrativo || !hasFicha;

    items.push({
      id: coop.id,
      originalName: origName,
      found: true,
      name: toUpperWithAccents(coop.name),
      cpf: coop.document || null,
      matricula: coop.registration_number || "-",
      contractName: toUpperWithAccents(coop.contract_name || "NÃO INFORMADO"),
      status: coop.status || "Ativo",
      base,
      hasExtrato,
      hasDemonstrativo,
      hasFicha,
      hasMissingItems,
    });
  }

  const foundCount = items.filter((i) => i.found).length;
  const notFoundCount = items.filter((i) => !i.found).length;
  const completeCount = items.filter((i) => i.found && !i.hasMissingItems).length;
  const partialCount = items.filter((i) => i.found && i.hasMissingItems).length;

  return {
    items,
    total: items.length,
    foundCount,
    notFoundCount,
    completeCount,
    partialCount,
  };
}

