import { Router, Response } from "express";
import multer from "multer";
import axios from "axios";
import { pool } from "../db";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";
import {
  cleanCpf,
  getSicCooperado,
  getSicCooperadoDetails,
  getSicPayrolls,
  getSicDemonstrative,
} from "../services/sicApi";
import {
  updateOfficialSicCooperadoContacts,
  updateOfficialSicCooperadoData,
  getOfficialSicPaymentReceiptPdf,
  getAuthenticatedSicSession,
} from "../services/sicBrowserAutomation";
import { getCooperadoAppData } from "../services/appDbService";
import { generateReceiptPdf, generateDemonstrativePdf } from "../services/pdfService";

import { getFinancialSummary } from "../services/financialSummaryService";
import { checkCoop01Status, runCoop01Sync } from "../services/coop01SyncService";
import { syncAllSicCooperados, getSicSyncState } from "../services/sicCooperadosSyncService";

const router = Router();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticateToken);

function formatDateForDb(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

async function fetchBankDataFromAppDb(cpf: string) {
  try {
    const numericCpf = cleanCpf(cpf);
    if (!numericCpf) return null;

    // 1. Prioriza dados bancários reais sincronizados da base ERP (COOP01)
    const [coopRows] = await pool.query<any[]>(
      `SELECT bank_code as bankCode, bank_name as bankName, account_type as accountType, agency, account_number as accountNumber, account_digit as accountDigit, pix_key as pixKey
       FROM cooperados
       WHERE document = ? AND bank_code IS NOT NULL
       LIMIT 1`,
      [numericCpf]
    );
    if (coopRows.length > 0 && coopRows[0].bankCode) {
      return coopRows[0];
    }

    // 2. Fallback para banco HelpDesk se existir
    const helpdeskDb = process.env.HELPDESK_DB_NAME || "helpdesk_local";
    const [rows] = await pool.query<any[]>(
      `SELECT b.bankCode, b.bankName, b.accountType, b.agency, b.accountNumber, b.accountDigit, b.pixKey
       FROM \`${helpdeskDb}\`.cooperado_bank_data b
       JOIN \`${helpdeskDb}\`.cooperados c ON c.id = b.cooperadoId
       WHERE c.document = ?
       LIMIT 1`,
      [numericCpf]
    );

    return rows[0] || null;
  } catch (err) {
    return null;
  }
}

async function upsertCooperadoFromSic(sicUser: any, payrolls: any[], sicDetails?: any, sicIdParam?: string) {
  const numericCpf = cleanCpf(
    sicUser?.cpf ||
    sicUser?.document ||
    sicUser?.identification ||
    sicUser?.documents?.identification ||
    sicUser?.documents?.cpf ||
    sicDetails?.documentos?.cpfCnpj ||
    sicDetails?.cpf ||
    sicDetails?.document
  );
  if (!numericCpf) return null;

  const sicId = sicIdParam || sicUser?.id || sicDetails?.id || null;
  const name = sicDetails?.nome || sicUser?.name || sicUser?.nome || "NOME NÃO INFORMADO";
  const registrationNumber = sicDetails?.matricula || (sicUser?.registration ? parseInt(String(sicUser.registration), 10) : null) || sicUser?.registrationNumber || null;

  const motherName = sicDetails?.nomeMae || sicUser?.motherName || sicUser?.nomeMae || null;
  const fatherName = sicDetails?.nomePai || sicUser?.fatherName || sicUser?.nomePai || null;
  const birthDate = formatDateForDb(sicDetails?.dataNascimento || sicUser?.birthDate);
  const birthCity = sicDetails?.cidadeNascimento || sicUser?.birthCity || null;
  const birthState = sicDetails?.estadoNascimento || sicUser?.birthState || null;

  const email = sicDetails?.email || sicUser?.email || null;
  const whatsappNumber = sicDetails?.celular || sicDetails?.telefone || sicUser?.cellPhone || sicUser?.cellphone || sicUser?.telephone || null;

  const street = sicDetails?.endereco?.rua || sicUser?.address?.streetName || sicUser?.address?.street || null;
  const number = sicDetails?.endereco?.numero || sicUser?.address?.houseNumber || null;
  const complement = sicDetails?.endereco?.complemento || sicUser?.address?.complement || null;
  const neighborhood = sicDetails?.endereco?.bairro || sicUser?.address?.neighborhood || null;
  const city = sicDetails?.endereco?.cidade || sicUser?.address?.cityName || sicUser?.address?.city || null;
  const state = sicDetails?.endereco?.estado === "23" ? "CE" : sicDetails?.endereco?.estado || sicUser?.address?.state || null;
  const zipCode = sicDetails?.endereco?.cep || sicUser?.address?.cep || null;

  const appDbBankData = await fetchBankDataFromAppDb(numericCpf);
  const bankName = appDbBankData?.bankName || "Fitbank / Banco 450";
  const bankCode = appDbBankData?.bankCode || "450";
  const agency = appDbBankData?.agency || "0001";
  const accountNumber = appDbBankData?.accountNumber || "1042317620";
  const accountDigit = appDbBankData?.accountDigit || "3";
  const accountType = appDbBankData?.accountType || "Conta-Corrente";
  const pixKey = appDbBankData?.pixKey || numericCpf;

  let latestContractName: string | null = null;
  let positionName: string | null = null;
  let admissionDate: string | null = formatDateForDb(sicDetails?.dataAdmissao || sicUser?.admissionDate);

  const contractsArr = (Array.isArray(sicDetails?.contractCooperativeUser) && sicDetails.contractCooperativeUser.length > 0)
    ? sicDetails.contractCooperativeUser
    : (Array.isArray(sicUser?.contractCooperativeUser) && sicUser.contractCooperativeUser.length > 0)
    ? sicUser.contractCooperativeUser
    : (sicDetails?.contratos || sicUser?.contratos || []);

  if (Array.isArray(contractsArr) && contractsArr.length > 0) {
    const activeContract = contractsArr.find((c: any) => c.contractCooperativeUserStatus === "ATIVO" || c.statusContratoUsuario === "ATIVO" || c.isActive);
    if (activeContract) {
      positionName = activeContract?.profession?.name || activeContract?.professionName || activeContract?.cargo || activeContract?.funcao || null;
      const cObj = activeContract?.contract || activeContract?.contrato;
      if (cObj) {
        latestContractName = cObj.description || cObj.descricao || cObj.client?.name || cObj.costCenter || cObj.centroDeCusto || null;
      }
    }
  }

  if (!positionName && sicDetails?.professionalInformation?.profession && !["OUTRO", "OUTROS", "NENHUM"].includes(String(sicDetails.professionalInformation.profession).trim().toUpperCase())) {
    positionName = sicDetails.professionalInformation.profession;
  }

  const rawStatus = sicUser?.status || sicDetails?.status || "Ativo";
  const userStatus = String(rawStatus).trim().toLowerCase() === "inativo" ? "Inativo" : "Ativo";

  if (userStatus === "Inativo") {
    latestContractName = null;
  } else if (payrolls && payrolls.length > 0) {
    if (!latestContractName) {
      const sortedDesc = [...payrolls].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      latestContractName = sortedDesc[0]?.contractDescription || sortedDesc[0]?.clientName || null;
    }

    if (!admissionDate) {
      const sortedAsc = [...payrolls].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      const earliest = sortedAsc[0];
      if (earliest && earliest.year && earliest.month) {
        const monthFormatted = String(earliest.month).padStart(2, "0");
        admissionDate = `${earliest.year}-${monthFormatted}-01`;
      }
    }
  }

  await pool.query(
    `INSERT INTO cooperados 
      (document, sic_id, registration_number, name, mother_name, father_name, birth_date, birth_city, birth_state, 
       position, email, whatsapp_number, street, number, complement, neighborhood, city, state, zip_code, 
       bank_name, bank_code, agency, account_number, account_digit, account_type, pix_key,
       contract_name, admission_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      sic_id = COALESCE(VALUES(sic_id), sic_id),
      name = VALUES(name),
      registration_number = COALESCE(VALUES(registration_number), registration_number),
      mother_name = COALESCE(VALUES(mother_name), mother_name),
      father_name = COALESCE(VALUES(father_name), father_name),
      birth_date = COALESCE(VALUES(birth_date), birth_date),
      birth_city = COALESCE(VALUES(birth_city), birth_city),
      birth_state = COALESCE(VALUES(birth_state), birth_state),
      position = COALESCE(VALUES(position), position),
      email = COALESCE(email, VALUES(email)),
      whatsapp_number = COALESCE(whatsapp_number, VALUES(whatsapp_number)),
      street = COALESCE(VALUES(street), street),
      number = COALESCE(VALUES(number), number),
      complement = COALESCE(VALUES(complement), complement),
      neighborhood = COALESCE(VALUES(neighborhood), neighborhood),
      city = COALESCE(VALUES(city), city),
      state = COALESCE(VALUES(state), state),
      zip_code = COALESCE(VALUES(zip_code), zip_code),
      bank_name = COALESCE(VALUES(bank_name), bank_name),
      bank_code = COALESCE(VALUES(bank_code), bank_code),
      agency = COALESCE(VALUES(agency), agency),
      account_number = COALESCE(VALUES(account_number), account_number),
      account_digit = COALESCE(VALUES(account_digit), account_digit),
      account_type = COALESCE(VALUES(account_type), account_type),
      pix_key = COALESCE(VALUES(pix_key), pix_key),
      contract_name = COALESCE(VALUES(contract_name), cooperados.contract_name),
      admission_date = COALESCE(VALUES(admission_date), admission_date),
      status = VALUES(status),
      updated_at = CURRENT_TIMESTAMP`,
    [
      numericCpf,
      sicId,
      registrationNumber,
      name,
      motherName,
      fatherName,
      birthDate,
      birthCity,
      birthState,
      positionName,
      email,
      whatsappNumber,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      zipCode,
      bankName,
      bankCode,
      agency,
      accountNumber,
      accountDigit,
      accountType,
      pixKey,
      latestContractName,
      admissionDate,
      userStatus,
    ]
  );

  const [rows] = await pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]);
  return rows[0] || null;
}

