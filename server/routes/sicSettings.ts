import { Router, Response } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import {
  getSicSessionStatus,
  saveSicSession,
  getAuthenticatedSicSession,
} from "../services/sicBrowserAutomation";
import axios from "axios";

const router = Router();

// Exige autenticação de usuário no Centralizador SIC
router.use(authenticateToken);

/**
 * GET /api/sic/status
 * Retorna o status da sessão web do SIC (Ativa, Expirada, Tempo restante, Usuário)
 */
router.get("/status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await getSicSessionStatus();
    return res.json(status);
  } catch (error: any) {
    return res.status(500).json({
      active: false,
      error: error.message || "Erro ao consultar status da sessão do SIC.",
    });
  }
});

/**
 * POST /api/sic/token
 * Salva e valida um novo cookie coopedu-auth-prod ou token JWT do SIC
 */
router.post("/token", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenOrCookie } = req.body;
    if (!tokenOrCookie || typeof tokenOrCookie !== "string") {
      return res.status(400).json({
        error: "O campo 'tokenOrCookie' é obrigatório. Cole o cookie coopedu-auth-prod ou o Token JWT.",
      });
    }

    const result = await saveSicSession(tokenOrCookie);
    return res.json(result);
  } catch (error: any) {
    console.error("[SIC Settings Error] Falha ao salvar token do SIC:", error.message);
    return res.status(400).json({
      error: error.message || "Falha ao validar ou salvar o Token do SIC.",
    });
  }
});

/**
 * POST /api/sic/test
 * Testa a conexão atual com a API do portal SIC
 */
router.post("/test", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
    const testRes = await axios.get(
      "https://ui.coopedu.app.br/api/cooperado/listar?search=000&pageNumber=1&pageSize=1",
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          Cookie: cookieHeader,
          Origin: "https://ui.coopedu.app.br",
        },
        timeout: 8000,
      }
    );

    return res.json({
      success: true,
      status: testRes.status,
      message: "Conexão com a API do portal SIC realizada com sucesso!",
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: error.message || "Sessão inválida ou expirada no portal do SIC.",
    });
  }
});

export default router;
