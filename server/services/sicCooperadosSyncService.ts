import axios from "axios";
import { pool } from "../db";
import { cleanCpf } from "./sicApi";
import { getAuthenticatedSicSession } from "./sicBrowserAutomation";

/**
 * Sincronização completa da lista de cooperados da API do SIC para a tabela `cooperados`.
 * - Marca `sic_id` (é o que identifica o cooperado como presente na base SIC).
 * - Nome e status passam a ser os do SIC (sistema vigente).
 * - Demais campos só preenchem lacunas, preservando o que veio do EasyCoop ou foi editado localmente.
 */

const SIC_API_BASE = "https://ui.coopedu.app.br/api";
const SIC_LIST_URL = `${SIC_API_BASE}/cooperado/listar`;
const PAGE_SIZE = 1000;
const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type SicSyncState = {
  running: boolean;
  phase: "cadastro" | "contratos" | null;
  startedAt: string | null;
  finishedAt: string | null;
  processed: number;
  total: number;
  error: string | null;
};

const state: SicSyncState = { running: false, phase: null, startedAt: null, finishedAt: null, processed: 0, total: 0, error: null };

export function getSicSyncState(): SicSyncState {
  return { ...state };
}

const toDate = (v: any): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) || d.getFullYear() < 1900 ? null : d.toISOString().slice(0, 10);
};

const clean = (v: any): string | null => {
  const s = String(v ?? "").trim();
  return !s || /^n[aã]o coletado$/i.test(s) ? null : s;
};

function mapSicItem(item: any): any[] | null {
  const doc = cleanCpf(String(item?.documents?.identification || item?.cpf || item?.document || ""));
  if (!doc) return null;
  const status = String(item.status || "").trim();
  const bank = item.bankAccount || {};
  return [
    doc.padStart(11, "0"),
    item.id || null,
    item.registration ? Number(item.registration) || null : null,
    clean(item.name) || "NOME NÃO INFORMADO",
    clean(item.motherName),
    clean(item.fatherName),
    toDate(item.birthDate),
    clean(item.birthCity),
    clean(item.birthState),
    clean(item.professionalInformation?.profession),
    clean(item.email),
    clean(item.cellPhone) || clean(item.telephone),
    clean(item.address?.streetName),
    clean(item.address?.houseNumber),
    clean(item.address?.complement),
    clean(item.address?.neighborhood),
    clean(item.address?.city),
    clean(item.address?.state),
    clean(item.address?.cep),
    clean(bank.bank),
    clean(bank.agency),
    clean(bank.account),
    clean(bank.digit),
    toDate(item.admissionDate),
    ["Ativo", "Inativo", "Desligado"].includes(status) ? status : "Ativo",
  ];
}

async function upsertBatch(rows: any[][]) {
  if (rows.length === 0) return;
  const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())").join(", ");
  await pool.query(
    `INSERT INTO cooperados
      (document, sic_id, registration_number, name, mother_name, father_name, birth_date, birth_city, birth_state,
       position, email, whatsapp_number, street, number, complement, neighborhood, city, state, zip_code,
       bank_code, agency, account_number, account_digit, admission_date, status, sic_synced_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
      sic_id = VALUES(sic_id),
      name = VALUES(name),
      status = VALUES(status),
      sic_synced_at = VALUES(sic_synced_at),
      registration_number = COALESCE(cooperados.registration_number, VALUES(registration_number)),
      mother_name = COALESCE(cooperados.mother_name, VALUES(mother_name)),
      father_name = COALESCE(cooperados.father_name, VALUES(father_name)),
      birth_date = COALESCE(cooperados.birth_date, VALUES(birth_date)),
      birth_city = COALESCE(cooperados.birth_city, VALUES(birth_city)),
      birth_state = COALESCE(cooperados.birth_state, VALUES(birth_state)),
      position = COALESCE(cooperados.position, VALUES(position)),
      email = COALESCE(cooperados.email, VALUES(email)),
      whatsapp_number = COALESCE(cooperados.whatsapp_number, VALUES(whatsapp_number)),
      street = COALESCE(cooperados.street, VALUES(street)),
      number = COALESCE(cooperados.number, VALUES(number)),
      complement = COALESCE(cooperados.complement, VALUES(complement)),
      neighborhood = COALESCE(cooperados.neighborhood, VALUES(neighborhood)),
      city = COALESCE(cooperados.city, VALUES(city)),
      state = COALESCE(cooperados.state, VALUES(state)),
      zip_code = COALESCE(cooperados.zip_code, VALUES(zip_code)),
      bank_code = COALESCE(cooperados.bank_code, VALUES(bank_code)),
      agency = IF(cooperados.bank_code IS NULL, VALUES(agency), cooperados.agency),
      account_number = IF(cooperados.bank_code IS NULL, VALUES(account_number), cooperados.account_number),
      account_digit = IF(cooperados.bank_code IS NULL, VALUES(account_digit), cooperados.account_digit),
      admission_date = COALESCE(cooperados.admission_date, VALUES(admission_date))`,
    rows.flat()
  );
}

