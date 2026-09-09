import { PDFDocument } from "pdf-lib";
import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { pool } from "../db";

export interface ExtractedFichaData {
  cpf: string | null;
  cooperadoName: string;
  matricula?: string | null;
  birthDate?: string | null;
  terminationDate?: string | null;
  contractName?: string | null;
  rawText: string;
  status: "SUCCESS" | "UNREADABLE" | "FAILED";
  errorMessage?: string;
  isValidated?: boolean;
}

/**
 * Limpa e completa CPF com zeros à esquerda se tiver menos de 11 dígitos
 */
export function cleanAndPadCpf(raw: string): string {
  if (!raw) return "";
  const clean = raw.replace(/\D/g, "");
  if (clean.length === 0) return "";
  if (clean.length < 11) {
    return clean.padStart(11, "0");
  }
  return clean;
}

/**
 * Validação oficial de dígitos verificadores do CPF (Algoritmo Módulo 11)
 */
export function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  const clean = cleanAndPadCpf(cpf);
  if (clean.length !== 11) return false;

  // Rejeita sequências de dígitos repetidos conhecidas (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  let remainder = 0;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10), 10)) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(clean.substring(10, 11), 10);
}

/**
 * Formata CPF para o padrão 000.000.000-00 (completa com zeros à esquerda se faltar)
 */
export function formatCPF(cpf?: string | null): string | null {
  if (!cpf) return null;
  const clean = cleanAndPadCpf(cpf);
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Extrai CPFs válidos do texto bruto, completando com Zero à esquerda se tiver menos de 11 dígitos
 */
export function extractCpfFromText(text: string): string | null {
  if (!text) return null;

  // 1. Padrões formatados com separadores (pontos, traço ou ponto). Ex: 070.357.324-11, 70.357.324-11, 070.357.324.11
  const formattedMatches = text.match(/\b\d{1,3}\.\d{3}\.\d{3}[.-]\d{2}\b/g) || [];
  for (const match of formattedMatches) {
    const padded = cleanAndPadCpf(match);
    if (isValidCPF(padded)) {
      return formatCPF(padded);
    }
  }

  // 2. Busca sequências com separadores variados ou puros (9 a 11 dígitos). Ex: 070 357 324 11, 70 357 324 11
  const generalMatches = text.match(/\b\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}\b/g) || [];
  for (const match of generalMatches) {
    const padded = cleanAndPadCpf(match);
    if (isValidCPF(padded)) {
      return formatCPF(padded);
    }
  }

  // 3. Sequências numéricas isoladas de 9 a 11 dígitos
  const pureDigits = text.match(/\b\d{9,11}\b/g) || [];
  for (const match of pureDigits) {
    const padded = cleanAndPadCpf(match);
    if (isValidCPF(padded)) {
      return formatCPF(padded);
    }
  }

  // 4. Captura contextual diretamente após a palavra/rótulo "CPF", normalizando OCR de manuscrito
  const cpfLabelMatches = text.match(/(?:cpf|c\.p\.f\.?)\s*[:;.\s-]*\s*([0-9A-Za-z.\s\/-]{7,25})/gi) || [];
  for (const labelMatch of cpfLabelMatches) {
    const candidate = labelMatch
      .replace(/^(?:cpf|c\.p\.f\.?)\s*[:;.\s-]*/i, "")
      .replace(/[OoQqDd]/g, "0")
      .replace(/[Il|!Jj]/g, "1")
      .replace(/[Zz]/g, "2")
      .replace(/[Ss]/g, "5")
      .replace(/[Bb]/g, "8");

    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 11) {
      const padded = cleanAndPadCpf(digits);
      if (isValidCPF(padded)) {
        return formatCPF(padded);
      }
    }
  }

  return null;
}

/**
 * Limpa e sanitiza o nome extraído de formulários
 */
