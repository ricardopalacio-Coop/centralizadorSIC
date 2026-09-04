import { Router, Response } from "express";
import axios from "axios";
import { pool } from "../db";
import { authenticateApiKey, ApiAuthenticatedRequest } from "../middlewares/apiKeyAuth";
import {
  cleanCpf,
  getSicCooperado,
  getSicCooperadoDetails,
  getSicPayrolls,
  getSicToken,
} from "../services/sicApi";
import { getFinancialSummary } from "../services/financialSummaryService";
import {
  getOfficialSicPaymentReceiptPdf,
  getAuthenticatedSicSession,
} from "../services/sicBrowserAutomation";
import { getCooperadoAppData } from "../services/appDbService";
import { generateReceiptPdf } from "../services/pdfService";

const router = Router();
router.use(authenticateApiKey);

/**
 * GET /api/v1/cooperados/pesquisar?q=...&page=1&pageSize=25
 * Pesquisa cooperados por CPF (com ou sem pontuação) ou por Nome
 */
router.get("/cooperados/pesquisar", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const q = String(req.query.q || req.query.search || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "25"), 10)));
    const offset = (page - 1) * pageSize;

    if (!q) {
      return res.status(400).json({
        error: "Parâmetro de pesquisa obrigatório.",
        message: "Forneça o parâmetro 'q' contendo o CPF ou Nome do cooperado na URL.",
      });
    }

    const numericCpf = cleanCpf(q);

    // Se for um CPF exato de 11 dígitos, efetua consulta direta no SIC
    if (numericCpf.length === 11) {
      try {
        const sicUser = await getSicCooperado(numericCpf);
        if (sicUser) {
          const payrolls = await getSicPayrolls(numericCpf);
          const sicDetails = await getSicCooperadoDetails(numericCpf);

          return res.json({
            status: "SUCESSO",
            total: 1,
            page: 1,
            pageSize,
            cooperados: [
              {
                cpf: numericCpf,
                nome: sicDetails?.nome || sicUser.name || sicUser.nome,
                matricula: sicDetails?.matricula || sicUser.registration,
                status: sicDetails?.status || "Ativo",
                payrollsCount: payrolls.length,
              },
            ],
          });
        }
      } catch (e) {}
    }

    // Busca no banco de dados local
    const searchTerm = `%${q}%`;
    const cleanedSearchTerm = `%${numericCpf || q}%`;

    const countQuery = "SELECT COUNT(*) as total FROM cooperados WHERE name LIKE ? OR document LIKE ? OR registration_number LIKE ?";
    const listQuery = "SELECT document as cpf, registration_number as matricula, name as nome, email, whatsapp_number, contract_name as contrato, position as cargo, status FROM cooperados WHERE name LIKE ? OR document LIKE ? OR registration_number LIKE ? ORDER BY name ASC LIMIT ? OFFSET ?";

    const [countRows] = await pool.query<any[]>(countQuery, [searchTerm, cleanedSearchTerm, searchTerm]);
    const total = countRows[0]?.total || 0;

    const [rows] = await pool.query<any[]>(listQuery, [searchTerm, cleanedSearchTerm, searchTerm, pageSize, offset]);

    return res.json({
      status: "SUCESSO",
      total,
      page,
      pageSize,
      cooperados: rows,
    });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao pesquisar cooperados:", error.message);
    return res.status(500).json({ error: "Falha ao pesquisar cooperados.", details: error.message });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/resumo
 * Retorna TODOS OS DADOS DA ABA RESUMO DO COOPERADO
 */
