import { pool } from "../db";

/**
 * Busca rápida de cooperados (por CPF ou Nome) no MySQL
 */
export async function searchEasycoopCooperados(q: string) {
  const term = q.trim();
  if (!term) return [];

  const numericCpf = term.replace(/\D/g, "");
  const words = term.split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 0);

  let sql = `
    SELECT id, document, registration_number, name, contract_name, position,
           admission_date, status, email, whatsapp_number, city, state
    FROM cooperados
    WHERE 1=1
  `;
  const params: any[] = [];

  if (numericCpf.length === 11) {
    sql += ` AND (document = ? OR document LIKE ?)`;
    params.push(numericCpf, `%${numericCpf}%`);
  } else if (numericCpf.length >= 3 && /^\d+$/.test(term.replace(/[.-]/g, ""))) {
    sql += ` AND (document LIKE ? OR CAST(registration_number AS CHAR) LIKE ?)`;
    params.push(`%${numericCpf}%`, `%${numericCpf}%`);
  } else if (words.length > 0) {
    const wordClauses = words.map(() => `name LIKE ?`).join(" AND ");
    sql += ` AND (${wordClauses} OR document LIKE ?)`;
    words.forEach((w) => params.push(`%${w}%`));
    params.push(`%${term}%`);
  } else {
    sql += ` AND (name LIKE ? OR registration_number LIKE ?)`;
    params.push(`%${term}%`, `%${term}%`);
  }

  sql += ` ORDER BY (CASE WHEN status = 'Ativo' THEN 0 ELSE 1 END) ASC, name ASC LIMIT 30`;

  let [rows] = await pool.query<any[]>(sql, params);

  // Fallback se não encontrar em cooperados
  if (rows.length === 0 && (numericCpf.length >= 3 || words.length > 0)) {
    let alocSql = `
      SELECT DISTINCT document, nome AS name, matricula AS registration_number,
             tomador_nome AS contract_name, cargo AS position,
             'Ativo' AS status
      FROM easycoop_alocacoes
      WHERE 1=1
    `;
    const alocParams: any[] = [];
    if (numericCpf.length === 11) {
      alocSql += ` AND (document = ? OR document LIKE ?)`;
      alocParams.push(numericCpf, `%${numericCpf}%`);
    } else if (words.length > 0) {
      const wordClauses = words.map(() => `nome LIKE ?`).join(" AND ");
      alocSql += ` AND (${wordClauses})`;
      words.forEach((w) => alocParams.push(`%${w}%`));
    }
    alocSql += ` ORDER BY nome ASC LIMIT 25`;
    try {
      const [alocRows] = await pool.query<any[]>(alocSql, alocParams);
      rows = alocRows;
    } catch {}
  }

  return rows;
}

/**
 * Helper para calcular tempo na cooperativa
 */
