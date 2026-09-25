import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import { isLgpdAtivo } from "../services/lgpdService";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "centralizador_sic_jwt_secret_key_coopedu_2026_super_secure";

/**
 * POST /api/auth/login
 * Realiza autenticação, emite Cookie HttpOnly e retorna dados do usuário (SEM SENHA)
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const [rows] = await pool.query<any[]>(
      "SELECT id, name, email, password_hash, role, status FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const user = rows[0];

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Sua conta está inativa. Contate o administrador." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "8h" });

    // Envia o token JWT como Cookie HttpOnly para total blindagem contra inspeção JS no F12
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 3600 * 1000, // 8 horas
    });

    return res.json({
      message: "Login realizado com sucesso",
      user: tokenPayload,
      lgpdAtivo: await isLgpdAtivo(),
      token, // Também devolve token caso o cliente prefira autorizar via Header
    });
  } catch (error: any) {
    console.error("[Auth Error] Falha no login:", error.message);
    return res.status(500).json({ error: "Erro interno no servidor ao realizar login." });
  }
});

/**
 * GET /api/auth/me
 * Retorna os dados da sessão do usuário autenticado (ou null se não logado, evitando erro 401 no F12)
 */
router.get("/me", async (req: Request, res: Response) => {
  const tokenFromCookie = req.cookies?.auth_token;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    return res.json({ user: null });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return res.json({ user: decoded, lgpdAtivo: await isLgpdAtivo() });
  } catch (error) {
    return res.json({ user: null });
  }
});

/**
 * POST /api/auth/logout
 * Encerra a sessão limpando o Cookie HttpOnly
 */
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("auth_token");
  return res.json({ message: "Logout realizado com sucesso." });
});

/**
 * PUT /api/auth/change-password
 * Permite ao usuário logado alterar a sua própria senha
 */
router.put("/change-password", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
    }

    const [rows] = await pool.query<any[]>("SELECT password_hash FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Senha atual incorreta." });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, userId]);

    return res.json({ message: "Sua senha foi alterada com sucesso!" });
  } catch (error: any) {
    console.error("[Auth Error] Falha ao alterar senha:", error.message);
    return res.status(500).json({ error: "Erro ao alterar a senha." });
  }
});

export default router;