router.get("/cooperados/:cpf/resumo", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = String(req.params.cpf || "");
    const numericCpf = cleanCpf(rawCpf);

    if (!numericCpf || numericCpf.length !== 11) {
      return res.status(400).json({ error: "CPF inválido. Forneça 11 dígitos numéricos." });
    }

    // 1. Obter dados no SIC e DB Local
    const [sicUser, sicDetails, payrolls, appData] = await Promise.all([
      getSicCooperado(numericCpf),
      getSicCooperadoDetails(numericCpf),
      getSicPayrolls(numericCpf),
      getCooperadoAppData(numericCpf),
    ]);

    const [dbRows] = await pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]);
    const dbCooperado = dbRows[0] || {};

    // 2. Tentar detectar o cargo exato via resumo financeiro da última folha
    let cargoDetectado = "";
    if (payrolls && payrolls.length > 0) {
      try {
        const latestSummary = await getFinancialSummary(numericCpf, payrolls[0].payrollId);
        if (latestSummary && latestSummary.profissao) {
          cargoDetectado = latestSummary.profissao;
        }
      } catch (e) {}
    }

    const cargoFinal =
      cargoDetectado ||
      dbCooperado.position ||
      sicDetails?.informacoesProfissionais?.profissao ||
      sicDetails?.informacoesProfissionais?.cargo ||
      sicDetails?.profissao ||
      sicDetails?.cargo ||
      "";

    // 3. Montar contratos ativos
    let contratosAtivos: any[] = [];
    if (sicDetails?.contratos && Array.isArray(sicDetails.contratos)) {
      contratosAtivos = sicDetails.contratos
        .filter((c: any) => c.statusContratoUsuario === "ATIVO")
        .map((c: any) => ({
          contrato: c.contrato?.descricao || c.contrato?.centroDeCusto || "",
          cliente: c.contrato?.cliente?.nome || "",
          nucleo: c.contrato?.nucleoRegional || "",
          status: "ATIVO",
        }));
    }

    if (contratosAtivos.length === 0 && dbCooperado.contract_name) {
      contratosAtivos = [
        {
          contrato: dbCooperado.contract_name,
          cliente: "",
          status: "ATIVO",
        },
      ];
    }

    // 4. Montar última competência
    const ultimaFolha = payrolls.length > 0 ? payrolls[0] : null;

    const payloadResumo = {
      dadosPessoais: {
        nome: sicDetails?.nome || sicUser?.name || dbCooperado.name || "NÃO INFORMADO",
        cpf: numericCpf,
        matricula: sicDetails?.matricula || sicUser?.registration || dbCooperado.registration_number,
        cargoProfissao: cargoFinal,
        nomeMae: sicDetails?.nomeMae || dbCooperado.mother_name || "NÃO INFORMADO",
        nomePai: sicDetails?.nomePai || dbCooperado.father_name || "NÃO INFORMADO",
        dataNascimento: sicDetails?.dataNascimento || dbCooperado.birth_date,
        dataAdmissao: sicDetails?.dataAdmissao || sicDetails?.admissionDate || dbCooperado.admission_date || "NÃO INFORMADA",
        dataAssociacao: sicDetails?.dataAssociacao || sicDetails?.associationDate || dbCooperado.association_date || sicDetails?.dataAdmissao || sicDetails?.admissionDate || dbCooperado.admission_date || "NÃO INFORMADA",
        dataDesligamento: "----",
        naturalidade: sicDetails?.cidadeNascimento ? `${sicDetails.cidadeNascimento}/${sicDetails.estadoNascimento || ""}` : "NÃO INFORMADA",
        generoEstadoCivil: `${sicDetails?.genero || "MASCULINO"} - ${sicDetails?.estadoCivil || "NÃO INFORMADO"}`,
        rg: dbCooperado.rg_number || "REGISTRADO NO SIC",
      },
      contratosAtivos,
      dadosBancarios: {
        banco: dbCooperado.bank_name || "Fitbank / Banco 450",
        codigoBanco: dbCooperado.bank_code || "450",
        agencia: dbCooperado.agency || "0001",
        conta: `${dbCooperado.account_number || "1042317620"}-${dbCooperado.account_digit || "3"}`,
        tipoConta: dbCooperado.account_type || "Conta-Corrente",
        chavePix: dbCooperado.pix_key || numericCpf,
      },
      enderecoResidencial: {
        rua: sicDetails?.endereco?.rua || dbCooperado.street || "NÃO INFORMADA",
        numero: sicDetails?.endereco?.numero || dbCooperado.number || "S/N",
        bairro: sicDetails?.endereco?.bairro || dbCooperado.neighborhood || "NÃO INFORMADO",
        cep: sicDetails?.endereco?.cep || dbCooperado.zip_code || "NÃO INFORMADO",
        cidade: sicDetails?.endereco?.cidade || dbCooperado.city || "FORTALEZA",
        estado: sicDetails?.endereco?.estado || dbCooperado.state || "CE",
      },
      contatos: {
        celularWhatsapp: dbCooperado.whatsapp_number || sicDetails?.celular || "NÃO INFORMADO",
        email: dbCooperado.email || sicDetails?.email || "NÃO INFORMADO",
      },
      ultimaCompetencia: ultimaFolha
        ? {
            competencia: ultimaFolha.competence || `${ultimaFolha.year}-${String(ultimaFolha.month).padStart(2, "0")}`,
            statusPagamento: ultimaFolha.payrollStatus || "Pago",
            payrollId: ultimaFolha.payrollId,
            aplicativoMobile: {
              horasTrabalhadasHoje: appData?.todayWorkedTimeFormatted || "0h 00min",
              ultimoAcesso: appData?.lastAccess?.date || null,
            },
            linksDiretos: {
              resumoFinanceiro: `/api/v1/cooperados/${numericCpf}/folhas/${ultimaFolha.payrollId}/resumo-financeiro`,
              demonstrativoPdf: `/api/v1/cooperados/${numericCpf}/folhas/${ultimaFolha.payrollId}/demonstrativo`,
              comprovantePdf: `/api/v1/cooperados/${numericCpf}/folhas/${ultimaFolha.payrollId}/comprovante`,
            },
          }
        : null,
    };

    return res.json(payloadResumo);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter resumo do cooperado:", error.message);
    return res.status(500).json({ error: "Falha ao obter o resumo do cooperado.", details: error.message });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/folhas
 * Retorna TODAS AS FOLHAS DE PAGAMENTO E COMPETÊNCIAS do cooperado
 */
