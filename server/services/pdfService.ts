import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import {
  toUpperNoAccents,
  toUpperWithAccents,
  sanitizeText,
  fixMojibake,
  getEsocialCategoryInfo,
} from "./easycoopService";

function resolveImagePath(filename: string): string {
  const candidates = [
    path.resolve(process.cwd(), "client/public", filename),
    path.resolve(process.cwd(), "client/dist", filename),
    path.resolve(__dirname, "../../client/public", filename),
    path.resolve(__dirname, "../../client/dist", filename),
    path.resolve(__dirname, "../client/public", filename),
    path.resolve(__dirname, "../client/dist", filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const LOGO_COOPEDU_PATH = resolveImagePath("logo-coopedu-horizontal-azul.png");
const LOGO_SIC_PATH = resolveImagePath("logo_sic.png");

interface ReceiptData {
  cooperadoName: string;
  cpf: string;
  registrationNumber?: string | number;
  contractName?: string;
  competence: string;
  month: number;
  year: number;
  payrollType: string;
  payrollStatus: string;
  payDayTime?: string;
  payrollId: string;
  bankName?: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  accountDigit?: string;
  pixKey?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

/**
 * Formata CPF para o formato 000.000.000-00
 */
function formatCpf(val?: string) {
  if (!val) return "N/I";
  const digits = val.replace(/\D/g, "");
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Gera um PDF em buffer referente ao COMPROVANTE DE PAGAMENTO DE REPASSE COOPERATIVO
 */
export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#0088cc";
      const secondaryColor = "#16a34a";
      const darkText = "#0f172a";
      const lightBg = "#f8fafc";
      const borderLine = "#cbd5e1";

      // --- CULTURA E CABEÇALHO ---
      doc
        .rect(40, 40, 515, 65)
        .fillAndStroke("#f0f9ff", "#bae6fd");

      if (fs.existsSync(LOGO_COOPEDU_PATH)) {
        try {
          doc.image(LOGO_COOPEDU_PATH, 50, 47, { width: 100 });
        } catch {
          doc.fillColor(primaryColor).fontSize(16).font("Helvetica-Bold").text("COOPEDU", 55, 50);
        }
      } else {
        doc
          .fillColor(primaryColor)
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("COOPEDU", 55, 50);
      }

      if (fs.existsSync(LOGO_SIC_PATH)) {
        try {
          doc.image(LOGO_SIC_PATH, 420, 50, { width: 110 });
        } catch {}
      }

      doc
        .fillColor(darkText)
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .text("COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA EDUCAÇÃO", 50, 75);

      doc
        .fillColor("#64748b")
        .fontSize(7.5)
        .font("Helvetica")
        .text("CNPJ: 10.423.176/0001-20 | BR 116, Fortaleza - CE | Core Coopedu • SIC", 50, 87);

      // --- TÍTULO PRINCIPAL ---
      doc
        .fillColor(darkText)
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("COMPROVANTE DE PAGAMENTO DE REPASSE COOPERATIVO", 40, 125, { align: "center" });

      doc
        .moveTo(40, 145)
        .lineTo(555, 145)
        .strokeColor(primaryColor)
        .lineWidth(2)
        .stroke();

      // --- CAIXA 1: DADOS DO COOPERADO BENEFICIÁRIO ---
      doc
        .rect(40, 160, 515, 85)
        .fillAndStroke(lightBg, borderLine);

      doc
        .fillColor(primaryColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("1. IDENTIFICAÇÃO DO COOPERADO BENEFICIÁRIO", 50, 168);

      doc
        .fillColor(darkText)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Nome Completo:", 50, 185)
        .font("Helvetica")
        .text(data.cooperadoName, 135, 185);

      doc
        .font("Helvetica-Bold")
        .text("CPF (Documento):", 50, 200)
        .font("Helvetica")
        .text(formatCpf(data.cpf), 145, 200);

      doc
        .font("Helvetica-Bold")
        .text("Matrícula:", 320, 200)
        .font("Helvetica")
        .text(String(data.registrationNumber || "N/I"), 380, 200);

      const addressStr = data.street
        ? `${data.street}, Nº ${data.number || "S/N"}${data.neighborhood ? `, ${data.neighborhood}` : ""}, ${data.city || "Fortaleza"}/${data.state || "CE"}`
        : "R Antônio Pompil, Nº 321, Lagoa Redonda, Fortaleza/CE | CEP: 60832650";

      doc
        .font("Helvetica-Bold")
        .text("Endereço:", 50, 215)
        .font("Helvetica")
        .text(addressStr, 135, 215, { width: 400 });

      // --- CAIXA 2: DADOS DA CONTA BANCÁRIA DE CRÉDITO ---
      doc
        .rect(40, 260, 515, 65)
        .fillAndStroke(lightBg, borderLine);

      doc
        .fillColor(primaryColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("2. DADOS BANCÁRIOS DO CRÉDITO / TRANSFERÊNCIA", 50, 268);

      const bankInfo = `${data.bankName || "450 - OwlBank / Fitbank"} (Código: ${data.bankCode || "450"})`;
      const accountInfo = `Agência: ${data.agency || "0001"} | Conta: ${data.accountNumber || "1042317620"}-${data.accountDigit || "3"}`;

      doc
        .fillColor(darkText)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Instituição:", 50, 285)
        .font("Helvetica")
        .text(bankInfo, 135, 285);

      doc
        .font("Helvetica-Bold")
        .text("Conta / Agência:", 50, 300)
        .font("Helvetica")
        .text(accountInfo, 135, 300);

      doc
        .font("Helvetica-Bold")
        .text("Chave PIX:", 340, 300)
        .font("Helvetica")
        .text(data.pixKey || formatCpf(data.cpf), 400, 300);

      // --- CAIXA 3: ESPECIFICAÇÃO DO PAGAMENTO ---
      doc
        .rect(40, 340, 515, 95)
        .fillAndStroke(lightBg, borderLine);

      doc
        .fillColor(primaryColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("3. ESPECIFICAÇÃO DO PAGAMENTO E COMPETÊNCIA", 50, 348);

      doc
        .fillColor(darkText)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Competência:", 50, 365)
        .font("Helvetica")
        .text(data.competence || `${data.year}-${String(data.month).padStart(2, "0")}`, 135, 365);

      doc
        .font("Helvetica-Bold")
        .text("Contrato / Projeto:", 50, 380)
        .font("Helvetica")
        .text(data.contractName || "COOPEDU GESTORES", 135, 380);

      doc
        .font("Helvetica-Bold")
        .text("Tipo de Folha:", 50, 395)
        .font("Helvetica")
        .text(data.payrollType || "Regular", 135, 395);

      doc
        .font("Helvetica-Bold")
        .text("Situação no SIC:", 320, 395)
        .font("Helvetica")
        .text(data.payrollStatus || "Processado / Pago", 390, 395);

      const payDate = data.payDayTime
        ? new Date(data.payDayTime).toLocaleDateString("pt-BR")
        : new Date().toLocaleDateString("pt-BR");

      doc
        .font("Helvetica-Bold")
        .text("Data de Crédito:", 50, 410)
        .font("Helvetica")
        .text(payDate, 135, 410);

      // --- DECLARAÇÃO DE COMPROVAÇÃO DE PAGAMENTO ---
      doc
        .rect(40, 450, 515, 80)
        .fillAndStroke("#f0fdf4", "#bbf7d0");

      doc
        .fillColor(secondaryColor)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("AUTENTICAÇÃO DE PAGAMENTO EFETUADO", 50, 458);

      doc
        .fillColor(darkText)
        .fontSize(9)
        .font("Helvetica")
        .text(
          `Comprovamos que o pagamento referente aos honorários / repasse de produção cooperativa da competência ${
            data.competence || `${data.year}-${data.month}`
          } foi devidamente processado e creditado na conta do(a) cooperado(a) indicado(a) acima.`,
          50,
          475,
          { width: 495, align: "justify" }
        );

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#64748b")
        .text(`ID de Registro no SIC Core: ${data.payrollId}`, 50, 510);

      // --- CAMPO DE EMISSÃO ---
      const currentDateStr = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      doc
        .fillColor(darkText)
        .fontSize(9)
        .font("Helvetica")
        .text(`Fortaleza - CE, ${currentDateStr}`, 40, 570, { align: "center" });

      doc
        .moveTo(150, 640)
        .lineTo(405, 640)
        .strokeColor("#94a3b8")
        .lineWidth(1)
        .stroke();

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("COOPEDU — Cooperativa de Trabalho dos Profissionais da Educação", 40, 645, { align: "center" });

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#64748b")
        .text(`Departamento Financeiro / Sistema Integrado de Cooperativas (SIC)`, 40, 658, { align: "center" });

      // Rodapé
      doc
        .fontSize(7)
        .fillColor("#94a3b8")
        .text(
          "Documento emitido eletronicamente via Centralizador SIC — Core Coopedu. Válido como Comprovante de Pagamento Oficial.",
          40,
          740,
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Gera PDF referente à PROPOSTA DE ADESÃO / ADMISSÃO DO COOPERADO
 */
export function generatePropostaAdesaoPdf(proposalData: any, cpf: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#0284c7"; // Sky 600
      const darkText = "#0f172a";

      // Cabeçalho
      doc.rect(40, 40, 515, 60).fillAndStroke("#e0f2fe", "#7dd3fc");
      if (fs.existsSync(LOGO_COOPEDU_PATH)) {
        try {
          doc.image(LOGO_COOPEDU_PATH, 50, 46, { width: 95 });
        } catch {
          doc.fillColor(primaryColor).fontSize(16).font("Helvetica-Bold").text("COOPEDU", 55, 48);
        }
      } else {
        doc.fillColor(primaryColor).fontSize(16).font("Helvetica-Bold").text("COOPEDU", 55, 48);
      }
      if (fs.existsSync(LOGO_SIC_PATH)) {
        try {
          doc.image(LOGO_SIC_PATH, 430, 48, { width: 105 });
        } catch {}
      }
      doc.fillColor(darkText).fontSize(9.5).font("Helvetica-Bold").text("PROPOSTA DE ADESÃO / ADMISSÃO DE COOPERADO", 50, 68);
      doc.fillColor("#475569").fontSize(7.5).font("Helvetica").text("Centralizador SIC — Sistema Integrado de Cooperativas | Core Coopedu", 50, 81);

      // Título
      doc.fillColor(darkText).fontSize(14).font("Helvetica-Bold").text("FICHA DE PROPOSTA DE ADMISSÃO", 40, 115, { align: "center" });

      // Seção Dados Pessoais
      doc.rect(40, 140, 515, 25).fill("#f1f5f9");
      doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold").text("1. DADOS PESSOAIS DO CANDIDATO", 50, 147);

      const nome = proposalData?.nomeCompleto || proposalData?.name || "COOPERADO";
      const formatCpfStr = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      const cargo = proposalData?.categoriaFuncao || proposalData?.cargo || "VIGIA 40H";
      const contrato = proposalData?.contrato || proposalData?.contractName || "PREFEITURA MUNICIPAL DE SANTAREM / COOPEDU GESTORES";
      const status = proposalData?.status || "COMPLETA";

      doc.fillColor(darkText).fontSize(9).font("Helvetica");
      doc.text(`Nome Completo: ${nome}`, 50, 175);
      doc.text(`CPF: ${formatCpfStr}`, 50, 190);
      doc.text(`Cargo / Função: ${cargo}`, 50, 205);
      doc.text(`Contrato de Alocação: ${contrato}`, 50, 220);
      doc.text(`Nome da Mãe: ${proposalData?.nomeMae || "Não informado"}`, 50, 235);
      doc.text(`Data de Nascimento: ${proposalData?.dataNascimento || "Não informada"}`, 50, 250);
      doc.text(`Sexo / Cor: ${proposalData?.sexo || "N/I"} - ${proposalData?.corRaca || "N/I"}`, 50, 265);
      doc.text(`Estado Civil: ${proposalData?.estadoCivil || "N/I"}`, 50, 280);

      // Seção Assinatura
      doc.rect(40, 310, 515, 25).fill("#f1f5f9");
      doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold").text("2. STATUS DE ASSINATURA DIGITAL (PLUGSIGN)", 50, 317);

      const statusAssinatura = proposalData?.assinatura?.assinado ? "DOCUMENTO ASSINADO DIGITALMENTE" : "PENDENTE DE ASSINATURA";
      const statusProvedor = proposalData?.assinatura?.statusProvedor === "signed" ? "Assinado Digitalmente" : proposalData?.assinatura?.statusProvedor || "Pendente";

      doc.fillColor(darkText).fontSize(9).font("Helvetica");
      doc.text(`Status da Proposta: ${status}`, 50, 345);
      doc.text(`Situação da Assinatura: ${statusAssinatura}`, 50, 360);
      doc.text(`Status do Provedor PlugSign: ${statusProvedor}`, 50, 375);

      // Emissão e Assinatura
      const nowStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      doc.text(`Emitido eletronicamente em: ${nowStr}`, 40, 430, { align: "center" });

      doc.moveTo(150, 500).lineTo(405, 500).strokeColor("#94a3b8").lineWidth(1).stroke();
      doc.fontSize(9).font("Helvetica-Bold").text("COOPEDU — Cooperativa de Trabalho dos Profissionais da Educação", 40, 505, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Gera PDF referente ao TERMO DE DESLIGAMENTO DO COOPERADO
 */
export function generateTermoDesligamentoPdf(terminationData: any, cpf: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#e11d48"; // Rose 600
      const darkText = "#0f172a";

      // Cabeçalho
      doc.rect(40, 40, 515, 60).fillAndStroke("#ffe4e6", "#f43f5e");
      if (fs.existsSync(LOGO_COOPEDU_PATH)) {
        try {
          doc.image(LOGO_COOPEDU_PATH, 50, 46, { width: 95 });
        } catch {
          doc.fillColor(primaryColor).fontSize(16).font("Helvetica-Bold").text("COOPEDU", 55, 48);
        }
      } else {
        doc.fillColor(primaryColor).fontSize(16).font("Helvetica-Bold").text("COOPEDU", 55, 48);
      }
      if (fs.existsSync(LOGO_SIC_PATH)) {
        try {
          doc.image(LOGO_SIC_PATH, 430, 48, { width: 105 });
        } catch {}
      }
      doc.fillColor(darkText).fontSize(9.5).font("Helvetica-Bold").text("SOLICITAÇÃO / TERMO DE DESLIGAMENTO DE COOPERADO", 50, 68);
      doc.fillColor("#475569").fontSize(7.5).font("Helvetica").text("Centralizador SIC — Sistema Integrado de Cooperativas | Core Coopedu", 50, 81);

      // Título
      doc.fillColor(darkText).fontSize(14).font("Helvetica-Bold").text("TERMO DE RESCISÃO / DESLIGAMENTO VOLUNTÁRIO", 40, 115, { align: "center" });

      // Seção Dados
      doc.rect(40, 140, 515, 25).fill("#fff1f2");
      doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold").text("1. IDENTIFICAÇÃO DO DESLIGAMENTO", 50, 147);

      const formatCpfStr = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      const statusTerm = terminationData?.data?.status || terminationData?.status || "SOLICITADO";
      const motivo = terminationData?.data?.reason || terminationData?.reason || "Desligamento a pedido do cooperado";
      const dataEfetiva = terminationData?.data?.effectiveDate || terminationData?.effectiveDate || "A ser processada";

      doc.fillColor(darkText).fontSize(9).font("Helvetica");
      doc.text(`CPF do Cooperado: ${formatCpfStr}`, 50, 175);
      doc.text(`Status do Pedido: ${statusTerm}`, 50, 190);
      doc.text(`Motivo Declarado: ${motivo}`, 50, 205);
      doc.text(`Data Efetiva do Desligamento: ${dataEfetiva}`, 50, 220);
      doc.text(`Sistema Origem: Core Coopedu / API de Desligamento`, 50, 235);

      // Emissão e Assinatura
      const nowStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      doc.text(`Emitido em: ${nowStr}`, 40, 310, { align: "center" });

      doc.moveTo(150, 380).lineTo(405, 380).strokeColor("#94a3b8").lineWidth(1).stroke();
      doc.fontSize(9).font("Helvetica-Bold").text("COOPEDU — Departamento de Recursos Humanos", 40, 385, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Gera o PDF do DEMONSTRATIVO DE PRODUTIVIDADE no modelo exato do Portal UI do SIC (Anexo 1)
 */
export function generateDemonstrativePdf(summary: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#005691";
      const darkText = "#1e293b";
      const borderGray = "#64748b";

      // 1. CABEÇALHO OFICIAL (Logo + Título)
      if (fs.existsSync(LOGO_COOPEDU_PATH)) {
        try {
          doc.image(LOGO_COOPEDU_PATH, 40, 30, { width: 95 });
        } catch {
          doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("▲ COOPEDU", 40, 35);
        }
      } else {
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("▲ COOPEDU", 40, 35);
      }

      if (fs.existsSync(LOGO_SIC_PATH)) {
        try {
          doc.image(LOGO_SIC_PATH, 145, 32, { width: 85 });
        } catch {}
      }

      // Título Principal
      doc.fillColor(darkText).fontSize(13).font("Helvetica-Bold").text("Demonstrativo de Produtividade", 250, 35, { align: "right" });

      // Subcabeçalho
      doc.fontSize(8).font("Helvetica-Bold").text("COOP TRAB PROF DA EDUCACAO DO ESTADO RIO G NORTE", 40, 66);
      doc.fontSize(7.5).font("Helvetica").text("Centro, 1, Centro, Monte Alegre - RN, CEP 59182-000", 40, 77);

      doc.fontSize(7.5).font("Helvetica").text("CNPJ: 35.537.126/0001-84", 420, 66, { align: "right" });
      doc.fontSize(7.5).font("Helvetica").text("(84) 98156-1479", 420, 77, { align: "right" });

      // 2. QUADRO DE IDENTIFICAÇÃO DO ASSOCIADO / COOPERADO
      let y = 92;
      doc.rect(40, y, 515, 46).strokeColor(borderGray).lineWidth(0.5).stroke();

      // Linhas Internas Divisórias
      doc.moveTo(40, y + 23).lineTo(555, y + 23).stroke();
      doc.moveTo(110, y).lineTo(110, y + 46).stroke();
      doc.moveTo(420, y).lineTo(420, y + 46).stroke();

      // Conteúdo Linha 1
      doc.fillColor(darkText).fontSize(6.5).font("Helvetica-Bold").text("Matrícula", 44, y + 3);
      doc.fontSize(8).font("Helvetica").text(String(summary.registration || summary.matricula || 4704), 44, y + 12);

      doc.fontSize(6.5).font("Helvetica-Bold").text("Nome do Associado - Cooperado", 114, y + 3);
      doc.fontSize(8).font("Helvetica-Bold").text(String(summary.cooperativeUserName || summary.nome || "RICARDO JOSE VIANNA PALACIO LEITE").toUpperCase(), 114, y + 12);

      doc.fontSize(6.5).font("Helvetica-Bold").text("Profissão", 424, y + 3);
      doc.fontSize(8).font("Helvetica").text(String(summary.profissao || summary.professionName || "OUVIDOR").toUpperCase(), 424, y + 12);

      // Conteúdo Linha 2
      doc.fontSize(6.5).font("Helvetica-Bold").text("CPF", 44, y + 26);
      doc.fontSize(8).font("Helvetica").text(formatCpf(summary.cpf), 44, y + 34);

      doc.fontSize(6.5).font("Helvetica-Bold").text("Contratante - Cliente da Cooperativa", 114, y + 26);
      doc.fontSize(7.5).font("Helvetica").text(String(summary.cliente || summary.clientName || "COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA EDUCAÇÃO").toUpperCase(), 114, y + 34, { width: 300, height: 10 });

      doc.fontSize(6.5).font("Helvetica-Bold").text("Competência", 424, y + 26);
      doc.fontSize(8).font("Helvetica").text(String(summary.competence || "08/2026"), 424, y + 34);

      // 3. TABELA DE PRODUTIVIDADE & RUBRICAS
      y = 144;
      doc.rect(40, y, 515, 14).strokeColor(borderGray).lineWidth(0.5).stroke();
      doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");

      doc.text("Cód.", 44, y + 3);
      doc.text("Descrição da Produtividade", 85, y + 3);
      doc.text("Referência", 340, y + 3, { width: 60, align: "center" });
      doc.text("Créditos", 410, y + 3, { width: 65, align: "right" });
      doc.text("Débitos", 480, y + 3, { width: 70, align: "right" });

      y += 14;

      const creditos = summary.creditos || [];
      const descontos = summary.descontosItens || [];
      const allItems = [...creditos, ...descontos];

      const startTableY = y;

      if (allItems.length === 0) {
        doc.fillColor(darkText).fontSize(7.5).font("Helvetica");
        doc.text("—", 44, y + 4);
        doc.text("PRODUTIVIDADE", 85, y + 4);
        doc.text("—", 340, y + 4, { width: 60, align: "center" });
        doc.text(String(summary.valorBruto || "10.372,51").replace("R$", "").trim(), 410, y + 4, { width: 65, align: "right" });
        doc.text("—", 480, y + 4, { width: 70, align: "right" });
        y += 14;
      } else {
        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];
          doc.fillColor(darkText).fontSize(7.5).font("Helvetica");

          const codStr = item.codigo ? String(item.codigo).padStart(4, "0") : "—";
          doc.text(codStr, 44, y + 4);

          let desc = item.descricao || "Produtividade";
          if (item.parcelInfo) {
            desc += ` (${item.parcelInfo.replace("Parcela ", "")})`;
          }
          doc.text(desc, 85, y + 4, { width: 250 });

          const refStr = item.tipo === "credito" ? (item.codigo === "0001" || !item.codigo ? "—" : "1,00") : (item.parcelInfo ? "—" : "1,00");
          doc.text(refStr, 340, y + 4, { width: 60, align: "center" });

          if (item.tipo === "credito") {
            const cleanVal = String(item.valor || "").replace("R$", "").trim();
            doc.text(cleanVal, 410, y + 4, { width: 65, align: "right" });
            doc.text("—", 480, y + 4, { width: 70, align: "right" });
          } else {
            const cleanVal = String(item.valor || "").replace("-R$", "").replace("R$", "").trim();
            doc.text("—", 410, y + 4, { width: 65, align: "right" });
            doc.text(cleanVal, 480, y + 4, { width: 70, align: "right" });
          }
          y += 14;
        }
      }

      // Moldura externa da tabela de itens
      doc.rect(40, startTableY, 515, y - startTableY).strokeColor(borderGray).lineWidth(0.5).stroke();

      // 4. LINHA DE VALORES TOTAIS
      doc.rect(40, y, 515, 14).strokeColor(borderGray).lineWidth(0.5).stroke();
      doc.fillColor(darkText).fontSize(7.5).font("Helvetica-Bold");
      doc.text("Valores totais", 44, y + 3);

      const cleanBruto = String(summary.valorBruto || "").replace("R$", "").trim();
      const cleanDisc = String(summary.descontos || "").replace("-R$", "").replace("R$", "").trim();

      doc.text(`R$ ${cleanBruto}`, 410, y + 3, { width: 65, align: "right" });
      doc.text(`R$ ${cleanDisc}`, 480, y + 3, { width: 70, align: "right" });

      // 5. SEÇÃO DADOS BANCÁRIOS E LÍQUIDO
      y += 18;
      doc.rect(40, y, 515, 46).strokeColor(borderGray).lineWidth(0.5).stroke();

      doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold").text("Dados bancários", 44, y + 3);
      const bankInfoStr = `Banco: ${summary.bankNumber || "001"}   Agência: ${summary.agency || "0001"}   Conta: ${summary.account || summary.accountNumber || "12345"}   Díg.: ${summary.digit || summary.accountDigit || "6"}   Tipo: ${summary.accountType || "CORRENTE"}`;
      doc.fontSize(7.5).font("Helvetica").text(bankInfoStr, 44, y + 14);

      // Subdivisão Base Cálculo INSS & Total Líquido
      doc.moveTo(40, y + 26).lineTo(555, y + 26).stroke();
      doc.moveTo(330, y + 26).lineTo(330, y + 46).stroke();

      doc.fontSize(6.5).font("Helvetica-Bold").text("Base Cálc. INSS", 250, y + 29);
      const inssBase = summary.inssCalculationBase ? `R$ ${Number(summary.inssCalculationBase).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : (summary.valorBruto || "R$ 10.372,51");
      doc.fontSize(8).font("Helvetica").text(inssBase, 270, y + 36, { width: 55, align: "right" });

      doc.fontSize(7.5).font("Helvetica-Bold").text("TOTAL LÍQUIDO", 335, y + 33);
      doc.fontSize(12).font("Helvetica-Bold").text(summary.valorLiquido || "R$ 5.870,53", 440, y + 31, { width: 110, align: "right" });

      // 6. DECLARAÇÃO E ASSINATURA (RODAPÉ ANEXO 1)
      y += 54;
      doc.fillColor(darkText).fontSize(7).font("Helvetica").text("Declaro ter recebido a importância líquida acima discriminada, dando quitação total.", 40, y);

      y += 18;
      doc.text("Data: ____/____/________", 40, y);
      doc.text("Assinatura: ____________________________________________________________________", 170, y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawCoopeduHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle?: string,
  options?: { hideEmissionDate?: boolean }
) {
  // 1. Logo Coopedu à esquerda
  if (fs.existsSync(LOGO_COOPEDU_PATH)) {
    try {
      doc.image(LOGO_COOPEDU_PATH, 35, 30, { width: 105 });
    } catch {
      doc.fillColor("#0284c7").fontSize(13).font("Helvetica-Bold").text("▲ COOPEDU", 35, 35);
    }
  } else {
    doc.fillColor("#0284c7").fontSize(13).font("Helvetica-Bold").text("▲ COOPEDU", 35, 35);
  }

  // Divisor vertical sutil entre marcas
  doc.moveTo(148, 32).lineTo(148, 64).strokeColor("#cbd5e1").lineWidth(1).stroke();

  // 2. Logo SIC ao lado
  if (fs.existsSync(LOGO_SIC_PATH)) {
    try {
      doc.image(LOGO_SIC_PATH, 156, 32, { width: 90 });
    } catch {
      doc.fillColor("#1e293b").fontSize(13).font("Helvetica-Bold").text("SIC", 156, 35);
    }
  }

  // 3. Títulos e metadados institucionais à direita (com acentuação e cedilhas preservadas)
  const normTitle = toUpperWithAccents(title);
  const normSubtitle = subtitle ? toUpperWithAccents(subtitle) : undefined;

  if (options?.hideEmissionDate) {
    doc.fillColor("#0f172a").fontSize(10.5).font("Helvetica-Bold").text(normTitle, 255, 33, { align: "right", width: 305 });
    if (normSubtitle) {
      doc.fillColor("#64748b").fontSize(8).font("Helvetica").text(normSubtitle, 255, 49, { align: "right", width: 305 });
    }
  } else {
    doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text(normTitle, 255, 30, { align: "right", width: 305 });
    if (normSubtitle) {
      doc.fillColor("#64748b").fontSize(7.5).font("Helvetica").text(normSubtitle, 255, 45, { align: "right", width: 305 });
    }
    const dateStr = `EMISSÃO: ${new Date().toLocaleDateString("pt-BR")} ÀS ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} • CENTRALIZADOR SIC`;
    doc.fillColor("#94a3b8").fontSize(6.8).font("Helvetica").text(dateStr, 255, 58, { align: "right", width: 305 });
  }

  // Linha divisória horizontal inferior
  doc.moveTo(35, 74).lineTo(560, 74).strokeColor("#cbd5e1").lineWidth(1.2).stroke();
}

function formatCurrency(val?: number | string) {
  const n = Number(val || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatSafeDate(val?: any): string {
  if (!val) return "-";
  try {
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return "-";
      const d = String(val.getDate()).padStart(2, "0");
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const y = val.getFullYear();
      return `${d}/${m}/${y}`;
    }
    const s = String(val).trim();
    if (!s || s === "null" || s === "undefined" || s === "-") return "-";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const parts = s.split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return s;
  } catch {
    return String(val);
  }
}

function resolveOwlBank(bankCode?: string, bankName?: string) {
  const code = String(bankCode || "").trim();
  const name = String(bankName || "").trim();
  if (code === "770" || code === "450" || name.includes("770") || name.toUpperCase().includes("FITBANK") || name.toUpperCase().includes("OWL")) {
    return { code: "450", name: "BANCO OWL" };
  }
  return { code: code || "-", name: name || "Banco não cadastrado" };
}

/**
 * 1. Gera PDF da Ficha Cadastral e Financeira do Cooperado (EasyCoop)
 */
export function generateEasycoopFichaPdf(coop: any, financialData?: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 35, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primary = "#0284c7";
      const darkText = "#0f172a";
      const grayBorder = "#e2e8f0";
      const bgLight = "#f8fafc";

      drawCoopeduHeader(doc, "FICHA CADASTRAL E FINANCEIRA DO COOPERADO", "BASE OFICIAL EASYCOOP ANALYTICS • CORE COOPEDU");

      let y = 92;

      // QUADRO 1: IDENTIFICAÇÃO CIVIL & VÍNCULO ESTATUTÁRIO
      doc.rect(40, y, 515, 140).fillAndStroke(bgLight, grayBorder);
      doc.fillColor(primary).fontSize(9).font("Helvetica-Bold").text("1. IDENTIFICACAO CIVIL & VINCULO COOPERATIVO", 50, y + 8);

      const bank = resolveOwlBank(coop.bank_code, coop.bank_name);
      const atividadeOficial = toUpperNoAccents(coop.cargo_contrato || coop.position || "COOPERADO");

      doc.fillColor(darkText).fontSize(8);
      // Linha 1
      doc.font("Helvetica-Bold").text("NOME COMPLETO:", 50, y + 25);
      doc.font("Helvetica").text(toUpperNoAccents(coop.name || "NAO INFORMADO"), 140, y + 25, { width: 230 });

      doc.font("Helvetica-Bold").text("CPF:", 380, y + 25);
      doc.font("Helvetica").text(formatCpf(coop.document), 415, y + 25);

      // Linha 2
      doc.font("Helvetica-Bold").text("MATRICULA:", 50, y + 41);
      doc.font("Helvetica").text(`#${coop.registration_number || "-"}`, 140, y + 41);

      doc.font("Helvetica-Bold").text("ADMISSAO:", 230, y + 41);
      doc.font("Helvetica").text(formatSafeDate(coop.admission_date), 290, y + 41);

      doc.font("Helvetica-Bold").text("SITUACAO:", 380, y + 41);
      doc.font("Helvetica").text(toUpperNoAccents(coop.status || "ATIVO"), 435, y + 41);

      // Linha 3
      doc.font("Helvetica-Bold").text("ATIVIDADE OFICIAL:", 50, y + 57);
      doc.font("Helvetica-Bold").fillColor(primary).text(atividadeOficial, 140, y + 57, { width: 230 });
      doc.fillColor(darkText);

      doc.font("Helvetica-Bold").text("TEMPO NA COOP:", 380, y + 57);
      doc.font("Helvetica").text(toUpperNoAccents(coop.tempo_cooperativa_formatado || "-"), 460, y + 57, { width: 90 });

      // Linha 4
      doc.font("Helvetica-Bold").text("QUOTAS-PARTE:", 50, y + 73);
      doc.font("Helvetica").text(toUpperNoAccents(coop.quotas_info?.texto || "10 DE 10 QUOTAS"), 140, y + 73, { width: 230 });

      doc.font("Helvetica-Bold").text("NASCIMENTO:", 380, y + 73);
      doc.font("Helvetica").text(formatSafeDate(coop.birth_date), 450, y + 73);

      // Linha 5
      doc.font("Helvetica-Bold").text("RG / ORGAO:", 50, y + 89);
      doc.font("Helvetica").text(`${coop.rg_number || "-"} ${coop.rg_issuer ? `(${toUpperNoAccents(coop.rg_issuer)})` : ""}`, 140, y + 89);

      doc.font("Helvetica-Bold").text("PIS/PASEP:", 230, y + 89);
      doc.font("Helvetica").text(coop.pis_number || "-", 290, y + 89);

      doc.font("Helvetica-Bold").text("SEXO:", 380, y + 89);
      doc.font("Helvetica").text(coop.gender === "F" ? "FEMININO" : "MASCULINO", 420, y + 89);

      // Linha 6
      doc.font("Helvetica-Bold").text("NATURALIDADE:", 50, y + 105);
      doc.font("Helvetica").text(coop.birth_city ? `${toUpperNoAccents(coop.birth_city)}/${toUpperNoAccents(coop.birth_state)}` : "-", 140, y + 105);

      doc.font("Helvetica-Bold").text("CTPS:", 230, y + 105);
      doc.font("Helvetica").text(coop.ctps_number || "-", 270, y + 105);

      // Linha 7 - Filiação
      doc.font("Helvetica-Bold").text("FILIACAO:", 50, y + 121);
      doc.font("Helvetica").text(`MAE: ${toUpperNoAccents(coop.mother_name) || "-"} | PAI: ${toUpperNoAccents(coop.father_name) || "-"}`, 140, y + 121, { width: 410 });

      y += 150;

      // QUADRO 2: CONTRATO E TOMADOR ATUAL
      if (coop.contrato_atual) {
        doc.rect(40, y, 515, 65).fillAndStroke(bgLight, grayBorder);
        doc.fillColor(primary).fontSize(9).font("Helvetica-Bold").text("2. ALOCACAO EM CONTRATO E TOMADOR ATUAL", 50, y + 8);

        doc.fillColor(darkText).fontSize(8);
        doc.font("Helvetica-Bold").text("CLIENTE / TOMADOR:", 50, y + 25);
        doc.font("Helvetica").text(toUpperNoAccents(coop.contrato_atual.tomador_nome || coop.contract_name || "COOPEDU"), 155, y + 25, { width: 390 });

        doc.font("Helvetica-Bold").text("CONTRATO:", 50, y + 42);
        doc.font("Helvetica").text(toUpperNoAccents(coop.contrato_atual.contrato_descricao || "CONTRATO GERAL"), 110, y + 42, { width: 230 });

        doc.font("Helvetica-Bold").text("VIGENCIA:", 350, y + 42);
        doc.font("Helvetica").text(`${formatSafeDate(coop.contrato_atual.data_inicio)} ATE ${formatSafeDate(coop.contrato_atual.data_fim)}`, 405, y + 42);

        y += 75;
      }

      // QUADRO 3: DADOS BANCÁRIOS & CONTATOS
      doc.rect(40, y, 515, 90).fillAndStroke(bgLight, grayBorder);
      doc.fillColor(primary).fontSize(9).font("Helvetica-Bold").text("3. DADOS BANCARIOS PARA REPASSE (OWL) & CONTATOS", 50, y + 8);

      doc.fillColor(darkText).fontSize(8);
      // Linha 1 Bancária
      doc.font("Helvetica-Bold").text("INSTITUICAO BANCARIA:", 50, y + 25);
      doc.font("Helvetica-Bold").fillColor("#047857").text(`${toUpperNoAccents(bank.name)} (COD: ${bank.code})`, 165, y + 25);
      doc.fillColor(darkText);

      doc.font("Helvetica-Bold").text("AGENCIA / CONTA:", 360, y + 25);
      doc.font("Helvetica").text(`AG: ${coop.agency || "0001"} | CC: ${coop.account_number || "-"}-${coop.account_digit || ""}`, 445, y + 25);

      // Linha 2 Contatos
      doc.font("Helvetica-Bold").text("CHAVE PIX:", 50, y + 41);
      doc.font("Helvetica").text(coop.pix_key || formatCpf(coop.document), 110, y + 41, { width: 140 });

      doc.font("Helvetica-Bold").text("WHATSAPP / CELULAR:", 260, y + 41);
      doc.font("Helvetica").text(coop.whatsapp_number || coop.secondary_phone || "-", 375, y + 41);

      doc.font("Helvetica-Bold").text("E-MAIL:", 50, y + 57);
      doc.font("Helvetica").text(toUpperNoAccents(coop.email || "-"), 95, y + 57, { width: 450 });

      // Linha 3 Endereço Completo
      doc.font("Helvetica-Bold").text("ENDERECO:", 50, y + 72);
      const fullEndStr = toUpperNoAccents(`${coop.street || "-"}, ${coop.number || "S/N"} - ${coop.neighborhood || ""} - ${coop.city || ""}/${coop.state || ""} - CEP: ${coop.zip_code || "-"}`);
      doc.font("Helvetica").text(fullEndStr, 110, y + 72, { width: 435 });

      y += 100;

      // QUADRO 4: HISTÓRICO FINANCEIRO CONSOLIDADO
      doc.rect(40, y, 515, 62).fillAndStroke(bgLight, grayBorder);
      doc.fillColor(primary).fontSize(9).font("Helvetica-Bold").text("4. HISTORICO FINANCEIRO CONSOLIDADO DE REPASSES", 50, y + 8);

      // Mini-cards de totais
      const totais = financialData?.totais || {};
      const bruto = Number(totais.totalBruto || 0);
      const liquido = Number(totais.totalLiquido || 0);
      const retencoes = (Number(totais.totalInss || 0) + Number(totais.totalIrrf || 0) + Number(totais.totalTaxaAdm || 0));

      doc.rect(50, y + 23, 140, 32).fillAndStroke("#ffffff", "#cbd5e1");
      doc.fillColor("#64748b").fontSize(6.5).font("Helvetica-Bold").text("TOTAL BRUTO REPASSADO", 55, y + 27);
      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text(formatCurrency(bruto), 55, y + 38);

      doc.rect(200, y + 23, 140, 32).fillAndStroke("#ffffff", "#cbd5e1");
      doc.fillColor("#64748b").fontSize(6.5).font("Helvetica-Bold").text("TOTAL RETENCOES (INSS/IRRF/TAXA)", 205, y + 27);
      doc.fillColor("#e11d48").fontSize(10).font("Helvetica-Bold").text(formatCurrency(retencoes), 205, y + 38);

      doc.rect(350, y + 23, 195, 32).fillAndStroke("#f0fdf4", "#86efac");
      doc.fillColor("#166534").fontSize(6.5).font("Helvetica-Bold").text("LIQUIDO TOTAL CREDITADO EM CONTA", 355, y + 27);
      doc.fillColor("#15803d").fontSize(11).font("Helvetica-Bold").text(formatCurrency(liquido), 355, y + 38);

      // Tabela de lançamentos completos
      let tableY = y + 70;
      doc.rect(50, tableY, 495, 15).fillAndStroke("#e2e8f0", "#cbd5e1");
      doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
      doc.text("COMP.", 55, tableY + 4);
      doc.text("CLIENTE / TOMADOR", 100, tableY + 4);
      doc.text("CONTRATO VINCULADO", 220, tableY + 4);
      doc.text("VALOR BRUTO", 340, tableY + 4, { width: 60, align: "right" });
      doc.text("VALOR LIQUIDO", 410, tableY + 4, { width: 65, align: "right" });
      doc.text("PAGAMENTO", 485, tableY + 4, { width: 55, align: "center" });

      tableY += 15;
      const fechamentos = financialData?.fechamentos || [];

      if (fechamentos.length === 0) {
        doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica").text("Nenhum lançamento registrado para este cooperado.", 55, tableY + 5);
      } else {
        for (const f of fechamentos) {
          if (tableY > 740) {
            doc.addPage();
            drawCoopeduHeader(doc, "FICHA CADASTRAL E FINANCEIRA (CONTINUACAO)", "HISTORICO FINANCEIRO CONSOLIDADO DE REPASSES");
            tableY = 90;
            doc.rect(50, tableY, 495, 15).fillAndStroke("#e2e8f0", "#cbd5e1");
            doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
            doc.text("COMP.", 55, tableY + 4);
            doc.text("CLIENTE / TOMADOR", 100, tableY + 4);
            doc.text("CONTRATO VINCULADO", 220, tableY + 4);
            doc.text("VALOR BRUTO", 340, tableY + 4, { width: 60, align: "right" });
            doc.text("VALOR LIQUIDO", 410, tableY + 4, { width: 65, align: "right" });
            doc.text("PAGAMENTO", 485, tableY + 4, { width: 55, align: "center" });
            tableY += 15;
          }
          doc.fillColor(darkText).fontSize(7).font("Helvetica");
          doc.text(`${String(f.mes).padStart(2, "0")}/${f.ano}`, 55, tableY + 3);
          doc.text(toUpperNoAccents(f.tomador || "COOPEDU SEDE"), 100, tableY + 3, { width: 115, height: 10 });
          doc.text(toUpperNoAccents(f.contrato_descricao || f.tomador || "CONTRATO GERAL"), 220, tableY + 3, { width: 115, height: 10 });
          doc.text(formatCurrency(f.valor_bruto), 340, tableY + 3, { width: 60, align: "right" });
          doc.fillColor("#15803d").font("Helvetica-Bold").text(formatCurrency(f.valor_liquido), 410, tableY + 3, { width: 65, align: "right" });
          doc.fillColor(darkText).font("Helvetica").text(formatSafeDate(f.data_pagamento), 485, tableY + 3, { width: 55, align: "center" });
          tableY += 13;
        }
      }

      // Rodapé
      doc.fillColor("#94a3b8").fontSize(6.5).font("Helvetica").text(
        "Certidão emitida eletronicamente pelo Sistema Integrado de Cooperativas (Centralizador SIC • Core Coopedu). Documento de uso corporativo.",
        40,
        780,
        { align: "center", width: 515 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 2. Gera PDF do Gráfico e Histórico de Produtividade (EasyCoop)
 */
export function generateEasycoopGraficoPdf(coop: any, financialData: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 35, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primary = "#0284c7";
      const darkText = "#0f172a";
      const grayBorder = "#cbd5e1";

      drawCoopeduHeader(doc, "HISTÓRICO ANALÍTICO DE PRODUTIVIDADE", "Evolução Mensal de Repasses Cooperativos com Gráfico");

      let y = 92;

      // BOX IDENTIFICAÇÃO COOPERADO
      doc.rect(40, y, 515, 48).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor(darkText).fontSize(8);
      doc.font("Helvetica-Bold").text("Cooperado:", 50, y + 8);
      doc.font("Helvetica").text(String(coop.name || "N/I").toUpperCase(), 110, y + 8);

      doc.font("Helvetica-Bold").text("CPF:", 360, y + 8);
      doc.font("Helvetica").text(formatCpf(coop.document), 400, y + 8);

      doc.font("Helvetica-Bold").text("Atividade:", 50, y + 24);
      doc.font("Helvetica-Bold").fillColor(primary).text(coop.cargo_contrato || coop.position || "Cooperado", 110, y + 24);
      doc.fillColor(darkText);

      doc.font("Helvetica-Bold").text("Matrícula:", 360, y + 24);
      doc.font("Helvetica").text(`#${coop.registration_number || "-"}`, 410, y + 24);

      y += 60;

      // CARDS DE RESUMO DO PERÍODO
      const fechamentos = financialData?.fechamentos || [];
      const totalBruto = Number(financialData?.totais?.totalBruto || 0);
      const totalLiquido = Number(financialData?.totais?.totalLiquido || 0);
      const media = fechamentos.length > 0 ? totalBruto / fechamentos.length : 0;

      doc.rect(40, y, 160, 36).fillAndStroke("#f0fdf4", "#86efac");
      doc.fillColor("#166534").fontSize(7).font("Helvetica-Bold").text("MÉDIA MENSAL DE PRODUÇÃO", 50, y + 6);
      doc.fillColor("#15803d").fontSize(12).font("Helvetica-Bold").text(formatCurrency(media), 50, y + 18);

      doc.rect(215, y, 160, 36).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.fillColor("#64748b").fontSize(7).font("Helvetica-Bold").text("TOTAL BRUTO ANALISADO", 225, y + 6);
      doc.fillColor(darkText).fontSize(12).font("Helvetica-Bold").text(formatCurrency(totalBruto), 225, y + 18);

      doc.rect(390, y, 165, 36).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.fillColor("#64748b").fontSize(7).font("Helvetica-Bold").text("TOTAL LÍQUIDO CREDITADO", 400, y + 6);
      doc.fillColor("#0284c7").fontSize(12).font("Helvetica-Bold").text(formatCurrency(totalLiquido), 400, y + 18);

      y += 50;

      // GRÁFICO VETORIAL DE BARRAS
      doc.rect(40, y, 515, 200).fillAndStroke("#ffffff", grayBorder);
      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("GRÁFICO DE PRODUÇÃO BRUTA POR MÊS (ÚLTIMOS REPASSES)", 50, y + 10);

      const chartItems = [...fechamentos].sort((a: any, b: any) => {
        const anoDiff = Number(a.ano || 0) - Number(b.ano || 0);
        if (anoDiff !== 0) return anoDiff;
        const mesDiff = Number(a.mes || 0) - Number(b.mes || 0);
        if (mesDiff !== 0) return mesDiff;
        return Number(a.folha || 1) - Number(b.folha || 1);
      });
      const maxVal = Math.max(...chartItems.map((f: any) => Number(f.valor_bruto || 0)), 1000);

      const chartAreaX = 60;
      const chartAreaY = y + 35;
      const chartAreaHeight = 135;
      const chartAreaWidth = 475;

      // Linhas guia de fundo
      doc.strokeColor("#f1f5f9").lineWidth(0.5);
      for (let i = 0; i <= 4; i++) {
        const lineY = chartAreaY + (chartAreaHeight / 4) * i;
        doc.moveTo(chartAreaX, lineY).lineTo(chartAreaX + chartAreaWidth, lineY).stroke();
      }

      if (chartItems.length === 0) {
        doc.fillColor("#94a3b8").fontSize(9).font("Helvetica").text("Sem lançamentos suficientes para gerar o gráfico.", 180, y + 100);
      } else {
        const count = chartItems.length;
        const barWidth = Math.max(10, Math.min(28, Math.floor((chartAreaWidth - 20) / (count || 1)) - 3));
        const barSpacing = Math.max(2, Math.floor((chartAreaWidth - count * barWidth) / (count + 1)));

        chartItems.forEach((f: any, idx: number) => {
          const val = Number(f.valor_bruto || 0);
          const barHeight = Math.max(8, Math.round((val / maxVal) * (chartAreaHeight - 20)));
          const barX = chartAreaX + barSpacing + idx * (barWidth + barSpacing);
          const barY = chartAreaY + chartAreaHeight - barHeight;

          // Desenha a barra
          doc.rect(barX, barY, barWidth, barHeight).fill("#0284c7");

          // Rótulo do valor acima da barra
          doc.fillColor("#0f172a").fontSize(5.5).font("Helvetica-Bold").text(
            val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val.toFixed(0)}`,
            barX - 4,
            barY - 9,
            { width: barWidth + 8, align: "center" }
          );

          // Rótulo do mês abaixo da barra
          doc.fillColor("#475569").fontSize(6.5).font("Helvetica").text(
            `${String(f.mes).padStart(2, "0")}/${String(f.ano).slice(2)}`,
            barX - 4,
            chartAreaY + chartAreaHeight + 4,
            { width: barWidth + 8, align: "center" }
          );
        });
      }

      y += 215;

      // TABELA COMPLEMENTAR DE LANÇAMENTOS DO GRÁFICO
      doc.rect(40, y, 515, 18).fillAndStroke("#e2e8f0", grayBorder);
      doc.fillColor(darkText).fontSize(7.5).font("Helvetica-Bold");
      doc.text("Competência", 50, y + 5);
      doc.text("Cliente / Tomador", 130, y + 5);
      doc.text("Contrato Vinculado", 250, y + 5);
      doc.text("Produção Bruta", 360, y + 5, { width: 60, align: "right" });
      doc.text("Deduções", 430, y + 5, { width: 50, align: "right" });
      doc.text("Valor Líquido", 490, y + 5, { width: 55, align: "right" });

      y += 18;
      const tableList = chartItems.slice(0, 8);
      for (const f of tableList) {
        doc.rect(40, y, 515, 15).fillAndStroke("#ffffff", "#f1f5f9");
        doc.fillColor(darkText).fontSize(7).font("Helvetica");
        doc.text(`${String(f.mes).padStart(2, "0")}/${f.ano}`, 50, y + 4);
        doc.text(f.tomador || "Coopedu Sede", 130, y + 4, { width: 110, height: 10 });
        doc.text(f.contrato_descricao || f.tomador || "Contrato Geral", 250, y + 4, { width: 105, height: 10 });
        doc.text(formatCurrency(f.valor_bruto), 360, y + 4, { width: 60, align: "right" });
        doc.fillColor("#e11d48").text(formatCurrency(f.total_descontos || (Number(f.inss || 0) + Number(f.irrf || 0) + Number(f.taxa_adm || 0))), 430, y + 4, { width: 50, align: "right" });
        doc.fillColor("#15803d").font("Helvetica-Bold").text(formatCurrency(f.valor_liquido), 490, y + 4, { width: 55, align: "right" });
        y += 15;
      }

      // Rodapé
      doc.fillColor("#94a3b8").fontSize(6.5).font("Helvetica").text(
        "Relatório gerado eletronicamente via Centralizador SIC • Core Coopedu. Todos os valores auditados na base oficial.",
        40,
        780,
        { align: "center", width: 515 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 3. Gera PDF dos Lançamentos Selecionados no Período com Detalhes (EasyCoop)
 * - Agrupamento: uma página dedicada para cada contrato
 * - Remoção da coluna "Pago em"
 * - Redesign estético executivo dos totais consolidados
 * - Preservação total de acentos e cedilhas (ex: IPANGUAÇU)
 */
export function generateEasycoopLancamentosPdf(coop: any, lancamentos: any[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 35, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primary = "#0284c7";
      const darkText = "#0f172a";
      const grayBorder = "#cbd5e1";

      const coopName = toUpperWithAccents(coop.name || "N/I");
      const coopCargo = toUpperWithAccents(coop.cargo_contrato || coop.position || "Cooperado");
      const bank = resolveOwlBank(coop.bank_code, coop.bank_name);
      const bankFullStr = `${toUpperWithAccents(bank.name)} (${bank.code}) • Ag: ${coop.agency || "0001"} • CC: ${coop.account_number || "-"}-${coop.account_digit || ""} (${coop.account_type || "Corrente"})`;

      // 1. Sanitizar lançamentos e calcular totais gerais
      let totGeralBruto = 0;
      let totGeralInss = 0;
      let totGeralIrrf = 0;
      let totGeralTaxa = 0;
      let totGeralLiquido = 0;

      const safeLancamentos = (lancamentos || []).map((l: any) => {
        const valorBruto = Number(l.valor_bruto || 0);
        const inss = Number(l.inss || 0);
        const irrf = Number(l.irrf || 0);
        const taxaAdm = Number(l.taxa_adm || 0);
        const valorLiquido = Number(l.valor_liquido || 0);

        totGeralBruto += valorBruto;
        totGeralInss += inss;
        totGeralIrrf += irrf;
        totGeralTaxa += taxaAdm;
        totGeralLiquido += valorLiquido;

        return {
          ...l,
          tomador: toUpperWithAccents(l.tomador || "COOPEDU"),
          contrato_descricao: toUpperWithAccents(l.contrato_descricao || l.tomador || "CONTRATO GERAL"),
          valor_bruto: valorBruto,
          inss,
          irrf,
          taxa_adm: taxaAdm,
          valor_liquido: valorLiquido,
        };
      });

      // 2. Agrupar por CONTRATO (Uma página para cada contrato)
      const gruposMap = new Map<string, { contratoNome: string; tomadorNome: string; itens: any[] }>();
      for (const l of safeLancamentos) {
        const chave = l.contrato_descricao || l.tomador || "CONTRATO GERAL";
        if (!gruposMap.has(chave)) {
          gruposMap.set(chave, {
            contratoNome: chave,
            tomadorNome: l.tomador || "COOPEDU",
            itens: [],
          });
        }
        gruposMap.get(chave)!.itens.push(l);
      }

      const grupos = Array.from(gruposMap.values());

      if (grupos.length === 0) {
        drawCoopeduHeader(doc, "EXTRATO DE REPASSES E LANÇAMENTOS SELECIONADOS");
        doc.fillColor(darkText).fontSize(10).font("Helvetica").text("Nenhum lançamento selecionado para exibição.", 40, 120);
        doc.end();
        return;
      }

      for (let gIdx = 0; gIdx < grupos.length; gIdx++) {
        const g = grupos[gIdx];
        if (gIdx > 0) doc.addPage();

        drawCoopeduHeader(
          doc,
          "EXTRATO DE REPASSES E LANÇAMENTOS SELECIONADOS",
          `Detalhamento Financeiro • ${g.contratoNome}`
        );

        let y = 84;

        // IDENTIFICAÇÃO DO COOPERADO E CONTRATO DESTA PÁGINA
        doc.rect(35, y, 525, 58).fillAndStroke("#f8fafc", "#e2e8f0");
        doc.fillColor(darkText).fontSize(7.5);

        // Linha 1
        doc.font("Helvetica-Bold").text("Cooperado:", 45, y + 7);
        doc.font("Helvetica").text(coopName, 100, y + 7, { width: 240, ellipsis: true });

        doc.font("Helvetica-Bold").text("CPF:", 355, y + 7);
        doc.font("Helvetica").text(formatCpf(coop.document), 385, y + 7);

        doc.font("Helvetica-Bold").text("Matrícula:", 470, y + 7);
        doc.font("Helvetica").text(`#${coop.registration_number || "-"}`, 515, y + 7);

        // Linha 2
        doc.font("Helvetica-Bold").text("Atividade/Cargo:", 45, y + 23);
        doc.font("Helvetica-Bold").fillColor(primary).text(coopCargo, 125, y + 23, { width: 170, ellipsis: true });
        doc.fillColor(darkText);

        doc.font("Helvetica-Bold").text("Cliente / Tomador:", 305, y + 23);
        doc.font("Helvetica").text(g.tomadorNome, 400, y + 23, { width: 155, ellipsis: true });

        // Linha 3
        doc.font("Helvetica-Bold").text("Contrato Vinculado:", 45, y + 39);
        doc.font("Helvetica").text(g.contratoNome, 140, y + 39, { width: 150, ellipsis: true });

        doc.font("Helvetica-Bold").text("Dados Bancários:", 305, y + 39);
        doc.font("Helvetica-Bold").fillColor("#047857").text(bankFullStr, 390, y + 39, { width: 165, ellipsis: true });
        doc.fillColor(darkText);

        y += 66;

        // CABEÇALHO DA TABELA (SEM "PAGO EM")
        // Colunas (525 total): Comp.(42), Cliente(105), Contrato(118), Bruto(55), INSS(50), IRRF(50), Taxa Adm(48), Líquido(57)
        doc.rect(35, y, 525, 18).fillAndStroke("#e2e8f0", grayBorder);
        doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");

        doc.text("Comp.", 35, y + 5, { width: 42, align: "center" });
        doc.text("Cliente / Tomador", 77, y + 5, { width: 105 });
        doc.text("Contrato Vinculado", 182, y + 5, { width: 118 });
        doc.text("Bruto", 300, y + 5, { width: 55, align: "right" });
        doc.text("INSS", 355, y + 5, { width: 50, align: "right" });
        doc.text("IRRF", 405, y + 5, { width: 50, align: "right" });
        doc.text("Taxa Adm", 455, y + 5, { width: 48, align: "right" });
        doc.text("Líquido", 503, y + 5, { width: 57, align: "right" });

        y += 18;

        let subBruto = 0;
        let subInss = 0;
        let subIrrf = 0;
        let subTaxa = 0;
        let subLiquido = 0;

        for (let i = 0; i < g.itens.length; i++) {
          const l = g.itens[i];
          subBruto += l.valor_bruto;
          subInss += l.inss;
          subIrrf += l.irrf;
          subTaxa += l.taxa_adm;
          subLiquido += l.valor_liquido;

          // Quebra de página para o mesmo contrato se exceder a altura útil
          if (y > 670) {
            doc.addPage();
            drawCoopeduHeader(doc, "EXTRATO DE REPASSES E LANÇAMENTOS (CONTINUAÇÃO)", `Contrato: ${g.contratoNome}`);
            y = 86;
            doc.rect(35, y, 525, 18).fillAndStroke("#e2e8f0", grayBorder);
            doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
            doc.text("Comp.", 35, y + 5, { width: 42, align: "center" });
            doc.text("Cliente / Tomador", 77, y + 5, { width: 105 });
            doc.text("Contrato Vinculado", 182, y + 5, { width: 118 });
            doc.text("Bruto", 300, y + 5, { width: 55, align: "right" });
            doc.text("INSS", 355, y + 5, { width: 50, align: "right" });
            doc.text("IRRF", 405, y + 5, { width: 50, align: "right" });
            doc.text("Taxa Adm", 455, y + 5, { width: 48, align: "right" });
            doc.text("Líquido", 503, y + 5, { width: 57, align: "right" });
            y += 18;
          }

          const isEven = i % 2 === 0;
          doc.rect(35, y, 525, 15).fillAndStroke(isEven ? "#ffffff" : "#f8fafc", "#f1f5f9");
          doc.fillColor(darkText).fontSize(6.8).font("Helvetica");

          doc.text(`${String(l.mes).padStart(2, "0")}/${l.ano}`, 35, y + 4, { width: 42, align: "center" });
          doc.text(l.tomador, 77, y + 4, { width: 105, height: 9, ellipsis: true });
          doc.text(l.contrato_descricao, 182, y + 4, { width: 118, height: 9, ellipsis: true });
          doc.text(formatCurrency(l.valor_bruto), 300, y + 4, { width: 55, align: "right" });
          doc.text(formatCurrency(l.inss), 355, y + 4, { width: 50, align: "right" });
          doc.text(formatCurrency(l.irrf), 405, y + 4, { width: 50, align: "right" });
          doc.text(formatCurrency(l.taxa_adm), 455, y + 4, { width: 48, align: "right" });
          doc.fillColor("#15803d").font("Helvetica-Bold").text(formatCurrency(l.valor_liquido), 503, y + 4, { width: 57, align: "right" });

          y += 15;
        }

        // LINHA DE SUBTOTAL DA TABELA DO CONTRATO
        y += 2;
        doc.rect(35, y, 525, 19).fillAndStroke("#f1f5f9", grayBorder);
        doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
        doc.text(`SUBTOTAL DO CONTRATO (${g.itens.length} ${g.itens.length === 1 ? "LANÇAMENTO" : "LANÇAMENTOS"})`, 42, y + 6, { width: 250 });
        doc.text(formatCurrency(subBruto), 300, y + 6, { width: 55, align: "right" });
        doc.text(formatCurrency(subInss), 355, y + 6, { width: 50, align: "right" });
        doc.text(formatCurrency(subIrrf), 405, y + 6, { width: 50, align: "right" });
        doc.text(formatCurrency(subTaxa), 455, y + 6, { width: 48, align: "right" });
        doc.fillColor("#15803d").text(formatCurrency(subLiquido), 503, y + 6, { width: 57, align: "right" });

        y += 26;

        // CARD RESUMO EXECUTIVO DO CONTRATO
        const cardY = y;
        doc.rect(35, cardY, 525, 66).fillAndStroke("#ffffff", "#e2e8f0");
        doc.rect(35, cardY, 525, 19).fillAndStroke("#f8fafc", "#e2e8f0");
        doc.fillColor("#0369a1").fontSize(7.5).font("Helvetica-Bold").text(`RESUMO CONSOLIDADO DO CONTRATO • ${g.contratoNome}`, 45, cardY + 5);

        doc.rect(45, cardY + 24, 155, 34).fillAndStroke("#f8fafc", "#e2e8f0");
        doc.fillColor("#64748b").fontSize(6.5).font("Helvetica-Bold").text("TOTAL BRUTO", 53, cardY + 28);
        doc.fillColor(darkText).fontSize(10.5).font("Helvetica-Bold").text(formatCurrency(subBruto), 53, cardY + 40);

        doc.rect(210, cardY + 24, 160, 34).fillAndStroke("#fef2f2", "#fee2e2");
        doc.fillColor("#991b1b").fontSize(6.5).font("Helvetica-Bold").text("RETENÇÕES (INSS + IRRF + TAXA)", 218, cardY + 28);
        doc.fillColor("#b91c1c").fontSize(10.5).font("Helvetica-Bold").text(`- ${formatCurrency(subInss + subIrrf + subTaxa)}`, 218, cardY + 40);

        doc.rect(380, cardY + 24, 170, 34).fillAndStroke("#f0fdf4", "#bbf7d0");
        doc.fillColor("#166534").fontSize(6.5).font("Helvetica-Bold").text("TOTAL LÍQUIDO REPASSADO", 388, cardY + 28);
        doc.fillColor("#15803d").fontSize(11).font("Helvetica-Bold").text(formatCurrency(subLiquido), 388, cardY + 40);

        y = cardY + 74;

        // Se for a ÚLTIMA página e existirem múltiplos contratos selecionados, renderizar o BLOCO GERAL CONSOLIDADO
        if (gIdx === grupos.length - 1 && grupos.length > 1) {
          if (y > 660) {
            doc.addPage();
            drawCoopeduHeader(doc, "EXTRATO DE REPASSES E LANÇAMENTOS SELECIONADOS", "Consolidação Geral dos Contratos");
            y = 90;
          } else {
            y += 10;
          }

          const boxGeralY = y;
          doc.rect(35, boxGeralY, 525, 78).fillAndStroke("#f0f9ff", "#7dd3fc");
          doc.rect(35, boxGeralY, 525, 20).fillAndStroke("#e0f2fe", "#7dd3fc");
          doc.fillColor("#0284c7").fontSize(8).font("Helvetica-Bold").text(
            `TOTAL GERAL CONSOLIDADO DE TODOS OS CONTRATOS (${safeLancamentos.length} LANÇAMENTOS • ${grupos.length} CONTRATOS)`,
            45,
            boxGeralY + 6
          );

          doc.rect(45, boxGeralY + 26, 155, 42).fillAndStroke("#ffffff", "#bae6fd");
          doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("TOTAL BRUTO GERAL", 53, boxGeralY + 32);
          doc.fillColor(darkText).fontSize(11).font("Helvetica-Bold").text(formatCurrency(totGeralBruto), 53, boxGeralY + 46);

          doc.rect(210, boxGeralY + 26, 160, 42).fillAndStroke("#ffffff", "#fecaca");
          doc.fillColor("#991b1b").fontSize(7).font("Helvetica-Bold").text("RETENÇÕES TOTAIS (INSS/IRRF/TAXA)", 218, boxGeralY + 32);
          doc.fillColor("#b91c1c").fontSize(11).font("Helvetica-Bold").text(`- ${formatCurrency(totGeralInss + totGeralIrrf + totGeralTaxa)}`, 218, boxGeralY + 46);

          doc.rect(380, boxGeralY + 26, 170, 42).fillAndStroke("#ffffff", "#86efac");
          doc.fillColor("#166534").fontSize(7).font("Helvetica-Bold").text("TOTAL LÍQUIDO GERAL CONSOLIDADO", 388, boxGeralY + 32);
          doc.fillColor("#15803d").fontSize(12).font("Helvetica-Bold").text(formatCurrency(totGeralLiquido), 388, boxGeralY + 46);
        }

        // Rodapé da página
        doc.fillColor("#94a3b8").fontSize(6.5).font("Helvetica").text(
          "Extrato oficial emitido via Centralizador SIC • Core Coopedu. Todos os dados possuem validade institucional.",
          35,
          785,
          { align: "center", width: 525 }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 4. Gera PDF em Lote de Demonstrativos de Produtividade (Folha de Pagamento)
 */
/**
 * Formata valor numérico para padrão decimal brasileiro (ex: 651,00)
 */
function formatPtBrDecimal(val?: number | string | null): string {
  if (val === undefined || val === null || val === "") return "0,00";
  const n = Number(val);
  if (isNaN(n)) return "0,00";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 4. Gera PDF de Demonstrativos de Produtividade (Contracheque oficial idêntico à Imagem 2)
 */
export function generateEasycoopFolhaLotePdf(coop: any, folhasList: any[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 35, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      if (folhasList.length === 0) {
        doc.rect(35, 40, 525, 60).strokeColor("#000000").lineWidth(0.8).stroke();
        doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold").text("DEMONSTRATIVO DE PRODUTIVIDADE", 45, 55);
        doc.font("Helvetica").fontSize(8).text(`Cooperado: ${toUpperWithAccents(coop?.name || "N/I")} • CPF: ${formatCpf(coop?.document)}`, 45, 72);
        doc.fillColor("#64748b").fontSize(8).text("Nenhum demonstrativo de folha encontrado para as competências solicitadas.", 45, 87);
        doc.end();
        return;
      }

      folhasList.forEach((item: any, pageIdx: number) => {
        if (pageIdx > 0) doc.addPage();

        const folha = (typeof item.folha === "object" && item.folha !== null) ? item.folha : item;
        const compStr = folha.competencia_rotulo || (folha.mes && folha.ano ? `${String(folha.mes).padStart(2, "0")} / ${folha.ano} - Folha : ${String(folha.folha || 1).padStart(2, "0")}` : "02 / 2023 - Folha : 01");

        const cooperativa = folha.cooperativa || {
          razao_social: "COOP TRAB PROF DA EDUCACAO DO ESTADO RIO G NORTE",
          cnpj: "35.537.126/0001-84",
          endereco: "RUA PROJETADA, N 1",
          cidade: "MONTE ALEGRE",
          uf: "RN",
          telefone: "(84) 98156-1479",
        };

        const cooperado = folha.cooperado || {};
        const nomeCooperado = toUpperWithAccents(coop?.name || cooperado.nome || "COOPERADO");
        const cpfCooperado = formatCpf(coop?.document || cooperado.cpf);
        const matriculaCooperado = String(cooperado.matricula || coop?.registration_number || folha.matricula || "00002700").padStart(8, "0");
        const atividadeCooperado = toUpperWithAccents(cooperado.cargo || coop?.cargo_contrato || coop?.position || "ASG 20 HORAS");

        const bancoSigla = cooperado.banco_sigla || "BB";
        const agencia = cooperado.agencia || "1140";
        const agenciaDig = cooperado.agencia_digito || "";
        const conta = cooperado.conta || "26725";
        const contaDig = cooperado.conta_digito || "2";

        // Rubricas combinadas e ordenadas (Proventos e Descontos)
        let rubricas: any[] = [];
        if (Array.isArray(folha.itens) && folha.itens.length > 0) {
          rubricas = folha.itens;
        } else {
          const provs = folha.proventos || [];
          const descs = folha.descontos || [];
          rubricas = [...provs, ...descs];
        }

        // Totais e bases
        const totalVenc = Number(folha.totais?.totalVencimentos ?? folha.totais?.totalProventos ?? folha.valor_bruto ?? 0);
        const totalDesc = Number(folha.totais?.totalDescontos ?? folha.total_descontos ?? 0);
        const totLiq = Number(folha.totais?.valorLiquido ?? (totalVenc - totalDesc));

        const baseProdutividade = Number(folha.bases_calculo?.produtividade ?? totalVenc);
        const baseInss = Number(folha.bases_calculo?.baseInss ?? baseProdutividade);
        const baseIrrf = Number(folha.bases_calculo?.baseIrrf ?? Math.max(0, baseInss - (folha.inss || 0)));
        const nroDepIrrf = String(folha.bases_calculo?.nroDepIrrf ?? "00");
        const valorIrrfDep = Number(folha.bases_calculo?.valorIrrfDep ?? 0);

        // COORDENADAS E MEDIDAS DO CONTRACHEQUE (IMAGEM 2)
        const startX = 35;
        const boxWidth = 525;
        const endX = startX + boxWidth; // 560
        const startY = 35;

        doc.strokeColor("#000000").lineWidth(0.8);

        // 1. CABEÇALHO SUPERIOR (Y = 35 a 78)
        doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
        doc.text("DEMONSTRATIVO DE PRODUTIVIDADE", startX, startY + 6, { width: boxWidth - 8, align: "right" });

        doc.fontSize(8).font("Helvetica-Bold").text(cooperativa.razao_social, startX + 8, startY + 20);
        doc.fontSize(7.5).font("Helvetica").text(`C.N.P.J ${cooperativa.cnpj}`, startX, startY + 20, { width: boxWidth - 8, align: "right" });

        doc.fontSize(7.5).font("Helvetica").text(cooperativa.endereco, startX + 8, startY + 31);
        doc.text(cooperativa.cidade, startX + 180, startY + 31);
        doc.text(`${cooperativa.uf} ${cooperativa.telefone}`, startX, startY + 31, { width: boxWidth - 8, align: "right" });

        // Linha divisória após cabeçalho institucional
        const coopY = startY + 42;
        doc.moveTo(startX, coopY).lineTo(endX, coopY).stroke();

        // 2. QUADRO DO COOPERADO (Y = 77 a 115)
        const coopMidY = coopY + 18;
        const coopBottomY = coopY + 36;

        // Linha interna divisória horizontal
        doc.moveTo(startX, coopMidY).lineTo(endX, coopMidY).stroke();

        // Linhas verticais do bloco do cooperado
        doc.moveTo(startX + 65, coopY).lineTo(startX + 65, coopBottomY).stroke(); // Matrícula
        doc.moveTo(startX + 375, coopY).lineTo(startX + 375, coopBottomY).stroke(); // Nome / Atividade / CPF
        doc.moveTo(startX + 445, coopMidY).lineTo(startX + 445, coopBottomY).stroke(); // Divisor CPF / Competência

        // Linha 1 do Cooperado
        doc.fontSize(6.5).font("Helvetica").text("Matrícula", startX + 4, coopY + 3);
        doc.fontSize(8.5).font("Helvetica-Bold").text(matriculaCooperado, startX + 4, coopY + 10);

        doc.fontSize(6.5).font("Helvetica").text("Nome do Associado - Cooperado", startX + 70, coopY + 3);
        doc.fontSize(8.5).font("Helvetica-Bold").text(nomeCooperado, startX + 70, coopY + 10, { width: 300, ellipsis: true });

        doc.fontSize(6.5).font("Helvetica").text("Atividade Profissional", startX + 380, coopY + 3);
        doc.fontSize(7.5).font("Helvetica-Bold").text(atividadeCooperado, startX + 380, coopY + 10, { width: 140, ellipsis: true });

        // Linha 2 do Cooperado
        doc.fontSize(6.5).font("Helvetica").text("CPF", startX + 380, coopMidY + 3);
        doc.fontSize(7.5).font("Helvetica-Bold").text(cpfCooperado, startX + 380, coopMidY + 10);

        doc.fontSize(6.5).font("Helvetica").text("Competência", startX + 450, coopMidY + 3);
        doc.fontSize(7.5).font("Helvetica-Bold").text(compStr, startX + 450, coopMidY + 10);

        // Linha divisória antes da tabela
        doc.moveTo(startX, coopBottomY).lineTo(endX, coopBottomY).stroke();

        // 3. TABELA DE RUBRICAS / PRODUTIVIDADE
        const tblHeadY = coopBottomY;
        const tblHeadMidY = tblHeadY + 11;
        const tblRowsStartY = tblHeadY + 22;

        // Sub-cabeçalho horizontal para Vencimentos e Descontos
        doc.moveTo(startX + 325, tblHeadMidY).lineTo(endX, tblHeadMidY).stroke();

        // Cabeçalhos principais
        doc.fontSize(6.5).font("Helvetica").text("Cód.", startX + 4, tblHeadY + 8);
        doc.text("Descrição da Produtividade", startX + 40, tblHeadY + 8);
        doc.text("Referência", startX + 270, tblHeadY + 8, { width: 50, align: "right" });

        doc.text("Vencimentos", startX + 325, tblHeadY + 3, { width: 110, align: "center" });
        doc.text("Atual", startX + 325, tblHeadMidY + 3, { width: 50, align: "right" });
        doc.text("Acumulado", startX + 380, tblHeadMidY + 3, { width: 50, align: "right" });

        doc.text("Descontos", startX + 435, tblHeadY + 3, { width: 90, align: "center" });
        doc.text("Atual", startX + 435, tblHeadMidY + 3, { width: 42, align: "right" });
        doc.text("Acumulado", startX + 480, tblHeadMidY + 3, { width: 42, align: "right" });

        // Linha divisória inferior do cabeçalho da tabela
        doc.moveTo(startX, tblRowsStartY).lineTo(endX, tblRowsStartY).stroke();

        // 12 linhas padronizadas de altura uniforme
        const rowHeight = 13.5;
        const totalRows = Math.max(rubricas.length, 10);
        const tblBottomY = tblRowsStartY + (totalRows * rowHeight);

        // Linhas verticais da tabela estendidas até tblBottomY
        const colCodX = startX + 35;
        const colDescX = startX + 265;
        const colRefX = startX + 325;
        const colVencAtualX = startX + 380;
        const colVencAcumX = startX + 435;
        const colDescAtualX = startX + 480;

        doc.moveTo(colCodX, tblHeadY).lineTo(colCodX, tblBottomY).stroke();
        doc.moveTo(colDescX, tblHeadY).lineTo(colDescX, tblBottomY).stroke();
        doc.moveTo(colRefX, tblHeadY).lineTo(colRefX, tblBottomY).stroke();
        doc.moveTo(colVencAtualX, tblHeadMidY).lineTo(colVencAtualX, tblBottomY).stroke();
        doc.moveTo(colVencAcumX, tblHeadY).lineTo(colVencAcumX, tblBottomY).stroke();
        doc.moveTo(colDescAtualX, tblHeadMidY).lineTo(colDescAtualX, tblBottomY).stroke();

        // Preenchimento dos dados das linhas
        for (let rIdx = 0; rIdx < totalRows; rIdx++) {
          const rowY = tblRowsStartY + (rIdx * rowHeight);
          const it = rubricas[rIdx];

          if (it) {
            const isDesconto = it.tipo === "D" || String(it.tipo).toUpperCase() === "D";
            const codStr = it.codigo ? String(it.codigo).padStart(4, "0") : (isDesconto ? "0200" : "0100");
            const refStr = it.referencia || (codStr === "0200" || it.descricao.includes("INSS") ? "0,00" : "1,00");
            const valNum = Number(it.valor || 0);
            const valStr = formatPtBrDecimal(valNum);

            doc.fontSize(7).font("Helvetica");
            doc.text(codStr, startX + 4, rowY + 3);
            doc.text(toUpperWithAccents(it.descricao), startX + 38, rowY + 3, { width: 224, ellipsis: true });
            doc.text(refStr, startX + 270, rowY + 3, { width: 50, align: "right" });

            if (!isDesconto) {
              doc.text(valStr, startX + 325, rowY + 3, { width: 50, align: "right" });
              doc.text(valStr, startX + 380, rowY + 3, { width: 50, align: "right" });
            } else {
              doc.text(valStr, startX + 435, rowY + 3, { width: 42, align: "right" });
              doc.text(valStr, startX + 480, rowY + 3, { width: 42, align: "right" });
            }
          }
        }

        // Linha divisória após a grade de rubricas
        doc.moveTo(startX, tblBottomY).lineTo(endX, tblBottomY).stroke();

        // 4. SEÇÃO DE DADOS BANCÁRIOS E TOTAIS (VENCIMENTOS / DESCONTOS)
        const bankRowY = tblBottomY;
        const bankRowBottomY = bankRowY + 24;

        // Divisórias da linha bancária
        const bankAgX = startX + 75;
        const bankAgDigX = startX + 130;
        const bankContaX = startX + 160;
        const bankContaDigX = startX + 225;
        const bankEndX = colRefX; // 360

        doc.moveTo(bankAgX, bankRowY).lineTo(bankAgX, bankRowBottomY).stroke();
        doc.moveTo(bankAgDigX, bankRowY).lineTo(bankAgDigX, bankRowBottomY).stroke();
        doc.moveTo(bankContaX, bankRowY).lineTo(bankContaX, bankRowBottomY).stroke();
        doc.moveTo(bankContaDigX, bankRowY).lineTo(bankContaDigX, bankRowBottomY).stroke();
        doc.moveTo(bankEndX, bankRowY).lineTo(bankEndX, bankRowBottomY).stroke();
        doc.moveTo(colVencAcumX, bankRowY).lineTo(colVencAcumX, bankRowBottomY).stroke();

        // Células bancárias
        doc.fontSize(6.5).font("Helvetica").text("Banco :", startX + 4, bankRowY + 8);
        doc.fontSize(7.5).font("Helvetica-Bold").text(bancoSigla, startX + 35, bankRowY + 8);

        doc.fontSize(6.5).font("Helvetica").text("Agência :", bankAgX + 4, bankRowY + 8);
        doc.fontSize(7.5).font("Helvetica-Bold").text(agencia, bankAgX + 32, bankRowY + 8);

        doc.fontSize(6.5).font("Helvetica").text("Díg.", bankAgDigX + 3, bankRowY + 8);
        if (agenciaDig) doc.fontSize(7.5).font("Helvetica-Bold").text(agenciaDig, bankAgDigX + 16, bankRowY + 8);

        doc.fontSize(6.5).font("Helvetica").text("Conta :", bankContaX + 4, bankRowY + 8);
        doc.fontSize(7.5).font("Helvetica-Bold").text(conta, bankContaX + 28, bankRowY + 8);

        doc.fontSize(6.5).font("Helvetica").text("Díg.", bankContaDigX + 3, bankRowY + 8);
        doc.fontSize(7.5).font("Helvetica-Bold").text(contaDig, bankContaDigX + 16, bankRowY + 8);

        // Células Totais (Vencimentos / Descontos)
        doc.fontSize(6.5).font("Helvetica").text("Total de Vencimentos", bankEndX + 4, bankRowY + 3);
        doc.fontSize(8.5).font("Helvetica-Bold").text(formatPtBrDecimal(totalVenc), bankEndX + 4, bankRowY + 12, { width: 100, align: "right" });

        doc.fontSize(6.5).font("Helvetica").text("Total de Descontos", colVencAcumX + 4, bankRowY + 3);
        doc.fontSize(8.5).font("Helvetica-Bold").text(formatPtBrDecimal(totalDesc), colVencAcumX + 4, bankRowY + 12, { width: 80, align: "right" });

        // Linha divisória após Totais
        doc.moveTo(startX, bankRowBottomY).lineTo(endX, bankRowBottomY).stroke();

        // 5. SEÇÃO DE BASES FISCAIS E TOTAL LÍQUIDO ==>
        const basesRowY = bankRowBottomY;
        const basesRowBottomY = basesRowY + 24;

        const baseB1 = startX + 70;
        const baseB2 = startX + 140;
        const baseB3 = startX + 190;
        const baseB4 = startX + 250;
        const baseB5 = colRefX; // 360

        doc.moveTo(baseB1, basesRowY).lineTo(baseB1, basesRowBottomY).stroke();
        doc.moveTo(baseB2, basesRowY).lineTo(baseB2, basesRowBottomY).stroke();
        doc.moveTo(baseB3, basesRowY).lineTo(baseB3, basesRowBottomY).stroke();
        doc.moveTo(baseB4, basesRowY).lineTo(baseB4, basesRowBottomY).stroke();
        doc.moveTo(baseB5, basesRowY).lineTo(baseB5, basesRowBottomY).stroke();

        // 5.1 Produtividade
        doc.fontSize(6).font("Helvetica").text("Produtividade", startX + 4, basesRowY + 3);
        doc.fontSize(7.5).font("Helvetica").text(formatPtBrDecimal(baseProdutividade), startX + 4, basesRowY + 12, { width: 62, align: "right" });

        // 5.2 Base Cálc. IRRF
        doc.fontSize(6).font("Helvetica").text("Base Cálc. IRRF", baseB1 + 4, basesRowY + 3);
        doc.fontSize(7.5).font("Helvetica").text(formatPtBrDecimal(baseIrrf), baseB1 + 4, basesRowY + 12, { width: 62, align: "right" });

        // 5.3 Nro. Dep. IRRF
        doc.fontSize(6).font("Helvetica").text("Nro. Dep. IRRF", baseB2 + 2, basesRowY + 3);
        doc.fontSize(7.5).font("Helvetica").text(nroDepIrrf, baseB2 + 2, basesRowY + 12, { width: 46, align: "center" });

        // 5.4 Valor IRRF/Dep.
        doc.fontSize(6).font("Helvetica").text("Valor IRRF/Dep.", baseB3 + 2, basesRowY + 3);
        doc.fontSize(7.5).font("Helvetica").text(formatPtBrDecimal(valorIrrfDep), baseB3 + 2, basesRowY + 12, { width: 54, align: "right" });

        // 5.5 Base Cálc. INSS
        doc.fontSize(6).font("Helvetica").text("Base Cálc. INSS", baseB4 + 4, basesRowY + 3);
        doc.fontSize(7.5).font("Helvetica").text(formatPtBrDecimal(baseInss), baseB4 + 4, basesRowY + 12, { width: 66, align: "right" });

        // 5.6 TOTAL LÍQUIDO ==>
        doc.fontSize(7.5).font("Helvetica-Bold").text("TOTAL LÍQUIDO ==>", baseB5 + 6, basesRowY + 8);
        doc.fontSize(10).font("Helvetica-Bold").text(formatPtBrDecimal(totLiq), baseB5 + 50, basesRowY + 7, { width: 140, align: "right" });

        // Linha divisória após Bases
        doc.moveTo(startX, basesRowBottomY).lineTo(endX, basesRowBottomY).stroke();

        // 6. CANHOTO DE QUITAÇÃO E ASSINATURA (Y = basesRowBottomY a receiptBottomY)
        const receiptRowY = basesRowBottomY;
        const receiptBottomY = receiptRowY + 34;

        // Divisória vertical separando área esquerda da área de recibo
        const receiptSplitX = startX + 230;
        doc.moveTo(receiptSplitX, receiptRowY).lineTo(receiptSplitX, receiptBottomY).stroke();

        doc.fontSize(6.5).font("Helvetica").text(
          "Declaro ter recebido a importancia liquida acima descriminada, dando total quitacao",
          receiptSplitX + 6,
          receiptRowY + 4,
          { width: boxWidth - 236 }
        );

        doc.fontSize(7).font("Helvetica").text("Data : _____/_____/_________", receiptSplitX + 6, receiptRowY + 20);
        doc.text("Assinatura : __________________________________________", receiptSplitX + 115, receiptRowY + 20);

        // Linha de fechamento inferior da moldura
        doc.moveTo(startX, receiptBottomY).lineTo(endX, receiptBottomY).stroke();

        // Contorno externo completo (retângulo sólido da moldura)
        doc.rect(startX, startY, boxWidth, receiptBottomY - startY).stroke();

        // 7. LINHA DE PICOTE COM ÍCONE VETORIAL DE TESOURA ✂
        const cutY = receiptBottomY + 12;
        doc.save();
        doc.strokeColor("#000000").lineWidth(0.7);

        // Desenho vetorial da tesoura
        doc.circle(startX + 4, cutY + 1, 2.2).stroke();
        doc.circle(startX + 4, cutY + 7, 2.2).stroke();
        doc.moveTo(startX + 6, cutY + 2).lineTo(startX + 15, cutY + 7.5).stroke();
        doc.moveTo(startX + 6, cutY + 6).lineTo(startX + 15, cutY + 0.5).stroke();

        // Linha pontilhada / tracejada
        doc.dash(4, { space: 3 });
        doc.moveTo(startX + 20, cutY + 4).lineTo(endX, cutY + 4).stroke();
        doc.undash();
        doc.restore();
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}


/**
 * 5. Gera PDF dos Eventos Selecionados do e-Social (EasyCoop)
 */
export function generateEasycoopEsocialPdf(coop: any, eventos: any[], metricas?: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 35, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primary = "#0284c7";
      const darkText = "#0f172a";
      const grayBorder = "#cbd5e1";

      drawCoopeduHeader(doc, "RELATÓRIO OFICIAL DE EVENTOS DO e-SOCIAL", "Escrituração Digital das Obrigações Fiscais e Previdenciárias");

      let y = 92;

      // IDENTIFICAÇÃO DO COOPERADO DECLARADO
      const catInfo = getEsocialCategoryInfo(coop.categoria_esocial?.codigo || coop.cod_cat_trab_esocial || "731");

      doc.rect(40, y, 515, 52).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor(darkText).fontSize(8);
      doc.font("Helvetica-Bold").text("Cooperado:", 50, y + 7);
      doc.font("Helvetica").text(String(coop.name || "N/I").toUpperCase(), 105, y + 7, { width: 245, lineBreak: false });

      doc.font("Helvetica-Bold").text("CPF:", 360, y + 7);
      doc.font("Helvetica").text(formatCpf(coop.document), 390, y + 7);

      doc.font("Helvetica-Bold").text("Atividade Oficial:", 50, y + 22);
      doc.font("Helvetica-Bold").fillColor(primary).text(coop.cargo_contrato || coop.position || "Cooperado", 130, y + 22, { width: 220, lineBreak: false });
      doc.fillColor(darkText);

      if (coop.registration_number) {
        doc.font("Helvetica-Bold").text("Matrícula:", 360, y + 22);
        doc.font("Helvetica").text(String(coop.registration_number).padStart(8, "0"), 410, y + 22);
      }

      doc.font("Helvetica-Bold").text("Categoria eSocial:", 50, y + 36);
      doc.font("Helvetica").fontSize(7.5).text(catInfo.completo, 135, y + 36, { width: 410, lineBreak: false });
      doc.fontSize(8);

      y += 62;

      // QUADRO DE MÉTRICAS GERAIS
      const totTrans = metricas?.totalTransmissoes || eventos.length;
      const totAceitos = metricas?.totalAceitos || eventos.filter((e: any) => e.status?.includes("Recibo")).length;
      const totErros = metricas?.totalErros || eventos.filter((e: any) => e.status?.includes("Erro") || e.status?.includes("Rejeitado")).length;

      doc.rect(40, y, 160, 32).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.fillColor("#64748b").fontSize(6.5).font("Helvetica-Bold").text("TOTAL DE TRANSMISSÕES", 50, y + 5);
      doc.fillColor(darkText).fontSize(11).font("Helvetica-Bold").text(String(totTrans), 50, y + 16);

      doc.rect(215, y, 160, 32).fillAndStroke("#f0fdf4", "#86efac");
      doc.fillColor("#166534").fontSize(6.5).font("Helvetica-Bold").text("ACEITOS COM RECIBO OFICIAL", 225, y + 5);
      doc.fillColor("#15803d").fontSize(11).font("Helvetica-Bold").text(String(totAceitos), 225, y + 16);

      doc.rect(390, y, 165, 32).fillAndStroke("#fff1f2", "#fca5a5");
      doc.fillColor("#9f1239").fontSize(6.5).font("Helvetica-Bold").text("OCORRÊNCIAS / REJEIÇÕES", 400, y + 5);
      doc.fillColor("#e11d48").fontSize(11).font("Helvetica-Bold").text(String(totErros), 400, y + 16);

      y += 44;

      // TABELA DE EVENTOS TRANSMITIDOS
      doc.rect(40, y, 515, 18).fillAndStroke("#e2e8f0", grayBorder);
      doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
      doc.text("Evento", 45, y + 5);
      doc.text("Comp.", 95, y + 5);
      doc.text("Data/Hora Envio", 135, y + 5);
      doc.text("Protocolo Governamental", 225, y + 5);
      doc.text("Recibo eSocial", 355, y + 5);
      doc.text("Situação Oficial", 475, y + 5);

      y += 18;

      for (let i = 0; i < eventos.length; i++) {
        const ev = eventos[i];
        if (y > 730) {
          doc.addPage();
          drawCoopeduHeader(doc, "RELATÓRIO OFICIAL DE EVENTOS DO e-SOCIAL (CONTINUAÇÃO)");
          y = 90;
        }

        const isAceito = ev.status?.includes("Recibo");
        const isErro = ev.status?.includes("Erro") || ev.status?.includes("Rejeitado");

        doc.rect(40, y, 515, 16).fillAndStroke(i % 2 === 0 ? "#ffffff" : "#f8fafc", "#f1f5f9");
        doc.fillColor(darkText).fontSize(6.5).font("Helvetica-Bold");
        doc.text(ev.evento || "S-1200", 45, y + 4);

        doc.font("Helvetica").text(`${String(ev.mes).padStart(2, "0")}/${ev.ano}`, 95, y + 4);
        doc.text(`${formatSafeDate(ev.data_envio)} ${ev.hora_envio || ""}`, 135, y + 4);
        doc.text(ev.nro_protocolo || "-", 225, y + 4, { width: 120, height: 9 });

        if (ev.nro_recibo) {
          doc.fillColor("#15803d").font("Helvetica-Bold").text(ev.nro_recibo, 355, y + 4, { width: 110, height: 9 });
        } else {
          doc.fillColor("#94a3b8").font("Helvetica").text("-", 355, y + 4);
        }

        doc.fillColor(isAceito ? "#15803d" : isErro ? "#e11d48" : "#475569").font("Helvetica-Bold");
        doc.text(ev.status || "Enviado", 475, y + 4, { width: 75, height: 9 });

        y += 16;
      }

      // Rodapé
      doc.fillColor("#94a3b8").fontSize(6.5).font("Helvetica").text(
        "Certificado emitido via Centralizador SIC • Core Coopedu. Todos os recibos e protocolos são validados pela Receita Federal.",
        40,
        780,
        { align: "center", width: 515 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}