export function sanitizeName(name: string): string {
  if (!name) return "";

  let clean = name
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[;:,_\-|\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove rótulos residuais no início
  clean = clean.replace(
    /^(nome\s*completo|nome\s*do\s*cooperado|nome\s*do\s*candidato|nome\s*do\s*associado|nome|signat[aá]rio|assinado\s*por|assinante)\s*[:;]?\s*/i,
    ""
  );

  // Remove sufixos residuais e palavras de transição comuns
  clean = clean.replace(
    /\s+(inscrito|inscrita|portador|portadora|brasileiro|brasileira|sob|nº|n°|do\s+cpf|no\s+cpf|cpf|rg|data|nascimento|cargo|funcao|função|matricula|matrícula|telefone|email|e-mail|endereco|endereço|assinado|digitalmente|via|plugsign|em\s+\d).*$/i,
    ""
  );
  clean = clean.trim();

  // Se o nome tiver menos de 2 palavras ou menos de 5 letras, descarta se for lixo
  const words = clean.split(" ").filter((w) => w.length > 1);
  if (words.length < 2 && clean.length < 6) {
    return "";
  }

  return clean.toUpperCase();
}

/**
 * Extrai o Nome Completo do cooperado a partir do texto do PDF
 */
export function extractNameFromText(text: string, fallbackName?: string): string {
  if (!text) return sanitizeName(fallbackName || "") || "NÃO IDENTIFICADO";

  // Lista de palavras institucionais que não podem ser o nome do cooperado
  const blacklistWords = [
    "COOPEDU",
    "COOPERATIVA",
    "PROFISSIONAIS",
    "PROPOSTA DE ADESAO",
    "PROPOSTA DE ADESÃO",
    "FICHA CADASTRAL",
    "FICHA DE ADESÃO",
    "FICHA DE ADESAO",
    "TERMO DE RESCISAO",
    "TERMO DE RESCISÃO",
    "PLUGSIGN",
    "EASYCOOP",
    "ASSINACOOP",
    "CENTRALIZADOR",
    "DOCUMENTO ASSINADO",
    "SISTEMA INTEGRADO",
  ];

  // Padrões de captura contextual nos modelos de ficha
  const patterns = [
    // Padrão 1: "Nome Completo: [NOME]" ou "Nome do Cooperado: [NOME]"
    /(?:nome\s*completo|nome\s*do\s*cooperado|nome\s*do\s*candidato|nome\s*do\s*associado)\s*[:;]\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{4,70}?)(?=\s*(?:\n|\r|cpf|rg|data|nasc|cargo|funcao|matricula|email|telefone|estado|$))/i,

    // Padrão 2: "1. DADOS PESSOAIS DO CANDIDATO\nNome: [NOME]"
    /(?:1\.\s*dados\s*pessoais[^\n]*\n+)?(?:nome)\s*[:;]\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{4,70}?)(?=\s*(?:\n|\r|cpf|rg|data|nasc|cargo|funcao|matricula|email|telefone|estado|$))/i,

    // Padrão 3: "Eu, [NOME], portador do CPF" (Comum em termos e fichas manuais)
    /eu\s*,\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{5,70}?)\s*,\s*(?:inscrito|inscrita|portador|portadora|brasileiro|brasileira|cooperado)/i,

    // Padrão 4: Assinatura eletrônica / Signatário: "[NOME]"
    /(?:signat[aá]rio|assinado\s*por|assinante)\s*[:;]\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{5,70}?)(?=\s*(?:\n|\r|inscrito|cpf|email|em|data|$))/i,

    // Padrão 5: "DADOS DO PROPONENTE / CANDIDATO\n[NOME]"
    /(?:dados\s*do\s*(?:proponente|candidato|cooperado))\s*\n+([A-Za-zÀ-ÖØ-öø-ÿ\s]{5,70}?)\n+/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = sanitizeName(match[1]);
      if (candidate.length >= 5) {
        const isBlacklisted = blacklistWords.some((bad) => candidate.includes(bad));
        if (!isBlacklisted) {
          return candidate;
        }
      }
    }
  }

  // Se não localizou no texto estruturado, usa o nome do arquivo se fornecido
  if (fallbackName) {
    const cleanedFallback = sanitizeName(fallbackName);
    if (cleanedFallback.length >= 4) {
      return cleanedFallback;
    }
  }

  return "NÃO IDENTIFICADO";
}

/**
 * Serviço central de parsing e extração de PDF focado estritamente na Página 1
 */
export class FichaExtractorService {
  /**
   * Isola estritamente a primeira página (página index 0) de um PDF buffer
   */
  public static async extractPage1PdfBuffer(buffer: Buffer): Promise<Buffer> {
    try {
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      if (srcDoc.getPageCount() <= 1) {
        return buffer;
      }
      const singlePageDoc = await PDFDocument.create();
      const [page0] = await singlePageDoc.copyPages(srcDoc, [0]);
      singlePageDoc.addPage(page0);
      const pdfBytes = await singlePageDoc.save();
      return Buffer.from(pdfBytes);
    } catch (err: any) {
      console.warn("[FichaExtractor] Aviso ao fatiar página 1 com pdf-lib:", err.message);
      return buffer;
    }
  }