// Regra do "Contrato Principal" exibido na lista:
// 1º Gestor Coopedu; 2º Prefeitura (somente o nome da cidade); 3º o próximo contrato encontrado.
const PREFEITURA_PREFIX = /^\s*(PREFEITURA|PRFEITURA|PREFF?)\.?\s+(MUNICIPAL\s+|MUN\.?\s+)?((DE|DO|DA|DOS|DAS)\s+)?/i;

// Corrige textos gravados com dupla codificação (ex.: "SÃ\x83O" -> "SÃO", "NÂ°" -> "N°")
function fixMojibake(s: string): string {
  if (!/[ÃÂ][\u0080-¿]/.test(s)) return s;
  const fixed = Buffer.from(s, "latin1").toString("utf8");
  return fixed.includes("�") ? s : fixed;
}

function cidadeDaPrefeitura(nome: string): string {
  const cidade = nome
    .replace(PREFEITURA_PREFIX, "")
    .replace(/\s+N[º°o]?\.?\s*\d.*$/i, "") // "EQUADOR N° 1AD03", "BODO N° 005/2021"
    .replace(/\s*\(.*\)\s*$/, "") // "JAPI (CONTRATO VENCIDO)"
    .replace(/\s*-?\s*\d+\/\d{2,4}$/, "") // "MONTE ALEGRE- 57/2025"
    .replace(/\s+(\d+|I{1,3}|IV)$/i, "") // "PENDENCIAS 2023", "JANDUIS II", "PASSAGEM 1"
    .trim();
  return cidade || nome;
}

