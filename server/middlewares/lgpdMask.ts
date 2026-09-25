import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./auth";
import { isLgpdAtivo, mascararDados, contemMascara } from "../services/lgpdService";

/** Rotas administrativas ou de integração externa ficam fora do mascaramento. */
const ROTAS_LIVRES = ["/api/auth", "/api/users", "/api/tokens", "/api/v1", "/api/sic", "/api/lgpd", "/api/health"];

function papelDaSessao(req: Request): string | null {
  const header = req.headers.authorization;
  const token = req.cookies?.auth_token || (header?.startsWith("Bearer ") ? header.split(" ")[1] : null);
  if (!token) return null;
  try {
    return (jwt.verify(token, JWT_SECRET) as any)?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Com a LGPD ativa, mascara os dados pessoais de todas as respostas JSON
 * para quem não é SuperAdmin e impede que valores mascarados sejam gravados.
 */
export async function lgpdMask(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api") || ROTAS_LIVRES.some((rota) => req.path.startsWith(rota))) return next();

  const papel = papelDaSessao(req);
  if (!papel || papel === "SUPER_ADMIN" || !(await isLgpdAtivo())) return next();

  if (req.method !== "GET" && contemMascara(req.body)) {
    return res.status(403).json({ error: "Dados protegidos pela LGPD não podem ser alterados por este perfil." });
  }

  const jsonOriginal = res.json.bind(res);
  res.json = (corpo: any) => jsonOriginal(mascararDados(corpo));
  next();
}
