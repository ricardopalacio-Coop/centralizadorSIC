import axios from "axios";
import { getSicCooperadoDetails } from "./sicApi";

const DESLIGAMENTO_API_KEY = process.env.DESLIGAMENTO_API_KEY || "583ea0cb-1c5c-4a71-aae0-5a04af21ea4e";
const DESLIGAMENTO_BASE_URL = process.env.DESLIGAMENTO_BASE_URL || "https://c.coopedu.com.br";

export interface DesligamentoConsultaResult {
  cpf: string;
  formattedCpf: string;
  termination: {
    found: boolean;
    status: string;
    message?: string;
    data?: any;
  };
  proposal: {
    found: boolean;
    status: string;
    message?: string;
    data?: any;
  };
  cooperadoCadastral?: any;
}

export function cleanCpf(cpf: string): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "");
}

export function formatCpf(val: string): string {
  if (!val) return "N/I";
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 11) return val;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export async function consultarDesligamentoEProposta(cpfInput: string): Promise<DesligamentoConsultaResult> {
  const clean = cleanCpf(cpfInput);
  if (!clean || clean.length !== 11) {
    throw new Error("CPF inválido. Por favor informe um CPF contendo 11 dígitos.");
  }

  const formatted = formatCpf(clean);

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": DESLIGAMENTO_API_KEY,
    "X-API-Key": DESLIGAMENTO_API_KEY,
  };

  const result: DesligamentoConsultaResult = {
    cpf: clean,
    formattedCpf: formatted,
    termination: {
      found: false,
      status: "NENHUM_PEDIDO",
      message: "Nenhum pedido de desligamento encontrado.",
    },
    proposal: {
      found: false,
      status: "NAO_ENCONTRADA",
      message: "Nenhuma proposta cadastrada encontrada.",
    },
    cooperadoCadastral: null,
  };

  // 1. Tentar consultar /api/terminations/status nas 2 variações de formatação de CPF
  for (const cpfVariant of [formatted, clean]) {
    try {
      const res = await axios.post(
        `${DESLIGAMENTO_BASE_URL}/api/terminations/status`,
        { cpf: cpfVariant },
        { headers, timeout: 8000 }
      );

      if (res.data && res.data.success !== false) {
        result.termination = {
          found: true,
          status: res.data.data?.status || "SOLICITADO",
          message: "Pedido de desligamento encontrado no sistema.",
          data: res.data.data || res.data,
        };
        break;
      }
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error === "CPF inválido.") {
        throw new Error("CPF informado é inválido de acordo com a validação do sistema.");
      }
      if (err.response?.data?.error) {
        result.termination.message = err.response.data.error;
      }
    }
  }

  // 2. Tentar consultar /api/external/proposals nas 2 variações de formatação de CPF
  for (const cpfVariant of [formatted, clean]) {
    try {
      const res = await axios.post(
        `${DESLIGAMENTO_BASE_URL}/api/external/proposals`,
        { cpf: cpfVariant },
        { headers, timeout: 8000 }
      );

      if (res.data && res.data.success === true && res.data.data) {
        result.proposal = {
          found: true,
          status: res.data.data.status || "COMPLETA",
          message: "Proposta de vínculo localizada com sucesso.",
          data: res.data.data,
        };
        break;
      }
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error === "CPF inválido.") {
        throw new Error("CPF informado é inválido.");
      }
      if (err.response?.data?.error) {
        result.proposal.message = err.response.data.error;
      }
    }
  }

  // 3. Tentar enriquecer com dados do SIC cadastral
  try {
    const sicCadastral = await getSicCooperadoDetails(clean);
    if (sicCadastral) {
      result.cooperadoCadastral = sicCadastral;
    }
  } catch (err: any) {
    console.warn(`[DesligamentoService] Aviso ao buscar SIC cadastral para ${clean}:`, err.message);
  }

  return result;
}
