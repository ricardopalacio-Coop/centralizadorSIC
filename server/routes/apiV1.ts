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
  updateOfficialSicCooperadoData,
  updateOfficialSicCooperadoContacts,
} from "../services/sicBrowserAutomation";
import { getCooperadoAppData } from "../services/appDbService";
import {
  generateReceiptPdf,
  generateEasycoopFichaPdf,
  generateEasycoopFolhaLotePdf,
  generateEasycoopLancamentosPdf,
  generateEasycoopEsocialPdf,
  generateTermoDesligamentoPdf,
  generatePropostaAdesaoPdf,
} from "../services/pdfService";
import {
  getEasycoopCooperadoFull,
  getEasycoopFinancialHistory,
  getEasycoopLancamentoItens,
  getEasycoopCooperadoFolha,
  getEasycoopCooperadoEsocial,
  getEasycoopFolhasPeriodo,
  listEasycoopContratos,
} from "../services/easycoopService";
import { consultarDesligamentoEProposta, formatCpf } from "../services/desligamentoService";

function formatDateForDb(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const str = String(dateStr).trim();
    if (str.includes("/")) {
      const parts = str.split("/");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

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

/* =========================================================================
   MÓDULO EASYCOOP NA API V1
   ========================================================================= */

/**
 * GET /api/v1/cooperados/:cpf/easycoop
 * Retorna o dossiê 360° completo do cooperado no EasyCoop
 */
router.get("/cooperados/:cpf/easycoop", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    if (!numericCpf || numericCpf.length !== 11) {
      return res.status(400).json({ error: "CPF inválido. Forneça 11 dígitos numéricos." });
    }

    const dossier = await getEasycoopCooperadoFull(numericCpf);
    return res.json({
      status: "SUCESSO",
      cpf: numericCpf,
      formattedCpf: formatCpf(numericCpf),
      easycoop: dossier,
    });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter dossiê EasyCoop:", error.message);
    return res.status(error.message?.includes("não encontrado") ? 404 : 500).json({
      error: "Falha ao obter dados do EasyCoop.",
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/easycoop/financeiro?ano=...&mes=...&tomador=...
 * Retorna o histórico financeiro e fechamentos do cooperado no EasyCoop
 */
router.get("/cooperados/:cpf/easycoop/financeiro", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    if (!numericCpf) return res.status(400).json({ error: "CPF inválido." });

    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const tomador = req.query.tomador ? String(req.query.tomador).trim() : undefined;

    const data = await getEasycoopFinancialHistory(numericCpf, ano, mes, tomador);
    return res.json({
      status: "SUCESSO",
      cpf: numericCpf,
      ...data,
    });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter histórico financeiro EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao consultar histórico financeiro no EasyCoop.", details: error.message });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/easycoop/financeiro/itens?ano=...&mes=...&folha=...
 * Retorna as rubricas item a item de um fechamento específico no EasyCoop
 */
router.get("/cooperados/:cpf/easycoop/financeiro/itens", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    const ano = parseInt(String(req.query.ano || "0"), 10);
    const mes = parseInt(String(req.query.mes || "0"), 10);
    const folha = parseInt(String(req.query.folha || "1"), 10);

    const itens = await getEasycoopLancamentoItens(numericCpf, ano, mes, folha);
    return res.json({ status: "SUCESSO", cpf: numericCpf, itens });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter itens de fechamento EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao consultar itens de repasse no EasyCoop.", details: error.message });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/easycoop/folha?ano=...&mes=...&folha=...
 * Retorna a folha analítica do cooperado com proventos, descontos e bases de cálculo
 */
router.get("/cooperados/:cpf/easycoop/folha", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const folha = req.query.folha ? parseInt(String(req.query.folha), 10) : 1;

    const data = await getEasycoopCooperadoFolha(numericCpf, ano, mes, folha);
    return res.json({ status: "SUCESSO", cpf: numericCpf, ...data });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter folha EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao carregar folha analítica no EasyCoop.", details: error.message });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/easycoop/esocial?ano=...&mes=...&evento=...
 * Retorna eventos e transmissões do eSocial do cooperado no EasyCoop
 */
router.get("/cooperados/:cpf/easycoop/esocial", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const evento = req.query.evento ? String(req.query.evento).trim() : undefined;

    const data = await getEasycoopCooperadoEsocial(numericCpf, ano, mes, evento);
    return res.json({ status: "SUCESSO", cpf: numericCpf, ...data });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao obter eSocial EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao consultar eSocial no EasyCoop.", details: error.message });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/easycoop/pdf/ficha
 * Retorna o PDF oficial da Ficha Cadastral e Financeira EasyCoop
 */
router.get("/cooperados/:cpf/easycoop/pdf/ficha", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    const [coop, financial] = await Promise.all([
      getEasycoopCooperadoFull(numericCpf),
      getEasycoopFinancialHistory(numericCpf).catch(() => ({})),
    ]);

    const pdfBuffer = await generateEasycoopFichaPdf(coop, financial);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="ficha-cadastral-easycoop-${numericCpf}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao gerar PDF da ficha EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao gerar PDF da ficha cadastral EasyCoop." });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/easycoop/pdf/folha?ano=...&mes=...&folha=...
 * Retorna o PDF consolidado do Demonstrativo de Produtividade/Folha EasyCoop
 */
router.get("/cooperados/:cpf/easycoop/pdf/folha", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const folha = req.query.folha ? parseInt(String(req.query.folha), 10) : 1;

    let competencias: any = undefined;
    if (req.query.competencias) {
      try {
        competencias = JSON.parse(String(req.query.competencias));
      } catch {}
    }

    const coop = await getEasycoopCooperadoFull(numericCpf);
    let folhasList: any[] = [];

    if (ano && mes && (!competencias || competencias.length === 0)) {
      const singleFolha = await getEasycoopCooperadoFolha(numericCpf, ano, mes, folha);
      if (singleFolha?.folha) folhasList.push(singleFolha.folha);
    } else {
      folhasList = await getEasycoopFolhasPeriodo(numericCpf, ano, mes, competencias);
    }

    if (folhasList.length === 0) {
      const singleFolha = await getEasycoopCooperadoFolha(numericCpf, ano, mes, folha);
      if (singleFolha?.folha) folhasList.push(singleFolha.folha);
    }

    const pdfBuffer = await generateEasycoopFolhaLotePdf(coop, folhasList);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="demonstrativo-produtividade-easycoop-${numericCpf}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao gerar PDF de demonstrativo EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao gerar PDF de demonstrativo EasyCoop." });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/easycoop/pdf/lancamentos?ano=...&mes=...&tomador=...
 * Retorna o PDF do extrato de lançamentos de rubricas EasyCoop
 */
router.get("/cooperados/:cpf/easycoop/pdf/lancamentos", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const tomador = req.query.tomador ? String(req.query.tomador).trim() : undefined;

    const [coop, financial] = await Promise.all([
      getEasycoopCooperadoFull(numericCpf),
      getEasycoopFinancialHistory(numericCpf, ano, mes, tomador),
    ]);

    const pdfBuffer = await generateEasycoopLancamentosPdf(coop, financial.fechamentos || []);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="extrato-lancamentos-easycoop-${numericCpf}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao gerar PDF de lançamentos EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao gerar PDF de lançamentos EasyCoop." });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/easycoop/pdf/esocial?ano=...&mes=...&evento=...
 * Retorna o PDF do relatório de eventos do eSocial EasyCoop
 */
router.get("/cooperados/:cpf/easycoop/pdf/esocial", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const evento = req.query.evento ? String(req.query.evento).trim() : undefined;

    const [coop, esocialData] = await Promise.all([
      getEasycoopCooperadoFull(numericCpf),
      getEasycoopCooperadoEsocial(numericCpf, ano, mes, evento),
    ]);

    const pdfBuffer = await generateEasycoopEsocialPdf(coop, esocialData.eventos || [], esocialData.metricas);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="relatorio-esocial-easycoop-${numericCpf}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao gerar PDF eSocial EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao gerar PDF de eventos do eSocial EasyCoop." });
  }
});

/**
 * GET /api/v1/easycoop/contratos?search=...&page=...&pageSize=...
 * Lista paginada dos contratos e tomadores do EasyCoop
 */
router.get("/easycoop/contratos", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const search = String(req.query.search || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "20"), 10)));

    const result = await listEasycoopContratos(search, page, pageSize);
    return res.json({ status: "SUCESSO", ...result });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao listar contratos EasyCoop:", error.message);
    return res.status(500).json({ error: "Falha ao listar contratos do EasyCoop.", details: error.message });
  }
});

