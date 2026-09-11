import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { authenticateToken, requireSuperAdmin, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// Todas as rotas de gerenciamento de usuários exigem autenticação e nível SuperAdmin
router.use(authenticateToken, requireSuperAdmin);

/**
 * GET /api/users
 * Lista todos os usuários cadastrados (SEM EXPOR HASHEMENTO OU SENHAS)
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [users] = await pool.query<any[]>(
      "SELECT id, name, email, role, status, created_at, updated_at FROM users ORDER BY id DESC"
    );
    return res.json({ users });
  } catch (error: any) {
    console.error("[Users Error] Erro ao listar usuários:", error.message);
    return res.status(500).json({ error: "Erro ao carregar a lista de usuários." });
  }
});

/**
 * POST /api/users
 * Cadastra um novo usuário no sistema
 */
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verifica duplicação de e-mail
    const [existing] = await pool.query<any[]>("SELECT id FROM users WHERE email = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Já existe um usuário cadastrado com este e-mail." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const allowedRoles = ["SUPER_ADMIN", "MASTER", "USER"];
    const userRole = allowedRoles.includes(role) ? role : "USER";

    const [result]: any = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
      [name.trim(), cleanEmail, passwordHash, userRole]
    );

    return res.status(201).json({
      message: "Usuário cadastrado com sucesso!",
      user: {
        id: result.insertId,
        name: name.trim(),
        email: cleanEmail,
        role: userRole,
        status: "ACTIVE",
      },
    });
  } catch (error: any) {
    console.error("[Users Error] Erro ao criar usuário:", error.message);
    return res.status(500).json({ error: "Erro ao cadastrar usuário." });
  }
});

/**
 * PUT /api/users/:id/password
 * Permite ao SuperAdmin redefinir a senha de outro usuário
 */
router.put("/:id/password", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paramId = String(req.params.id || "");
    const targetUserId = parseInt(paramId, 10);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "A nova senha é obrigatória e deve ter pelo menos 6 caracteres." });
    }

    const [users] = await pool.query<any[]>("SELECT id FROM users WHERE id = ?", [targetUserId]);
    if (users.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, targetUserId]);

    return res.json({ message: "Senha do usuário redefinida com sucesso." });
  } catch (error: any) {
    console.error("[Users Error] Erro ao redefinir senha do usuário:", error.message);
    return res.status(500).json({ error: "Erro ao redefinir a senha do usuário." });
  }
});

/**
 * PUT /api/users/:id
 * Atualiza dados ou status de um usuário
 */
router.put("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paramId = String(req.params.id || "");
    const targetUserId = parseInt(paramId, 10);
    const { name, role, status } = req.body;

    const [users] = await pool.query<any[]>("SELECT id, name, email, role, status FROM users WHERE id = ?", [targetUserId]);
    if (users.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const allowedRoles = ["SUPER_ADMIN", "MASTER", "USER"];
    const roleToUpdate = role && allowedRoles.includes(role) ? role : null;
    const statusToUpdate = status && ["ACTIVE", "INACTIVE"].includes(status) ? status : null;

    // Regra de segurança: O SuperAdmin autenticado não pode rebaixar seu próprio perfil
    if (targetUserId === req.user?.id && roleToUpdate && roleToUpdate !== "SUPER_ADMIN") {
      return res.status(400).json({ error: "Você não pode alterar ou rebaixar seu próprio perfil de SuperAdmin." });
    }

    await pool.query(
      "UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?",
      [name?.trim() || null, roleToUpdate, statusToUpdate, targetUserId]
    );

    const [updated] = await pool.query<any[]>("SELECT id, name, email, role, status FROM users WHERE id = ?", [targetUserId]);

    return res.json({
      message: "Dados do usuário atualizados com sucesso.",
      user: updated[0],
    });
  } catch (error: any) {
    console.error("[Users Error] Erro ao atualizar usuário:", error.message);
    return res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

/**
 * DELETE /api/users/:id
 * Remove um usuário do sistema
 */
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paramId = String(req.params.id || "");
    const targetUserId = parseInt(paramId, 10);

    // Evita auto-exclusão do usuário logado
    if (targetUserId === req.user?.id) {
      return res.status(400).json({ error: "Você não pode excluir sua própria conta enquanto estiver logado." });
    }

    await pool.query("DELETE FROM users WHERE id = ?", [targetUserId]);
    return res.json({ message: "Usuário excluído com sucesso." });
  } catch (error: any) {
    console.error("[Users Error] Erro ao excluir usuário:", error.message);
    return res.status(500).json({ error: "Erro ao excluir usuário." });
  }
});

export default router;
