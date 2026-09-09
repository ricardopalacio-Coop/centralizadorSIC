import { Router, Response, Request } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import { googleDriveService } from "../services/googleDriveService";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const router = Router();

/**
 * GET /api/drive/auth/url
 * Retorna a URL de consentimento OAuth do Google
 */
router.get("/auth/url", (req: Request, res: Response) => {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: "GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET não configurados no .env.",
      });
    }

    const origin = req.headers.referer ? new URL(req.headers.referer).origin : `http://localhost:${process.env.PORT || 3005}`;
    const redirectUri = `${origin}/api/drive/auth/callback`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    res.json({ authUrl, redirectUri });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao gerar URL de autorização." });
  }
});

/**
 * GET /api/drive/auth/callback
 * Callback público do Google OAuth
 */
router.get("/auth/callback", async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send("<h3>Código de autorização não recebido.</h3>");
      return;
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const host = req.get("host") || `localhost:${process.env.PORT || 3005}`;
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const redirectUri = `${protocol}://${host}/api/drive/auth/callback`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (refreshToken) {
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN = refreshToken;
      const envPath = path.resolve(process.cwd(), ".env");
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

      if (envContent.includes("GOOGLE_OAUTH_REFRESH_TOKEN=")) {
        envContent = envContent.replace(/GOOGLE_OAUTH_REFRESH_TOKEN=.*/g, `GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`);
      } else {
        envContent += `
GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}
`;
      }
      fs.writeFileSync(envPath, envContent, "utf8");
    }

    googleDriveService.initClient();
    try {
      await googleDriveService.syncMetadataToDb();
    } catch (e) {}

    // Redireciona para o aplicativo
    res.redirect("/?auth=success&tab=fichas");
  } catch (err: any) {
    console.error("Erro no callback OAuth:", err.message);
    res.status(500).send(`<h3>Erro ao autenticar com o Google Drive: ${err.message}</h3>`);
  }
});

// A partir daqui, as rotas exigem autenticação do usuário do SIC
router.use(authenticateToken);

/**
 * GET /api/drive/status
 * Retorna o status da integração e credenciais do Google Drive
 */
router.get("/status", (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = googleDriveService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao consultar status do Google Drive." });
  }
});

/**
 * GET /api/drive/fichas
 * Consulta e lista as Fichas Cadastrais com filtros, busca por Nome e CPF e paginação
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

    const result = await googleDriveService.searchFichas({
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
    console.error("❌ Erro na rota /api/drive/fichas:", err.message);
    res.status(500).json({
      error: err.message || "Falha ao buscar Fichas Cadastrais no Google Drive.",
      status: googleDriveService.getStatus(),
    });
  }
});

/**
 * POST /api/drive/fichas/scan
 * Inicia a varredura profunda e extração de texto/CPF em lote em background
 */
router.post("/fichas/scan", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const forceFullRescan = req.body?.forceFullRescan === true;
    googleDriveService.startBackgroundScan(forceFullRescan);
    const scanStatus = googleDriveService.getScanStatus();

    res.json({
      success: true,
      message: "Varredura profunda e extração de PDFs iniciada com sucesso em segundo plano.",
      scanStatus,
    });
  } catch (err: any) {
    console.error("❌ Erro na rota /api/drive/fichas/scan:", err.message);
    res.status(500).json({
      success: false,
      error: err.message || "Falha ao iniciar varredura de PDFs.",
    });
  }
});

/**
 * GET /api/drive/fichas/scan-status
 * Consulta o progresso em tempo real da varredura profunda
 */
router.get("/fichas/scan-status", (req: AuthenticatedRequest, res: Response): void => {
  try {
    const scanStatus = googleDriveService.getScanStatus();
    res.json(scanStatus);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao consultar status da varredura." });
  }
});

/**
 * POST /api/drive/fichas/atualizar-easy
 * Atualiza Matrícula, Data de Nascimento, Contrato Principal e valida Nome cruzando com a base EasyCoop/SIC
 */
router.post("/fichas/atualizar-easy", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await googleDriveService.atualizarEasy();
    res.json({
      success: true,
      message: `Atualização Easy concluída! ${result.updatedCount} fichas atualizadas com Matrícula, Nascimento e Contrato.`,
      updatedCount: result.updatedCount,
    });
  } catch (err: any) {
    console.error("❌ Erro na rota /api/drive/fichas/atualizar-easy:", err.message);
    res.status(500).json({
      success: false,
      error: err.message || "Falha ao atualizar fichas cadastrais com a base Easy.",
    });
  }
});

/**
 * POST /api/drive/sync
 * Sincroniza metadados dos arquivos do Drive para o MySQL
 */
router.post("/sync", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await googleDriveService.syncMetadataToDb();
    const result = await googleDriveService.searchFichas({ page: 1, pageSize: 30 });
    res.json({
      success: true,
      message: "Catálogo de Fichas do Google Drive sincronizado com o MySQL.",
      result,
    });
  } catch (err: any) {
    console.error("❌ Erro na rota /api/drive/sync:", err.message);
    res.status(500).json({
      success: false,
      error: err.message || "Falha ao sincronizar com o Google Drive.",
      status: googleDriveService.getStatus(),
    });
  }
});

/**
 * GET /api/drive/download/:fileId
 * Faz streaming para download direto do arquivo
 */
router.get("/download/:fileId", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const fileId = Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId;
    if (!fileId) {
      res.status(400).json({ error: "ID do arquivo é obrigatório." });
      return;
    }

    const { stream, name, mimeType, size } = await googleDriveService.getDownloadStream(fileId);

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
    console.error("❌ Erro no download do arquivo do Google Drive:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Falha ao baixar arquivo do Google Drive." });
    }
  }
});

/**
 * PUT /api/drive/fichas/:fileId
 * Atualiza manualmente o Nome do Cooperado e/ou CPF de uma Ficha Cadastral
 */
router.put("/fichas/:fileId", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const fileId = Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId;
    const { cooperadoName, cpf, matricula, birthDate, contractName } = req.body;

    if (!fileId) {
      res.status(400).json({ error: "ID do arquivo é obrigatório." });
      return;
    }

    if (!cooperadoName && !cpf && !matricula) {
      res.status(400).json({ error: "Informe ao menos o Nome, CPF ou Matrícula para atualizar." });
      return;
    }

    const updated = await googleDriveService.updateFicha(
      fileId,
      cooperadoName,
      cpf,
      matricula,
      birthDate,
      contractName
    );
    if (!updated) {
      res.status(404).json({ error: "Ficha não encontrada." });
      return;
    }

    res.json({
      success: true,
      message: "Dados da ficha atualizados com sucesso.",
      item: updated,
    });
  } catch (err: any) {
    console.error("❌ Erro ao atualizar ficha cadastral:", err.message);
    res.status(500).json({ error: err.message || "Erro ao salvar alterações da ficha." });
  }
});

export default router;