/* =========================================================================
   MÓDULO TERMOS DE DESLIGAMENTO & ADESÃO EASY NA API V1
   ========================================================================= */

/**
 * GET /api/v1/cooperados/:cpf/desligamento
 * Consulta status do desligamento e da proposta de adesão Easy
 */
router.get("/cooperados/:cpf/desligamento", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    if (!numericCpf || numericCpf.length !== 11) {
      return res.status(400).json({ error: "CPF inválido. Forneça 11 dígitos numéricos." });
    }

    const resultado = await consultarDesligamentoEProposta(numericCpf);
    return res.json({
      status: "SUCESSO",
      cpf: numericCpf,
      formattedCpf: resultado.formattedCpf,
      desligamento: {
        solicitado: resultado.termination.found,
        status: resultado.termination.status,
        mensagem: resultado.termination.message,
        dados: resultado.termination.data,
        linkPdf: `/api/v1/cooperados/${numericCpf}/desligamento/termo-pdf`,
      },
      adesao: {
        localizada: resultado.proposal.found,
        status: resultado.proposal.status,
        mensagem: resultado.proposal.message,
        dados: resultado.proposal.data,
        linkPdf: `/api/v1/cooperados/${numericCpf}/adesao/termo-pdf`,
      },
    });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao consultar desligamento/adesão:", error.message);
    return res.status(400).json({ error: error.message || "Falha ao consultar desligamento e adesão." });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/desligamento/termo-pdf
 * Retorna o PDF oficial gerado do Termo de Desligamento
 */
router.get("/cooperados/:cpf/desligamento/termo-pdf", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    if (!numericCpf) return res.status(400).json({ error: "CPF inválido." });

    const resultado = await consultarDesligamentoEProposta(numericCpf);
    const pdfBuffer = await generateTermoDesligamentoPdf(resultado.termination?.data || resultado.termination || {}, numericCpf);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="termo-desligamento-${numericCpf}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao gerar PDF do termo de desligamento:", error.message);
    return res.status(500).json({ error: "Falha ao gerar o PDF do termo de desligamento.", details: error.message });
  }
});

