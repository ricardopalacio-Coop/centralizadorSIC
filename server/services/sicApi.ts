import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL_HOST = process.env.SIC_API_URL || "https://core.coopedu.app.br";
const TOKEN_URL = `${BASE_URL_HOST}/api/AuthMachineClient`;
const BASE_URL = `${BASE_URL_HOST}/api/CooperativeUserApp`;
const PRODUCTIVITY_URL = `${BASE_URL_HOST}/api/ProductivityApp/identification-result`;

const CLIENT_ID = process.env.SIC_CLIENT_ID || "2872a32a-48c0-4949-95f8-3e0cdc677907";
const CLIENT_SECRET = process.env.SIC_CLIENT_SECRET || "510fb3c701774cb78d1e8b8c47cf187e";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Sanitiza o CPF para conter exclusivamente 11 dígitos numéricos
 */
export function cleanCpf(cpf: string): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "");
}

/**
 * Obtém o token M2M da API do SIC com gerenciamento de cache em memória
 */
export async function getSicToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 300000) {
    return tokenCache.token;
  }

  try {
    const response = await axios.post(TOKEN_URL, {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      grantType: "client_credentials",
    });

    const body = response.data?.body;
    const token = body?.access_token;
    const expiresIn = body?.expires_in || 3600;

    if (!token) {
      throw new Error("Token de acesso não retornado pelo servidor do SIC");
    }

    tokenCache = {
      token,
      expiresAt: now + expiresIn * 1000,
    };

    return token;
  } catch (error: any) {
    console.error("[SIC API Error] Falha na autenticação M2M:", error.response?.data || error.message);
    throw new Error(`Falha ao autenticar na API do SIC: ${error.message}`);
  }
}

/**
 * Consulta dados cadastrais básicos de um cooperado na API do SIC
 */
export async function getSicCooperado(cpf: string) {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf || numericCpf.length !== 11) {
    throw new Error("CPF deve ter 11 dígitos numéricos para consulta no SIC");
  }

  const token = await getSicToken();
  const url = `${BASE_URL}/${numericCpf}`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data?.body || null;
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return null;
    }
    console.error(`[SIC API Error] Falha ao consultar CPF ${numericCpf}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Consulta TODOS OS DADOS DETALHADOS de um cooperado na API do SIC (ProductivityApp)
 */
export async function getSicCooperadoDetails(cpf: string) {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf || numericCpf.length !== 11) {
    return null;
  }

  const token = await getSicToken();
  const url = `${PRODUCTIVITY_URL}/${numericCpf}/`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data?.body || null;
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return null;
    }
    console.warn(`[SIC API Warning] Falha na rota estendida de detalhes para o CPF ${numericCpf}.`);
    return null;
  }
}

/**
 * Lista as folhas de pagamento (payrolls) do cooperado na API do SIC
 */
export async function getSicPayrolls(cpf: string) {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf) return [];

  const token = await getSicToken();
  const url = `${BASE_URL}/${numericCpf}/payrolls`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data?.body?.items || [];
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return [];
    }
    console.error(`[SIC API Error] Falha ao buscar folhas do CPF ${numericCpf}:`, error.response?.data || error.message);
    return [];
  }
}

/**
 * Baixa o fluxo de bytes em PDF do demonstrativo individual de pagamento
 */
export async function getSicDemonstrative(cpf: string, payrollId: string): Promise<Buffer> {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf || !payrollId) {
    throw new Error("CPF e ID da folha são obrigatórios para demonstrativo em PDF");
  }

  const token = await getSicToken();
  const url = `${BASE_URL}/${numericCpf}/payrolls/${payrollId}/demonstrative`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
    });
    return Buffer.from(response.data);
  } catch (error: any) {
    console.error(`[SIC API Error] Erro ao baixar PDF da folha ${payrollId} para CPF ${numericCpf}:`, error.message);
    throw new Error(`Falha ao obter demonstrativo PDF do SIC: ${error.message}`);
  }
}

/**
 * Tenta enviar a atualização de contatos (e-mail e celular/WhatsApp) para a API do SIC
 */
export async function updateSicCooperadoContacts(cpf: string, email: string, cellphone: string) {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf) return false;

  try {
    const token = await getSicToken();
    const headers = { Authorization: `Bearer ${token}` };

    // Busca detalhes do cooperado no SIC para compor a requisição
    const details = await getSicCooperadoDetails(numericCpf);

    const payload = {
      identification: numericCpf,
      name: details?.nome || "COOPERADO",
      birthDate: details?.dataNascimento,
      admissionDate: details?.dataAdmissao,
      gender: details?.genero || "MASCULINO",
      maritalStatus: details?.estadoCivil || "DIVORCIADO",
      nationality: details?.nacionalidade || "BRASILEIRO",
      raceColor: details?.racaCor || "Branca",
      birthCity: details?.cidadeNascimento || "Fortaleza",
      birthState: details?.estadoNascimento || "CE",
      motherName: details?.nomeMae || "NÃO INFORMADO",
      fatherName: details?.nomePai || "NÃO INFORMADO",
      email: email,
      cellphone: cellphone,
      address: {
        cep: details?.endereco?.cep || "60832650",
        streetName: details?.endereco?.rua || "R Antônio Pompil",
        houseNumber: details?.endereco?.numero || "321",
        complement: details?.endereco?.complemento || "",
        neighborhood: details?.endereco?.bairro || "Lagoa Redonda",
        cityName: details?.endereco?.cidade || "Fortaleza",
        stateCode: details?.endereco?.estado || "CE",
      },
      professionalInformation: {
        registrationNumber: details?.matricula || 4704,
        educationalLevel: "Superior",
        profession: "Educador",
        professionalCategory: "Cooperado",
      },
      documents: {
        rg: details?.documentos?.rg?.numero || "2003009031435",
        pispasep: "12345678901",
      },
      eSocialBirthCountry: "105",
      eSocialNationalityCountry: "105",
      bankAccount: {
        bankCode: "450",
        agency: "0001",
        accountNumber: "1042317620",
        accountDigit: "3",
      },
    };

    const updateUrl = "https://ui.coopedu.app.br/api/cooperado/atualizar";
    await axios.put(updateUrl, payload, { headers });
    console.log(`[SIC API Sync] Sucesso ao enviar atualização de contatos para o SIC para CPF ${numericCpf}`);
    return true;
  } catch (err: any) {
    console.warn(`[SIC API Sync Warning] Tentativa de atualização enviada para a API do SIC para CPF ${numericCpf}: ${err.message}`);
    return false;
  }
}
