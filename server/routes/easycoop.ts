import { Router, Response } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import {
  searchEasycoopCooperados,
  getEasycoopCooperadoFull,
  getEasycoopFinancialHistory,
  getEasycoopLancamentoItens,
  getEasycoopCooperadoFolha,
  getEasycoopCooperadoEsocial,
  listEasycoopContratos,
  getEasycoopContratoDetails,
  getEasycoopContratoCooperados,
  getEasycoopFolhasPeriodo,
} from "../services/easycoopService";
import {
  generateEasycoopFichaPdf,
  generateEasycoopGraficoPdf,
  generateEasycoopLancamentosPdf,
  generateEasycoopFolhaLotePdf,
  generateEasycoopEsocialPdf,
} from "../services/pdfService";

const router = Router();

// Todas as rotas do EasyCoop exigem autenticação segura
router.use(authenticateToken);

/**
 * GET /api/easycoop/cooperados/search?q=...
 * Busca rápida de cooperados no EasyCoop
 */
router.get("/cooperados/search", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const results = await searchEasycoopCooperados(q);
    return res.json({ cooperados: results });
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro na busca de cooperados:", error.message);
    return res.status(500).json({ error: "Falha ao buscar cooperados no EasyCoop." });
  }
});

/**
 * GET /api/easycoop/cooperados/:cpf/full
 * Retorna dossiê completo de dados cadastrais, alocações, dependentes, documentos e auditoria
 */
router.get("/cooperados/:cpf/full", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const data = await getEasycoopCooperadoFull(cpf);
    return res.json(data);
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro ao carregar cooperado completo:", error.message);
    return res.status(404).json({ error: error.message || "Cooperado não encontrado no EasyCoop." });
  }
});

/**
 * GET /api/easycoop/cooperados/:cpf/financeiro?ano=...&mes=...&tomador=...
 * Retorna histórico financeiro filtrável por período e por contrato
 */
router.get("/cooperados/:cpf/financeiro", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const tomador = req.query.tomador ? String(req.query.tomador).trim() : undefined;

    const data = await getEasycoopFinancialHistory(cpf, ano, mes, tomador);
    return res.json(data);
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro ao carregar financeiro:", error.message);
    return res.status(500).json({ error: "Falha ao consultar histórico financeiro." });
  }
});

/**
 * GET /api/easycoop/cooperados/:cpf/financeiro/itens?ano=...&mes=...&folha=...
 * Retorna o extrato item a item de rubricas do fechamento
 */
router.get("/cooperados/:cpf/financeiro/itens", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const ano = parseInt(String(req.query.ano || "0"), 10);
    const mes = parseInt(String(req.query.mes || "0"), 10);
    const folha = parseInt(String(req.query.folha || "1"), 10);

    const itens = await getEasycoopLancamentoItens(cpf, ano, mes, folha);
    return res.json({ itens });
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro ao carregar itens do repasse:", error.message);
    return res.status(500).json({ error: "Falha ao consultar itens de repasse." });
  }
});

/**
 * GET /api/easycoop/cooperados/:cpf/folha?ano=...&mes=...&folha=...
 * Retorna a folha analítica do cooperado com proventos, descontos e bases de cálculo
 */
router.get("/cooperados/:cpf/folha", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const folha = req.query.folha ? parseInt(String(req.query.folha), 10) : 1;

    const data = await getEasycoopCooperadoFolha(cpf, ano, mes, folha);
    return res.json(data);
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro ao carregar folha de pagamento:", error.message);
    return res.status(500).json({ error: "Falha ao carregar folha de pagamento." });
  }
});

/**
 * GET /api/easycoop/cooperados/:cpf/esocial?ano=...&mes=...&evento=...
 * Retorna os eventos e transmissões do eSocial do cooperado com filtros
 */
router.get("/cooperados/:cpf/esocial", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const evento = req.query.evento ? String(req.query.evento).trim() : undefined;

    const data = await getEasycoopCooperadoEsocial(cpf, ano, mes, evento);
    return res.json(data);
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro ao consultar eSocial:", error.message);
    return res.status(500).json({ error: "Falha ao consultar dados do eSocial." });
  }
});

/**
 * GET /api/easycoop/contratos/listar?search=...&page=...&pageSize=...
 * Lista contratos paginados
 */
