import { Router, Response, Request } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import { googleDriveDesligamentoService } from "../services/googleDriveDesligamentoService";

const router = Router();

// Todas as rotas de desligamentos exigem autenticação do usuário do SIC
router.use(authenticateToken);

/**
 * GET /api/drive/desligamento/status
 * Retorna o status da integração e subpastas de Desligamentos do Google Drive
 */
router.get("/status", (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = googleDriveDesligamentoService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao consultar status do Google Drive Desligamentos." });
  }
});

/**
 * GET /api/drive/desligamento/fichas
 * Consulta e lista os termos/fichas de Desligamento com filtros, busca por Nome e CPF e paginação
 */
router.get("/fichas", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      tipo,
      cpfStatus,
      sortBy,
      sortOrder,
      page,
      pageSize,
      dateFrom,
      dateTo,
    } = req.query;

    const result = await googleDriveDesligamentoService.searchFichas({
      search: typeof search === "string" ? search : undefined,
      tipo: typeof tipo === "string" ? tipo : undefined,
      cpfStatus: (cpfStatus as any) || "all",
      sortBy: (sortBy as any) || "modifiedTime",
      sortOrder: (sortOrder as any) || "desc",
      page: page ? parseInt(page as string, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : 30,
      dateFrom: typeof dateFrom === "string" ? dateFrom : undefined,
      dateTo: typeof dateTo === "string" ? dateTo : undefined,
    });

    res.json(result);
  } catch (err: any) {
    console.error("❌ Erro na rota /api/drive/desligamento/fichas:", err.message);
    res.status(500).json({
      error: err.message || "Falha ao buscar Fichas de Desligamento no Google Drive.",
      status: googleDriveDesligamentoService.getStatus(),
    });
  }
});

/**
 * POST /api/drive/desligamento/scan
 * Inicia a varredura profunda e extração de texto/CPF em lote de Desligamentos
 */
router.post("/scan", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const forceFullRescan = req.body?.forceFullRescan === true;
    googleDriveDesligamentoService.startBackgroundScan(forceFullRescan);
    const scanStatus = googleDriveDesligamentoService.getScanStatus();

    res.json({
      success: true,
      message: "Varredura profunda e extração de PDFs de Desligamento iniciada com sucesso em segundo plano.",
      scanStatus,
    });
  } catch (err: any) {
    console.error("❌ Erro na rota /api/drive/desligamento/scan:", err.message);
    res.status(500).json({
      success: false,
      error: err.message || "Falha ao iniciar varredura de PDFs de Desligamento.",
    });
  }
});

/**
 * GET /api/drive/desligamento/scan-status
 * Consulta o progresso em tempo real da varredura profunda de Desligamentos
 */
router.get("/scan-status", (req: AuthenticatedRequest, res: Response): void => {
  try {
    const scanStatus = googleDriveDesligamentoService.getScanStatus();
    res.json(scanStatus);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao consultar status da varredura de Desligamento." });
  }
});

/**
 * POST /api/drive/desligamento/stop-scan
 * Interrompe a varredura em andamento
 */
router.post("/stop-scan", (req: AuthenticatedRequest, res: Response): void => {
  try {
    googleDriveDesligamentoService.stopScan();
    res.json({ success: true, message: "Varredura interrompida." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao interromper varredura." });
  }
});

/**
 * POST /api/drive/desligamento/sync
 * Sincroniza metadados dos arquivos de Desligamento do Drive para o MySQL
 */
router.post("/sync", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await googleDriveDesligamentoService.syncMetadataToDb();
    const result = await googleDriveDesligamentoService.searchFichas({ page: 1, pageSize: 30 });
    res.json({
      success: true,
      message: "Catálogo de Desligamentos do Google Drive sincronizado com o MySQL.",
      result,
    });
  } catch (err: any) {
    console.error("❌ Erro na rota /api/drive/desligamento/sync:", err.message);
    res.status(500).json({
      success: false,
      error: err.message || "Falha ao sincronizar Desligamentos com o Google Drive.",
      status: googleDriveDesligamentoService.getStatus(),
    });
  }
});

/**
 * GET /api/drive/desligamento/download/:fileId
 * Faz streaming para download direto do arquivo de Desligamento
 */
router.get("/download/:fileId", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const fileId = Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId;
    if (!fileId) {
      res.status(400).json({ error: "ID do arquivo é obrigatório." });
      return;
    }

    const { stream, name, mimeType, size } = await googleDriveDesligamentoService.getDownloadStream(fileId);

    res.setHeader("Content-Type", mimeType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`
    );
    if (size) {
      res.setHeader("Content-Length", size);
    }

    stream.pipe(res);
  } catch (err: any) {
    console.error("❌ Erro no download do arquivo de Desligamento do Google Drive:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Falha ao baixar arquivo de Desligamento do Google Drive." });
    }
  }
});

/**
 * PUT /api/drive/desligamento/fichas/:fileId
 * Atualiza manualmente o Nome do Cooperado e/ou CPF de um Termo de Desligamento
 */
router.put("/fichas/:fileId", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const fileId = Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId;
    const { cooperadoName, cpf } = req.body;

    if (!fileId) {
      res.status(400).json({ error: "ID do arquivo é obrigatório." });
      return;
    }

    if (!cooperadoName && !cpf) {
      res.status(400).json({ error: "Informe ao menos o Nome ou CPF para atualizar." });
      return;
    }

    const updated = await googleDriveDesligamentoService.updateFicha(fileId, cooperadoName, cpf);
    if (!updated) {
      res.status(404).json({ error: "Termo de desligamento não encontrado." });
      return;
    }

    res.json({
      success: true,
      message: "Dados do termo de desligamento atualizados com sucesso.",
      item: updated,
    });
  } catch (err: any) {
    console.error("❌ Erro ao atualizar termo de desligamento:", err.message);
    res.status(500).json({ error: err.message || "Erro ao salvar alterações do termo." });
  }
});

export default router;