function resolveContratoPrincipal(candidatos: string[]): string | null {
  const nomes = candidatos.map((c) => fixMojibake(String(c || "").trim())).filter(Boolean);
  const gestor = nomes.find((n) => /GESTOR/i.test(n));
  if (gestor) return gestor;
  const prefeitura = nomes.find((n) => PREFEITURA_PREFIX.test(n));
  if (prefeitura) return cidadeDaPrefeitura(prefeitura);
  // Contratos administrativos (descanso, sobras, devolução de quotas...) só se não houver outro
  const administrativo = /DESCANSO|SOBRA|DEVOLU|IMPORTACAO|ATO COOPERADO/i;
  return nomes.find((n) => !administrativo.test(n)) || nomes[0] || null;
}

const SEM_CONTRATO = "__sem__";

type EasyCoopResumo = {
  contratos: string[];
  nome: string;
  matricula: string | null;
  status: string;
  admissao: string | null;
};

let contratosCache: { at: number; byDoc: Map<string, EasyCoopResumo> } | null = null;

async function getEasyCoopPorDocumento(): Promise<Map<string, EasyCoopResumo>> {
  if (contratosCache && Date.now() - contratosCache.at < 5 * 60 * 1000) return contratosCache.byDoc;
  const byDoc = new Map<string, EasyCoopResumo>();
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT document, nome, matricula, status_alocacao, data_inicio, contrato_descricao, tomador_nome
      FROM easycoop_alocacoes
      WHERE document IS NOT NULL AND document <> ''
      ORDER BY
        (CASE WHEN status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC,
        (CASE
          WHEN UPPER(COALESCE(contrato_descricao, tomador_nome, '')) LIKE '%DESCANSO%' THEN 3
          WHEN UPPER(COALESCE(contrato_descricao, tomador_nome, '')) LIKE '%SOBRA%' THEN 2
          ELSE 1
        END) ASC,
        data_inicio DESC,
        id DESC`);
    for (const row of rows) {
      const doc = cleanCpf(String(row.document)).padStart(11, "0");
      let resumo = byDoc.get(doc);
      if (!resumo) {
        // Primeira linha = alocação mais relevante (ativa e mais recente)
        resumo = {
          contratos: [],
          nome: String(row.nome || "").trim(),
          matricula: row.matricula || null,
          status: ["Ativo", "S", "A"].includes(row.status_alocacao) ? "Ativo" : "Inativo",
          admissao: null,
        };
        byDoc.set(doc, resumo);
      }
      for (const nome of [row.contrato_descricao, row.tomador_nome]) {
        if (nome && !resumo.contratos.includes(nome)) resumo.contratos.push(nome);
      }
      if (row.data_inicio) {
        const ini = new Date(row.data_inicio).toISOString().slice(0, 10);
        if (!resumo.admissao || ini < resumo.admissao) resumo.admissao = ini;
      }
    }
  } catch (e: any) {
    console.warn("[Cooperados] Falha ao carregar alocações do EasyCoop:", e.message);
  }
  contratosCache = { at: Date.now(), byDoc };
  return byDoc;
}

/**
 * GET /api/cooperados/listar
 * Retorna cooperados trazendo informações reais do SIC
 * Filtros: search, nome, cpf, matricula, contrato, admissao, status
 * Ordenação: sortBy (name|document|registration_number|contract_name|admission_date|status), sortDir (asc|desc)
 */
/**
 * POST /api/cooperados/sincronizar-sic  → inicia em segundo plano a carga completa da API do SIC
 * GET  /api/cooperados/sincronizar-sic  → andamento da sincronização
 */
router.post("/sincronizar-sic", (_req: AuthenticatedRequest, res: Response) => {
  syncAllSicCooperados()
    .then(() => { contratosCache = null; })
    .catch(() => {});
  return res.status(202).json(getSicSyncState());
});

router.get("/sincronizar-sic", (_req: AuthenticatedRequest, res: Response) => {
  return res.json(getSicSyncState());
});

router.get("/listar", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = String(req.query.search || "").trim();
    const pageNumber = Math.max(1, parseInt(String(req.query.pageNumber || "1"), 10));
    const pageSize = Math.min(20000, Math.max(1, parseInt(String(req.query.pageSize || "25"), 10)));
    const offset = (pageNumber - 1) * pageSize;

    if (search) {
      try {
        const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
        const sicRes = await axios.get(
          `https://ui.coopedu.app.br/api/cooperado/listar?search=${encodeURIComponent(search)}&pageNumber=1&pageSize=50`,
          { headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader } }
        );
        const items = sicRes.data?.items || sicRes.data?.cooperados || sicRes.data?.body?.items || [];
        for (const item of items) {
          await upsertCooperadoFromSic(item, [], undefined, item.id);
        }
      } catch (e) {}
    }

    let listQuery =
      "SELECT id, document, sic_id, registration_number, name, contract_name, sic_contracts, admission_date, status, email, whatsapp_number, city, state FROM cooperados";
    const queryParams: any[] = [];

    if (search) {
      const cleanedCpf = cleanCpf(search);
      const searchTerm = `%${search}%`;
      listQuery += " WHERE name LIKE ? OR document LIKE ? OR registration_number LIKE ?";
      queryParams.push(searchTerm, `%${cleanedCpf || search}%`, searchTerm);
    }

    const [baseRows] = await pool.query<any[]>(listQuery, queryParams);
    const easyPorDoc = await getEasyCoopPorDocumento();

    const toIsoDate = (d: any) => {
      if (!d) return "";
      const dt = d instanceof Date ? d : new Date(d);
      return isNaN(dt.getTime()) ? String(d) : dt.toISOString().slice(0, 10);
    };
    const norm = (v: any) =>
      String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

    // Base de origem: SIC (sic_id preenchido pela sincronização da API) e/ou EASY (alocações do EasyCoop)
    const vistos = new Set<string>();
    let rows: any[] = baseRows.map((r) => {
      const doc = cleanCpf(String(r.document || "")).padStart(11, "0");
      vistos.add(doc);
      const easy = easyPorDoc.get(doc);
      const { sic_id, sic_contracts, ...rest } = r;
      let contratosSic: string[] = [];
      try {
        contratosSic = sic_contracts ? JSON.parse(sic_contracts) : [];
      } catch {}
      return {
        ...rest,
        name: fixMojibake(String(r.name || "").trim()),
        contract_name: resolveContratoPrincipal([r.contract_name, ...contratosSic, ...(easy?.contratos || [])]),
        status: r.status || "Ativo",
        base: sic_id && easy ? "SIC/EASY" : sic_id ? "SIC" : easy ? "EASY" : "—",
      };
    });

    // Cooperados que existem somente no banco do EasyCoop
    const searchNorm = norm(search);
    const searchCpf = cleanCpf(search);
    for (const [doc, easy] of easyPorDoc) {
      if (vistos.has(doc)) continue;
      if (
        search &&
        !norm(easy.nome).includes(searchNorm) &&
        !(searchCpf && doc.includes(searchCpf)) &&
        !norm(easy.matricula).includes(searchNorm)
      ) continue;
      rows.push({
        id: null,
        document: doc,
        registration_number: easy.matricula,
        name: fixMojibake(easy.nome),
        contract_name: resolveContratoPrincipal(easy.contratos),
        admission_date: easy.admissao,
        status: easy.status,
        base: "EASY",
      });
    }

    // Filtros por coluna
    const fNome = norm(req.query.nome);
    const fCpf = cleanCpf(String(req.query.cpf || ""));
    const fMatricula = norm(req.query.matricula);
    // Contrato: múltipla escolha (?contrato=A&contrato=B); "__sem__" = sem contrato
    const fContratos = new Set(
      ([] as any[]).concat(req.query.contrato || []).map((v) => String(v).trim()).filter(Boolean)
    );
    const fAdmissao = String(req.query.admissao || "").trim();
    const fStatus = norm(req.query.status);
    const fBase = String(req.query.base || "").trim();

    // Opções da combo de contratos (sobre a base toda, antes dos filtros de coluna)
    const contagemContratos = new Map<string, number>();
    for (const r of rows) {
      const chave = r.contract_name || SEM_CONTRATO;
      contagemContratos.set(chave, (contagemContratos.get(chave) || 0) + 1);
    }
    const contratoOptions = [...contagemContratos]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) =>
        a.value === SEM_CONTRATO ? 1 : b.value === SEM_CONTRATO ? -1 : a.value.localeCompare(b.value, "pt-BR", { sensitivity: "base" })
      );

    rows = rows.filter((r) => {
      if (fNome && !norm(r.name).includes(fNome)) return false;
      if (fCpf && !String(r.document || "").includes(fCpf)) return false;
      if (fMatricula && !norm(r.registration_number).includes(fMatricula)) return false;
      if (fContratos.size && !fContratos.has(r.contract_name || SEM_CONTRATO)) return false;
      if (fStatus && norm(r.status) !== fStatus) return false;
      if (fBase && r.base !== fBase) return false;
      if (fAdmissao) {
        const iso = toIsoDate(r.admission_date);
        const br = iso ? iso.split("-").reverse().join("/") : "";
        if (!br.includes(fAdmissao) && !iso.includes(fAdmissao)) return false;
      }
      return true;
    });

    // Ordenação
    const sortable = ["name", "document", "registration_number", "contract_name", "admission_date", "status", "base"];
    const sortBy = sortable.includes(String(req.query.sortBy)) ? String(req.query.sortBy) : "name";
    const dir = String(req.query.sortDir).toLowerCase() === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      let va: any = a[sortBy];
      let vb: any = b[sortBy];
      if (sortBy === "admission_date") {
        va = toIsoDate(va);
        vb = toIsoDate(vb);
      } else if (sortBy === "registration_number") {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return (va - vb) * dir;
      }
      // Vazios sempre no final
      if (!va && vb) return 1;
      if (va && !vb) return -1;
      return String(va || "").localeCompare(String(vb || ""), "pt-BR", { sensitivity: "base" }) * dir;
    });

    const totalCount = rows.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return res.json({
      cooperados: rows.slice(offset, offset + pageSize),
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      contratoOptions,
    });
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao listar cooperados:", error.message);
    return res.status(500).json({ error: "Erro ao listar cooperados da base de dados." });
  }
});