function calcularTempoCooperativa(dtAdmissao?: string | null, dtDesligamento?: string | null) {
  if (!dtAdmissao) return { dias: 0, formatado: "Não informado" };

  try {
    const inicio = new Date(dtAdmissao);
    const fim = dtDesligamento ? new Date(dtDesligamento) : new Date();

    if (isNaN(inicio.getTime())) return { dias: 0, formatado: "Não informado" };

    const diffMs = Math.max(0, fim.getTime() - inicio.getTime());
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const anos = Math.floor(dias / 365.25);
    const meses = Math.floor((dias % 365.25) / 30.4375);
    const diasRest = Math.floor((dias % 365.25) % 30.4375);

    const partes = [];
    if (anos > 0) partes.push(`${anos} ${anos === 1 ? "ano" : "anos"}`);
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? "mês" : "meses"}`);
    if (diasRest > 0 || partes.length === 0) partes.push(`${diasRest} ${diasRest === 1 ? "dia" : "dias"}`);

    return {
      dias,
      formatado: `${dias.toLocaleString("pt-BR")} dias (${partes.join(", ")})`,
    };
  } catch {
    return { dias: 0, formatado: "Não informado" };
  }
}

/**
 * Formata CPF para o padrão 000.000.000-00
 */
export function formatCpf(val?: string | null): string {
  if (!val) return "000.000.000-00";
  const digits = String(val).replace(/\D/g, "");
  if (digits.length !== 11) return String(val);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// Tabela de reversão de caracteres CP1252 (0x80 - 0x9F) mapeados indevidamente em UTF-8
const cp1252ReverseMap: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e,
  0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Corrige mojibake decorrente de encoding duplo (UTF-8 interpretado como CP1252/Latin-1)
 * Preserva acentos, cedilhas e caracteres especiais originais em português
 */
export function fixMojibake(val: any): string {
  if (val === null || val === undefined) return "";
  let s = String(val).trim();
  if (!s) return "";

  // Iterar até 2 vezes se ainda houver caracteres típicos de mojibake (como Ã seguido de outro caractere, double dagger ‡ ou ƒ)
  for (let pass = 0; pass < 2; pass++) {
    if (/[ÃÂÁÉÍÓÚ]/i.test(s) || s.includes("‡") || s.includes("ƒ")) {
      try {
        const bytes: number[] = [];
        let isConvertible = true;
        for (let i = 0; i < s.length; i++) {
          const code = s.charCodeAt(i);
          if (cp1252ReverseMap[code] !== undefined) {
            bytes.push(cp1252ReverseMap[code]);
          } else if (code <= 0xff) {
            bytes.push(code);
          } else {
            isConvertible = false;
            break;
          }
        }
        if (isConvertible && bytes.length > 0) {
          const decoded = Buffer.from(bytes).toString("utf8");
          if (!decoded.includes("\ufffd") && decoded.length < s.length) {
            s = decoded;
            continue;
          }
        }
      } catch {}
    }
    break;
  }

  // Tratamento de substituições conhecidas residuais
  return s
    .replace(/SÃ\s*O/gi, "SÃO")
    .replace(/SÃfO/gi, "SÃO")
    .replace(/SÃƒO/gi, "SÃO")
    .replace(/SÃƑO/gi, "SÃO");
}

/**
 * Sanitiza texto removendo espaços extras e corrigindo mojibake, PRESERVANDO acentos e cedilhas
 */
export function sanitizeText(val: any): string {
  return fixMojibake(val).replace(/\s+/g, " ").trim();
}

/**
 * Converte para CAIXA ALTA preservando acentuação e cedilhas corretas (ex: "IPANGUAÇU", "EDUCAÇÃO")
 */
export function toUpperWithAccents(val: any): string {
  return sanitizeText(val).toUpperCase();
}

/**
 * Utilitário para normalização de texto sem acentos (quando explicitamente exigido por sistemas legados)
 */
export function toUpperNoAccents(str: any): string {
  if (str === null || str === undefined) return "";
  const s = fixMojibake(str);
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Retorna as informações oficiais da Categoria do Trabalhador no eSocial (Tabela 01)
 * Para cooperados vinculados à cooperativa de trabalho, o código governamental é 731.
 */
export function getEsocialCategoryInfo(code?: string | number | null) {
  let c = String(code || "").trim();
  if (!c || c === "734") {
    c = "731";
  }
  const descMap: Record<string, string> = {
    "731": "Contribuinte individual - Cooperado que presta serviços por intermédio de cooperativa de trabalho",
    "734": "Contribuinte individual - Transportador autônomo associado a cooperativa",
    "738": "Contribuinte individual - Cooperado filiado a cooperativa de produção",
    "721": "Contribuinte individual - Diretor não empregado, com FGTS",
    "722": "Contribuinte individual - Diretor não empregado, sem FGTS",
  };
  const descricao = descMap[c] || "Contribuinte individual - Cooperado que presta serviços por intermédio de cooperativa de trabalho";
  return {
    codigo: c,
    descricao,
    completo: `${c} - ${descricao}`,
  };
}

/**
 * Retorna o dossiê 360° completo do cooperado
 */
export async function getEasycoopCooperadoFull(cpf: string) {
  const numericCpf = cpf.replace(/\D/g, "");
  if (!numericCpf) throw new Error("CPF inválido.");

  // 1. Dados cadastrais consolidados no MySQL
  let [rows] = await pool.query<any[]>(
    "SELECT * FROM cooperados WHERE document = ? LIMIT 1",
    [numericCpf]
  );
  let base: any = null;
  if (rows.length === 0) {
    const [alocRows] = await pool.query<any[]>(
      `SELECT document, matricula AS registration_number, nome AS name, cargo AS position,
              tomador_nome AS contract_name,
              (CASE WHEN status_alocacao IN ('Ativo', 'S', 'A') THEN 'Ativo' ELSE 'Inativo' END) AS status,
              data_inicio AS admission_date,
              '450' AS bank_code, 'BANCO OWL' AS bank_name, '0001' AS agency,
              matricula AS account_number, '3' AS account_digit, 'Conta-Corrente' AS account_type,
              document AS pix_key
       FROM easycoop_alocacoes
       WHERE document = ?
       ORDER BY (CASE WHEN status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC, data_inicio DESC
       LIMIT 1`,
      [numericCpf]
    );
    if (alocRows.length === 0) {
      throw new Error("Cooperado não encontrado.");
    }
    base = alocRows[0];
  } else {
    base = rows[0];
  }

  // 2. Telefone com fallback automático para o WhatsApp caso vazio
  const telefoneConsolidado = base.secondary_phone || base.whatsapp_number || "-";

  // 3. Dependentes (easycoop_dependentes)
  const [dependentes] = await pool.query<any[]>(
    "SELECT nome, cpf, sexo, DATE_FORMAT(data_nascimento, '%Y-%m-%d') AS data_nascimento, deduz_irrf, tem_convenio FROM easycoop_dependentes WHERE document = ?",
    [numericCpf]
  );
  dependentes.forEach((d: any) => {
    d.nome = toUpperNoAccents(d.nome);
  });

  // 4. Histórico de Alocações em Contratos/Tomadores (easycoop_alocacoes + easycoop_contratos)
  const [alocacoes] = await pool.query<any[]>(
    `SELECT ea.cliente_id, ea.contrato_id, 
            COALESCE(NULLIF(ec.tomador_razao, ''), ea.tomador_nome) AS tomador_nome,
            ec.tomador_razao,
            ea.contrato_descricao, ea.contrato_numero,
            ea.cargo, ea.cbo, ea.valor_base, ea.horas, 
            DATE_FORMAT(ea.data_inicio, '%Y-%m-%d') AS data_inicio, 
            DATE_FORMAT(ea.data_fim, '%Y-%m-%d') AS data_fim, 
            CASE WHEN ea.status_alocacao IN ('Ativo', 'S', 'A') THEN 'Ativo' ELSE 'Inativo' END AS status_alocacao,
            CASE 
              WHEN UPPER(ea.contrato_descricao) LIKE '%DESCANSO%' OR UPPER(ea.contrato_descricao) LIKE '%DAR%' THEN 4
              WHEN UPPER(ea.contrato_descricao) LIKE '%SOBRA%' THEN 3
              WHEN UPPER(ea.contrato_descricao) LIKE '%COORDENA%' THEN 2
              ELSE 1
            END AS prioridade_tipo
     FROM easycoop_alocacoes ea
     LEFT JOIN easycoop_contratos ec ON ea.cliente_id = ec.cliente_id AND ea.contrato_id = ec.contrato_id
     WHERE ea.document = ? 
     ORDER BY 
       (CASE WHEN ea.status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC,
       prioridade_tipo ASC,
       ea.data_inicio DESC,
       ea.id DESC`,
    [numericCpf]
  );

  // 5. Garantir que descanso, sobras e coordenação não sobreponham cargos operacionais
  alocacoes.forEach((a: any) => {
    a.tomador_nome = toUpperWithAccents(a.tomador_nome);
    if (a.contrato_descricao && /SOBRA/i.test(a.contrato_descricao)) {
      a.contrato_descricao = "DISTRIBUIÇÃO DE SOBRAS";
    } else if (a.contrato_descricao) {
      a.contrato_descricao = toUpperWithAccents(a.contrato_descricao);
    }
    const isAuxiliar =
      a.contrato_descricao?.includes("DESCANSO") ||
      a.contrato_descricao?.includes("DAR") ||
      a.contrato_descricao?.includes("SOBRA");
    if (isAuxiliar) {
      a.cargo = null;
      a.cbo = null;
    } else if (a.cargo) {
      a.cargo = toUpperWithAccents(a.cargo);
    }
  });

  // 6. Contrato Atual: Sempre operacional ativo. SOBRAS, DESCANSO e COORDENAÇÃO nunca são principais se houver contrato operacional
  const contratoAtivo = alocacoes.find((a: any) => a.status_alocacao === "Ativo" && a.prioridade_tipo === 1)
    || alocacoes.find((a: any) => a.prioridade_tipo === 1)
    || alocacoes.find((a: any) => a.status_alocacao === "Ativo")
    || alocacoes[0]
    || null;

  // 7. Tempo de Cooperativa
  const tempoVida = calcularTempoCooperativa(base.admission_date, base.termination_date);

  // 8. Documentos / Assinaturas (easycoop_documentos)
  let documentos: any[] = [];
  try {
    const [docs] = await pool.query<any[]>(
      "SELECT tipo_documento, status, DATE_FORMAT(data_criacao, '%Y-%m-%d') AS data_criacao, data_assinatura, finalizado FROM easycoop_documentos WHERE document = ?",
      [numericCpf]
    );
    documentos = docs.map((d: any) => ({
      ...d,
      tipo_documento: toUpperNoAccents(d.tipo_documento),
      status: toUpperNoAccents(d.status),
    }));
  } catch {}

  // 9. Termos Oficiais do EasyCoop (Adesão e Desligamento)
  let termoAdesao: any = null;
  let termoDesligamento: any = null;

  try {
    const matr = base.registration_number ? String(base.registration_number) : "";
    const [adesaoRows] = await pool.query<any[]>(
      `SELECT id, file_id, file_name, cooperado_name, cpf, matricula, web_view_link, web_content_link, created_at
       FROM fichas_cadastrais
       WHERE (REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = ?
              OR (matricula IS NOT NULL AND matricula != '' AND matricula = ?))
       ORDER BY id DESC LIMIT 1`,
      [numericCpf, matr]
    );
    if (adesaoRows.length > 0) {
      termoAdesao = {
        ...adesaoRows[0],
        cooperado_name: toUpperNoAccents(adesaoRows[0].cooperado_name),
        tipo_documento: "FICHA DE ADESAO (EASY)",
        download_url: `/api/drive/download/${adesaoRows[0].file_id}`,
      };
    }

    const [desligRows] = await pool.query<any[]>(
      `SELECT id, file_id, file_name, cooperado_name, cpf, matricula, DATE_FORMAT(termination_date, '%Y-%m-%d') AS termination_date, contract_name, web_view_link, web_content_link, created_at
       FROM fichas_desligamento
       WHERE (REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = ?
              OR (matricula IS NOT NULL AND matricula != '' AND matricula = ?))
       ORDER BY id DESC LIMIT 1`,
      [numericCpf, matr]
    );
    if (desligRows.length > 0) {
      termoDesligamento = {
        ...desligRows[0],
        cooperado_name: toUpperNoAccents(desligRows[0].cooperado_name),
        contract_name: toUpperNoAccents(desligRows[0].contract_name),
        tipo_documento: "FICHA DE DESLIGAMENTO (EASY)",
        download_url: `/api/drive/desligamento/download/${desligRows[0].file_id}`,
      };
    }
  } catch (err: any) {
    console.warn("[EasyCoop] Aviso ao buscar termos easy:", err.message);
  }

  // 10. Quotas-Parte
  const quotasConcluidas = base.quotas_concluidas === "S" || (base.quotas_pagas && base.quotas_pagas >= 10);
  const quotasPagas = base.quotas_pagas || 0;
  const quotasValor = Number(base.quotas_valor || 0);

  const officialPosition = toUpperNoAccents(contratoAtivo?.cargo || base.position || "COOPERADO");

  let bankCode = base.bank_code;
  let bankName = base.bank_name;
  if (bankCode === "770" || bankCode === "450" || bankName?.includes("770") || bankName?.toUpperCase().includes("FITBANK") || bankName?.toUpperCase().includes("OWL")) {
    bankCode = "450";
    bankName = "BANCO OWL";
  }

  return {
    ...base,
    name: toUpperWithAccents(base.name),
    mother_name: toUpperWithAccents(base.mother_name),
    father_name: toUpperWithAccents(base.father_name),
    street: toUpperWithAccents(base.street),
    neighborhood: toUpperWithAccents(base.neighborhood),
    city: toUpperWithAccents(base.city),
    state: toUpperWithAccents(base.state),
    contract_name: toUpperWithAccents(contratoAtivo?.tomador_nome || base.contract_name),
    bank_code: bankCode,
    bank_name: toUpperWithAccents(bankName),
    gender: base.gender || "M",
    position: officialPosition,
    position_cadastral: toUpperWithAccents(base.position_cadastral || null),
    secondary_phone: telefoneConsolidado,
    tempo_cooperativa_dias: tempoVida.dias,
    tempo_cooperativa_formatado: sanitizeText(tempoVida.formatado),
    contrato_atual: contratoAtivo,
    cargo_contrato: officialPosition,
    categoria_esocial: getEsocialCategoryInfo(base.cod_cat_trab_esocial),
    quotas_info: {
      concluida: quotasConcluidas,
      pagas: quotasPagas,
      valor_total: quotasValor,
      texto: quotasConcluidas
        ? `${quotasPagas} DE 10 QUOTAS (INTEGRALIZADA - R$ ${quotasValor.toFixed(2)})`
        : `${quotasPagas} DE 10 QUOTAS (R$ ${quotasValor.toFixed(2)})`,
    },
    detalhes_erp: {
      RG: base.rg_number || null,
      ORGEMISSOR: toUpperWithAccents(base.rg_issuer || null),
      SEXO: base.gender || "M",
      PIS: base.pis_number || null,
      CTPS: base.ctps_number || null,
      TELREC: telefoneConsolidado,
    },
    dependentes,
    alocacoes,
    documentos,
    termos_easy: {
      adesao: termoAdesao,
      desligamento: termoDesligamento,
    },
    auditoria: [],
  };
}

/**
 * Histórico financeiro e repasses do cooperado com filtros de período e contrato
 */
export async function getEasycoopFinancialHistory(
  cpf: string,
  ano?: number,
  mes?: number,
  tomador?: string
) {
  const numericCpf = cpf.replace(/\D/g, "");
  if (!numericCpf) throw new Error("CPF inválido.");

  try {
    let whereClauses = "WHERE 1=1";
    const params: any[] = [numericCpf];

    if (ano && ano > 0) {
      whereClauses += " AND base.ano = ?";
      params.push(ano);
    }
    if (mes && mes > 0) {
      whereClauses += " AND base.mes = ?";
      params.push(mes);
    }
    if (tomador && tomador !== "TODOS") {
      whereClauses += ` AND (
        base.tomador = ? 
        OR UPPER(base.tomador) = UPPER(?)
        OR base.contrato_descricao = ? 
        OR UPPER(base.contrato_descricao) = UPPER(?)
        OR (
          UPPER(?) LIKE '%SOBRA%' AND (
            UPPER(base.contrato_descricao) LIKE '%SOBRA%'
            OR EXISTS (
              SELECT 1 FROM easycoop_lancamento_itens li 
              WHERE li.document = ? AND li.ano = base.ano AND li.mes = base.mes AND li.folha = base.folha 
                AND UPPER(li.descricao) LIKE '%SOBRA%'
            )
          )
        )
        OR (
          UPPER(?) LIKE '%DESCANSO%' AND (
            UPPER(base.contrato_descricao) LIKE '%DESCANSO%'
            OR EXISTS (
              SELECT 1 FROM easycoop_lancamento_itens li 
              WHERE li.document = ? AND li.ano = base.ano AND li.mes = base.mes AND li.folha = base.folha 
                AND (UPPER(li.descricao) LIKE '%DESCANSO%' OR UPPER(li.descricao) LIKE '%DAR%')
            )
          )
        )
      )`;
      params.push(
        tomador,
        tomador,
        tomador,
        tomador,
        tomador,
        numericCpf,
        tomador,
        numericCpf
      );
    }

    // 1. Fechamentos mensais com detecção precisa de contrato e rubricas analíticas
    const [fechamentos] = await pool.query<any[]>(
      `SELECT * FROM (
        SELECT f.id, f.ano, f.mes, f.folha, f.tomador,
               f.valor_bruto, f.valor_producao, f.outros_creditos, f.total_descontos,
               f.ajuda_custo, f.inss, f.irrf, f.taxa_adm, f.valor_liquido,
               DATE_FORMAT(f.data_pagamento, '%Y-%m-%d') AS data_pagamento,
               f.comprovante_doc,
               COALESCE(
                 -- 1. Rubrica analítica de SOBRAS
                 (SELECT 'DISTRIBUIÇÃO DE SOBRAS' 
                  FROM easycoop_lancamento_itens li 
                  WHERE li.document = f.document AND li.ano = f.ano AND li.mes = f.mes AND li.folha = f.folha 
                    AND UPPER(li.descricao) LIKE '%SOBRA%' 
                  LIMIT 1),
                 -- 2. Rubrica analítica de DESCANSO
                 (SELECT 'DESCANSO ANUAL REMUNERADO' 
                  FROM easycoop_lancamento_itens li 
                  WHERE li.document = f.document AND li.ano = f.ano AND li.mes = f.mes AND li.folha = f.folha 
                    AND (UPPER(li.descricao) LIKE '%DESCANSO%' OR UPPER(li.descricao) LIKE '%DAR%')
                  LIMIT 1),
                 -- 3. Alocação ativa no período do fechamento (priorizando contrato operacional base)
                 (SELECT a.contrato_descricao 
                  FROM easycoop_alocacoes a 
                  WHERE a.document = f.document 
                    AND (a.tomador_nome = f.tomador OR UPPER(a.tomador_nome) = UPPER(f.tomador) OR UPPER(f.tomador) LIKE '%COOPEDU%')
                    AND a.data_inicio <= LAST_DAY(CONCAT(f.ano, '-', LPAD(f.mes, 2, '0'), '-01'))
                    AND (a.data_fim IS NULL OR a.data_fim >= CONCAT(f.ano, '-', LPAD(f.mes, 2, '0'), '-01'))
                    AND UPPER(a.contrato_descricao) NOT LIKE '%DESCANSO%'
                    AND UPPER(a.contrato_descricao) NOT LIKE '%SOBRA%'
                  ORDER BY (CASE WHEN a.status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC, a.data_inicio DESC 
                  LIMIT 1),
                 -- 4. Alocação ativa no período (qualquer tipo)
                 (SELECT a.contrato_descricao 
                  FROM easycoop_alocacoes a 
                  WHERE a.document = f.document 
                    AND (a.tomador_nome = f.tomador OR UPPER(a.tomador_nome) = UPPER(f.tomador) OR UPPER(f.tomador) LIKE '%COOPEDU%')
                    AND a.data_inicio <= LAST_DAY(CONCAT(f.ano, '-', LPAD(f.mes, 2, '0'), '-01'))
                    AND (a.data_fim IS NULL OR a.data_fim >= CONCAT(f.ano, '-', LPAD(f.mes, 2, '0'), '-01'))
                  ORDER BY (CASE WHEN a.status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC, a.data_inicio DESC 
                  LIMIT 1),
                 -- 5. Alocação histórica mais recente daquele tomador
                 (SELECT a.contrato_descricao 
                  FROM easycoop_alocacoes a 
                  WHERE a.document = f.document 
                    AND (a.tomador_nome = f.tomador OR UPPER(a.tomador_nome) = UPPER(f.tomador))
                  ORDER BY (CASE WHEN a.status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC, a.data_inicio DESC 
                  LIMIT 1),
                 -- 6. Tabela de contratos
                 (SELECT c.contrato_descricao 
                  FROM easycoop_contratos c 
                  WHERE c.tomador_nome = f.tomador OR UPPER(c.tomador_nome) = UPPER(f.tomador) 
                  LIMIT 1),
                 f.tomador
               ) AS contrato_descricao
        FROM easycoop_fechamentos f
        WHERE f.document = ?
      ) AS base
      ${whereClauses}
      ORDER BY base.ano DESC, base.mes DESC, base.folha DESC`,
      params
    );

    // 2. Anos disponíveis com repasses para esse cooperado
    const [anosRows] = await pool.query<any[]>(
      "SELECT DISTINCT ano FROM easycoop_fechamentos WHERE document = ? ORDER BY ano DESC",
      [numericCpf]
    );

    // 3. Tomadores / Contratos distintos com repasses para esse cooperado
    const [tomadoresRows] = await pool.query<any[]>(
      `SELECT DISTINCT tomador FROM easycoop_fechamentos WHERE document = ? AND tomador IS NOT NULL AND tomador <> '' ORDER BY tomador ASC`,
      [numericCpf]
    );

    // 4. Lista consolidada de contratos reais do cooperado (para botões do filtro)
    const [contratosRows] = await pool.query<any[]>(
      `SELECT DISTINCT tomador AS nome
       FROM easycoop_fechamentos
       WHERE document = ? AND tomador IS NOT NULL AND tomador <> ''
       UNION
       SELECT DISTINCT contrato_descricao AS nome
       FROM easycoop_alocacoes
       WHERE document = ? AND status_alocacao IN ('Ativo', 'S', 'A') AND contrato_descricao IS NOT NULL AND contrato_descricao <> ''
       UNION
       SELECT DISTINCT COALESCE(
         (SELECT 'DISTRIBUIÇÃO DE SOBRAS' 
          FROM easycoop_lancamento_itens li 
          WHERE li.document = f.document AND li.ano = f.ano AND li.mes = f.mes AND li.folha = f.folha 
            AND UPPER(li.descricao) LIKE '%SOBRA%' 
          LIMIT 1),
         (SELECT 'DESCANSO ANUAL REMUNERADO' 
          FROM easycoop_lancamento_itens li 
          WHERE li.document = f.document AND li.ano = f.ano AND li.mes = f.mes AND li.folha = f.folha 
            AND (UPPER(li.descricao) LIKE '%DESCANSO%' OR UPPER(li.descricao) LIKE '%DAR%')
          LIMIT 1),
         (SELECT a.contrato_descricao 
          FROM easycoop_alocacoes a 
          WHERE a.document = f.document 
            AND (a.tomador_nome = f.tomador OR UPPER(a.tomador_nome) = UPPER(f.tomador) OR UPPER(f.tomador) LIKE '%COOPEDU%')
            AND a.data_inicio <= LAST_DAY(CONCAT(f.ano, '-', LPAD(f.mes, 2, '0'), '-01'))
            AND (a.data_fim IS NULL OR a.data_fim >= CONCAT(f.ano, '-', LPAD(f.mes, 2, '0'), '-01'))
            AND UPPER(a.contrato_descricao) NOT LIKE '%DESCANSO%'
            AND UPPER(a.contrato_descricao) NOT LIKE '%SOBRA%'
          ORDER BY (CASE WHEN a.status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC, a.data_inicio DESC 
          LIMIT 1),
         f.tomador
       ) AS nome
       FROM easycoop_fechamentos f
       WHERE f.document = ?
       ORDER BY nome ASC`,
      [numericCpf, numericCpf, numericCpf]
    );

    // Totais do período filtrado
    let totalBruto = 0;
    let totalLiquido = 0;
    let totalInss = 0;
    let totalIrrf = 0;
    let totalTaxaAdm = 0;

    for (const f of fechamentos) {
      f.tomador = toUpperWithAccents(f.tomador || "COOPEDU");
      f.contrato_descricao = toUpperWithAccents(f.contrato_descricao || f.tomador || "CONTRATO GERAL");
      totalBruto += Number(f.valor_bruto || 0);
      totalLiquido += Number(f.valor_liquido || 0);
      totalInss += Number(f.inss || 0);
      totalIrrf += Number(f.irrf || 0);
      totalTaxaAdm += Number(f.taxa_adm || 0);
    }

    return {
      fechamentos,
      anos: anosRows.map((a: any) => a.ano),
      tomadores: tomadoresRows.map((t: any) => toUpperWithAccents(t.tomador)).filter(Boolean),
      contratos: contratosRows.map((c: any) => toUpperWithAccents(c.nome)).filter(Boolean),
      totais: {
        totalBruto,
        totalLiquido,
        totalInss,
        totalIrrf,
        totalTaxaAdm,
        qtdRecibos: fechamentos.length,
      },
    };
  } catch (err: any) {
    console.warn(`[EasyCoop Financial Warning] Retornando fallback seguro para CPF ${numericCpf}:`, err.message);
    return {
      fechamentos: [],
      anos: [],
      tomadores: [],
      contratos: [],
      totais: {
        totalBruto: 0,
        totalLiquido: 0,
        totalInss: 0,
        totalIrrf: 0,
        totalTaxaAdm: 0,
        qtdRecibos: 0,
      },
    };
  }
}

/**
 * Detalhamento de rubricas analíticas (itens) de um fechamento mensal
 */
export async function getEasycoopLancamentoItens(cpf: string, ano: number, mes: number, folha: number) {
  const numericCpf = cpf.replace(/\D/g, "");

  // 1. Buscar itens detalhados gravados em easycoop_lancamento_itens
  const [itensRows] = await pool.query<any[]>(
    `SELECT cod_lancamento, descricao, tipo, valor
     FROM easycoop_lancamento_itens
     WHERE document = ? AND ano = ? AND mes = ? AND folha = ?
     ORDER BY tipo ASC, valor DESC`,
    [numericCpf, ano, mes, folha]
  );

  if (itensRows.length > 0) {
    return itensRows.map((it) => ({
      codigo: it.cod_lancamento,
      descricao: it.descricao,
      tipo: it.tipo === "D" ? "D" : "C",
      valor: Number(it.valor || 0),
    }));
  }

  // 2. Fallback caso não haja itens gravados em easycoop_lancamento_itens
  const [rows] = await pool.query<any[]>(
    "SELECT * FROM easycoop_fechamentos WHERE document = ? AND ano = ? AND mes = ? AND folha = ? LIMIT 1",
    [numericCpf, ano, mes, folha]
  );

  if (rows.length === 0) return [];
  const f = rows[0];

  const itens: any[] = [];
  if (Number(f.valor_producao || f.valor_bruto) > 0) {
    itens.push({
      descricao: "Produtividade / Produção Mensal",
      tipo: "C",
      valor: Number(f.valor_producao || f.valor_bruto),
    });
  }
  if (Number(f.outros_creditos) > 0) {
    itens.push({
      descricao: "Benefícios / Adicionais / Bônus",
      tipo: "C",
      valor: Number(f.outros_creditos),
    });
  }
  if (Number(f.ajuda_custo) > 0) {
    itens.push({
      descricao: "Ajuda de Custo Operacional",
      tipo: "C",
      valor: Number(f.ajuda_custo),
    });
  }
  if (Number(f.inss) > 0) {
    itens.push({
      descricao: "Retenção INSS Previdência Social",
      tipo: "D",
      valor: Number(f.inss),
    });
  }
  if (Number(f.irrf) > 0) {
    itens.push({
      descricao: "Retenção IRRF Imposto de Renda",
      tipo: "D",
      valor: Number(f.irrf),
    });
  }
  if (Number(f.taxa_adm) > 0) {
    itens.push({
      descricao: "Taxa de Administração Cooperativa",
      tipo: "D",
      valor: Number(f.taxa_adm),
    });
  }

  return itens;
}

/**
 * Consulta de Folha de Pagamento analítica para Demonstrativo de Produtividade
 */
export async function getEasycoopCooperadoFolha(
  cpf: string,
  ano?: number,
  mes?: number,
  folha: number = 1
) {
  const numericCpf = cpf.replace(/\D/g, "");
  if (!numericCpf) throw new Error("CPF inválido.");

  // Se ano e mês não informados, pegar o fechamento mais recente
  let query = `
    SELECT f.*, DATE_FORMAT(f.data_pagamento, '%Y-%m-%d') AS data_pagamento_fmt
    FROM easycoop_fechamentos f
    WHERE f.document = ?
  `;
  const params: any[] = [numericCpf];

  if (ano && ano > 0 && mes && mes > 0) {
    query += " AND f.ano = ? AND f.mes = ? AND f.folha = ?";
    params.push(ano, mes, folha);
  } else {
    query += " ORDER BY f.ano DESC, f.mes DESC, f.folha DESC LIMIT 1";
  }

  const [fechamentos] = await pool.query<any[]>(query, params);

  // Lista de todas as competências disponíveis para o seletor da folha
  const [rawCompetencias] = await pool.query<any[]>(
    `SELECT DISTINCT ano, mes, folha, tomador, valor_liquido
     FROM easycoop_fechamentos
     WHERE document = ?
     ORDER BY ano DESC, mes DESC, folha DESC`,
    [numericCpf]
  );
  const competencias = (rawCompetencias || []).map((cp) => ({
    ...cp,
    tomador: toUpperWithAccents(cp.tomador || "COOPEDU SEDE"),
  }));

  if (fechamentos.length === 0) {
    return {
      folha: null,
      competencias: competencias || [],
    };
  }

  const f = fechamentos[0];

  // Cooperado base para cabeçalho do contracheque
  const [coopRows] = await pool.query<any[]>(
    "SELECT * FROM cooperados WHERE document = ? LIMIT 1",
    [numericCpf]
  );
  const c = coopRows[0] || {};

  // 2. Buscar cargo oficial no contrato ativo do cooperado
  const [alocRows] = await pool.query<any[]>(
    `SELECT cargo, contrato_descricao
     FROM easycoop_alocacoes
     WHERE document = ?
       AND UPPER(contrato_descricao) NOT LIKE '%DESCANSO%'
       AND UPPER(contrato_descricao) NOT LIKE '%DAR%'
       AND UPPER(contrato_descricao) NOT LIKE '%SOBRA%'
     ORDER BY (CASE WHEN status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC,
              data_inicio DESC
     LIMIT 1`,
    [numericCpf]
  );
  const officialCargo = alocRows[0]?.cargo || c.position || "Cooperado";

  // 3. Dependentes de IRRF
  let totalDependentes = 0;
  try {
    const [depRows] = await pool.query<any[]>(
      "SELECT COUNT(*) AS cnt FROM easycoop_dependentes WHERE document = ? AND (deduz_irrf = 'S' OR deduz_irrf = '1' OR deduz_irrf IS NULL)",
      [numericCpf]
    );
    totalDependentes = Number(depRows[0]?.cnt || 0);
  } catch {}

  // 4. Proventos e Descontos estruturados a partir das rubricas oficiais (easycoop_lancamento_itens)
  const proventos: any[] = [];
  const descontos: any[] = [];
  const itens: any[] = [];

  const [rubricasRows] = await pool.query<any[]>(
    `SELECT cod_lancamento, descricao, tipo, valor
     FROM easycoop_lancamento_itens
     WHERE document = ? AND ano = ? AND mes = ? AND folha = ?
     ORDER BY tipo ASC, valor DESC`,
    [numericCpf, f.ano, f.mes, f.folha]
  );

  if (rubricasRows.length > 0) {
    for (const it of rubricasRows) {
      const rawCod = String(it.cod_lancamento || "").replace(/\.0$/, "").trim();
      const val = Number(it.valor || 0);
      const isDesconto = String(it.tipo || "").toUpperCase() === "D";
      const descr = toUpperWithAccents(it.descricao || (isDesconto ? "DESCONTO" : "PRODUCAO"));
      const cod = rawCod ? rawCod.padStart(4, "0") : (isDesconto ? "0200" : "0100");

      let ref = "1,00";
      if (cod === "0200" || descr.includes("INSS") || descr.includes("PREVIDENCIA")) {
        ref = "0,00";
      }

      const itemObj = {
        codigo: cod,
        descricao: descr,
        referencia: ref,
        tipo: isDesconto ? "D" : "C",
        valor: val,
        vencimento_atual: !isDesconto ? val : null,
        vencimento_acumulado: !isDesconto ? val : null,
        desconto_atual: isDesconto ? val : null,
        desconto_acumulado: isDesconto ? val : null,
      };

      if (!isDesconto) {
        proventos.push(itemObj);
      } else {
        descontos.push(itemObj);
      }
      itens.push(itemObj);
    }
  } else {
    // Fallback sintético caso não haja itens analíticos cadastrados
    const bruto = Number(f.valor_bruto || f.valor_producao || 0);
    const prodVal = Number(f.valor_producao || bruto);
    const outrosCred = Number(f.outros_creditos || 0);
    const ajuda = Number(f.ajuda_custo || 0);
    const inss = Number(f.inss || 0);
    const irrf = Number(f.irrf || 0);
    const taxaAdm = Number(f.taxa_adm || 0);

    if (prodVal > 0) {
      const item = {
        codigo: "0100",
        descricao: "PRODUTIVIDADE",
        referencia: "1,00",
        tipo: "C",
        valor: prodVal,
        vencimento_atual: prodVal,
        vencimento_acumulado: prodVal,
        desconto_atual: null,
        desconto_acumulado: null,
      };
      proventos.push(item);
      itens.push(item);
    }
    if (inss > 0) {
      const item = {
        codigo: "0200",
        descricao: "INSS",
        referencia: "0,00",
        tipo: "D",
        valor: inss,
        vencimento_atual: null,
        vencimento_acumulado: null,
        desconto_atual: inss,
        desconto_acumulado: inss,
      };
      descontos.push(item);
      itens.push(item);
    }
    if (taxaAdm > 0) {
      const item = {
        codigo: "0202",
        descricao: "QUOTAS PARTE - 010/010",
        referencia: "1,00",
        tipo: "D",
        valor: taxaAdm,
        vencimento_atual: null,
        vencimento_acumulado: null,
        desconto_atual: taxaAdm,
        desconto_acumulado: taxaAdm,
      };
      descontos.push(item);
      itens.push(item);
    }
    if (irrf > 0) {
      const item = {
        codigo: "0205",
        descricao: "IRRF - IMPOSTO DE RENDA RETIDO",
        referencia: "0,00",
        tipo: "D",
        valor: irrf,
        vencimento_atual: null,
        vencimento_acumulado: null,
        desconto_atual: irrf,
        desconto_acumulado: irrf,
      };
      descontos.push(item);
      itens.push(item);
    }
    if (outrosCred > 0 || ajuda > 0) {
      const item = {
        codigo: "0316",
        descricao: "PERCAPTA SAUDE SUPLEMENTAR VAR",
        referencia: "1,00",
        tipo: "C",
        valor: (outrosCred || ajuda),
        vencimento_atual: (outrosCred || ajuda),
        vencimento_acumulado: (outrosCred || ajuda),
        desconto_atual: null,
        desconto_acumulado: null,
      };
      proventos.push(item);
      itens.push(item);
    }
  }

  const totalProventos = proventos.reduce((acc, it) => acc + (it.valor || 0), 0);
  const totalDescontos = descontos.reduce((acc, it) => acc + (it.valor || 0), 0);
  const liquido = Number(f.valor_liquido || (totalProventos - totalDescontos));

  // Base Produtividade e Base INSS
  const produtividadeItem = proventos.find((p) => p.codigo === "0100" || p.codigo === "100" || p.descricao.includes("PRODUTIVIDADE"));
  const produtividadeVal = produtividadeItem ? produtividadeItem.valor : (totalProventos || Number(f.valor_producao || f.valor_bruto || 0));
  const baseInss = Number(f.inss ? produtividadeVal : (totalProventos || 0));
  const inssVal = descontos.find((d) => d.codigo === "0200" || d.codigo === "200" || d.descricao.includes("INSS"))?.valor || Number(f.inss || 0);
  const baseIrrf = Math.max(0, baseInss - inssVal);

  // Mapeamento de banco no estilo Imagem 2 (ex: "BB", "OWL", etc.)
  let bancoSigla = "BB";
  const bCode = String(c.bank_code || "").trim();
  const bName = String(c.bank_name || "").toUpperCase();
  if (bCode === "001" || bName.includes("BRASIL") || bName.includes("BB")) {
    bancoSigla = "BB";
  } else if (bCode === "104" || bName.includes("CAIXA") || bName.includes("CEF")) {
    bancoSigla = "CEF";
  } else if (bCode === "033" || bName.includes("SANTANDER")) {
    bancoSigla = "SANTANDER";
  } else if (bCode === "237" || bName.includes("BRADESCO")) {
    bancoSigla = "BRADESCO";
  } else if (bCode === "341" || bName.includes("ITAU")) {
    bancoSigla = "ITAU";
  } else if (bCode === "450" || bCode === "770" || bName.includes("OWL") || bName.includes("FITBANK")) {
    bancoSigla = "OWL";
  } else if (bCode === "260" || bName.includes("NUBANK")) {
    bancoSigla = "NUBANK";
  } else if (bCode === "756" || bName.includes("SICOOB")) {
    bancoSigla = "SICOOB";
  } else if (bCode === "748" || bName.includes("SICREDI")) {
    bancoSigla = "SICREDI";
  } else if (c.bank_name) {
    bancoSigla = toUpperNoAccents(c.bank_name).slice(0, 10);
  }

  const rawMatricula = c.registration_number || f.matricula || "";
  const matriculaFormatada = String(rawMatricula).replace(/\D/g, "").padStart(8, "0") || "00000000";

  return {
    folha: {
      id: f.id,
      ano: f.ano,
      mes: f.mes,
      folha: f.folha,
      competencia_str: `${String(f.mes).padStart(2, "0")}/${f.ano}`,
      competencia_rotulo: `${String(f.mes).padStart(2, "0")} / ${f.ano} - Folha : ${String(f.folha).padStart(2, "0")}`,
      tomador: toUpperWithAccents(f.tomador || c.contract_name || "COOPEDU SEDE"),
      data_pagamento: f.data_pagamento_fmt || "-",
      comprovante_doc: f.comprovante_doc || "-",
      cooperativa: {
        razao_social: "COOP TRAB PROF DA EDUCACAO DO ESTADO RIO G NORTE",
        cnpj: "35.537.126/0001-84",
        endereco: "RUA PROJETADA, N 1",
        cidade: "MONTE ALEGRE",
        uf: "RN",
        telefone: "(84) 98156-1479",
      },
      cooperado: {
        nome: toUpperWithAccents(c.name || "COOPERADO"),
        cpf: formatCpf(c.document),
        cpf_raw: c.document,
        matricula: matriculaFormatada,
        cargo: toUpperWithAccents(officialCargo),
        banco_sigla: bancoSigla,
        banco: (c.bank_code === "770" || c.bank_code === "450" || c.bank_name?.includes("770") || c.bank_name?.toUpperCase().includes("FITBANK") || c.bank_name?.toUpperCase().includes("OWL"))
          ? "450 - BANCO OWL"
          : (c.bank_name || "Banco não informado"),
        agencia: c.agency || "1140",
        agencia_digito: "",
        conta: c.account_number || "26725",
        conta_digito: c.account_digit || "2",
        pix: c.pix_key,
      },
      itens,
      proventos,
      descontos,
      totais: {
        totalVencimentos: totalProventos,
        totalDescontos: totalDescontos,
        totalProventos: totalProventos, // compatibilidade
        valorLiquido: liquido,
      },
      bases_calculo: {
        produtividade: Number(produtividadeVal || 0),
        baseInss: Number(baseInss || 0),
        baseIrrf: Number(baseIrrf || 0),
        nroDepIrrf: String(totalDependentes).padStart(2, "0"),
        valorIrrfDep: 0,
      },
    },
    competencias,
  };
}

/**
 * Consulta de Eventos eSocial do cooperado com filtros
 */
export async function getEasycoopCooperadoEsocial(
  cpf: string,
  ano?: number,
  mes?: number,
  evento?: string
) {
  const numericCpf = cpf.replace(/\D/g, "");
  if (!numericCpf) throw new Error("CPF inválido.");

  try {
    let whereClauses = "WHERE document = ?";
    const params: any[] = [numericCpf];

    if (ano && ano > 0) {
      whereClauses += " AND ano = ?";
      params.push(ano);
    }
    if (mes && mes > 0) {
      whereClauses += " AND mes = ?";
      params.push(mes);
    }
    if (evento && evento !== "TODOS") {
      whereClauses += " AND evento = ?";
      params.push(evento);
    }

    // Lista de eventos filtrados
    const [eventos] = await pool.query<any[]>(
      `SELECT id, evento, 
              DATE_FORMAT(data_envio, '%Y-%m-%d') AS data_envio,
              hora_envio, ano, mes, enviado, nro_protocolo, nro_recibo, status, erro_envio
       FROM easycoop_esocial
       ${whereClauses}
       ORDER BY ano DESC, mes DESC, id DESC`,
      params
    );

    // Métricas gerais de eSocial desse cooperado
    const [statsRows] = await pool.query<any[]>(
      `SELECT 
          COUNT(*) AS total_transmissoes,
          SUM(CASE WHEN status LIKE '%Recibo%' THEN 1 ELSE 0 END) AS total_aceitos,
          SUM(CASE WHEN status LIKE '%Erro%' OR status LIKE '%Rejeitado%' THEN 1 ELSE 0 END) AS total_erros,
          SUM(CASE WHEN status = 'Enviado' OR status = 'Pendente' THEN 1 ELSE 0 END) AS total_pendentes
       FROM easycoop_esocial
       WHERE document = ?`,
      [numericCpf]
    );

    // Tipos de eventos distintos
    const [tiposRows] = await pool.query<any[]>(
      "SELECT DISTINCT evento FROM easycoop_esocial WHERE document = ? ORDER BY evento ASC",
      [numericCpf]
    );

    // Anos disponíveis
    const [anosRows] = await pool.query<any[]>(
      "SELECT DISTINCT ano FROM easycoop_esocial WHERE document = ? ORDER BY ano DESC",
      [numericCpf]
    );

    const stats = statsRows[0] || {};

    // Categoria do cooperado no eSocial (Padrão 731)
    let catEsocialCode = "731";
    try {
      const [coopRows] = await pool.query<any[]>(
        "SELECT cod_cat_trab_esocial FROM cooperados WHERE document = ? LIMIT 1",
        [numericCpf]
      );
      if (coopRows.length > 0 && coopRows[0].cod_cat_trab_esocial) {
        catEsocialCode = coopRows[0].cod_cat_trab_esocial;
      }
    } catch {}

    const catEsocial = getEsocialCategoryInfo(catEsocialCode);

    return {
      eventos,
      categoria: catEsocial,
      metricas: {
        totalTransmissoes: Number(stats.total_transmissoes || 0),
        totalAceitos: Number(stats.total_aceitos || 0),
        totalErros: Number(stats.total_erros || 0),
        totalPendentes: Number(stats.total_pendentes || 0),
        ultimoProtocolo: eventos[0]?.nro_protocolo || "-",
      },
      tiposEventos: tiposRows.map((t: any) => t.evento),
      anos: anosRows.map((a: any) => a.ano),
    };
  } catch (err: any) {
    console.warn(`[EasyCoop eSocial Warning] Retornando fallback seguro para CPF ${numericCpf}:`, err.message);
    return {
      eventos: [],
      categoria: getEsocialCategoryInfo("731"),
      metricas: {
        totalTransmissoes: 0,
        totalAceitos: 0,
        totalErros: 0,
        totalPendentes: 0,
        ultimoProtocolo: "-",
      },
      tiposEventos: [],
      anos: [],
    };
  }
}

/**
 * Lista contratos com paginação e busca por nome/tomador/número
 */
export async function listEasycoopContratos(search: string = "", page: number = 1, pageSize: number = 20) {
  const cleanSearch = search.trim();
  const offset = (page - 1) * pageSize;

  let whereClause = "WHERE 1=1";
  const params: any[] = [];

  if (cleanSearch) {
    whereClause += ` AND (
      contrato_descricao LIKE ?
      OR tomador_nome LIKE ?
      OR numero_doc LIKE ?
      OR cidade LIKE ?
    )`;
    const wildcard = `%${cleanSearch}%`;
    params.push(wildcard, wildcard, wildcard, wildcard);
  }

  const [countRows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS total FROM easycoop_contratos ${whereClause}`,
    params
  );
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const [contratos] = await pool.query<any[]>(
    `SELECT cliente_id, contrato_id, numero_doc, tomador_nome, contrato_descricao,
            cidade, uf, 
            DATE_FORMAT(data_inicio, '%Y-%m-%d') AS data_inicio, 
            DATE_FORMAT(data_fim, '%Y-%m-%d') AS data_fim, 
            status, perc_taxa_adm, total_cooperados, cooperados_ativos
     FROM easycoop_contratos
     ${whereClause}
     ORDER BY total_cooperados DESC, data_inicio DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    contratos,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Detalhes de um contrato específico
 */
export async function getEasycoopContratoDetails(clienteId: number, contratoId: number) {
  const [rows] = await pool.query<any[]>(
    `SELECT cliente_id, contrato_id, numero_doc, tomador_nome, tomador_razao, tomador_cnpj,
            contrato_descricao, endereco, bairro, cidade, uf, cep, telefone, contato_responsavel,
            DATE_FORMAT(data_inicio, '%Y-%m-%d') AS data_inicio, 
            DATE_FORMAT(data_fim, '%Y-%m-%d') AS data_fim, 
            status, perc_taxa_adm, valor_taxa_adm, dia_pagamento, centro_custo,
            total_cooperados, cooperados_ativos
     FROM easycoop_contratos
     WHERE cliente_id = ? AND contrato_id = ?
     LIMIT 1`,
    [clienteId, contratoId]
  );

  if (rows.length === 0) throw new Error("Contrato não encontrado.");
  return rows[0];
}

/**
 * Lista paginada dos cooperados alocados no contrato
 */
export async function getEasycoopContratoCooperados(
  clienteId: number,
  contratoId: number,
  page: number = 1,
  pageSize: number = 20,
  search: string = ""
) {
  const cleanSearch = search.trim();
  const offset = (page - 1) * pageSize;

  let whereClause = "WHERE cliente_id = ? AND contrato_id = ?";
  const params: any[] = [clienteId, contratoId];

  if (cleanSearch) {
    const numCpf = cleanSearch.replace(/\D/g, "");
    if (numCpf.length >= 3) {
      whereClause += " AND (nome LIKE ? OR document LIKE ? OR matricula LIKE ?)";
      params.push(`%${cleanSearch}%`, `%${numCpf}%`, `%${cleanSearch}%`);
    } else {
      whereClause += " AND (nome LIKE ? OR matricula LIKE ?)";
      params.push(`%${cleanSearch}%`, `%${cleanSearch}%`);
    }
  }

  const [countRows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS total FROM easycoop_alocacoes ${whereClause}`,
    params
  );
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const [cooperados] = await pool.query<any[]>(
    `SELECT matricula, nome, document AS cpf, cargo, cbo, valor_base, horas,
            DATE_FORMAT(data_inicio, '%Y-%m-%d') AS data_inicio, 
            DATE_FORMAT(data_fim, '%Y-%m-%d') AS data_fim, 
            status_alocacao
     FROM easycoop_alocacoes
     ${whereClause}
     ORDER BY status_alocacao ASC, nome ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    cooperados,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Retorna as folhas analíticas de um período (para exportação em lote de demonstrativos em PDF)
 */
export async function getEasycoopFolhasPeriodo(
  cpf: string, 
  ano?: number, 
  mes?: number, 
  competencias?: { ano: number; mes: number; folha?: number }[]
) {
  const numericCpf = cpf.replace(/\D/g, "");
  if (!numericCpf) return [];

  let rows: any[] = [];
  if (Array.isArray(competencias) && competencias.length > 0) {
    rows = competencias.map((c) => ({
      ano: Number(c.ano),
      mes: Number(c.mes),
      folha: Number(c.folha || 1),
    }));
  } else {
    let query = "SELECT ano, mes, folha FROM easycoop_fechamentos WHERE document = ?";
    const params: any[] = [numericCpf];
    if (ano && ano > 0) {
      query += " AND ano = ?";
      params.push(ano);
    }
    if (mes && mes > 0) {
      query += " AND mes = ?";
      params.push(mes);
    }
    query += " ORDER BY ano DESC, mes DESC, folha DESC LIMIT 36";
    const [dbRows] = await pool.query<any[]>(query, params);
    rows = dbRows;
  }

  const folhasList: any[] = [];
  for (const r of rows) {
    const folhaData = await getEasycoopCooperadoFolha(numericCpf, r.ano, r.mes, r.folha || 1);
    if (folhaData && folhaData.folha) {
      folhasList.push(folhaData.folha);
    }
  }
  return folhasList;
}

