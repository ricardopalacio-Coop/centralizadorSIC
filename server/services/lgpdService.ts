import { pool } from "../db";

/**
 * Mascaramento LGPD (Lei 13.709/2018).
 * Quando ativo, todo usuário que não é SuperAdmin recebe os dados pessoais
 * do cooperado mascarados. A chave fica em system_settings para valer para todos.
 */

const CHAVE = "lgpd_mascaramento_ativo";
const CACHE_MS = 15000;

let cache: { ativo: boolean; lidoEm: number } | null = null;

export async function isLgpdAtivo(): Promise<boolean> {
  if (cache && Date.now() - cache.lidoEm < CACHE_MS) return cache.ativo;
  try {
    const [rows] = await pool.query<any[]>("SELECT setting_value FROM system_settings WHERE setting_key = ?", [CHAVE]);
    const ativo = rows[0]?.setting_value === "1";
    cache = { ativo, lidoEm: Date.now() };
    return ativo;
  } catch (err: any) {
    console.warn("[LGPD] Falha ao ler configuração:", err.message);
    return cache?.ativo ?? false;
  }
}

export async function setLgpdAtivo(ativo: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value, description)
     VALUES (?, ?, 'Mascaramento de dados sensíveis (LGPD) para usuários não SuperAdmin')
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [CHAVE, ativo ? "1" : "0"]
  );
  cache = { ativo, lidoEm: Date.now() };
}

/** Campos de CPF usados como chave de busca e navegação: a tela mascara na exibição. */
const CHAVES_CPF = new Set(["cpf", "document", "documento", "numericcpf", "identification", "cpfcnpj", "cleancpf"]);

type Tipo = "email" | "telefone" | "data" | "generico" | "chave";

function classificar(chave: string): Tipo | null {
  const k = chave.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (CHAVES_CPF.has(k)) return "chave";
  if (k.includes("email")) return "email";
  if (/fone|phone|celular|whatsapp/.test(k)) return "telefone";
  if (/nascimento|birth|datanasc|dtnasc/.test(k)) return "data";
  if (
    k === "rg" || /^rg[a-z]/.test(k) || /(numero|nr|num)rg$/.test(k) || k.includes("identidade") ||
    k === "pis" || k === "nis" || k.includes("pispasep") || k === "nit" ||
    /ctps|tituloeleitor|passaporte|passport|reservista|^cnh/.test(k) ||
    /endereco|address|logradouro|bairro|complemento|street|zipcode|postalcode|neighborhood/.test(k) ||
    k === "cep" || /^cep|cep$/.test(k) ||
    /nomemae|nomepai|mother|father|filiacao/.test(k) || k === "mae" || k === "pai" ||
    k === "conta" || /agencia|contabanc|contacorrente|numeroconta|nrconta|contadigito|bankaccount|pix/.test(k) ||
    /raca|etnia|religiao|deficiencia/.test(k)
  ) {
    return "generico";
  }
  return null;
}

const CPF_FORMATADO = /\b\d{3}\.(\d{3})\.(\d{3})-\d{2}\b/g;

function mascararValor(valor: string, tipo: Tipo): string {
  if (tipo === "email") {
    const [usuario, dominio] = valor.split("@");
    return dominio ? `${usuario.charAt(0)}***@${dominio}` : "***";
  }
  if (tipo === "telefone") {
    const d = valor.replace(/\D/g, "");
    return d.length >= 4 ? `(**) *****-${d.slice(-4)}` : "***";
  }
  if (tipo === "data") return "**/**/****";
  return "******";
}

/** Percorre a resposta inteira e mascara o que for dado pessoal. */
export function mascararDados(dado: any, tipo: Tipo | null = null): any {
  if (dado === null || dado === undefined || dado === "") return dado;
  if (Array.isArray(dado)) return dado.map((item) => mascararDados(item, tipo));
  if (dado instanceof Date) return tipo && tipo !== "chave" ? mascararValor(dado.toISOString(), tipo) : dado;
  if (typeof dado === "object") {
    // Um objeto sob chave de CPF (ex.: "documento": { rg, cpf }) ainda tem os filhos avaliados.
    const herdado = tipo === "chave" ? null : tipo;
    const saida: Record<string, any> = {};
    for (const [chave, valor] of Object.entries(dado)) {
      saida[chave] = mascararDados(valor, herdado ?? classificar(chave));
    }
    return saida;
  }
  if (tipo === "chave") return dado;
  if (tipo) return mascararValor(String(dado), tipo);
  if (typeof dado === "string") return dado.replace(CPF_FORMATADO, "***.$1.$2-**");
  return dado;
}

/** Detecta valores já mascarados, para não gravá-los por cima do dado real. */
export function contemMascara(dado: any): boolean {
  if (typeof dado === "string") return dado.includes("***");
  if (Array.isArray(dado)) return dado.some(contemMascara);
  if (dado && typeof dado === "object") return Object.values(dado).some(contemMascara);
  return false;
}