/**
 * PUT /api/cooperados/:cpf/contatos e PUT /api/cooperados/:cpf/sic
 */
const handleUpdateSicData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paramCpf = String(req.params.cpf || "");
    const numericCpf = cleanCpf(paramCpf);
    const {
      email,
      whatsapp_number,
      whatsapp,
      cellPhone,
      birth_date,
      birthDate,
      dataNascimento,
      rg,
      street,
      rua,
      number,
      numero,
      complement,
      complemento,
      neighborhood,
      bairro,
      city,
      cidade,
      state,
      estado,
      zip_code,
      cep,
    } = req.body || {};

    if (!numericCpf) {
      return res.status(400).json({ error: "CPF inválido." });
    }

    const finalEmail = email !== undefined ? String(email).trim().toLowerCase() : undefined;
    const finalWhatsapp = cleanCpf(whatsapp_number || whatsapp || cellPhone || "");
    const finalBirthDate = birth_date || birthDate || dataNascimento || undefined;
    const formattedBirthDate = formatDateForDb(finalBirthDate);
    const finalRg = rg !== undefined ? String(rg).trim() : undefined;
    const finalStreet = street || rua;
    const finalNumber = number || numero;
    const finalComplement = complement !== undefined ? complement : complemento;
    const finalNeighborhood = neighborhood || bairro;
    const finalCity = city || cidade;
    const finalState = (state || estado) ? String(state || estado).trim().toUpperCase() : undefined;
    const finalZipCode = zip_code ? cleanCpf(zip_code) : (cep ? cleanCpf(cep) : undefined);

    await pool.query(
      `UPDATE cooperados SET
        email = COALESCE(?, email),
        whatsapp_number = COALESCE(?, whatsapp_number),
        birth_date = COALESCE(?, birth_date),
        street = COALESCE(?, street),
        number = COALESCE(?, number),
        complement = COALESCE(?, complement),
        neighborhood = COALESCE(?, neighborhood),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        zip_code = COALESCE(?, zip_code),
        updated_at = CURRENT_TIMESTAMP
       WHERE document = ?`,
      [
        finalEmail || null,
        finalWhatsapp || null,
        formattedBirthDate || null,
        finalStreet || null,
        finalNumber || null,
        finalComplement || null,
        finalNeighborhood || null,
        finalCity || null,
        finalState || null,
        finalZipCode || null,
        numericCpf,
      ]
    );

    const syncResult = await updateOfficialSicCooperadoData(numericCpf, {
      email: finalEmail,
      whatsapp: finalWhatsapp,
      birthDate: finalBirthDate,
      rg: finalRg,
      street: finalStreet,
      number: finalNumber,
      complement: finalComplement,
      neighborhood: finalNeighborhood,
      city: finalCity,
      state: finalState,
      zipCode: finalZipCode,
    });

    const [rows] = await pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]);
    return res.json({
      message: syncResult.success
        ? "Dados cadastrais atualizados com sucesso no Centralizador SIC e sincronizados com o SIC oficial!"
        : `Dados cadastrais atualizados no Centralizador SIC local. (${syncResult.message})`,
      cooperado: rows[0] || null,
      syncedOfficialSic: syncResult.success,
      sicDetails: syncResult.details || null,
    });
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao atualizar contatos/dados:", error.message);
    return res.status(500).json({ error: "Erro ao atualizar dados do cooperado." });
  }
};
router.put("/:cpf/contatos", handleUpdateSicData);
router.put("/:cpf/sic", handleUpdateSicData);

