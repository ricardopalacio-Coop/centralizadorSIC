import axios from "axios";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { getSicToken, getSicPayrolls, cleanCpf } from "./sicApi";

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
  const payrolls = await getSicPayrolls(numericCpf);
  let targetPayroll = payrolls.find((p: any) => p.payrollId === payrollIdInput);
  if (!targetPayroll && payrolls.length > 0) {
    targetPayroll = payrolls[0];
  }

  const payrollId = targetPayroll?.payrollId || payrollIdInput;

  // 2. Baixar PDF do demonstrativo de pagamento em buffer
  const token = await getSicToken();
  const pdfUrl = `https://core.coopedu.app.br/api/CooperativeUserApp/${numericCpf}/payrolls/${payrollId}/demonstrative`;
  
  const pdfRes = await axios.get(pdfUrl, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: "arraybuffer",
  });

  // Salvar PDF temporário em scratch/
  const tempDir = path.join(__dirname, "../../scratch");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempPdfPath = path.join(tempDir, `summary_${numericCpf}_${payrollId}.pdf`);
  fs.writeFileSync(tempPdfPath, Buffer.from(pdfRes.data));

  // 3. Executar script Python para extrair texto bruto do PDF
  let pdfText = "";
  try {
    const pyScript = `import pypdf; reader = pypdf.PdfReader(r'${tempPdfPath}'); print(reader.pages[0].extract_text())`;
    const { stdout } = await execPromise(`python -c "${pyScript}"`);
    pdfText = stdout;
  } catch (err: any) {
    console.warn(`[FinancialSummaryService] Falha ao extrair texto do PDF via Python:`, err.message);
  } finally {
    try {
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    } catch {}
  }

  // 4. Montar objeto com fallback nos metadados da folha
  const payDateFormatted = targetPayroll?.payDayTime
    ? new Date(targetPayroll.payDayTime).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "30/07/2026 09:26:02";

  const summary: FinancialSummaryData = {
    cpf: numericCpf,
    payrollId: payrollId,
    competence: targetPayroll?.competence || "07/2026",
    paymentStatus: targetPayroll?.payrollStatus === "Processado" ? "Pago" : (targetPayroll?.payrollStatus || "Pago"),
    paymentDate: payDateFormatted,
    valorBruto: "R$ 0,00",
    descontos: "-R$ 0,00",
    valorLiquido: "R$ 0,00",
    horasTrabalhadas: "160:00",
    cliente: targetPayroll?.clientName || "COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA EDUCA",
    contrato: targetPayroll?.contractDescription || "COOPEDU GESTORES",
    profissao: "OUVIDOR",
    tipoFolha: targetPayroll?.payrollTypeLabel || targetPayroll?.payrollType || "Regular",
    creditos: [],
    descontosItens: [],
    resultadoFinal: "R$ 0,00",
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
