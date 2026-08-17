import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

/**
 * Gera o Manual Completo da API v1 em PDF utilizando PDFKit
 */
export async function generateApiManualPdf(outputPath?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
      info: {
        Title: "Manual Completo da API REST v1 - Centralizador SIC",
        Author: "Centralizador SIC - Core Coopedu",
        Subject: "Documentação Oficial dos Endpoints, Autenticação por Token e Dicionário de Campos",
        Keywords: "API, REST, SIC, Coopedu, Cooperados, PDF, Demonstrativo, Comprovante",
      },
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      if (outputPath) {
        try {
          fs.writeFileSync(outputPath, pdfBuffer);
          console.log(`[PDF Generator] Manual da API em PDF salvo com sucesso em: ${outputPath}`);
        } catch (e: any) {
          console.error(`[PDF Generator Error] Falha ao salvar PDF no disco: ${e.message}`);
        }
      }
      resolve(pdfBuffer);
    });
    doc.on("error", (err) => reject(err));

    // CORES DO DESIGN SYSTEM (SKY / SLATE / EMERALD)
    const primaryColor = "#0284c7"; // Sky 600
    const darkSlate = "#0f172a";    // Slate 900
    const subSlate = "#475569";     // Slate 600
    const lightBg = "#f8fafc";      // Slate 50
    const borderSlate = "#e2e8f0";  // Slate 200
    const emeraldColor = "#059669"; // Emerald 600

    // CABEÇALHO DO DOCUMENTO
    doc.rect(0, 0, 595.28, 90).fill(darkSlate);

    doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("CENTRALIZADOR SIC - CORE COOPEDU", 40, 25);
    doc.fontSize(12).font("Helvetica-Bold").fillColor(primaryColor).text("MANUAL TÉCNICO OFICIAL DA API REST (v1)", 40, 50);

    doc.fontSize(8).font("Helvetica").fillColor("#94a3b8").text("Documentação com Dicionário de Campos e Guia de Integração", 40, 68);

    doc.y = 110;

    // SEÇÃO 1: VISÃO GERAL E AUTENTICAÇÃO
    doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("1. Visão Geral & Segurança de Acesso", 40, doc.y);
    doc.moveDown(0.4);

    doc.fillColor(darkSlate).fontSize(9).font("Helvetica").text(
      "A API do Centralizador SIC distribui dados cadastrais, financeiros, competências de folhas de pagamento e downloads de PDFs oficiais. Todas as requisições requerem autenticação por API Token ativo.",
      { align: "justify" }
    );
    doc.moveDown(0.6);

    // BOX DE AUTENTICAÇÃO
    const authBoxY = doc.y;
    doc.roundedRect(40, authBoxY, 515.28, 55, 8).fillAndStroke(lightBg, borderSlate);

    doc.fillColor(darkSlate).fontSize(9).font("Helvetica-Bold").text("Cabeçalho de Autenticação Obrigatório (HTTP Header):", 50, authBoxY + 10);
    doc.fillColor(primaryColor).fontSize(10).font("Courier-Bold").text("Authorization: Bearer <SEU_API_TOKEN>", 50, authBoxY + 25);
    doc.fillColor(subSlate).fontSize(8).font("Helvetica").text("Alternativa aceita: Header X-API-Key: <SEU_API_TOKEN> ou parâmetro query ?api_key=<TOKEN>", 50, authBoxY + 40);

    doc.y = authBoxY + 70;

    // SEÇÃO 2: DICIONÁRIO COMPLETO DOS ENDPOINTS E CAMPOS
    doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("2. Dicionário Completo de Endpoints & Campos", 40, doc.y);
    doc.moveDown(0.6);

    // ENDPOINT 1: PESQUISA
    doc.fillColor(emeraldColor).fontSize(10).font("Helvetica-Bold").text("ENDPOINT 1: Pesquisa de Cooperados", 40, doc.y);
    doc.fillColor(darkSlate).fontSize(9).font("Courier-Bold").text("GET /api/v1/cooperados/pesquisar?q={cpf_ou_nome}&page=1&pageSize=25", 40, doc.y + 12);
    doc.moveDown(1.5);

    doc.fillColor(subSlate).fontSize(8).font("Helvetica-Bold").text("Parâmetros de Entrada (Query Params):");
    doc.fillColor(darkSlate).fontSize(8).font("Helvetica").text("• q (obrigatório): CPF (formatado ou apenas números) ou Nome parcial/completo.");
    doc.text("• page (opcional, padrão 1): Número da página desejada.");
    doc.text("• pageSize (opcional, padrão 25, máx 100): Quantidade de registros por página.");
    doc.moveDown(0.5);

    doc.fillColor(subSlate).fontSize(8).font("Helvetica-Bold").text("Campos do JSON de Resposta:");
    doc.fillColor(darkSlate).fontSize(8).font("Helvetica");
    doc.text("• status (String): 'SUCESSO' ou erro.");
    doc.text("• total (Integer): Total de cooperados encontrados no filtro.");
    doc.text("• cooperados[].cpf (String): CPF numérico (11 dígitos).");
    doc.text("• cooperados[].nome (String): Nome completo do cooperado.");
    doc.text("• cooperados[].matricula (Integer/String): Número da matrícula no SIC.");
    doc.text("• cooperados[].cargo (String): Cargo/função exercida.");
    doc.text("• cooperados[].status (String): Status no cadastro ('Ativo', 'Inativo').");
    doc.moveDown(1);

    // ENDPOINT 2: RESUMO DO COOPERADO
    if (doc.y > 680) doc.addPage();

    doc.fillColor(emeraldColor).fontSize(10).font("Helvetica-Bold").text("ENDPOINT 2: Resumo Completo do Cooperado", 40, doc.y);
    doc.fillColor(darkSlate).fontSize(9).font("Courier-Bold").text("GET /api/v1/cooperados/{CPF}/resumo", 40, doc.y + 12);
    doc.moveDown(1.5);

    doc.fillColor(subSlate).fontSize(8).font("Helvetica-Bold").text("Estrutura Detalhada dos Campos Retornados:");
    doc.fillColor(darkSlate).fontSize(8).font("Helvetica");
    doc.text("• dadosPessoais (Object):");
    doc.text("   - nome (String): Nome completo registrado.");
    doc.text("   - cpf (String): CPF (11 dígitos).");
    doc.text("   - matricula (Integer/String): Matrícula oficial.");
    doc.text("   - cargoProfissao (String): Cargo real extraído do SIC.");
    doc.text("   - nomeMae / nomePai (String): Nomes da mãe e do pai.");
    doc.text("   - dataNascimento (String/Date): Data de nascimento.");
    doc.text("   - naturalidade (String): Cidade/UF de nascimento.");
    doc.text("   - generoEstadoCivil (String): Gênero e estado civil.");
    doc.text("   - rg (String): Número do documento RG.");
    doc.moveDown(0.3);

    doc.text("• contratosAtivos (Array of Objects): Lista de contratos que o cooperado possui em status ATIVO.");
    doc.text("   - contrato (String): Descrição do contrato / Centro de Custo.");
    doc.text("   - cliente (String): Nome da entidade / contratante.");
    doc.text("   - status (String): 'ATIVO'.");
    doc.moveDown(0.3);

    doc.text("• dadosBancarios (Object): Dados de recebimento de repasses.");
    doc.text("   - banco / codigoBanco (String): Nome e código do banco (ex: Fitbank / 450).");
    doc.text("   - agencia / conta / tipoConta (String): Número da agência, conta com dígito e modalidade.");
    doc.text("   - chavePix (String): Chave PIX cadastrada.");
    doc.moveDown(0.3);

    doc.text("• enderecoResidencial (Object): Rua, número, complemento, bairro, CEP, cidade e estado.");
    doc.text("• contatos (Object): Celular/WhatsApp e E-mail de contato.");
    doc.text("• ultimaCompetencia (Object): Competência recente com atalhos de links para resumo, demonstrativo e comprovante.");
    doc.moveDown(1);

    // ENDPOINT 3: FOLHAS DE PAGAMENTO
    if (doc.y > 680) doc.addPage();

    doc.fillColor(emeraldColor).fontSize(10).font("Helvetica-Bold").text("ENDPOINT 3: Histórico de Folhas de Pagamento", 40, doc.y);
    doc.fillColor(darkSlate).fontSize(9).font("Courier-Bold").text("GET /api/v1/cooperados/{CPF}/folhas", 40, doc.y + 12);
    doc.moveDown(1.5);

    doc.fillColor(subSlate).fontSize(8).font("Helvetica-Bold").text("Campos do JSON de Resposta:");
    doc.fillColor(darkSlate).fontSize(8).font("Helvetica");
    doc.text("• totalFolhas (Integer): Quantidade total de folhas processadas.");
    doc.text("• folhas[].payrollId (String UUID): ID exclusivo do holerite (necessário para buscar os PDFs e resumos).");
    doc.text("• folhas[].competencia (String): Competência no formato AAAA-MM (ex: 2026-07).");
    doc.text("• folhas[].tipoFolha (String): Tipo da folha ('Regular', 'Complementar', etc).");
    doc.text("• folhas[].status (String): Status de processamento ('Processado', 'Pago').");
    doc.text("• folhas[].dataPagamento (String/Date): Data efetiva de crédito do repasse.");
    doc.moveDown(1);

    // ENDPOINT 4: RESUMO FINANCEIRO
    doc.fillColor(emeraldColor).fontSize(10).font("Helvetica-Bold").text("ENDPOINT 4: Resumo Financeiro da Competência", 40, doc.y);
    doc.fillColor(darkSlate).fontSize(9).font("Courier-Bold").text("GET /api/v1/cooperados/{CPF}/folhas/{PAYROLL_ID}/resumo-financeiro", 40, doc.y + 12);
    doc.moveDown(1.5);

    doc.fillColor(subSlate).fontSize(8).font("Helvetica-Bold").text("Campos do JSON de Resposta:");
    doc.fillColor(darkSlate).fontSize(8).font("Helvetica");
    doc.text("• valorBruto (Number): Total de produção bruta na competência.");
    doc.text("• totalDescontos (Number): Somatório dos descontos tributários e operacionais.");
    doc.text("• valorLiquido (Number): Valor líquido efetivamente pago ao cooperado.");
    doc.text("• totalHoras (Number): Horas trabalhadas registradas.");
    doc.text("• rubricas[].codigo / descricao / tipo / valor: Detalhamento de cada item de provento ou desconto.");
    doc.moveDown(1);

    // ENDPOINTS 5 E 6: DOWNLOADS DE PDF
    if (doc.y > 680) doc.addPage();

    doc.fillColor(emeraldColor).fontSize(10).font("Helvetica-Bold").text("ENDPOINTS 5 e 6: Download de PDFs (Demonstrativo e Comprovante PIX)", 40, doc.y);
    doc.fillColor(darkSlate).fontSize(9).font("Courier-Bold").text("GET /api/v1/cooperados/{CPF}/folhas/{PAYROLL_ID}/demonstrativo", 40, doc.y + 12);
    doc.fillColor(darkSlate).fontSize(9).font("Courier-Bold").text("GET /api/v1/cooperados/{CPF}/folhas/{PAYROLL_ID}/comprovante", 40, doc.y + 26);
    doc.moveDown(2.2);

    doc.fillColor(subSlate).fontSize(8).font("Helvetica-Bold").text("Especificações de Resposta:");
    doc.fillColor(darkSlate).fontSize(8).font("Helvetica");
    doc.text("• Content-Type: application/pdf");
    doc.text("• Content-Disposition: inline; filename=\"demonstrativo-{CPF}-{PAYROLL_ID}.pdf\"");
    doc.text("• Retorna o arquivo PDF original oficial gerado pelo SIC em fluxo binário.");
    doc.moveDown(1);

    // SEÇÃO 3: CÓDIGOS DE RESPOSTA HTTP
    doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("3. Tabela de Códigos HTTP de Resposta", 40, doc.y);
    doc.moveDown(0.6);

    const httpBoxY = doc.y;
    doc.roundedRect(40, httpBoxY, 515.28, 75, 8).fillAndStroke(lightBg, borderSlate);

    doc.fillColor(emeraldColor).fontSize(8.5).font("Helvetica-Bold").text("200 OK: Requisição processada com sucesso.", 50, httpBoxY + 10);
    doc.fillColor("#b91c1c").fontSize(8.5).font("Helvetica-Bold").text("400 Bad Request: CPF inválido ou parâmetro obrigatório não fornecido.", 50, httpBoxY + 23);
    doc.fillColor("#b91c1c").fontSize(8.5).font("Helvetica-Bold").text("401 Unauthorized: Token de API ausente, inválido ou revogado.", 50, httpBoxY + 36);
    doc.fillColor("#b91c1c").fontSize(8.5).font("Helvetica-Bold").text("404 Not Found: Cooperado ou folha de pagamento não localizada.", 50, httpBoxY + 49);
    doc.fillColor("#b91c1c").fontSize(8.5).font("Helvetica-Bold").text("500 Internal Error: Falha no servidor ou indisponibilidade no SIC.", 50, httpBoxY + 62);

    // RODA PÉ DAS PÁGINAS
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor("#94a3b8").text(
        `Centralizador SIC - Core Coopedu | Manual da API REST v1 | Página ${i + 1} de ${range.count}`,
        40,
        780,
        { align: "center", width: 515.28 }
      );
    }

    doc.end();
  });
}