/**
 * GET /api/v1/cooperados/:cpf/adesao/termo-pdf (e alias /proposta-pdf)
 * Retorna o PDF oficial gerado da Proposta/Termo de Adesão Easy
 */
const handleAdesaoPdf = async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    if (!numericCpf) return res.status(400).json({ error: "CPF inválido." });

    const resultado = await consultarDesligamentoEProposta(numericCpf);
    const pdfBuffer = await generatePropostaAdesaoPdf(resultado.proposal?.data || {}, numericCpf);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="proposta-adesao-${numericCpf}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao gerar PDF da proposta de adesão:", error.message);
    return res.status(500).json({ error: "Falha ao gerar o PDF da proposta de adesão.", details: error.message });
  }
};
router.get("/cooperados/:cpf/adesao/termo-pdf", handleAdesaoPdf);
router.get("/cooperados/:cpf/adesao/proposta-pdf", handleAdesaoPdf);

/* =========================================================================
   MÓDULO EDIÇÃO DE CAMPOS DO SIC NA API V1
   ========================================================================= */

/**
 * PUT /api/v1/cooperados/:cpf/sic
 * Atualiza campos cadastrais do cooperado (E-mail, WhatsApp, Data de Nascimento, RG, Endereço)
 * no Centralizador SIC (MySQL) e sincroniza de forma oficial com o SIC (ui.coopedu.app.br)
 */
