import { Router, Response } from "express";
import { authenticateToken, requireSuperAdmin, AuthenticatedRequest } from "../middlewares/auth";
import { isLgpdAtivo, setLgpdAtivo } from "../services/lgpdService";

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/lgpd
 * Informa se o mascaramento LGPD está ativo
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ ativo: await isLgpdAtivo() });
});

/**
 * PUT /api/lgpd
 * Ativa ou desativa o mascaramento para todos os usuários (somente SuperAdmin)
 */
router.put("/", requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ativo = req.body?.ativo === true;
    await setLgpdAtivo(ativo);
    console.log(`[LGPD] Mascaramento ${ativo ? "ATIVADO" : "DESATIVADO"} por ${req.user?.email}`);
    return res.json({ ativo, message: ativo ? "Mascaramento LGPD ativado para todos os usuários." : "Mascaramento LGPD desativado." });
  } catch (error: any) {
    console.error("[LGPD Error] Falha ao salvar configuração:", error.message);
    return res.status(500).json({ error: "Falha ao salvar a configuração da LGPD." });
  }
});

export default router;
