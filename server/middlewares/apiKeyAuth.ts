import { Request, Response, NextFunction } from "express";
import { pool } from "../db";

export interface ApiAuthenticatedRequest extends Request {
  apiUser?: {
    userId: number;
    tokenId: number;
    tokenName: string;
  };
}

export async function authenticateApiKey(
  req: ApiAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let token = "";

    // 1. Verificar Header Authorization Bearer
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // 2. Verificar Header X-API-Key
    if (!token && req.headers["x-api-key"]) {
      token = String(req.headers["x-api-key"]).trim();
    }

    // 3. Verificar Query Parameter api_key
    if (!token && req.query.api_key) {
      token = String(req.query.api_key).trim();
    }

    if (!token) {
      return res.status(401).json({
        error: "Token de API não fornecido.",
        message: "Autenticação necessária. Envie seu token via Header 'Authorization: Bearer <TOKEN>' ou 'X-API-Key: <TOKEN>'.",
      });
    }

    // 4. Buscar token ativo no banco de dados
    const [rows] = await pool.query<any[]>(
      "SELECT id, user_id, name, status FROM api_tokens WHERE token = ? AND status = 'ACTIVE' LIMIT 1",
      [token]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        error: "Token de API inválido ou revogado.",
        message: "O token fornecido é inválido, expirou ou foi revogado no Centralizador SIC.",
      });
    }

    const tokenRow = rows[0];

    // 5. Atualizar último uso de forma assíncrona
    pool.query("UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?", [tokenRow.id]).catch(() => {});

    req.apiUser = {
      userId: tokenRow.user_id,
      tokenId: tokenRow.id,
      tokenName: tokenRow.name,
    };

    return next();
  } catch (error: any) {
    console.error("[API Key Auth Error]:", error);
    return res.status(500).json({ error: "Falha interna na autenticação por API Token." });
  }
}