router.get("/cooperados/:cpf/folhas", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    if (!numericCpf) return res.status(400).json({ error: "CPF inválido." });

    const payrolls = await getSicPayrolls(numericCpf);

    const formattedPayrolls = payrolls.map((p: any) => ({
      payrollId: p.payrollId,
      competencia: p.competence || `${p.year}-${String(p.month).padStart(2, "0")}`,
      mes: p.month,
      ano: p.year,
      tipoFolha: p.payrollType || "Regular",
      status: p.payrollStatus || "Processado",
      contrato: p.contractDescription || "",
      cliente: p.clientName || "",
      dataPagamento: p.payDayTime || null,
      links: {
        resumoFinanceiro: `/api/v1/cooperados/${numericCpf}/folhas/${p.payrollId}/resumo-financeiro`,
        demonstrativoPdf: `/api/v1/cooperados/${numericCpf}/folhas/${p.payrollId}/demonstrativo`,
        comprovantePdf: `/api/v1/cooperados/${numericCpf}/folhas/${p.payrollId}/comprovante`,
      },
    }));

    return res.json({
      cpf: numericCpf,
      totalFolhas: formattedPayrolls.length,
      folhas: formattedPayrolls,
    });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao listar folhas:", error.message);
    return res.status(500).json({ error: "Falha ao listar folhas de pagamento." });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/folhas/:payrollId/resumo-financeiro
 * Retorna o resumo financeiro detalhado de uma competência específica
 */
router.get("/cooperados/:cpf/folhas/:payrollId/resumo-financeiro", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const rawPayrollId = Array.isArray(req.params.payrollId) ? req.params.payrollId[0] : req.params.payrollId;

    const numericCpf = cleanCpf(rawCpf || "");
    const payrollId = String(rawPayrollId || "");

    const summary = await getFinancialSummary(numericCpf, payrollId);
    return res.json(summary);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter resumo financeiro:", error.message);
    return res.status(500).json({ error: "Falha ao extrair o resumo financeiro da folha." });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/folhas/:payrollId/demonstrativo
 * Retorna o PDF do Demonstrativo de Pagamento em fluxo binário
 */
router.get("/cooperados/:cpf/folhas/:payrollId/demonstrativo", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const rawPayrollId = Array.isArray(req.params.payrollId) ? req.params.payrollId[0] : req.params.payrollId;

    const numericCpf = cleanCpf(rawCpf || "");
    const payrollId = String(rawPayrollId || "");
    const token = await getSicToken();

    const url = `https://core.coopedu.app.br/api/CooperativeUserApp/${numericCpf}/payrolls/${payrollId}/demonstrative`;
    const pdfRes = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
    });

    const pdfBuffer = Buffer.from(pdfRes.data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="demonstrativo-${numericCpf}-${payrollId}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter PDF do demonstrativo:", error.message);
    return res.status(500).json({ error: "Falha ao obter o PDF do demonstrativo." });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/folhas/:payrollId/comprovante
 * Retorna o PDF do Comprovante de Pagamento PIX em fluxo binário
 */
router.get("/cooperados/:cpf/folhas/:payrollId/comprovante", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const rawPayrollId = Array.isArray(req.params.payrollId) ? req.params.payrollId[0] : req.params.payrollId;

    const numericCpf = cleanCpf(rawCpf || "");
    const payrollId = String(rawPayrollId || "");
    const token = await getSicToken();

    const url = `https://core.coopedu.app.br/api/CooperativeUserApp/${numericCpf}/payrolls/${payrollId}/receipt`;
    const pdfRes = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
    });

    const pdfBuffer = Buffer.from(pdfRes.data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="comprovante-${numericCpf}-${payrollId}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter PDF do comprovante:", error.message);
    return res.status(500).json({ error: "Falha ao obter o PDF do comprovante." });
  }
});

export default router;
