import { PDFParse } from "pdf-parse";

export interface ExtractedFichaData {
  cpf: string | null;
  cooperadoName: string;
  rawText: string;
  status: "SUCCESS" | "UNREADABLE" | "FAILED";
  errorMessage?: string;
}

/**
 * Validação oficial de dígitos verificadores do CPF (Algoritmo Módulo 11)
 */
export function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, "");
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
 * Formata CPF para o padrão 000.000.000-00
 */
export function formatCPF(cpf?: string | null): string | null {
  if (!cpf) return null;
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Extrai todos os CPFs válidos do texto bruto
 */
export function extractCpfFromText(text: string): string | null {
  if (!text) return null;

  // Busca padrões com máscara (000.000.000-00) ou apenas 11 dígitos
  const formattedMatches = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g) || [];
  for (const match of formattedMatches) {
    const raw = match.replace(/\D/g, "");
    if (isValidCPF(raw)) {
      return formatCPF(raw);
    }
  }

  // Busca sequências de 11 dígitos com separadores variados ou puros
  const generalMatches = text.match(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}\b/g) || [];
  for (const match of generalMatches) {
    const raw = match.replace(/\D/g, "");
    if (isValidCPF(raw)) {
      return formatCPF(raw);
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

  // Padrões de captura contextual nos 3 modelos de ficha
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
 * Serviço central de parsing de buffer de PDF
 */
export class FichaExtractorService {
  /**
   * Extrai texto, CPF e Nome Completo a partir do buffer de um PDF
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
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      await parser.destroy();

      const rawText = textResult?.text || "";

      if (!rawText || rawText.trim().length === 0) {
        // PDF baseado puramente em imagem digitalizada sem camada de texto OCR embutida
        return {
          cpf: null,
          cooperadoName: sanitizeName(fileName || "") || "NÃO IDENTIFICADO",
          rawText: "",
          status: "UNREADABLE",
          errorMessage: "Documento escaneado como imagem pura (sem camada de texto).",
        };
      }

      const cpf = extractCpfFromText(rawText);
      const cooperadoName = extractNameFromText(rawText, fileName);

      return {
        cpf,
        cooperadoName,
        rawText: rawText.substring(0, 3000), // Salva amostra inicial de texto
        status: cpf ? "SUCCESS" : "UNREADABLE",
        errorMessage: cpf ? undefined : "CPF não localizado no texto do documento.",
      };
    } catch (err: any) {
      console.warn(`[FichaExtractor] Falha ao processar PDF (${fileName || "sem nome"}):`, err.message);
      return {
        cpf: null,
        cooperadoName: sanitizeName(fileName || "") || "NÃO IDENTIFICADO",
        rawText: "",
        status: "FAILED",
        errorMessage: err.message || "Erro durante o parsing do PDF.",
      };
    }
  }
}