  /**
   * Renderiza a primeira página do PDF para uma imagem PNG em alta definição para OCR (com suporte a rotação 0°, 180°, etc.)
   */
  public static async renderPage1ToImage(pdfBuffer: Buffer, rotation: number = 0): Promise<Buffer | null> {
    return new Promise((resolve) => {
      try {
        const scriptPath = path.resolve(__dirname, "../scripts/render_page.py");
        const tempPdfPath = path.join(
          os.tmpdir(),
          `ficha_page1_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`
        );
        const tempPngPath = tempPdfPath.replace(".pdf", ".png");

        fs.writeFileSync(tempPdfPath, pdfBuffer);

        const pyProcess = spawn("python", [scriptPath, tempPdfPath, tempPngPath, String(rotation)]);

        const timer = setTimeout(() => {
          try { pyProcess.kill(); } catch (e) {}
          try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (e) {}
          try { if (fs.existsSync(tempPngPath)) fs.unlinkSync(tempPngPath); } catch (e) {}
          resolve(null);
        }, 15000);

        pyProcess.on("close", (code) => {
          clearTimeout(timer);
          try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (e) {}

          if (code === 0 && fs.existsSync(tempPngPath)) {
            const pngBuffer = fs.readFileSync(tempPngPath);
            try { fs.unlinkSync(tempPngPath); } catch (e) {}
            resolve(pngBuffer);
          } else {
            try { if (fs.existsSync(tempPngPath)) fs.unlinkSync(tempPngPath); } catch (e) {}
            resolve(null);
          }
        });

        pyProcess.on("error", (e) => {
          clearTimeout(timer);
          try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (e) {}
          try { if (fs.existsSync(tempPngPath)) fs.unlinkSync(tempPngPath); } catch (e) {}
          console.warn("[FichaExtractor] Falha ao acionar renderizador Python:", e.message);
          resolve(null);
        });
      } catch (err: any) {
        console.warn("[FichaExtractor] Erro na renderização de imagem para OCR:", err.message);
        resolve(null);
      }
    });
  }

  /**
   * Consulta a base mestre de cooperados pelo CPF para validar o Nome Completo oficial
   * e trazer Matrícula, Data de Nascimento, Data de Desligamento e Contrato Principal Operacional
   */
  public static async lookupAndValidateCooperado(cpf: string): Promise<{
    isValidated: boolean;
    name?: string;
    matricula?: string;
    birthDate?: string;
    terminationDate?: string;
    contractName?: string;
  }> {
    if (!cpf) return { isValidated: false };
    const cleanDoc = cleanAndPadCpf(cpf);
    if (cleanDoc.length !== 11) return { isValidated: false };

    try {
      const [rows]: [any[], any] = await pool.query(
        `SELECT c.name, c.registration_number, c.birth_date, c.termination_date, c.contract_name
         FROM cooperados c
         WHERE c.document = ?
         LIMIT 1;`,
        [cleanDoc]
      );

      if (rows && rows.length > 0) {
        const c = rows[0];
        let birthDateStr: string | undefined = undefined;
        if (c.birth_date) {
          birthDateStr = c.birth_date instanceof Date
            ? c.birth_date.toISOString().split("T")[0]
            : String(c.birth_date).split("T")[0];
        }
        let termDateStr: string | undefined = undefined;
        if (c.termination_date) {
          termDateStr = c.termination_date instanceof Date
            ? c.termination_date.toISOString().split("T")[0]
            : String(c.termination_date).split("T")[0];
        }

        // Tenta buscar o contrato operacional real na tabela easycoop_alocacoes
        let resolvedContract = c.contract_name || undefined;
        try {
          const [alocRows]: [any[], any] = await pool.query(
            `SELECT COALESCE(NULLIF(a.contrato_descricao, ''), a.tomador_nome) AS contrato_operacional
             FROM easycoop_alocacoes a
             WHERE a.document = ?
             ORDER BY 
               (CASE WHEN a.status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC,
               (CASE 
                 WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%DESCANSO%' OR UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%DAR%' THEN 4
                 WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%SOBRA%' THEN 3
                 WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%COORDENA%' THEN 2
                 WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%COOPEDU%' THEN 2
                 ELSE 1
               END) ASC,
               a.data_inicio DESC,
               a.id DESC
             LIMIT 1;`,
            [cleanDoc]
          );
          if (alocRows && alocRows.length > 0 && alocRows[0].contrato_operacional) {
            resolvedContract = String(alocRows[0].contrato_operacional).trim();
          }
        } catch (e) {}

        return {
          isValidated: true,
          name: c.name?.trim().toUpperCase(),
          matricula: c.registration_number ? String(c.registration_number) : undefined,
          birthDate: birthDateStr,
          terminationDate: termDateStr,
          contractName: resolvedContract,
        };
      }
    } catch (err: any) {
      console.warn("[FichaExtractor] Falha na consulta de cooperado por CPF:", err.message);
    }

    return { isValidated: false };
  }