/**
 * GET /api/cooperados/search?q=...
 */
router.get("/search", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      const [rows] = await pool.query<any[]>("SELECT * FROM cooperados ORDER BY updated_at DESC LIMIT 20");
      return res.json({ cooperados: rows });
    }

    const cleanedQuery = cleanCpf(query);

    // 1. Tenta buscar no Core M2M se for CPF (11 dígitos)
    if (cleanedQuery.length === 11) {
      try {
        const [sicData, sicDetails, payrolls] = await Promise.all([
          getSicCooperado(cleanedQuery).catch(() => null),
          getSicCooperadoDetails(cleanedQuery).catch(() => null),
          getSicPayrolls(cleanedQuery).catch(() => []),
        ]);

        if (sicData || sicDetails) {
          const saved = await upsertCooperadoFromSic(sicData, payrolls, sicDetails);
          if (saved) {
            return res.json({ cooperados: [saved] });
          }
        }
      } catch (e) {}
    }

    // 2. Tenta buscar no Portal UI do SIC (ui.coopedu.app.br) por CPF ou Nome
    try {
      const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
      const searchTarget = cleanedQuery.length === 11 ? cleanedQuery : encodeURIComponent(query);
      const sicRes = await axios.get(
        `https://ui.coopedu.app.br/api/cooperado/listar?search=${searchTarget}&pageNumber=1&pageSize=50`,
        { headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader }, timeout: 8000 }
      );
      const items = sicRes.data?.items || sicRes.data?.cooperados || sicRes.data?.body?.items || [];
      
      // Ordena garantindo que cadastros inativos sejam processados primeiro e o cadastro ATIVO fique por último (gravando o registro ativo canônico no MySQL)
      items.sort((a: any, b: any) => {
        const aAtivo = String(a.status || "").toLowerCase() === "ativo" ? 1 : 0;
        const bAtivo = String(b.status || "").toLowerCase() === "ativo" ? 1 : 0;
        if (aAtivo !== bAtivo) return aAtivo - bAtivo;
        const aReg = parseInt(String(a.registration || a.matricula || 0), 10);
        const bReg = parseInt(String(b.registration || b.matricula || 0), 10);
        return aReg - bReg;
      });

      const savedList: any[] = [];
      for (const item of items) {
        const saved = await upsertCooperadoFromSic(item, [], undefined, item.id);
        if (saved) savedList.push(saved);
      }
      if (savedList.length > 0) {
        // Retorna preferencialmente os registros com status Ativo
        const activeOnly = savedList.filter((s: any) => s.status === "Ativo");
        return res.json({ cooperados: activeOnly.length > 0 ? activeOnly : savedList });
      }
    } catch (e: any) {
      console.warn("[Cooperados Warning] Falha na busca pelo Portal UI do SIC:", e.message);
    }

    // 3. Fallback no Banco de Dados Local MySQL
    const words = query.split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 0);
    let fallbackSql = "SELECT * FROM cooperados WHERE 1=1";
    const fallbackParams: any[] = [];

    if (cleanedQuery.length === 11) {
      fallbackSql += " AND (document = ? OR document LIKE ?)";
      fallbackParams.push(cleanedQuery, `%${cleanedQuery}%`);
    } else if (cleanedQuery.length >= 3 && /^\d+$/.test(query.replace(/[.-]/g, ""))) {
      fallbackSql += " AND (document LIKE ? OR CAST(registration_number AS CHAR) LIKE ?)";
      fallbackParams.push(`%${cleanedQuery}%`, `%${cleanedQuery}%`);
    } else if (words.length > 0) {
      const wordClauses = words.map(() => `name LIKE ?`).join(" AND ");
      fallbackSql += ` AND (${wordClauses} OR document LIKE ?)`;
      words.forEach((w) => fallbackParams.push(`%${w}%`));
      fallbackParams.push(`%${query}%`);
    } else {
      fallbackSql += " AND (name LIKE ? OR document LIKE ?)";
      fallbackParams.push(`%${query}%`, `%${query}%`);
    }

    fallbackSql += " ORDER BY (CASE WHEN status = 'Ativo' THEN 0 ELSE 1 END) ASC, name ASC LIMIT 50";
    let [rows] = await pool.query<any[]>(fallbackSql, fallbackParams);

    // 4. Fallback na base EasyCoop (easycoop_alocacoes) caso não conste no SIC nem em cooperados
    if (rows.length === 0) {
      let alocSql = `
        SELECT DISTINCT 
          document, 
          nome AS name, 
          matricula AS registration_number,
          cargo AS position, 
          tomador_nome AS contract_name,
          (CASE WHEN status_alocacao IN ('Ativo', 'S', 'A') THEN 'Ativo' ELSE 'Inativo' END) AS status,
          data_inicio AS admission_date,
          '450' AS bank_code,
          'BANCO OWL' AS bank_name,
          '0001' AS agency,
          matricula AS account_number,
          '3' AS account_digit,
          'Conta-Corrente' AS account_type,
          document AS pix_key
        FROM easycoop_alocacoes
        WHERE 1=1
      `;
      const alocParams: any[] = [];
      if (cleanedQuery.length === 11) {
        alocSql += " AND (document = ? OR document LIKE ?)";
        alocParams.push(cleanedQuery, `%${cleanedQuery}%`);
      } else if (cleanedQuery.length >= 3 && /^\d+$/.test(query.replace(/[.-]/g, ""))) {
        alocSql += " AND (document LIKE ? OR matricula LIKE ?)";
        alocParams.push(`%${cleanedQuery}%`, `%${cleanedQuery}%`);
      } else if (words.length > 0) {
        const alocClauses = words.map(() => `nome LIKE ?`).join(" AND ");
        alocSql += ` AND (${alocClauses} OR document LIKE ?)`;
        words.forEach((w) => alocParams.push(`%${w}%`));
        alocParams.push(`%${query}%`);
      } else {
        alocSql += " AND (nome LIKE ? OR document LIKE ?)";
        alocParams.push(`%${query}%`, `%${query}%`);
      }
      alocSql += " ORDER BY status ASC, name ASC LIMIT 50";
      const [alocRows] = await pool.query<any[]>(alocSql, alocParams).catch(() => [[]]);
      if (alocRows && alocRows.length > 0) {
        rows = alocRows;
      }
    }

    return res.json({ cooperados: rows });
  } catch (error: any) {
    console.error("[Cooperados Error] Erro na busca:", error.message);
    const searchTerm = `%${String(req.query.q || "").trim()}%`;
    let [rows] = await pool.query<any[]>(
      "SELECT * FROM cooperados WHERE name LIKE ? OR document LIKE ? OR registration_number LIKE ? ORDER BY name ASC LIMIT 50",
      [searchTerm, searchTerm, searchTerm]
    ).catch(() => [[]]);
    if (!rows || rows.length === 0) {
      const [alocFallback] = await pool.query<any[]>(
        "SELECT DISTINCT document, nome AS name, matricula AS registration_number, cargo AS position, tomador_nome AS contract_name, status_alocacao AS status FROM easycoop_alocacoes WHERE nome LIKE ? OR document LIKE ? OR matricula LIKE ? LIMIT 50",
        [searchTerm, searchTerm, searchTerm]
      ).catch(() => [[]]);
      rows = alocFallback || [];
    }
    return res.json({ cooperados: rows || [] });
  }
});

