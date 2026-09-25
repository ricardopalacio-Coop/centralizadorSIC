import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: "SUPER_ADMIN" | "MASTER" | "USER";
    name: string;
  };
}

export const JWT_SECRET = process.env.JWT_SECRET || "centralizador_sic_jwt_secret_key_coopedu_2026_super_secure";

/**
 * Middleware para autenticação via JWT (lido de HttpOnly Cookie ou Bearer Header)
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const tokenFromCookie = req.cookies?.auth_token;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    return res.status(401).json({ error: "Acesso não autorizado. Faça login para continuar." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedRequest["user"];
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
  }
}

/**
 * Middleware exigindo privilégios de SuperAdmin
 */
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Acesso negado. Ação restrita a SuperAdmins." });
  }
  next();
}