  /**
   * Tenta localizar o cooperado através de pistas contextuais (Matrícula ou Nome no arquivo/texto)
   * quando a leitura direta do CPF manuscrito estiver ilegível pelo OCR
   */
  public static async lookupCooperadoByClues(
    fileName?: string,
    rawText?: string
  ): Promise<{
    isValidated: boolean;
    cpf?: string;
    name?: string;
    matricula?: string;
    birthDate?: string;
    terminationDate?: string;
    contractName?: string;
  }> {
    const combined = `${fileName || ""} ${rawText || ""}`.trim();
    if (!combined) return { isValidated: false };

    try {
      const cleanFileName = (fileName || "").replace(/\.pdf$/i, "");

      // 1. Tenta extrair matrícula numérica (3 a 6 dígitos) do nome do arquivo ou do texto
      const matriculaMatches = `${cleanFileName} ${rawText || ""}`.match(/\b(\d{3,6})\b/g) || [];
      for (const mat of matriculaMatches) {
        const [rows]: [any[], any] = await pool.query(
          `SELECT c.name, c.document, c.registration_number, c.birth_date, c.termination_date, c.contract_name
           FROM cooperados c
           WHERE c.registration_number = ?
           LIMIT 1;`,
          [mat]
        );

        if (rows && rows.length > 0) {
          const c = rows[0];
          // Validação de segurança: verifica se partes do nome do cooperado batem com o arquivo ou texto
          const cNameUpper = (c.name || "").toUpperCase();
          const targetUpper = `${cleanFileName} ${rawText || ""}`.toUpperCase();
          const nameTokens = cNameUpper.split(" ").filter((t: string) => t.length > 2);
          const hasNameOverlap = nameTokens.some((t: string) => targetUpper.includes(t));

          if (hasNameOverlap || !fileName) {
            let birthDateStr: string | undefined = undefined;
            if (c.birth_date) {
              birthDateStr = c.birth_date instanceof Date
                ? c.birth_date.toISOString().split("T")[0]
                : String(c.birth_date).split("T")[0];
            }
            let termDateStr: string | undefined = undefined;
            if (c.termination_date) {
              termDateStr = c.termination_date instanceof Date
                ? c.termination_date.toISOString().split("T")[0]
                : String(c.termination_date).split("T")[0];
            }
            let resolvedContract = c.contract_name || undefined;
            try {
              const [alocRows]: [any[], any] = await pool.query(
                `SELECT COALESCE(NULLIF(a.contrato_descricao, ''), a.tomador_nome) AS contrato_operacional
                 FROM easycoop_alocacoes a
                 WHERE a.document = ?
                 ORDER BY 
                   (CASE WHEN a.status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC,
                   (CASE 
                     WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%DESCANSO%' OR UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%DAR%' THEN 4
                     WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%SOBRA%' THEN 3
                     WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%COORDENA%' THEN 2
                     WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%COOPEDU%' THEN 2
                     ELSE 1
                   END) ASC,
                   a.data_inicio DESC,
                   a.id DESC
                 LIMIT 1;`,
                [c.document]
              );
              if (alocRows && alocRows.length > 0 && alocRows[0].contrato_operacional) {
                resolvedContract = String(alocRows[0].contrato_operacional).trim();
              }
            } catch (e) {}

            return {
              isValidated: true,
              cpf: formatCPF(c.document) || undefined,
              name: c.name?.trim().toUpperCase(),
              matricula: String(c.registration_number),
              birthDate: birthDateStr,
              terminationDate: termDateStr,
              contractName: resolvedContract,
            };
          }
        }
      }

      // 2. Se não localizou por matrícula, tenta correspondência por Nome no arquivo
      const nameCandidate = sanitizeName(cleanFileName.replace(/\b\d{3,6}\b/g, ""));
      if (nameCandidate && nameCandidate.length >= 6) {
        const nameParts = nameCandidate.split(" ").filter((p: string) => p.length > 2);
        if (nameParts.length >= 2) {
          const searchLike = `%${nameParts[0]}%${nameParts[nameParts.length - 1]}%`;
          const [rows]: [any[], any] = await pool.query(
            `SELECT c.name, c.document, c.registration_number, c.birth_date, c.termination_date, c.contract_name
             FROM cooperados c
             WHERE c.name LIKE ?
             LIMIT 2;`,
            [searchLike]
          );

          if (rows && rows.length === 1) {
            const c = rows[0];
            let birthDateStr: string | undefined = undefined;
            if (c.birth_date) {
              birthDateStr = c.birth_date instanceof Date
                ? c.birth_date.toISOString().split("T")[0]
                : String(c.birth_date).split("T")[0];
            }
            let termDateStr: string | undefined = undefined;
            if (c.termination_date) {
              termDateStr = c.termination_date instanceof Date
                ? c.termination_date.toISOString().split("T")[0]
                : String(c.termination_date).split("T")[0];
            }
            let resolvedContract = c.contract_name || undefined;
            try {
              const [alocRows]: [any[], any] = await pool.query(
                `SELECT COALESCE(NULLIF(a.contrato_descricao, ''), a.tomador_nome) AS contrato_operacional
                 FROM easycoop_alocacoes a
                 WHERE a.document = ?
                 ORDER BY 
                   (CASE WHEN a.status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC,
                   (CASE 
                     WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%DESCANSO%' OR UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%DAR%' THEN 4
                     WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%SOBRA%' THEN 3
                     WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%COORDENA%' THEN 2
                     WHEN UPPER(COALESCE(a.contrato_descricao, a.tomador_nome, '')) LIKE '%COOPEDU%' THEN 2
                     ELSE 1
                   END) ASC,
                   a.data_inicio DESC,
                   a.id DESC
                 LIMIT 1;`,
                [c.document]
              );
              if (alocRows && alocRows.length > 0 && alocRows[0].contrato_operacional) {
                resolvedContract = String(alocRows[0].contrato_operacional).trim();
              }
            } catch (e) {}

            return {
              isValidated: true,
              cpf: formatCPF(c.document) || undefined,
              name: c.name?.trim().toUpperCase(),
              matricula: c.registration_number ? String(c.registration_number) : undefined,
              birthDate: birthDateStr,
              terminationDate: termDateStr,
              contractName: resolvedContract,
            };
          }
        }
      }
    } catch (err: any) {
      console.warn("[FichaExtractor] Falha no fallback por pistas contextuais:", err.message);
    }

    return { isValidated: false };
  }