router.get("/contratos/listar", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = String(req.query.search || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "15"), 10)));

    const result = await listEasycoopContratos(search, page, pageSize);
    return res.json(result);
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro ao listar contratos:", error.message);
    return res.status(500).json({ error: "Falha ao listar contratos do EasyCoop." });
  }
});

/**
 * GET /api/easycoop/contratos/:clienteId/:contratoId
 * Detalhes de um contrato específico
 */
router.get("/contratos/:clienteId/:contratoId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clienteId = parseInt(String(req.params.clienteId), 10);
    const contratoId = parseInt(String(req.params.contratoId), 10);

    const details = await getEasycoopContratoDetails(clienteId, contratoId);
    return res.json(details);
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro ao buscar detalhes do contrato:", error.message);
    return res.status(404).json({ error: error.message || "Contrato não encontrado." });
  }
});

/**
 * GET /api/easycoop/contratos/:clienteId/:contratoId/cooperados?page=...&pageSize=...&search=...
 * Lista paginada dos cooperados alocados no contrato
 */
router.get("/contratos/:clienteId/:contratoId/cooperados", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clienteId = parseInt(String(req.params.clienteId), 10);
    const contratoId = parseInt(String(req.params.contratoId), 10);
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "20"), 10)));
    const search = String(req.query.search || "").trim();

    const result = await getEasycoopContratoCooperados(clienteId, contratoId, page, pageSize, search);
    return res.json(result);
  } catch (error: any) {
    console.error("[EasyCoop Error] Erro ao listar cooperados do contrato:", error.message);
    return res.status(500).json({ error: "Falha ao listar cooperados do contrato." });
  }
});

/**
 * GET /api/easycoop/cooperados/:cpf/pdf/ficha
 * Gera o PDF oficial da Ficha Cadastral e Financeira do Cooperado (com logo oficial e Banco OWL)
 */
router.get("/cooperados/:cpf/pdf/ficha", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const isDownload = req.query.download === "true" || req.query.download === "1";
    const [coop, financial] = await Promise.all([
      getEasycoopCooperadoFull(cpf),
      getEasycoopFinancialHistory(cpf).catch(() => ({})),
    ]);

    const pdfBuffer = await generateEasycoopFichaPdf(coop, financial);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="ficha-cadastral-${cpf}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[EasyCoop PDF Error] Erro ao gerar ficha em PDF:", error.message);
    return res.status(500).json({ error: "Falha ao gerar PDF da ficha cadastral." });
  }
});

/**
 * GET or POST /api/easycoop/cooperados/:cpf/pdf/grafico
 * Gera o PDF com o Gráfico de Produtividade e os dados do cooperado no topo
 */
const handleGraficoPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const isDownload = req.query.download === "true" || req.query.download === "1" || req.body?.download;
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : (req.body?.ano || undefined);
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : (req.body?.mes || undefined);
    const contratoFiltro = req.query.contrato || req.query.tomador || req.body?.contrato || req.body?.tomador;
    const tomador = contratoFiltro && contratoFiltro !== "TODOS" ? String(contratoFiltro).trim() : undefined;

    const [coop, financial] = await Promise.all([
      getEasycoopCooperadoFull(cpf),
      getEasycoopFinancialHistory(cpf, ano, mes, tomador),
    ]);

    const pdfBuffer = await generateEasycoopGraficoPdf(coop, financial);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="grafico-produtividade-${cpf}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[EasyCoop PDF Error] Erro ao gerar gráfico em PDF:", error.message);
    return res.status(500).json({ error: "Falha ao gerar PDF do gráfico de produtividade." });
  }
};
router.get("/cooperados/:cpf/pdf/grafico", handleGraficoPdf);
router.post("/cooperados/:cpf/pdf/grafico", handleGraficoPdf);

/**
 * POST or GET /api/easycoop/cooperados/:cpf/pdf/lancamentos
 * Gera o PDF de todos os lançamentos selecionados com os dados do cooperado e detalhes
 */
const handleLancamentosPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const isDownload = req.query.download === "true" || req.query.download === "1" || req.body?.download;
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : (req.body?.ano || undefined);
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : (req.body?.mes || undefined);
    const tomador = req.query.tomador ? String(req.query.tomador).trim() : (req.body?.tomador || undefined);
    const rawIds = req.body?.ids || (req.query.ids ? String(req.query.ids).split(",").map(Number) : undefined);

    const [coop, financial] = await Promise.all([
      getEasycoopCooperadoFull(cpf),
      getEasycoopFinancialHistory(cpf, ano, mes, tomador),
    ]);

    let lancamentos = financial.fechamentos || [];
    if (Array.isArray(rawIds) && rawIds.length > 0) {
      const idSet = new Set(rawIds.map(Number));
      lancamentos = lancamentos.filter((f: any) => idSet.has(Number(f.id)));
    }

    const pdfBuffer = await generateEasycoopLancamentosPdf(coop, lancamentos);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="extrato-lancamentos-${cpf}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[EasyCoop PDF Error] Erro ao gerar lançamentos em PDF:", error.message);
    return res.status(500).json({ error: "Falha ao gerar PDF dos lançamentos." });
  }
};
router.get("/cooperados/:cpf/pdf/lancamentos", handleLancamentosPdf);
router.post("/cooperados/:cpf/pdf/lancamentos", handleLancamentosPdf);

/**
 * POST or GET /api/easycoop/cooperados/:cpf/pdf/folha-lote
 * Gera o PDF consolidado de demonstrativos de produtividade (individual ou lote selecionado)
 */
const handleFolhaLotePdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const isDownload = req.query.download === "true" || req.query.download === "1" || req.body?.download;
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : (req.body?.ano || undefined);
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : (req.body?.mes || undefined);
    const folha = req.query.folha ? parseInt(String(req.query.folha), 10) : (req.body?.folha || 1);

    let competencias = req.body?.competencias;
    if (!competencias && req.query.competencias) {
      try {
        competencias = JSON.parse(String(req.query.competencias));
      } catch {}
    }

    const coop = await getEasycoopCooperadoFull(cpf);
    let folhasList: any[] = [];

    if (ano && mes && (!competencias || competencias.length === 0)) {
      // Demonstrativo pontual da competência escolhida
      const singleFolha = await getEasycoopCooperadoFolha(cpf, ano, mes, folha);
      if (singleFolha?.folha) {
        folhasList.push(singleFolha.folha);
      }
    } else {
      // Lote por ano ou lista de competências selecionadas
      folhasList = await getEasycoopFolhasPeriodo(cpf, ano, mes, competencias);
    }

    if (folhasList.length === 0) {
      // Se não encontrou lote, tenta pegar a folha atual
      const singleFolha = await getEasycoopCooperadoFolha(cpf, ano, mes, folha);
      if (singleFolha?.folha) folhasList.push(singleFolha.folha);
    }

    const pdfBuffer = await generateEasycoopFolhaLotePdf(coop, folhasList);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="demonstrativos-${cpf}-${ano || "todos"}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[EasyCoop PDF Error] Erro ao gerar lote de folhas:", error.message);
    return res.status(500).json({ error: "Falha ao gerar demonstrativos em lote." });
  }
};
router.get("/cooperados/:cpf/pdf/folha-lote", handleFolhaLotePdf);
router.post("/cooperados/:cpf/pdf/folha-lote", handleFolhaLotePdf);

/**
 * POST or GET /api/easycoop/cooperados/:cpf/pdf/esocial
 * Gera o PDF dos eventos do e-Social selecionados por período e por tipo
 */
const handleEsocialPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const isDownload = req.query.download === "true" || req.query.download === "1" || req.body?.download;
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : (req.body?.ano || undefined);
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : (req.body?.mes || undefined);
    const evento = req.query.evento ? String(req.query.evento).trim() : (req.body?.evento || undefined);
    const rawIds = req.body?.ids || (req.query.ids ? String(req.query.ids).split(",").map(Number) : undefined);

    const [coop, esocialData] = await Promise.all([
      getEasycoopCooperadoFull(cpf),
      getEasycoopCooperadoEsocial(cpf, ano, mes, evento),
    ]);

    let eventos = esocialData.eventos || [];
    if (Array.isArray(rawIds) && rawIds.length > 0) {
      const idSet = new Set(rawIds.map(Number));
      eventos = eventos.filter((e: any) => idSet.has(Number(e.id)));
    }

    const pdfBuffer = await generateEasycoopEsocialPdf(coop, eventos, esocialData.metricas);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="esocial-relatorio-${cpf}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[EasyCoop PDF Error] Erro ao gerar relatório do eSocial:", error.message);
    return res.status(500).json({ error: "Falha ao gerar relatório do e-Social em PDF." });
  }
};
router.get("/cooperados/:cpf/pdf/esocial", handleEsocialPdf);
router.post("/cooperados/:cpf/pdf/esocial", handleEsocialPdf);

export default router;