const DETAIL_CONCURRENCY = 10;

/**
 * Etapa 2: contratos de cada cooperado.
 * A listagem do SIC não traz os contratos; eles só vêm no detalhe (`/cooperado/{id}`),
 * e os nomes vêm de `/contrato/listar`. Grava em `sic_contracts` (JSON, ativos primeiro).
 */
async function syncSicContracts() {
  state.phase = "contratos";
  let { jwtToken, cookieHeader } = await getAuthenticatedSicSession();

  const contratosRes = await axios.get(`${SIC_API_BASE}/contrato/listar?pageNumber=1&pageSize=1000`, {
    headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader },
    timeout: 120000,
  });
  const nomeContrato = new Map<string, string>();
  for (const c of contratosRes.data?.body?.items || []) {
    const descricao = clean(c.description);
    const nucleo = clean(c.regionalNucleus);
    const ehPrefeitura = [c.costCenter, c.description].some((v) => /^\s*(PREFEITURA|PRFEITURA|PREFF?\b)/i.test(String(v || "")));
    // Em contratos de prefeitura o núcleo regional é a própria cidade (já sem nº de contrato e sem erros de digitação)
    const nome = ehPrefeitura && nucleo ? `PREFEITURA ${nucleo}` : descricao || clean(c.costCenter);
    if (c.id && nome) nomeContrato.set(c.id, nome);
  }

  const [coops] = await pool.query<any[]>("SELECT document, sic_id FROM cooperados WHERE sic_id IS NOT NULL");
  state.processed = 0;
  state.total = coops.length;

  let cursor = 0;
  const worker = async () => {
    while (cursor < coops.length) {
      const coop = coops[cursor++];
      try {
        if (state.processed % 1000 === 0) ({ jwtToken, cookieHeader } = await getAuthenticatedSicSession());
        const res = await axios.get(`${SIC_API_BASE}/cooperado/${coop.sic_id}`, {
          headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader },
          timeout: 20000,
        });
        const vinculos: any[] = (res.data?.body || res.data)?.contractCooperativeUser || [];
        const ordenados = [...vinculos].sort((a, b) => Number(!!b.isActive) - Number(!!a.isActive));
        const nomes: string[] = [];
        for (const v of ordenados) {
          const nome = nomeContrato.get(v.contractId);
          if (nome && !nomes.includes(nome)) nomes.push(nome);
        }
        await pool.query("UPDATE cooperados SET sic_contracts = ? WHERE document = ?", [
          nomes.length ? JSON.stringify(nomes) : null,
          coop.document,
        ]);
      } catch {
        // Falha pontual de um cooperado não interrompe a sincronização
      }
      state.processed++;
    }
  };
  await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));
}

export async function syncAllSicCooperados(): Promise<SicSyncState> {
  if (state.running) return getSicSyncState();
  Object.assign(state, { running: true, phase: "cadastro", startedAt: new Date().toISOString(), finishedAt: null, processed: 0, total: 0, error: null });

  try {
    let pageNumber = 1;
    let totalPages = 1;
    do {
      const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
      const res = await axios.get(`${SIC_LIST_URL}?search=&pageNumber=${pageNumber}&pageSize=${PAGE_SIZE}`, {
        headers: { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader },
        timeout: 120000,
      });
      const body = res.data?.body || res.data || {};
      const items: any[] = body.items || [];
      totalPages = Number(body.totalPages) || 1;
      state.total = Number(body.totalCount) || state.total;

      const rows = items.map(mapSicItem).filter(Boolean) as any[][];
      for (let i = 0; i < rows.length; i += 250) {
        await upsertBatch(rows.slice(i, i + 250));
      }
      state.processed += items.length;
      pageNumber++;
    } while (pageNumber <= totalPages);
    console.log(`[SIC Sync] Cadastro: ${state.processed} cooperados. Buscando contratos...`);

    await syncSicContracts();

    await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value) VALUES ('sic_cooperados_last_sync', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [new Date().toISOString()]
    );
    console.log(`[SIC Sync] ✅ Cadastro e contratos de ${state.processed} cooperados sincronizados da API do SIC.`);
  } catch (e: any) {
    state.error = e.response?.status ? `HTTP ${e.response.status}` : e.message;
    console.error("[SIC Sync] ❌ Falha na sincronização de cooperados:", state.error);
  } finally {
    state.running = false;
    state.finishedAt = new Date().toISOString();
  }
  return getSicSyncState();
}

export function startSicCooperadosSyncWorker() {
  setTimeout(() => syncAllSicCooperados().catch(() => {}), 60 * 1000);
  setInterval(() => syncAllSicCooperados().catch(() => {}), AUTO_SYNC_INTERVAL_MS);
  console.log("[SIC Sync] 🕒 Sincronização automática de cooperados do SIC ativada (a cada 6h).");
}
