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
  getOfficialSicPaymentReceiptPdf,
  getAuthenticatedSicSession,
} from "../services/sicBrowserAutomation";
import { getCooperadoAppData } from "../services/appDbService";
import { generateReceiptPdf } from "../services/pdfService";

import { getFinancialSummary } from "../services/financialSummaryService";

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

    const [rows] = await pool.query<any[]>(
      `SELECT b.bankCode, b.bankName, b.accountType, b.agency, b.accountNumber, b.accountDigit, b.pixKey
       FROM app_db.cooperado_bank_data b
       JOIN app_db.cooperados c ON c.id = b.cooperadoId
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
  const numericCpf = cleanCpf(sicUser?.cpf || sicUser?.document || sicDetails?.documentos?.cpfCnpj || sicDetails?.cpf);
  if (!numericCpf) return null;

  const sicId = sicIdParam || sicUser?.id || sicDetails?.id || null;
  const name = sicDetails?.nome || sicUser?.name || sicUser?.nome || "NOME NÃO INFORMADO";
  const registrationNumber = sicDetails?.matricula || (sicUser?.registration ? parseInt(sicUser.registration, 10) : null) || sicUser?.registrationNumber || null;

  const motherName = sicDetails?.nomeMae || null;
  const fatherName = sicDetails?.nomePai || null;
  const birthDate = formatDateForDb(sicDetails?.dataNascimento || sicUser?.birthDate);
  const birthCity = sicDetails?.cidadeNascimento || null;
  const birthState = sicDetails?.estadoNascimento || null;

  const email = sicDetails?.email || sicUser?.email || null;
  const whatsappNumber = sicDetails?.celular || sicDetails?.telefone || sicUser?.cellPhone || sicUser?.cellphone || null;

  const street = sicDetails?.endereco?.rua || sicUser?.address?.streetName || null;
  const number = sicDetails?.endereco?.numero || sicUser?.address?.houseNumber || null;
  const complement = sicDetails?.endereco?.complemento || sicUser?.address?.complement || null;
  const neighborhood = sicDetails?.endereco?.bairro || sicUser?.address?.neighborhood || null;
  const city = sicDetails?.endereco?.cidade || sicUser?.address?.cityName || null;
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
  let admissionDate: string | null = formatDateForDb(sicDetails?.dataAdmissao || sicUser?.admissionDate);

  if (sicDetails?.contratos && Array.isArray(sicDetails.contratos) && sicDetails.contratos.length > 0) {
    const activeContract = sicDetails.contratos.find((c: any) => c.statusContratoUsuario === "ATIVO");
    if (activeContract && activeContract.contrato) {
      latestContractName = activeContract.contrato.descricao || activeContract.contrato.centroDeCusto || null;
    } else if (sicDetails.contratos[0]?.contrato) {
      latestContractName = sicDetails.contratos[0].contrato.descricao || null;
    }
  }

  if (payrolls && payrolls.length > 0) {
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
       email, whatsapp_number, street, number, complement, neighborhood, city, state, zip_code, 
       bank_name, bank_code, agency, account_number, account_digit, account_type, pix_key,
       contract_name, admission_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativo')
     ON DUPLICATE KEY UPDATE
      sic_id = COALESCE(VALUES(sic_id), sic_id),
      name = VALUES(name),
      registration_number = COALESCE(VALUES(registration_number), registration_number),
      mother_name = COALESCE(VALUES(mother_name), mother_name),
      father_name = COALESCE(VALUES(father_name), father_name),
      birth_date = COALESCE(VALUES(birth_date), birth_date),
      birth_city = COALESCE(VALUES(birth_city), birth_city),
      birth_state = COALESCE(VALUES(birth_state), birth_state),
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
      contract_name = COALESCE(VALUES(contract_name), contract_name),
      admission_date = COALESCE(VALUES(admission_date), admission_date),
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
    ]
  );

  const [rows] = await pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]);
  return rows[0] || null;
}

/**
 * GET /api/cooperados/listar
 * Retorna cooperados trazendo informações reais do SIC
 */
router.get("/listar", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = String(req.query.search || "").trim();
    const pageNumber = Math.max(1, parseInt(String(req.query.pageNumber || "1"), 10));
    const pageSize = Math.min(12000, Math.max(1, parseInt(String(req.query.pageSize || "25"), 10)));
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

    let countQuery = "SELECT COUNT(*) as total FROM cooperados";
    let listQuery = "SELECT * FROM cooperados";
    const queryParams: any[] = [];

    if (search) {
      const cleanedCpf = cleanCpf(search);
      const searchTerm = `%${search}%`;
      countQuery += " WHERE name LIKE ? OR document LIKE ? OR registration_number LIKE ?";
      listQuery += " WHERE name LIKE ? OR document LIKE ? OR registration_number LIKE ?";
      queryParams.push(searchTerm, `%${cleanedCpf || search}%`, searchTerm);
    }

    listQuery += " ORDER BY name ASC LIMIT ? OFFSET ?";

    const [countRows] = await pool.query<any[]>(countQuery, queryParams);
    const totalCount = countRows[0]?.total || 0;

    const [rows] = await pool.query<any[]>(listQuery, [...queryParams, pageSize, offset]);
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return res.json({
      cooperados: rows,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
    });
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao listar cooperados:", error.message);
    return res.status(500).json({ error: "Erro ao listar cooperados da base de dados." });
  }
});

/**
 * PUT /api/cooperados/:cpf/contatos
 */
router.put("/:cpf/contatos", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paramCpf = String(req.params.cpf || "");
    const numericCpf = cleanCpf(paramCpf);
    const { email, whatsapp_number, birth_date } = req.body;

    if (!numericCpf) {
      return res.status(400).json({ error: "CPF inválido." });
    }

    const formattedBirthDate = formatDateForDb(birth_date);

    await pool.query(
      `UPDATE cooperados SET
        email = ?,
        whatsapp_number = ?,
        birth_date = COALESCE(?, birth_date),
        updated_at = CURRENT_TIMESTAMP
       WHERE document = ?`,
      [email || null, whatsapp_number || null, formattedBirthDate, numericCpf]
    );

    const syncedSuccess = await updateOfficialSicCooperadoContacts(
      numericCpf,
      email || "",
      whatsapp_number || "",
      birth_date || undefined
    );

    const [rows] = await pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]);
    return res.json({
      message: syncedSuccess
        ? "Dados cadastrais (E-mail, WhatsApp e Data de Nascimento) atualizados com sucesso no Centralizador SIC e sincronizados com o SIC oficial!"
        : "Dados cadastrais atualizados no Centralizador SIC local. (Erro na sincronização oficial do SIC).",
      cooperado: rows[0] || null,
      syncedOfficialSic: syncedSuccess,
    });
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao atualizar contatos/dados:", error.message);
    return res.status(500).json({ error: "Erro ao atualizar dados do cooperado." });
  }
});

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

    if (cleanedQuery.length === 11) {
      const [sicData, sicDetails, payrolls] = await Promise.all([
        getSicCooperado(cleanedQuery),
        getSicCooperadoDetails(cleanedQuery),
        getSicPayrolls(cleanedQuery),
      ]);

      if (sicData || sicDetails) {
        const saved = await upsertCooperadoFromSic(sicData, payrolls, sicDetails);
        return res.json({ cooperados: saved ? [saved] : [] });
      }
    }

    try {
      const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
      const sicRes = await axios.get(
        `https://ui.coopedu.app.br/api/cooperado/listar?search=${encodeURIComponent(query)}&pageNumber=1&pageSize=20`,
        { headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader } }
      );
      const items = sicRes.data?.items || sicRes.data?.cooperados || sicRes.data?.body?.items || [];
      for (const item of items) {
        await upsertCooperadoFromSic(item, [], undefined, item.id);
      }
    } catch (e) {}

    const searchTerm = `%${query}%`;
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM cooperados WHERE name LIKE ? OR document LIKE ? OR registration_number LIKE ? ORDER BY name ASC LIMIT 50",
      [searchTerm, searchTerm, searchTerm]
    );

    return res.json({ cooperados: rows });
  } catch (error: any) {
    console.error("[Cooperados Error] Erro na busca:", error.message);
    return res.status(500).json({ error: "Erro ao realizar busca de cooperados." });
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

    const [sicData, sicDetails, payrolls, [localRows]] = await Promise.all([
      getSicCooperado(numericCpf),
      getSicCooperadoDetails(numericCpf),
      getSicPayrolls(numericCpf),
      pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]),
    ]);

    let cooperado = localRows[0] || null;
    if (sicData || sicDetails) {
      cooperado = await upsertCooperadoFromSic(sicData, payrolls, sicDetails);
    }

    if (!cooperado) {
      return res.status(404).json({ error: "Cooperado não encontrado no sistema ou na API do SIC." });
    }

    // Consulta os dados de login no app (lastSignedIn) e registro de produtividade mobile
    const appData = await getCooperadoAppData(numericCpf, cooperado?.name, cooperado?.email, sicDetails);

    return res.json({
      cooperado,
      payrolls,
      sicDetails,
      appData,
    });
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao carregar detalhes:", error.message);
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
    const numericCpf = cleanCpf(paramCpf);

    if (!numericCpf || !paramPayrollId) {
      return res.status(400).json({ error: "CPF e ID da folha são obrigatórios." });
    }

    if (docType === "comprovante" || docType === "recibo") {
      const officialPdfBuffer = await getOfficialSicPaymentReceiptPdf(numericCpf, paramPayrollId);

      if (officialPdfBuffer) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="comprovante-oficial-pix-${numericCpf}-${paramPayrollId}.pdf"`);
        res.setHeader("Content-Length", officialPdfBuffer.length);
        return res.send(officialPdfBuffer);
      }

      const [sicDetails, payrolls, [localRows]] = await Promise.all([
        getSicCooperadoDetails(numericCpf),
        getSicPayrolls(numericCpf),
        pool.query<any[]>("SELECT * FROM cooperados WHERE document = ?", [numericCpf]),
      ]);

      const cooperado = localRows[0] || null;
      const targetPayroll = payrolls.find((p: any) => p.payrollId === paramPayrollId) || {
        payrollId: paramPayrollId,
        competence: "N/I",
        month: 1,
        year: 2026,
        payrollType: "Regular",
        payrollStatus: "Processado",
      };

      const pdfBuffer = await generateReceiptPdf({
        cooperadoName: sicDetails?.nome || cooperado?.name || "COOPERADO",
        cpf: numericCpf,
        registrationNumber: sicDetails?.matricula || cooperado?.registration_number || "N/I",
        contractName: targetPayroll.contractDescription || targetPayroll.clientName || cooperado?.contract_name || "COOPEDU GESTORES",
        competence: targetPayroll.competence || `${targetPayroll.year}-${String(targetPayroll.month).padStart(2, "0")}`,
        month: targetPayroll.month,
        year: targetPayroll.year,
        payrollType: targetPayroll.payrollType || "Regular",
        payrollStatus: targetPayroll.payrollStatus || "Processado",
        payDayTime: targetPayroll.payDayTime,
        payrollId: paramPayrollId,
        bankName: cooperado?.bank_name || "450 - OwlBank / Fitbank",
        bankCode: cooperado?.bank_code || "450",
        agency: cooperado?.agency || "0001",
        accountNumber: cooperado?.account_number || "1042317620",
        accountDigit: cooperado?.account_digit || "3",
        pixKey: cooperado?.pix_key || numericCpf,
        street: sicDetails?.endereco?.rua || cooperado?.street,
        number: sicDetails?.endereco?.numero || cooperado?.number,
        neighborhood: sicDetails?.endereco?.bairro || cooperado?.neighborhood,
        city: sicDetails?.endereco?.cidade || cooperado?.city,
        state: sicDetails?.endereco?.estado === "23" ? "CE" : sicDetails?.endereco?.estado || cooperado?.state,
        zipCode: sicDetails?.endereco?.cep || cooperado?.zip_code,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="comprovante-pagamento-${numericCpf}-${paramPayrollId}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    }

    const pdfBuffer = await getSicDemonstrative(numericCpf, paramPayrollId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="demonstrativo-pagamento-${numericCpf}-${paramPayrollId}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[Cooperados Error] Erro ao obter PDF do demonstrativo/comprovante:", error.message);
    return res.status(500).json({ error: "Falha ao gerar/obter o documento em PDF no SIC." });
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

export default router;