router.put("/cooperados/:cpf/sic", async (req: ApiAuthenticatedRequest, res: Response) => {
  try {
    const rawCpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const numericCpf = cleanCpf(rawCpf || "");
    if (!numericCpf || numericCpf.length !== 11) {
      return res.status(400).json({ error: "CPF inválido. Forneça 11 dígitos numéricos." });
    }

    const {
      email,
      whatsapp,
      whatsapp_number,
      cellPhone,
      birth_date,
      dataNascimento,
      birthDate,
      rg,
      rg_number,
      rgIssuer,
      rgState,
      street,
      rua,
      number,
      numero,
      complement,
      complemento,
      neighborhood,
      bairro,
      city,
      cidade,
      state,
      estado,
      zip_code,
      cep,
    } = req.body || {};

    const finalEmail = email !== undefined ? String(email).trim().toLowerCase() : undefined;
    const finalWhatsapp = cleanCpf(whatsapp || whatsapp_number || cellPhone || "");
    const finalBirthDate = birth_date || dataNascimento || birthDate || undefined;
    const formattedBirthDate = formatDateForDb(finalBirthDate);
    const finalRg = rg !== undefined ? String(rg).trim() : (rg_number !== undefined ? String(rg_number).trim() : undefined);
    const finalStreet = street !== undefined ? String(street).trim() : (rua !== undefined ? String(rua).trim() : undefined);
    const finalNumber = number !== undefined ? String(number).trim() : (numero !== undefined ? String(numero).trim() : undefined);
    const finalComplement = complement !== undefined ? String(complement).trim() : (complemento !== undefined ? String(complemento).trim() : undefined);
    const finalNeighborhood = neighborhood !== undefined ? String(neighborhood).trim() : (bairro !== undefined ? String(bairro).trim() : undefined);
    const finalCity = city !== undefined ? String(city).trim() : (cidade !== undefined ? String(cidade).trim() : undefined);
    const finalState = state !== undefined ? String(state).trim().toUpperCase() : (estado !== undefined ? String(estado).trim().toUpperCase() : undefined);
    const finalZipCode = zip_code !== undefined ? cleanCpf(zip_code) : (cep !== undefined ? cleanCpf(cep) : undefined);

    // 1. Atualizar no banco MySQL local de forma consistente
    await pool.query(
      `UPDATE cooperados SET
        email = COALESCE(?, email),
        whatsapp_number = COALESCE(?, whatsapp_number),
        birth_date = COALESCE(?, birth_date),
        street = COALESCE(?, street),
        number = COALESCE(?, number),
        complement = COALESCE(?, complement),
        neighborhood = COALESCE(?, neighborhood),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        zip_code = COALESCE(?, zip_code),
        updated_at = CURRENT_TIMESTAMP
       WHERE document = ?`,
      [
        finalEmail || null,
        finalWhatsapp || null,
        formattedBirthDate || null,
        finalStreet || null,
        finalNumber || null,
        finalComplement || null,
        finalNeighborhood || null,
        finalCity || null,
        finalState || null,
        finalZipCode || null,
        numericCpf,
      ]
    );

    // 2. Sincronizar oficialmente com a API do SIC (ui.coopedu.app.br)
    const sicSyncResult = await updateOfficialSicCooperadoData(numericCpf, {
      email: finalEmail,
      whatsapp: finalWhatsapp,
      birthDate: finalBirthDate,
      rg: finalRg,
      rgIssuer,
      rgState: finalState || rgState,
      street: finalStreet,
      number: finalNumber,
      complement: finalComplement,
      neighborhood: finalNeighborhood,
      city: finalCity,
      state: finalState,
      zipCode: finalZipCode,
    });

    const [rows] = await pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]);

    return res.json({
      status: "SUCESSO",
      message: sicSyncResult.success
        ? "Dados cadastrais atualizados com sucesso no Centralizador SIC e sincronizados com o SIC oficial!"
        : `Dados cadastrais atualizados no Centralizador SIC local. (${sicSyncResult.message})`,
      syncedOfficialSic: sicSyncResult.success,
      cooperado: rows[0] || null,
      sicDetails: sicSyncResult.details || null,
    });
  } catch (error: any) {
    console.error("[API v1 Error] Erro ao editar campos do SIC:", error.message);
    return res.status(500).json({ error: "Falha ao editar campos do cooperado no SIC.", details: error.message });
  }
});

export default router;