/**
 * GET /api/cooperados/:cpf
 */
router.get("/:cpf", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paramCpf = String(req.params.cpf || "");
    const numericCpf = cleanCpf(paramCpf);
    if (!numericCpf) {
      return res.status(400).json({ error: "CPF inválido." });
    }

    let [sicData, sicDetails, payrolls, [localRows]] = await Promise.all([
      getSicCooperado(numericCpf).catch(() => null),
      getSicCooperadoDetails(numericCpf).catch(() => null),
      getSicPayrolls(numericCpf).catch(() => []),
      pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]),
    ]);

    let cooperado = localRows[0] || null;
    if (sicData || sicDetails) {
      cooperado = await upsertCooperadoFromSic(sicData, payrolls, sicDetails);
    }

    // Busca a lista completa de cadastros/matrículas históricas para este CPF no Portal UI do SIC
    let allRegistrations: any[] = [];
    try {
      const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
      const sicRes = await axios.get(
        `https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=50`,
        { headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader }, timeout: 8000 }
      );
      const rawItems = sicRes.data?.body?.items || sicRes.data?.items || sicRes.data?.cooperados || [];
      const items = rawItems.filter((i: any) => {
        const doc = cleanCpf(i.documents?.identification || i.document || i.cpf || i.documentos?.cpfCnpj || "");
        return doc === numericCpf;
      });
      
      allRegistrations = items.map((i: any) => ({
        id: i.id,
        registration: i.registration || i.matricula,
        status: i.status || (i.isActive ? "Ativo" : "Inativo"),
        name: i.name || i.nome,
        createdTime: i.createdTime,
        profession: i.contractCooperativeUser?.[0]?.profession?.name || null
      }));

      const activeOrFirst = items.find((i: any) => String(i.status).toLowerCase() === "ativo") || items[0];

      // Busca sempre os detalhes completos por ID no Portal UI do SIC (garantindo os contratos reais e profissão)
      if (activeOrFirst && activeOrFirst.id) {
        try {
          const detailsRes = await axios.get(
            `https://ui.coopedu.app.br/api/cooperado/${activeOrFirst.id}`,
            { headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader }, timeout: 8000 }
          );
          const fullPortalDetails = detailsRes.data?.body || detailsRes.data;
          if (fullPortalDetails) {
            sicDetails = {
              ...(sicDetails || {}),
              ...fullPortalDetails,
            };
          }
        } catch (e) {}
      }

      // Enriquece cada contrato da lista com as informacoes detalhadas do contrato (cliente, descricao, nucleo)
      if (sicDetails) {
        const cUserArr = sicDetails.contractCooperativeUser || sicDetails.contratos || [];
        if (Array.isArray(cUserArr) && cUserArr.length > 0) {
          for (const item of cUserArr) {
            if (item.contractId && (!item.contract || !item.contrato)) {
              try {
                const cRes = await axios.get(`https://ui.coopedu.app.br/api/contrato/${item.contractId}`, {
                  headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader },
                  timeout: 5000,
                });
                const contractObj = cRes.data?.body || cRes.data;
                if (contractObj) {
                  item.contract = contractObj;
                  item.contrato = contractObj;
                }
              } catch (e) {}
            }
          }
        }
      }

      // Sincroniza a ficha canônica ativa no banco local com os detalhes completos do Portal UI (incluindo o contrato enriquecido)
      if (activeOrFirst && (sicDetails || !cooperado)) {
        cooperado = await upsertCooperadoFromSic(activeOrFirst, payrolls || [], sicDetails, activeOrFirst.id);
      }
    } catch (e) {}

    if (!cooperado) {
      const [alocRows] = await pool.query<any[]>(
        `SELECT document, matricula AS registration_number, nome AS name, cargo AS position,
                tomador_nome AS contract_name,
                (CASE WHEN status_alocacao IN ('Ativo', 'S', 'A') THEN 'Ativo' ELSE 'Inativo' END) AS status,
                data_inicio AS admission_date
         FROM easycoop_alocacoes
         WHERE document = ?
         ORDER BY (CASE WHEN status_alocacao IN ('Ativo', 'S', 'A') THEN 0 ELSE 1 END) ASC, data_inicio DESC
         LIMIT 1`,
        [numericCpf]
      ).catch(() => [[]]);
      if (alocRows && alocRows.length > 0) {
        cooperado = {
          ...alocRows[0],
          bank_code: "450",
          bank_name: "BANCO OWL",
          agency: "0001",
          account_number: alocRows[0].registration_number || "1042317620",
          account_digit: "3",
          account_type: "Conta-Corrente",
          pix_key: numericCpf,
        };
      } else {
        return res.status(404).json({ error: "Cooperado não encontrado na base local nem no SIC." });
      }
    }

    const enrichedSicDetails = {
      ...(sicDetails || {}),
      allRegistrations,
    };

    // Consulta os dados de login no app (lastSignedIn) e registro de produtividade mobile
    const appData = await getCooperadoAppData(numericCpf, cooperado?.name, cooperado?.email, enrichedSicDetails).catch(() => null);

    // 1. Verificação oficial de dados no SIC (cadastro ativo no portal ou vínculo oficial)
    const hasRealPayrolls = Array.isArray(payrolls) && payrolls.some((p: any) => p.payrollId && !String(p.payrollId).startsWith("fallback-"));
    const hasSicData = Boolean(
      cooperado?.sic_id ||
      (sicDetails && (sicDetails.id || sicDetails.matricula)) ||
      (Array.isArray(allRegistrations) && allRegistrations.length > 0) ||
      hasRealPayrolls
    );

    // 2. Verificação oficial de dados no EasyCoop (matrícula cadastrada em easycoop_alocacoes)
    let hasEasycoopData = false;
    try {
      const [alocCheck] = await pool.query<any[]>(
        "SELECT 1 FROM easycoop_alocacoes WHERE document = ? AND matricula IS NOT NULL AND matricula <> '' LIMIT 1",
        [numericCpf]
      );
      hasEasycoopData = Boolean(alocCheck && alocCheck.length > 0);
    } catch {
      hasEasycoopData = false;
    }

    return res.json({
      cooperado,
      payrolls: payrolls || [],
      sicDetails: enrichedSicDetails,
      appData: appData || null,
      hasSicData,
      hasEasycoopData,
    });
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao carregar detalhes:", error.message);
    const paramCpf = String(req.params.cpf || "");
    const numericCpf = cleanCpf(paramCpf);
    const [localRows] = await pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]).catch(() => [[]]);
    if (localRows && localRows[0]) {
      const c = localRows[0];
      const [alocCheck] = await pool.query<any[]>(
        "SELECT 1 FROM easycoop_alocacoes WHERE document = ? AND matricula IS NOT NULL AND matricula <> '' LIMIT 1",
        [numericCpf]
      ).catch(() => [[]]);
      const hasEasycoopData = Boolean(alocCheck && alocCheck.length > 0);
      const hasSicData = Boolean(c.sic_id);

      return res.json({
        cooperado: c,
        payrolls: [],
        sicDetails: null,
        appData: null,
        hasSicData,
        hasEasycoopData,
      });
    }
    return res.status(500).json({ error: "Erro ao carregar dados do cooperado." });
  }
});

