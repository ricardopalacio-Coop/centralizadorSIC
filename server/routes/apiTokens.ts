import { Router, Response } from "express";
import crypto from "crypto";
import { pool } from "../db";
import { authenticateToken, requireSuperAdmin, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateToken, requireSuperAdmin);

/**
 * GET /api/tokens/listar
 * Lista os tokens de API criados pelo usuário autenticado
 */
router.get("/listar", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const isSuperAdmin = req.user?.role === "SUPER_ADMIN";

    let query = "SELECT id, user_id, name, token, status, last_used_at, created_at FROM api_tokens";
    const params: any[] = [];

    if (!isSuperAdmin) {
      query += " WHERE user_id = ?";
      params.push(userId);
    }

    query += " ORDER BY created_at DESC";

    const [rows] = await pool.query<any[]>(query, params);
    return res.json({ tokens: rows });
  } catch (error: any) {
    console.error("[ApiTokens Error] Erro ao listar tokens:", error.message);
    return res.status(500).json({ error: "Falha ao listar tokens de API." });
  }
});

/**
 * POST /api/tokens/gerar
 * Cria um novo token de API com um nome fornecido
 */
router.post("/gerar", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "O nome/descrição da chave é obrigatório." });
    }

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    // Gerar token seguro com prefixo sic_live_
    const randomBytes = crypto.randomBytes(24).toString("hex");
    const rawToken = `sic_live_${randomBytes}`;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const maskedToken = `${rawToken.substring(0, 14)}...${rawToken.substring(rawToken.length - 6)}`;

    const [result] = await pool.query<any>(
      "INSERT INTO api_tokens (user_id, name, token, token_hash, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
      [userId, name.trim(), maskedToken, tokenHash]
    );

    const [createdRows] = await pool.query<any[]>(
      "SELECT id, user_id, name, token, status, created_at FROM api_tokens WHERE id = ?",
      [result.insertId]
    );

    return res.status(201).json({
      message: "Token de API gerado com sucesso!",
      token: {
        ...createdRows[0],
        token: rawToken, // Devolve o token completo apenas uma vez na criação
      },
    });
  } catch (error: any) {
    console.error("[ApiTokens Error] Erro ao gerar token:", error.message);
    return res.status(500).json({ error: "Falha ao gerar o token de API." });
  }
});

/**
 * POST /api/tokens/:id/revogar
 * Revoga um token de API existente
 */
router.post("/:id/revogar", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tokenId = req.params.id;
    const userId = req.user?.id;
    const isSuperAdmin = req.user?.role === "SUPER_ADMIN";

    let query = "UPDATE api_tokens SET status = 'REVOKED' WHERE id = ?";
    const params: any[] = [tokenId];

    if (!isSuperAdmin) {
      query += " AND user_id = ?";
      params.push(userId);
    }

    const [result] = await pool.query<any>(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Token não encontrado ou você não tem permissão para revogá-lo." });
    }

    return res.json({ message: "Token de API revogado com sucesso!" });
  } catch (error: any) {
    console.error("[ApiTokens Error] Erro ao revogar token:", error.message);
    return res.status(500).json({ error: "Falha ao revogar o token de API." });
  }
});

/**
 * GET /api/tokens/manual/pdf
 * Baixa o Manual da API em PDF
 */
router.get("/manual/pdf", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { generateApiManualPdf } = await import("../services/apiManualPdfGenerator");
    const pdfBuffer = await generateApiManualPdf();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Manual_API_Centralizador_SIC_v1.pdf"');
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[ApiTokens Error] Erro ao gerar PDF do manual:", error.message);
    return res.status(500).json({ error: "Falha ao gerar o PDF do manual da API." });
  }
});

export default router;
