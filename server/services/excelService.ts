import * as XLSX from "xlsx";
import { cleanCpf } from "./sicApi";

export interface ParsedExcelResult {
  cpfs: string[];
  totalRows: number;
  validCpfsCount: number;
}

/**
 * Processa o buffer de um arquivo XLS/XLSX e extrai todos os CPFs válidos
 */
export function parseExcelFile(buffer: Buffer): ParsedExcelResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("O arquivo Excel enviado está vazio ou não possui planilhas válidas.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (!rows || rows.length === 0) {
    throw new Error("A planilha enviada não contém dados.");
  }

  const cpfsFound: Set<string> = new Set();
  let totalRows = rows.length;

  for (const row of rows) {
    // Procura qualquer chave na linha que contenha 'cpf' ou 'doc' no nome
    let cpfValue = "";

    for (const key of Object.keys(row)) {
      const normalizedKey = key.trim().toLowerCase();
      if (
        normalizedKey.includes("cpf") ||
        normalizedKey.includes("documento") ||
        normalizedKey.includes("doc")
      ) {
        cpfValue = String(row[key] || "");
        break;
      }
    }

    // Se não encontrou coluna de CPF explícita, verifica o primeiro valor numérico de 11 dígitos da linha
    if (!cpfValue) {
      for (const key of Object.keys(row)) {
        const val = cleanCpf(String(row[key] || ""));
        if (val.length === 11) {
          cpfValue = val;
          break;
        }
      }
    }

    const cleaned = cleanCpf(cpfValue);
    if (cleaned && cleaned.length === 11) {
      cpfsFound.add(cleaned);
    }
  }

  return {
    cpfs: Array.from(cpfsFound),
    totalRows,
    validCpfsCount: cpfsFound.size,
  };
}