  /**
   * Extrai texto, CPF e valida o Nome Completo exclusivamente a partir da PRIMEIRA PÁGINA do PDF
   * (com suporte a páginas invertidas 180° e rotações 90°/270°)
   */
  public static async parsePdfBuffer(
    buffer: Buffer,
    fileName?: string
  ): Promise<ExtractedFichaData> {
    if (!buffer || buffer.length === 0) {
      return {
        cpf: null,
        cooperadoName: sanitizeName(fileName || "") || "NÃO IDENTIFICADO",
        rawText: "",
        status: "UNREADABLE",
        errorMessage: "Buffer de arquivo vazio.",
      };
    }

    try {
      // 1. Isola estritamente a Página 1 do PDF
      const page1Buffer = await this.extractPage1PdfBuffer(buffer);

      let rawText = "";
      let cpf: string | null = null;

      // 2. Tenta extrair texto nativo digital da página 1 via pdf-parse
      try {
        const parser = new PDFParse({ data: page1Buffer });
        const textResult = await parser.getText();
        await parser.destroy();
        rawText = textResult?.text || "";
        cpf = extractCpfFromText(rawText);
      } catch (parseErr: any) {
        console.warn(`[FichaExtractor] Aviso de parsing nativo na pág 1 (${fileName || "doc"}):`, parseErr.message);
      }

      // 3. Se não houver texto suficiente ou não encontrar CPF, executa OCR na Página 1 (0° normal)
      if (!cpf || rawText.trim().length < 15) {
        console.log(`[FichaExtractor] Executando OCR na página 1 (0°): ${fileName || "documento"}`);
        const imageBuffer0 = await this.renderPage1ToImage(page1Buffer, 0);
        if (imageBuffer0) {
          try {
            const ocrResult = await Tesseract.recognize(imageBuffer0, "por");
            const ocrText = ocrResult?.data?.text || "";
            if (ocrText.trim().length > 0) {
              rawText = (rawText ? rawText + "\n[OCR 0°]\n" : "") + ocrText;
              const ocrCpf = extractCpfFromText(ocrText);
              if (ocrCpf) {
                cpf = ocrCpf;
              }
            }
          } catch (ocrErr: any) {
            console.warn(`[FichaExtractor] Falha no Tesseract OCR 0° (${fileName}):`, ocrErr.message);
          }
        }

        // 3.1 Se não encontrou CPF a 0°, testa rotação de 180° (página de ponta cabeça!)
        if (!cpf) {
          console.log(`[FichaExtractor] CPF não localizado a 0°. Testando OCR rotacionado 180° (ponta cabeça): ${fileName || "documento"}`);
          const imageBuffer180 = await this.renderPage1ToImage(page1Buffer, 180);
          if (imageBuffer180) {
            try {
              const ocrResult180 = await Tesseract.recognize(imageBuffer180, "por");
              const ocrText180 = ocrResult180?.data?.text || "";
              if (ocrText180.trim().length > 0) {
                rawText = (rawText ? rawText + "\n[OCR 180°]\n" : "") + ocrText180;
                const ocrCpf180 = extractCpfFromText(ocrText180);
                if (ocrCpf180) {
                  cpf = ocrCpf180;
                }
              }
            } catch (ocrErr: any) {
              console.warn(`[FichaExtractor] Falha no Tesseract OCR 180° (${fileName}):`, ocrErr.message);
            }
          }
        }
      }

      // 4. Se ainda não encontrou CPF, tenta fallback inteligente cruzando Matrícula / Nome com a base cooperados
      let cooperadoName = extractNameFromText(rawText, fileName);
      let matricula: string | null = null;
      let birthDate: string | null = null;
      let terminationDate: string | null = null;
      let contractName: string | null = null;
      let isValidated = false;

      if (!cpf) {
        const clues = await this.lookupCooperadoByClues(fileName, rawText);
        if (clues.isValidated && clues.cpf) {
          cpf = clues.cpf;
          cooperadoName = clues.name || cooperadoName;
          matricula = clues.matricula || null;
          birthDate = clues.birthDate || null;
          terminationDate = clues.terminationDate || null;
          contractName = clues.contractName || null;
          isValidated = true;
          console.log(`[FichaExtractor] Cooperado localizado via pistas (Matrícula/Nome): ${cooperadoName} | CPF: ${cpf}`);
        }
      }

      // 5. Se encontrou CPF válido e ainda não foi validado, cruza com a base de cooperados
      if (cpf && !isValidated) {
        const validated = await this.lookupAndValidateCooperado(cpf);
        if (validated.isValidated && validated.name) {
          cooperadoName = validated.name; // Nome Completo 100% validado pela base oficial
          matricula = validated.matricula || null;
          birthDate = validated.birthDate || null;
          terminationDate = validated.terminationDate || null;
          contractName = validated.contractName || null;
          isValidated = true;
        }
      }

      return {
        cpf,
        cooperadoName,
        matricula,
        birthDate,
        terminationDate,
        contractName,
        isValidated,
        rawText: rawText.substring(0, 3000),
        status: cpf ? "SUCCESS" : "UNREADABLE",
        errorMessage: cpf ? undefined : "CPF não localizado na primeira página do documento.",
      };
    } catch (err: any) {
      console.warn(`[FichaExtractor] Falha ao processar PDF (${fileName || "sem nome"}):`, err.message);
      return {
        cpf: null,
        cooperadoName: sanitizeName(fileName || "") || "NÃO IDENTIFICADO",
        rawText: "",
        status: "FAILED",
        errorMessage: err.message || "Erro durante o processamento da página 1 do PDF.",
      };
    }
  }
}
