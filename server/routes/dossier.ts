import { Router, Response } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import { searchEasycoopCooperados } from "../services/easycoopService";
import { getDossierInfo, generateDossierPdf } from "../services/dossierService";

const router = Router();

// Todas as rotas do Dossiê exigem autenticação segura
router.use(authenticateToken);

/**
 * GET /api/dossie/search?q=...
 * Busca rápida por CPF ou Nome para o autocomplete da tela de Dossiê
 */
router.get("/search", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ cooperados: [] });
    }
    const results = await searchEasycoopCooperados(q);
    return res.json({ cooperados: results });
  } catch (error: any) {
    console.error("[Dossier Route Error] Falha ao pesquisar cooperados:", error.message);
    return res.status(500).json({ error: "Falha na busca de cooperados." });
  }
});

/**
 * GET /api/dossie/info/:cpf
 * Retorna os dados resumidos do cooperado para preenchimento do Card (matrícula, nome, cpf, contrato principal, admissão, desligamento e status da ficha)
 */
router.get("/info/:cpf", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const info = await getDossierInfo(cpf);
    if (!info) {
      return res.status(404).json({ error: "Cooperado não localizado na base de dados." });
    }
    return res.json(info);
  } catch (error: any) {
    console.error("[Dossier Route Error] Erro ao carregar info do cooperado:", error.message);
    return res.status(500).json({ error: error.message || "Erro interno ao consultar dados do cooperado." });
  }
});

/**
 * GET /api/dossie/pdf/:cpf
 * Gera o arquivo PDF unificado do Dossiê
 * Query params opcionais:
 * - download: 'true' para forçar download como anexo, caso contrário abre inline no visualizador
 * - semFicha: 'true' se o usuário optou por gerar o dossiê mesmo sem a Ficha de Adesão
 */
router.get("/pdf/:cpf", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = String(req.params.cpf || "").trim();
    const isDownload = req.query.download === "true" || req.query.download === "1";
    const semFicha = req.query.semFicha === "true" || req.query.semFicha === "1";

    const result = await generateDossierPdf(cpf, {
      includeFicha: !semFicha,
    });

    const encodedFilename = encodeURIComponent(result.filename);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="${result.filename}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader("Content-Length", result.buffer.length);
    res.setHeader("X-Dossier-Pages", String(result.pagesCount));
    res.setHeader("X-Dossier-Has-Ficha", String(result.hasFichaAttached));

    return res.send(result.buffer);
  } catch (error: any) {
    console.error("[Dossier Route Error] Falha ao gerar PDF unificado do Dossiê:", error.message);
    return res.status(500).json({ error: error.message || "Falha ao gerar o PDF unificado do Dossiê." });
  }
});

export default router;
