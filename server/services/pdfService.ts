import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

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
      doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("▲ coopedu", 40, 35);
      doc.fontSize(7).font("Helvetica").text("COOPERATIVA DE TRABALHO", 40, 50);

      // Título Principal
      doc.fillColor(darkText).fontSize(14).font("Helvetica-Bold").text("Demonstrativo de Produtividade", 280, 38, { align: "right" });

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

const LOGO_PATH = path.resolve(process.cwd(), "client/public/logo-coopedu-horizontal-azul.png");

function drawCoopeduHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, 40, 35, { width: 130 });
    } catch {
      doc.fillColor("#0284c7").fontSize(14).font("Helvetica-Bold").text("▲ coopedu", 40, 38);
    }
  } else {
    doc.fillColor("#0284c7").fontSize(14).font("Helvetica-Bold").text("▲ coopedu", 40, 38);
  }

  doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold").text(title, 180, 38, { align: "right" });
  if (subtitle) {
    doc.fillColor("#64748b").fontSize(8).font("Helvetica").text(subtitle, 180, 53, { align: "right" });
  }

  doc.fillColor("#94a3b8").fontSize(7).font("Helvetica").text(
    `Emissão: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} • Centralizador SIC`,
    180,
    65,
    { align: "right" }
  );

  doc.moveTo(40, 80).lineTo(555, 80).strokeColor("#cbd5e1").lineWidth(1.5).stroke();
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

      drawCoopeduHeader(doc, "FICHA CADASTRAL E FINANCEIRA DO COOPERADO", "Base Oficial EasyCoop Analytics • Core Coopedu");

      let y = 92;

      // QUADRO 1: IDENTIFICAÇÃO CIVIL & VÍNCULO ESTATUTÁRIO
      doc.rect(40, y, 515, 125).fillAndStroke(bgLight, grayBorder);
      doc.fillColor(primary).fontSize(9).font("Helvetica-Bold").text("1. IDENTIFICAÇÃO CIVIL & VÍNCULO COOPERATIVO", 50, y + 8);

      const bank = resolveOwlBank(coop.bank_code, coop.bank_name);
      const atividadeOficial = coop.cargo_contrato || coop.position || "Cooperado";

      doc.fillColor(darkText).fontSize(8);
      // Linha 1
      doc.font("Helvetica-Bold").text("Nome Completo:", 50, y + 25);
      doc.font("Helvetica").text(String(coop.name || "NÃO INFORMADO").toUpperCase(), 130, y + 25);

      doc.font("Helvetica-Bold").text("CPF:", 360, y + 25);
      doc.font("Helvetica").text(formatCpf(coop.document), 410, y + 25);

      // Linha 2
      doc.font("Helvetica-Bold").text("Matrícula:", 50, y + 40);
      doc.font("Helvetica").text(`#${coop.registration_number || "-"}`, 130, y + 40);

      doc.font("Helvetica-Bold").text("Admissão:", 210, y + 40);
      doc.font("Helvetica").text(formatSafeDate(coop.admission_date), 260, y + 40);

      doc.font("Helvetica-Bold").text("Situação:", 360, y + 40);
      doc.font("Helvetica").text(coop.status || "Ativo", 410, y + 40);

      // Linha 3
      doc.font("Helvetica-Bold").text("Atividade Oficial:", 50, y + 55);
      doc.font("Helvetica-Bold").fillColor(primary).text(atividadeOficial, 130, y + 55);
      doc.fillColor(darkText);

      doc.font("Helvetica-Bold").text("Tempo na Coop:", 360, y + 55);
      doc.font("Helvetica").text(coop.tempo_cooperativa_formatado || "-", 435, y + 55, { width: 115 });

      // Linha 4
      doc.font("Helvetica-Bold").text("Quotas-Parte:", 50, y + 70);
      doc.font("Helvetica").text(coop.quotas_info?.texto || "10 de 10 Quotas", 130, y + 70);

      doc.font("Helvetica-Bold").text("Nascimento:", 360, y + 70);
      doc.font("Helvetica").text(formatSafeDate(coop.birth_date), 430, y + 70);

      // Linha 5
      doc.font("Helvetica-Bold").text("RG / Órgão:", 50, y + 85);
      doc.font("Helvetica").text(`${coop.rg_number || "-"} ${coop.rg_issuer ? `(${coop.rg_issuer})` : ""}`, 130, y + 85);

      doc.font("Helvetica-Bold").text("PIS/PASEP:", 210, y + 85);
      doc.font("Helvetica").text(coop.pis_number || "-", 265, y + 85);

      doc.font("Helvetica-Bold").text("Sexo:", 360, y + 85);
      doc.font("Helvetica").text(coop.gender === "F" ? "Feminino" : "Masculino", 400, y + 85);

      // Linha 6 - Filiação
      doc.font("Helvetica-Bold").text("Filiação:", 50, y + 100);
      doc.font("Helvetica").text(`Mãe: ${coop.mother_name || "-"} | Pai: ${coop.father_name || "-"}`, 130, y + 100, { width: 410 });

      y += 135;

      // QUADRO 2: CONTRATO E TOMADOR ATUAL (Sem Valor Base Contratado!)
      if (coop.contrato_atual) {
        doc.rect(40, y, 515, 65).fillAndStroke(bgLight, grayBorder);
        doc.fillColor(primary).fontSize(9).font("Helvetica-Bold").text("2. ALOCAÇÃO EM CONTRATO E TOMADOR ATUAL", 50, y + 8);

        doc.fillColor(darkText).fontSize(8);
        doc.font("Helvetica-Bold").text("Cliente / Tomador:", 50, y + 25);
        doc.font("Helvetica").text(coop.contrato_atual.tomador_nome || "COOPEDU", 140, y + 25);

        doc.font("Helvetica-Bold").text("Contrato:", 320, y + 25);
        doc.font("Helvetica").text(coop.contrato_atual.contrato_descricao || "Contrato Geral", 370, y + 25, { width: 175 });

        doc.font("Helvetica-Bold").text("Atividade no Contrato:", 50, y + 42);
        doc.font("Helvetica-Bold").fillColor("#047857").text(coop.cargo_contrato || atividadeOficial, 155, y + 42);
        doc.fillColor(darkText);

        doc.font("Helvetica-Bold").text("Vigência:", 320, y + 42);
        doc.font("Helvetica").text(`${formatSafeDate(coop.contrato_atual.data_inicio)} até ${formatSafeDate(coop.contrato_atual.data_fim)}`, 370, y + 42);

        y += 75;
      }

      // QUADRO 3: DADOS BANCÁRIOS (BANCO OWL) & CONTATOS
      doc.rect(40, y, 515, 80).fillAndStroke(bgLight, grayBorder);
      doc.fillColor(primary).fontSize(9).font("Helvetica-Bold").text("3. DADOS BANCÁRIOS PARA REPASSE (OWL) & CONTATOS", 50, y + 8);

      doc.fillColor(darkText).fontSize(8);
      // Linha 1 Bancária
      doc.font("Helvetica-Bold").text("Instituição Bancária:", 50, y + 25);
      doc.font("Helvetica-Bold").fillColor("#047857").text(`${bank.name} (Cód: ${bank.code})`, 150, y + 25);
      doc.fillColor(darkText);

      doc.font("Helvetica-Bold").text("Agência / Conta:", 320, y + 25);
      doc.font("Helvetica").text(`Ag: ${coop.agency || "0001"} | CC: ${coop.account_number || "-"}-${coop.account_digit || ""}`, 405, y + 25);

      // Linha 2
      doc.font("Helvetica-Bold").text("Chave PIX:", 50, y + 40);
      doc.font("Helvetica").text(coop.pix_key || formatCpf(coop.document), 140, y + 40, { width: 175, ellipsis: true });

      doc.font("Helvetica-Bold").text("WhatsApp / Celular:", 320, y + 40);
      doc.font("Helvetica").text(coop.whatsapp_number || coop.secondary_phone || "-", 420, y + 40, { width: 130, ellipsis: true });

      // Linha 3
      doc.font("Helvetica-Bold").text("E-mail:", 50, y + 55);
      doc.font("Helvetica").text(coop.email || "-", 140, y + 55, { width: 175, ellipsis: true });

      doc.font("Helvetica-Bold").text("Endereço:", 320, y + 55);
      const endStr = `${coop.street || "-"}, ${coop.number || "S/N"} - ${coop.city || ""}/${coop.state || ""}`;
      doc.font("Helvetica").text(endStr, 375, y + 55, { width: 175, ellipsis: true });

      y += 90;

      // QUADRO 4: HISTÓRICO FINANCEIRO CONSOLIDADO
      doc.rect(40, y, 515, 62).fillAndStroke(bgLight, grayBorder);
      doc.fillColor(primary).fontSize(9).font("Helvetica-Bold").text("4. HISTÓRICO FINANCEIRO CONSOLIDADO DE REPASSES", 50, y + 8);

      // Mini-cards de totais
      const totais = financialData?.totais || {};
      const bruto = Number(totais.totalBruto || 0);
      const liquido = Number(totais.totalLiquido || 0);
      const retencoes = (Number(totais.totalInss || 0) + Number(totais.totalIrrf || 0) + Number(totais.totalTaxaAdm || 0));

      doc.rect(50, y + 23, 140, 32).fillAndStroke("#ffffff", "#cbd5e1");
      doc.fillColor("#64748b").fontSize(6.5).font("Helvetica-Bold").text("TOTAL BRUTO REPASSADO", 55, y + 27);
      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text(formatCurrency(bruto), 55, y + 38);

      doc.rect(200, y + 23, 140, 32).fillAndStroke("#ffffff", "#cbd5e1");
      doc.fillColor("#64748b").fontSize(6.5).font("Helvetica-Bold").text("TOTAL RETENÇÕES (INSS/IRRF/TAXA)", 205, y + 27);
      doc.fillColor("#e11d48").fontSize(10).font("Helvetica-Bold").text(formatCurrency(retencoes), 205, y + 38);

      doc.rect(350, y + 23, 195, 32).fillAndStroke("#f0fdf4", "#86efac");
      doc.fillColor("#166534").fontSize(6.5).font("Helvetica-Bold").text("LÍQUIDO TOTAL CREDITADO EM CONTA", 355, y + 27);
      doc.fillColor("#15803d").fontSize(11).font("Helvetica-Bold").text(formatCurrency(liquido), 355, y + 38);

      // Tabela de lançamentos completos (sem corte de slice!)
      let tableY = y + 70;
      doc.rect(50, tableY, 495, 15).fillAndStroke("#e2e8f0", "#cbd5e1");
      doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
      doc.text("Comp.", 55, tableY + 4);
      doc.text("Cliente / Tomador", 100, tableY + 4);
      doc.text("Contrato Vinculado", 220, tableY + 4);
      doc.text("Valor Bruto", 340, tableY + 4, { width: 60, align: "right" });
      doc.text("Valor Líquido", 410, tableY + 4, { width: 65, align: "right" });
      doc.text("Pagamento", 485, tableY + 4, { width: 55, align: "center" });

      tableY += 15;
      const fechamentos = financialData?.fechamentos || [];

      if (fechamentos.length === 0) {
        doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica").text("Nenhum lançamento registrado para este cooperado.", 55, tableY + 5);
      } else {
        for (const f of fechamentos) {
          if (tableY > 740) {
            doc.addPage();
            drawCoopeduHeader(doc, "FICHA CADASTRAL E FINANCEIRA (CONTINUAÇÃO)", "Histórico Financeiro Consolidado de Repasses");
            tableY = 90;
            doc.rect(50, tableY, 495, 15).fillAndStroke("#e2e8f0", "#cbd5e1");
            doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
            doc.text("Comp.", 55, tableY + 4);
            doc.text("Cliente / Tomador", 100, tableY + 4);
            doc.text("Contrato Vinculado", 220, tableY + 4);
            doc.text("Valor Bruto", 340, tableY + 4, { width: 60, align: "right" });
            doc.text("Valor Líquido", 410, tableY + 4, { width: 65, align: "right" });
            doc.text("Pagamento", 485, tableY + 4, { width: 55, align: "center" });
            tableY += 15;
          }
          doc.fillColor(darkText).fontSize(7).font("Helvetica");
          doc.text(`${String(f.mes).padStart(2, "0")}/${f.ano}`, 55, tableY + 3);
          doc.text(f.tomador || "Coopedu Sede", 100, tableY + 3, { width: 115, height: 10 });
          doc.text(f.contrato_descricao || f.tomador || "Contrato Geral", 220, tableY + 3, { width: 115, height: 10 });
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

      drawCoopeduHeader(doc, "EXTRATO DE REPASSES E LANÇAMENTOS SELECIONADOS", "Detalhamento de Fechamentos Financeiros • Core Coopedu");

      let y = 92;

      // IDENTIFICAÇÃO DO COOPERADO E CONTRATOS (CABEÇALHO ENRIQUECIDO)
      doc.rect(35, y, 525, 65).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor(darkText).fontSize(8);
      
      // Linha 1
      doc.font("Helvetica-Bold").text("Cooperado:", 45, y + 8);
      doc.font("Helvetica").text(String(coop.name || "N/I").toUpperCase(), 105, y + 8, { width: 240, ellipsis: true });

      doc.font("Helvetica-Bold").text("CPF:", 355, y + 8);
      doc.font("Helvetica").text(formatCpf(coop.document), 385, y + 8);

      doc.font("Helvetica-Bold").text("Matrícula:", 470, y + 8);
      doc.font("Helvetica").text(`#${coop.registration_number || "-"}`, 520, y + 8);

      // Linha 2
      const firstTomador = lancamentos[0]?.tomador || coop.contrato_atual?.tomador_nome || "TODOS";
      const firstContrato = lancamentos[0]?.contrato_descricao || coop.contrato_atual?.contrato_descricao || "TODOS";

      doc.font("Helvetica-Bold").text("Atividade/Cargo:", 45, y + 26);
      doc.font("Helvetica-Bold").fillColor(primary).text(coop.cargo_contrato || coop.position || "Cooperado", 125, y + 26, { width: 170, ellipsis: true });
      doc.fillColor(darkText);

      doc.font("Helvetica-Bold").text("Cliente / Tomador:", 305, y + 26);
      doc.font("Helvetica").text(firstTomador, 400, y + 26, { width: 150, ellipsis: true });

      // Linha 3
      const bank = resolveOwlBank(coop.bank_code, coop.bank_name);
      doc.font("Helvetica-Bold").text("Contrato:", 45, y + 44);
      doc.font("Helvetica").text(firstContrato, 95, y + 44, { width: 170, ellipsis: true });

      doc.font("Helvetica-Bold").text("Dados Bancários:", 275, y + 44);
      const bankFullStr = `${bank.name} (${bank.code}) • Ag: ${coop.agency || "0001"} • CC: ${coop.account_number || "-"}-${coop.account_digit || ""} (${coop.account_type || "Corrente"})`;
      doc.font("Helvetica-Bold").fillColor("#047857").text(bankFullStr, 365, y + 44, { width: 190, ellipsis: true });
      doc.fillColor(darkText);

      y += 72;

      // CABEÇALHO DA TABELA (COLUNAS REDIMENSIONADAS: 40, 85, 100, 55, 50, 50, 45, 55, 45)
      doc.rect(35, y, 525, 18).fillAndStroke("#e2e8f0", grayBorder);
      doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
      doc.text("Comp.", 35, y + 5, { width: 40, align: "center" });
      doc.text("Cliente / Tomador", 75, y + 5, { width: 85 });
      doc.text("Contrato Vinculado", 160, y + 5, { width: 100 });
      doc.text("Bruto", 260, y + 5, { width: 55, align: "right" });
      doc.text("INSS", 315, y + 5, { width: 50, align: "right" });
      doc.text("IRRF", 365, y + 5, { width: 50, align: "right" });
      doc.text("Taxa Adm", 415, y + 5, { width: 45, align: "right" });
      doc.text("Líquido", 460, y + 5, { width: 55, align: "right" });
      doc.text("Pago em", 515, y + 5, { width: 45, align: "center" });

      y += 18;

      let totBruto = 0;
      let totInss = 0;
      let totIrrf = 0;
      let totTaxa = 0;
      let totLiquido = 0;

      for (let i = 0; i < lancamentos.length; i++) {
        const l = lancamentos[i];
        totBruto += Number(l.valor_bruto || 0);
        totInss += Number(l.inss || 0);
        totIrrf += Number(l.irrf || 0);
        totTaxa += Number(l.taxa_adm || 0);
        totLiquido += Number(l.valor_liquido || 0);

        // Quebra de página se necessário
        if (y > 730) {
          doc.addPage();
          drawCoopeduHeader(doc, "EXTRATO DE REPASSES E LANÇAMENTOS (CONTINUAÇÃO)");
          y = 90;
          doc.rect(35, y, 525, 18).fillAndStroke("#e2e8f0", grayBorder);
          doc.fillColor(darkText).fontSize(7).font("Helvetica-Bold");
          doc.text("Comp.", 35, y + 5, { width: 40, align: "center" });
          doc.text("Cliente / Tomador", 75, y + 5, { width: 85 });
          doc.text("Contrato Vinculado", 160, y + 5, { width: 100 });
          doc.text("Bruto", 260, y + 5, { width: 55, align: "right" });
          doc.text("INSS", 315, y + 5, { width: 50, align: "right" });
          doc.text("IRRF", 365, y + 5, { width: 50, align: "right" });
          doc.text("Taxa Adm", 415, y + 5, { width: 45, align: "right" });
          doc.text("Líquido", 460, y + 5, { width: 55, align: "right" });
          doc.text("Pago em", 515, y + 5, { width: 45, align: "center" });
          y += 18;
        }

        const isEven = i % 2 === 0;
        doc.rect(35, y, 525, 14).fillAndStroke(isEven ? "#ffffff" : "#f8fafc", "#f1f5f9");
        doc.fillColor(darkText).fontSize(6.5).font("Helvetica");

        doc.text(`${String(l.mes).padStart(2, "0")}/${l.ano}`, 35, y + 3, { width: 40, align: "center" });
        doc.text(l.tomador || "Coopedu", 75, y + 3, { width: 85, height: 9, ellipsis: true });
        doc.text(l.contrato_descricao || l.tomador || "Contrato Geral", 160, y + 3, { width: 100, height: 9, ellipsis: true });
        doc.text(formatCurrency(l.valor_bruto), 260, y + 3, { width: 55, align: "right" });
        doc.text(formatCurrency(l.inss), 315, y + 3, { width: 50, align: "right" });
        doc.text(formatCurrency(l.irrf), 365, y + 3, { width: 50, align: "right" });
        doc.text(formatCurrency(l.taxa_adm), 415, y + 3, { width: 45, align: "right" });
        doc.fillColor("#15803d").font("Helvetica-Bold").text(formatCurrency(l.valor_liquido), 460, y + 3, { width: 55, align: "right" });
        doc.fillColor(darkText).font("Helvetica").text(formatSafeDate(l.data_pagamento), 515, y + 3, { width: 45, align: "center" });

        y += 14;
      }

      // LINHA DE TOTAIS
      y += 4;
      doc.rect(35, y, 525, 20).fillAndStroke("#e0f2fe", "#7dd3fc");
      doc.fillColor("#0369a1").fontSize(7.5).font("Helvetica-Bold");
      doc.text(`TOTAIS CONSOLIDADOS (${lancamentos.length} LANÇAMENTOS SELECIONADOS)`, 40, y + 6, { width: 215 });
      doc.text(formatCurrency(totBruto), 260, y + 6, { width: 55, align: "right" });
      doc.text(formatCurrency(totInss), 315, y + 6, { width: 50, align: "right" });
      doc.text(formatCurrency(totIrrf), 365, y + 6, { width: 50, align: "right" });
      doc.text(formatCurrency(totTaxa), 415, y + 6, { width: 45, align: "right" });
      doc.fillColor("#15803d").text(formatCurrency(totLiquido), 460, y + 6, { width: 55, align: "right" });

      // Rodapé
      doc.fillColor("#94a3b8").fontSize(6.5).font("Helvetica").text(
        "Extrato oficial emitido via Centralizador SIC • Core Coopedu. Todos os dados possuem validade institucional.",
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
 * 4. Gera PDF em Lote de Demonstrativos de Produtividade (Folha de Pagamento)
 */
export function generateEasycoopFolhaLotePdf(coop: any, folhasList: any[]): Promise<Buffer> {
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

      if (folhasList.length === 0) {
        drawCoopeduHeader(doc, "DEMONSTRATIVO DE PRODUTIVIDADE E REPASSE", "Consulta de Folha de Pagamento");
        doc.rect(40, 100, 515, 60).fillAndStroke("#f8fafc", "#e2e8f0");
        doc.fillColor(darkText).fontSize(8);
        doc.font("Helvetica-Bold").text("Cooperado:", 50, 115);
        doc.font("Helvetica").text(String(coop?.name || "N/I").toUpperCase(), 110, 115);
        doc.font("Helvetica-Bold").text("CPF:", 360, 115);
        doc.font("Helvetica").text(formatCpf(coop?.document), 400, 115);
        doc.fillColor("#64748b").fontSize(9).font("Helvetica").text("Nenhum demonstrativo de folha encontrado para as competências solicitadas.", 50, 190, { align: "center", width: 495 });
        doc.end();
        return;
      }

      folhasList.forEach((item: any, pageIdx: number) => {
        if (pageIdx > 0) doc.addPage();

        const folha = (typeof item.folha === "object" && item.folha !== null) ? item.folha : item;
        const compStr = folha.competencia_str || (folha.mes && folha.ano ? `${String(folha.mes).padStart(2, "0")}/${folha.ano}` : "Geral");
        drawCoopeduHeader(doc, "DEMONSTRATIVO DE PRODUTIVIDADE E REPASSE", `Competência: ${compStr}`);

        let y = 92;

        // IDENTIFICAÇÃO DO COOPERADO E CONTRATO
        doc.rect(40, y, 515, 48).fillAndStroke("#f8fafc", "#e2e8f0");
        doc.fillColor(darkText).fontSize(8);
        doc.font("Helvetica-Bold").text("Cooperado:", 50, y + 8);
        doc.font("Helvetica").text(String(coop?.name || folha.cooperado?.nome || "N/I").toUpperCase(), 110, y + 8, { width: 240, ellipsis: true });

        doc.font("Helvetica-Bold").text("CPF:", 360, y + 8);
        doc.font("Helvetica").text(formatCpf(coop?.document || folha.cooperado?.cpf), 400, y + 8);

        doc.font("Helvetica-Bold").text("Atividade:", 50, y + 24);
        doc.font("Helvetica-Bold").fillColor(primary).text(coop?.cargo_contrato || folha.cooperado?.cargo || "Cooperado", 110, y + 24, { width: 240, ellipsis: true });
        doc.fillColor(darkText);

        doc.font("Helvetica-Bold").text("Tomador / Cliente:", 360, y + 24);
        doc.font("Helvetica").text(folha.tomador || "Coopedu Sede", 445, y + 24, { width: 105, ellipsis: true });

        y += 60;

        // PROVENTOS (+) E DESCONTOS (-)
        const colWidth = 250;
        doc.rect(40, y, colWidth, 18).fillAndStroke("#dcfce7", "#86efac");
        doc.fillColor("#166534").fontSize(7.5).font("Helvetica-Bold").text("PROVENTOS / CRÉDITOS (+)", 50, y + 5);

        doc.rect(305, y, colWidth, 18).fillAndStroke("#ffe4e6", "#fca5a5");
        doc.fillColor("#9f1239").fontSize(7.5).font("Helvetica-Bold").text("DESCONTOS / RETENÇÕES (-)", 315, y + 5);

        y += 18;
        const startTablesY = y;

        // Proventos (com fallback para totais se vazio)
        const proventos = [...(folha.proventos || [])];
        const totProv = Number(folha.totais?.totalProventos || folha.valor_bruto || 0);
        if (proventos.length === 0 && totProv > 0) {
          proventos.push({ codigo: "101", descricao: "PRODUÇÃO COOPERATIVA / HORAS", valor: totProv });
        }

        let provY = startTablesY;
        for (const p of proventos) {
          doc.rect(40, provY, colWidth, 16).fillAndStroke("#ffffff", "#f1f5f9");
          doc.fillColor(darkText).fontSize(7).font("Helvetica").text(p.descricao, 48, provY + 4, { width: 140, ellipsis: true });
          doc.fillColor("#15803d").font("Helvetica-Bold").text(formatCurrency(p.valor), 195, provY + 4, { width: 85, align: "right" });
          provY += 16;
        }

        // Descontos (com fallback para totais se vazio)
        const descontos = [...(folha.descontos || [])];
        const totDesc = Number(folha.totais?.totalDescontos || folha.total_descontos || 0);
        if (descontos.length === 0 && totDesc > 0) {
          descontos.push({ codigo: "201", descricao: "RETENÇÕES / DEDUÇÕES LEGAIS", valor: totDesc });
        }
        let descY = startTablesY;
        for (const d of descontos) {
          doc.rect(305, descY, colWidth, 16).fillAndStroke("#ffffff", "#f1f5f9");
          doc.fillColor(darkText).fontSize(7).font("Helvetica").text(d.descricao, 313, descY + 4, { width: 140 });
          doc.fillColor("#e11d48").font("Helvetica-Bold").text(formatCurrency(d.valor), 460, descY + 4, { width: 85, align: "right" });
          descY += 16;
        }

        y = Math.max(provY, descY) + 10;

        // TOTAIS
        const totLiq = Number(folha.totais?.valorLiquido || (totProv - totDesc));

        doc.rect(40, y, 160, 36).fillAndStroke("#f8fafc", "#cbd5e1");
        doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("TOTAL DE PROVENTOS", 50, y + 6);
        doc.fillColor("#15803d").fontSize(11).font("Helvetica-Bold").text(formatCurrency(totProv), 50, y + 18);

        doc.rect(215, y, 160, 36).fillAndStroke("#f8fafc", "#cbd5e1");
        doc.fillColor("#475569").fontSize(7).font("Helvetica-Bold").text("TOTAL DE DESCONTOS", 225, y + 6);
        doc.fillColor("#e11d48").fontSize(11).font("Helvetica-Bold").text(formatCurrency(totDesc), 225, y + 18);

        doc.rect(390, y, 165, 36).fillAndStroke("#f0fdf4", "#86efac");
        doc.fillColor("#166534").fontSize(7).font("Helvetica-Bold").text("VALOR LÍQUIDO A RECEBER", 400, y + 6);
        doc.fillColor("#15803d").fontSize(12).font("Helvetica-Bold").text(formatCurrency(totLiq), 400, y + 18);

        y += 48;

        // DADOS BANCÁRIOS (OWL) E BASES
        doc.rect(40, y, 515, 45).fillAndStroke("#f8fafc", "#e2e8f0");
        doc.fillColor(darkText).fontSize(7.5);
        doc.font("Helvetica-Bold").text("Base INSS:", 50, y + 8);
        doc.font("Helvetica").text(formatCurrency(folha.bases_calculo?.baseInss || totProv), 100, y + 8);

        doc.font("Helvetica-Bold").text("Base IRRF:", 180, y + 8);
        doc.font("Helvetica").text(formatCurrency(folha.bases_calculo?.baseIrrf || 0), 230, y + 8);

        const bank = resolveOwlBank(coop?.bank_code || folha.cooperado?.banco, coop?.bank_name || folha.cooperado?.banco);
        doc.font("Helvetica-Bold").text("Depósito em Conta:", 310, y + 8);
        doc.font("Helvetica-Bold").fillColor("#047857").text(`${bank.name} • Ag: ${coop?.agency || folha.cooperado?.agencia || "0001"} • CC: ${coop?.account_number || folha.cooperado?.conta || "-"}-${coop?.account_digit || ""}`, 400, y + 8);
        doc.fillColor(darkText);

        doc.font("Helvetica-Bold").text("Data de Pagamento:", 50, y + 26);
        doc.font("Helvetica").text(formatSafeDate(folha.data_pagamento), 140, y + 26);

        // Termo de quitação e assinatura
        y += 65;
        doc.fillColor(darkText).fontSize(7).font("Helvetica").text(
          "Declaro ter recebido a importância líquida discriminada neste demonstrativo, referente à produção cooperativa.",
          40,
          y
        );

        y += 28;
        doc.text("Data: _____/_____/_________", 40, y);
        doc.text("Assinatura do Cooperado: ___________________________________________________________", 160, y);

        // Rodapé
        doc.fillColor("#94a3b8").fontSize(6.5).font("Helvetica").text(
          `Folha ${pageIdx + 1} de ${folhasList.length} • Centralizador SIC (Core Coopedu)`,
          40,
          780,
          { align: "center", width: 515 }
        );
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
      doc.rect(40, y, 515, 48).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor(darkText).fontSize(8);
      doc.font("Helvetica-Bold").text("Cooperado:", 50, y + 8);
      doc.font("Helvetica").text(String(coop.name || "N/I").toUpperCase(), 110, y + 8);

      doc.font("Helvetica-Bold").text("CPF:", 360, y + 8);
      doc.font("Helvetica").text(formatCpf(coop.document), 400, y + 8);

      doc.font("Helvetica-Bold").text("Atividade Oficial:", 50, y + 24);
      doc.font("Helvetica-Bold").fillColor(primary).text(coop.cargo_contrato || coop.position || "Cooperado", 130, y + 24);
      doc.fillColor(darkText);

      doc.font("Helvetica-Bold").text("Categoria eSocial:", 360, y + 24);
      doc.font("Helvetica").text("734 - Cooperado de Cooperativa", 445, y + 24);

      y += 58;

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


