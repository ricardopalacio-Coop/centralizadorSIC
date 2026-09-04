import axios from "axios";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { getSicToken, getSicPayrolls, cleanCpf } from "./sicApi";
import { getAuthenticatedSicSession } from "./sicBrowserAutomation";

const execPromise = util.promisify(exec);

export interface FinancialSummaryItem {
  codigo: string;
  descricao: string;
  parcelInfo?: string;
  valor: string;
  tipo: "credito" | "debito";
}

export interface FinancialSummaryData {
  cpf: string;
  payrollId: string;
  competence: string;
  paymentStatus: string;
  paymentDate: string;
  valorBruto: string;
  descontos: string;
  valorLiquido: string;
  horasTrabalhadas: string;
  cliente: string;
  contrato: string;
  profissao: string;
  tipoFolha: string;
  creditos: FinancialSummaryItem[];
  descontosItens: FinancialSummaryItem[];
  resultadoFinal: string;
}

export async function getFinancialSummary(
  cpfInput: string,
  payrollIdInput: string
): Promise<FinancialSummaryData> {
  const numericCpf = cleanCpf(cpfInput);
  if (!numericCpf || numericCpf.length !== 11) {
    throw new Error("CPF inválido para consulta do resumo financeiro.");
  }

  // 1. Obter lista de folhas do cooperado no SIC para encontrar a folha target
  let payrolls: any[] = [];
  try {
    payrolls = await getSicPayrolls(numericCpf);
  } catch (e) {}

  let targetPayroll = payrolls.find((p: any) => 
    p.payrollId === payrollIdInput || 
    p.id === payrollIdInput || 
    p.competence === payrollIdInput ||
    (payrollIdInput.includes("-") && String(p.payrollId).includes(payrollIdInput.split("-").pop() || ""))
  );
  if (!targetPayroll && payrolls.length > 0) {
    targetPayroll = payrolls[0];
  }

  const payrollId = targetPayroll?.payrollId || payrollIdInput;

  // 2. Tentar baixar PDF do demonstrativo via M2M
  let tempPdfPath = "";
  let pdfText = "";

  try {
    const token = await getSicToken();
    const pdfUrl = `https://core.coopedu.app.br/api/CooperativeUserApp/${numericCpf}/payrolls/${payrollId}/demonstrative`;

    const pdfRes = await axios.get(pdfUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
      timeout: 8000,
    });

    const tempDir = path.join(__dirname, "../../scratch");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    tempPdfPath = path.join(tempDir, `summary_${numericCpf}_${payrollId}.pdf`);
    fs.writeFileSync(tempPdfPath, Buffer.from(pdfRes.data));

    const pyScript = `import pypdf; reader = pypdf.PdfReader(r'${tempPdfPath}'); print(reader.pages[0].extract_text())`;
    const { stdout } = await execPromise(`python -c "${pyScript}"`);
    pdfText = stdout;
  } catch (err: any) {
    console.warn(`[FinancialSummaryService] PDF M2M indisponível para CPF ${numericCpf}:`, err.message);
  } finally {
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try { fs.unlinkSync(tempPdfPath); } catch {}
    }
  }

  // 3. Tentar carregar dados detalhados diretamente da API do Portal UI (quando o PDF M2M estiver inacessível)
  let portalDetails: any = null;
  try {
    const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
    const headers = { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader };

    const searchRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}`, { headers, timeout: 5000 });
    const items = searchRes.data?.body?.items || searchRes.data?.items || [];
    const item = items.find((i: any) => cleanCpf(i.documents?.identification || i.document || i.cpf) === numericCpf);

    if (item && item.id) {
      const payListRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/${item.id}/financeiro/pagamentos?pageNumber=1&pageSize=100`, { headers, timeout: 5000 });
      const payments = payListRes.data?.body?.items || payListRes.data?.items || [];
      const matched = payments.find((p: any) => p.payrollId === payrollId || p.paymentId === payrollId || p.competence === targetPayroll?.competence);

      if (matched && matched.paymentId) {
        const detailsRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/${item.id}/financeiro/pagamentos/${matched.paymentId}`, { headers, timeout: 5000 });
        portalDetails = detailsRes.data?.body || detailsRes.data;
      }
    }
  } catch (e: any) {
    console.warn(`[FinancialSummaryService] Consulta estendida ao Portal UI indisponível:`, e.message);
  }

  // 4. Montar objeto consolidado do resumo financeiro
  let localPos = "";
  let localContract = "";
  try {
    const { pool } = require("../db");
    const [coopRows] = await pool.query("SELECT position, contract_name FROM cooperados WHERE document = ?", [numericCpf]);
    if (coopRows && coopRows[0]) {
      localPos = coopRows[0].position || "";
      localContract = coopRows[0].contract_name || "";
    }
  } catch (e) {}

  const grossValNum = portalDetails?.grossValue || targetPayroll?.grossValue || 0;
  const discValNum = portalDetails?.discounts || targetPayroll?.discounts || 0;
  const netValNum = portalDetails?.netValue || targetPayroll?.netValue || 0;

  const fmtGross = grossValNum > 0 ? `R$ ${Number(grossValNum).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "R$ 0,00";
  const fmtDisc = discValNum > 0 ? `-R$ ${Number(discValNum).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-R$ 0,00";
  const fmtNet = netValNum > 0 ? `R$ ${Number(netValNum).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "R$ 0,00";

  const rawPayDate = portalDetails?.payDayTime || targetPayroll?.payDayTime;
  const payDateFormatted = rawPayDate
    ? new Date(rawPayDate).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "NÃO INFORMADO";

  const creditosArr: FinancialSummaryItem[] = [];
  const descontosArr: FinancialSummaryItem[] = [];

  if (portalDetails && Array.isArray(portalDetails.entries)) {
    for (const entry of portalDetails.entries) {
      if (entry.credits && Number(entry.credits) > 0) {
        creditosArr.push({
          codigo: String(entry.registrationCode || ""),
          descricao: entry.description || "Produtividade / Repasse",
          valor: `R$ ${Number(entry.credits).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          tipo: "credito",
        });
      }
      if (entry.debits && Number(entry.debits) > 0) {
        let parc = "";
        if (entry.installments) {
          parc = `Parcela ${entry.installmentNumber || 1}/${entry.installments}`;
        }
        descontosArr.push({
          codigo: String(entry.registrationCode || ""),
          descricao: entry.description || "Desconto",
          parcelInfo: parc,
          valor: `-R$ ${Number(entry.debits).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          tipo: "debito",
        });
      }
    }
  }

  const summary: FinancialSummaryData = {
    cpf: numericCpf,
    payrollId: payrollId,
    competence: portalDetails?.competence || targetPayroll?.competence || "",
    paymentStatus: portalDetails?.paymentStatus || targetPayroll?.payrollStatus || "Pago",
    paymentDate: payDateFormatted,
    valorBruto: fmtGross,
    descontos: fmtDisc,
    valorLiquido: fmtNet,
    horasTrabalhadas: `${portalDetails?.workedHours || targetPayroll?.workedHours || 160}:00`,
    cliente: portalDetails?.clientName || targetPayroll?.clientName || localContract || "",
    contrato: portalDetails?.contractDescription || targetPayroll?.contractDescription || localContract || "",
    profissao: portalDetails?.professionName || localPos || "",
    tipoFolha: portalDetails?.payrollTypeLabel || targetPayroll?.payrollTypeLabel || "Regular",
    creditos: creditosArr.length > 0 ? creditosArr : (grossValNum > 0 ? [{ codigo: "0001", descricao: "Produtividade / Repasse", valor: fmtGross, tipo: "credito" }] : []),
    descontosItens: descontosArr,
    resultadoFinal: fmtNet,
  };

  if (!pdfText) {
    return summary;
  }

  // Extrair Profissão
  const profMatch = pdfText.match(/Profiss[aãio\uFFFD]+[\r\n]+\s*([^\r\n]+)/i);
  if (profMatch && profMatch[1].trim()) {
    summary.profissao = profMatch[1].trim().replace(/\uFFFD/g, "Ç");
  }

  // Extrair Contratante / Cliente
  const clienteMatch = pdfText.match(/Contratante[^\r\n]*[\r\n]+\s*([^\r\n]+)/i);
  if (clienteMatch && clienteMatch[1].trim()) {
    summary.cliente = clienteMatch[1].trim();
  }

  // Extrair Valores Totais (Bruto e Descontos)
  const totaisMatch = pdfText.match(/Valores\s+totais\s+R\$\s*([\d\.,]+)\s+R\$\s*([\d\.,]+)/i);
  if (totaisMatch) {
    summary.valorBruto = `R$ ${totaisMatch[1]}`;
    summary.descontos = `-R$ ${totaisMatch[2]}`;
  }

  // Extrair Total Líquido
  const liqMatch = pdfText.match(/TOTAL\s+L[ÍI\uFFFD]+QUIDO\s*[\r\n]+\s*R\$\s*([\d\.,]+)/i);
  if (liqMatch) {
    summary.valorLiquido = `R$ ${liqMatch[1]}`;
    summary.resultadoFinal = `R$ ${liqMatch[1]}`;
  }

  // Extrair itens individuais
  const lines = pdfText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    // PRODUTIVIDADE Base
    if (/PRODUTIVIDADE/i.test(trimmed) && /[\d\.,]+/.test(trimmed)) {
      const matchVal = trimmed.match(/([\d\.]+,\d{2})/);
      if (matchVal) {
        summary.creditos.push({
          codigo: "",
          descricao: "Produtividade",
          valor: `R$ ${matchVal[1]}`,
          tipo: "credito",
        });
      }
    }

    // Linhas com códigos numéricos (0010, 0012, 0013, 0019, 0022, 0024, 0032, 0033, 0034, etc.)
    const codeMatch = trimmed.match(/^(\d{4})\s+(.+)$/);
    if (codeMatch) {
      const codigo = codeMatch[1];
      let rawRest = codeMatch[2].trim();

      const valMatch = rawRest.match(/([\d\.]+,\d{2})/g);
      if (valMatch && valMatch.length > 0) {
        const valorNumStr = valMatch[valMatch.length - 1];
        const numVal = parseFloat(valorNumStr.replace(/\./g, "").replace(",", "."));

        if (numVal > 0) {
          // Limpeza do nome do item
          let desc = rawRest
            .replace(/([\d\.]+,\d{2})/g, "")
            .replace(/1,00/g, "")
            .replace(/[^\w\s\(\)\/-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          // Formatar maiúsculas / acentos comuns
          desc = desc
            .replace(/Empr\s*stimo/i, "Empréstimo")
            .replace(/EMPRESTIMO/i, "Empréstimo")
            .replace(/Aux\s*lio\s*Alimenta\s*o/i, "Auxílio Alimentação")
            .replace(/ALIMENTACAO/i, "Alimentação")
            .replace(/AUXILIO\s*HABITACAO/i, "AUXÍLIO HABITAÇÃO")
            .replace(/HABITACAO/i, "Habitação");

          const isDebito = /0010|0012|0024|0039|INSS|IRRF|EMPRESTIMO|QUOTA|DESCONTO/i.test(codigo + " " + desc);

          if (isDebito) {
            let parcelInfo = "";
            const parcMatch = desc.match(/\((\d+\/\d+)\)/);
            if (parcMatch) {
              parcelInfo = `Parcela ${parcMatch[1]}`;
            }

            summary.descontosItens.push({
              codigo: codigo,
              descricao: desc || "Desconto",
              parcelInfo: parcelInfo,
              valor: `-R$ ${valorNumStr}`,
              tipo: "debito",
            });
          } else {
            summary.creditos.push({
              codigo: codigo,
              descricao: desc || "Crédito",
              valor: `R$ ${valorNumStr}`,
              tipo: "credito",
            });
          }
        }
      }
    }
  }

  return summary;
}