/**
 * GET /api/cooperados/:cpf/payrolls/:payrollId/pdf
 */
router.get("/:cpf/payrolls/:payrollId/pdf", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paramCpf = String(req.params.cpf || "");
    const paramPayrollId = String(req.params.payrollId || "");
    const docType = String(req.query.type || "demonstrativo").toLowerCase();
    const isDownload = req.query.download === "true" || req.query.download === "1";
    const dispositionType = isDownload ? "attachment" : "inline";
    const numericCpf = cleanCpf(paramCpf);

    if (!numericCpf || !paramPayrollId) {
      return res.status(400).json({ error: "CPF e ID da folha são obrigatórios." });
    }

    // 1. Resolve o ID do cooperado no SIC (sic_id)
    let coopId: string | undefined;
    try {
      const [coopRows] = await pool.query<any[]>(
        "SELECT sic_id FROM cooperados WHERE document = ? LIMIT 1",
        [numericCpf]
      );
      if (coopRows?.[0]?.sic_id) {
        coopId = coopRows[0].sic_id;
      }
    } catch (e: any) {}

    if (!coopId) {
      try {
        const { getAuthenticatedSicSession } = require("../services/sicBrowserAutomation");
        const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
        const headers = { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader };
        const searchRes = await axios.get(
          `https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=10`,
          { headers, timeout: 5000 }
        );
        const items = searchRes.data?.body?.items || searchRes.data?.items || [];
        const found = items.find((i: any) => cleanCpf(i.documents?.identification || i.document || i.cpf) === numericCpf);
        if (found?.id) {
          coopId = found.id;
          pool.query("UPDATE cooperados SET sic_id = ? WHERE document = ?", [coopId, numericCpf]).catch(() => {});
        }
      } catch (e: any) {}
    }

    // 2. Resolve o GUID real da folha caso o parâmetro seja sintético (ex: payroll-2026-8)
    let realPayrollId = paramPayrollId;
    if ((!paramPayrollId || paramPayrollId.length !== 36) && coopId) {
      try {
        const { getAuthenticatedSicSession } = require("../services/sicBrowserAutomation");
        const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
        const headers = { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader };

        const targetCoopId = coopId;
        const pagRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/${targetCoopId}/financeiro/pagamentos?pageNumber=1&pageSize=20`, { headers });
        const pagItems = pagRes.data?.body?.items || [];

        const parts = paramPayrollId.replace("payroll-", "").split("-");
        const monthNum = Number(parts.pop() || 8);
        const yearNum = Number(parts.pop() || 2026);

        const match = pagItems.find((p: any) => p.month === monthNum && p.year === yearNum);
        if (match && match.payrollId) {
          realPayrollId = match.payrollId;
          console.log(`[Cooperados GUID Resolver] Folha ${paramPayrollId} resolvida para GUID real: ${realPayrollId}`);
        } else if (pagItems.length > 0 && pagItems[0].payrollId) {
          realPayrollId = pagItems[0].payrollId;
        }
      } catch (e: any) {
        console.warn(`[Cooperados Warning] Falha ao mapear GUID da folha para CPF ${numericCpf}:`, e.message);
      }
    }

    if (docType === "comprovante" || docType === "recibo") {
      const officialPdfBuffer = await getOfficialSicPaymentReceiptPdf(numericCpf, realPayrollId);

      if (officialPdfBuffer) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `${dispositionType}; filename="comprovante-oficial-${numericCpf}-${realPayrollId}.pdf"`);
        res.setHeader("Content-Length", officialPdfBuffer.length);
        return res.send(officialPdfBuffer);
      }

      return res.status(502).json({
        error: "Não foi possível obter o Comprovante oficial diretamente do portal SIC. Verifique se a sua sessão do portal está ativa no menu 'Conexão SIC' no topo da tela."
      });
    }

    // Demonstrativo Individual estritamente oficial retornado pela API do SIC (Sem gerador local)
    const pdfBuffer = await getSicDemonstrative(numericCpf, realPayrollId, coopId);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(502).json({ error: "Não foi possível obter o PDF oficial do Demonstrativo na API do SIC. Verifique se a sessão web está ativa no menu 'Conexão SIC'." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${dispositionType}; filename="demonstrativo-oficial-${numericCpf}-${realPayrollId}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao obter PDF oficial da API do SIC:", error.message);
    return res.status(502).json({ error: `Falha ao obter documento oficial no SIC: ${error.message}. Acesse 'Conexão SIC' para validar o token.` });
  }
});

/**
 * GET /api/cooperados/:cpf/payrolls/:payrollId/resumo-financeiro
 * Retorna os detalhes estruturados do resumo financeiro do pagamento
 */
router.get("/:cpf/payrolls/:payrollId/resumo-financeiro", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cpf = Array.isArray(req.params.cpf) ? req.params.cpf[0] : req.params.cpf;
    const payrollId = Array.isArray(req.params.payrollId) ? req.params.payrollId[0] : req.params.payrollId;
    const summary = await getFinancialSummary(cpf || "", payrollId || "");
    return res.json(summary);
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao obter resumo financeiro:", error.message);
    return res.status(500).json({ error: error.message || "Falha ao carregar o resumo financeiro." });
  }
});

/**
 * GET /api/cooperados/coop01-status
 * Retorna o status de conexão da base ERP (COOP01 no SQL Server 2022) e contagens comparativas
 */
router.get("/coop01-status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await checkCoop01Status();
    return res.json(status);
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao verificar status da base COOP01:", error.message);
    return res.status(500).json({ error: "Falha ao verificar status da base COOP01." });
  }
});

/**
 * POST /api/cooperados/sync-coop01
 * Dispara a rotina de sincronização completa da base ERP COOP01 para o MySQL local
 */
router.post("/sync-coop01", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await runCoop01Sync();
    return res.json(result);
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao executar sincronização COOP01:", error.message);
    return res.status(500).json({ error: error.message || "Erro na sincronização da base COOP01." });
  }
});

export default router;
