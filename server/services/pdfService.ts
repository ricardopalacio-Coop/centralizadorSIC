import PDFDocument from "pdfkit";

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

      doc
        .fillColor(primaryColor)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("COOPEDU", 55, 50);

      doc
        .fillColor(darkText)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA EDUCAÇÃO", 55, 68);

      doc
        .fillColor("#64748b")
        .fontSize(8)
        .font("Helvetica")
        .text("CNPJ: 10.423.176/0001-20 | BR 116, Fortaleza - CE | Core Coopedu", 55, 82);

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
      doc.fillColor(primaryColor).fontSize(16).font("Helvetica-Bold").text("COOPEDU", 55, 48);
      doc.fillColor(darkText).fontSize(10).font("Helvetica-Bold").text("PROPOSTA DE ADESÃO / ADMISSÃO DE COOPERADO", 55, 66);
      doc.fillColor("#475569").fontSize(8).font("Helvetica").text("Centralizador SIC — Sistema Integrado de Cooperativas | Core Coopedu", 55, 80);

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
      doc.fillColor(primaryColor).fontSize(16).font("Helvetica-Bold").text("COOPEDU", 55, 48);
      doc.fillColor(darkText).fontSize(10).font("Helvetica-Bold").text("SOLICITAÇÃO / TERMO DE DESLIGAMENTO DE COOPERADO", 55, 66);
      doc.fillColor("#475569").fontSize(8).font("Helvetica").text("Centralizador SIC — Sistema Integrado de Cooperativas | Core Coopedu", 55, 80);

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

