import axios from "axios";
import { execSync } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pool } from "../db";
import { getAuthenticatedSicSession } from "./sicBrowserAutomation";

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

let lastFailTime = 0;

/**
 * Obtém o token M2M da API do SIC com gerenciamento de cache em memória e fallback ultrarrápido
 */
export async function getSicToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 300000) {
    return tokenCache.token;
  }

  if (now - lastFailTime < 60000) {
    throw new Error("Servidor M2M do SIC indisponível/timeout recente");
  }

  try {
    const response = await axios.post(
      TOKEN_URL,
      {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        grantType: "client_credentials",
      },
      { timeout: 1500 }
    );

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
    lastFailTime = Date.now();
    // Log silencioso indicando a ativacao do modo resiliente
    throw new Error(`Falha ao autenticar na API do SIC: ${error.message}`);
  }
}

/**
 * Consulta dados cadastrais básicos de um cooperado na API do SIC
 */
export async function getSicCooperado(cpf: string) {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf || numericCpf.length !== 11) {
    return null;
  }

  try {
    const token = await getSicToken();
    const url = `${BASE_URL}/${numericCpf}`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    return response.data?.body || null;
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return null;
    }
    console.error(`[SIC API Warning] Falha ao consultar CPF ${numericCpf} no SIC oficial:`, error.message);
    return null;
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

  try {
    const token = await getSicToken();
    const url = `${PRODUCTIVITY_URL}/${numericCpf}/`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    return response.data?.body || null;
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return null;
    }
    console.warn(`[SIC API Warning] Falha na rota estendida de detalhes para o CPF ${numericCpf}:`, error.message);
    return null;
  }
}

/**
 * Lista as folhas de pagamento (payrolls) do cooperado na API do SIC com fallback resiliente no MySQL
 */
export async function getSicPayrolls(cpf: string) {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf) return [];

  let remoteItems: any[] = [];
  try {
    const token = await getSicToken();
    const url = `${BASE_URL}/${numericCpf}/payrolls`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    remoteItems = response.data?.body?.items || response.data?.items || [];
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      remoteItems = [];
    } else {
      console.info(`[SIC M2M Resiliência] M2M em timeout/manutenção. Ativando cache local do MySQL para CPF ${numericCpf}.`);
    }
  }

  // Se a API M2M retornou folhas remotas, salva no banco local MySQL para resiliência
  if (remoteItems.length > 0) {
    try {
      for (const item of remoteItems) {
        const pId = item.payrollId || item.id || `payroll-${item.year}-${item.month}`;
        const comp = item.competence || `${item.year}-${String(item.month).padStart(2, "0")}`;
        await pool.query(
          `INSERT INTO cooperado_payrolls 
            (document, payroll_id, competence, year, month, client_name, contract_description, gross_value, net_value, payroll_status, raw_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            competence = VALUES(competence),
            gross_value = VALUES(gross_value),
            net_value = VALUES(net_value),
            payroll_status = VALUES(payroll_status),
            raw_json = VALUES(raw_json)`,
          [
            numericCpf,
            pId,
            comp,
            item.year || null,
            item.month || null,
            item.clientName || null,
            item.contractDescription || null,
            item.grossValue || 0,
            item.netValue || 0,
            item.payrollStatus || "Pago",
            JSON.stringify(item),
          ]
        );
      }
    } catch (dbErr: any) {
      console.warn("[DB Payroll Cache Warning] Falha ao salvar folhas no MySQL:", dbErr.message);
    }
    return remoteItems;
  }

  // 2. Consulta os pagamentos reais diretamente no Portal UI do SIC (ui.coopedu.app.br)
  try {
    const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
    const headers = { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader };

    // Resolve o ID do cooperado no portal
    let targetCoopId: string | null = null;
    const [cRows] = await pool.query<any[]>("SELECT sic_id FROM cooperados WHERE document = ? LIMIT 1", [numericCpf]);
    if (cRows?.[0]?.sic_id) {
      targetCoopId = cRows[0].sic_id;
    }

    if (!targetCoopId) {
      const sRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=10`, { headers, timeout: 6000 });
      const rawList = sRes.data?.body?.items || sRes.data?.items || [];
      const matched = rawList.find((it: any) => cleanCpf(it.documents?.identification || it.cpf || it.document) === numericCpf);
      if (matched?.id) {
        targetCoopId = matched.id;
      }
    }

    if (targetCoopId) {
      const payRes = await axios.get(`https://ui.coopedu.app.br/api/cooperado/${targetCoopId}/financeiro/pagamentos?pageNumber=1&pageSize=50`, { headers, timeout: 6000 });
      const payList = payRes.data?.body?.items || payRes.data?.items || [];
      if (Array.isArray(payList) && payList.length > 0) {
        const mappedList = payList.map((p: any) => {
          const comp = p.competence || `${p.year}-${String(p.month).padStart(2, "0")}`;
          const pId = p.payrollId || p.paymentId || `payroll-${p.year}-${p.month}`;
          return {
            payrollId: pId,
            paymentId: p.paymentId,
            competence: comp,
            year: p.year || Number(String(comp).split("/")[1]) || 2026,
            month: p.month || Number(String(comp).split("/")[0]) || 1,
            clientName: p.clientName || p.tomador || "COOPEDU",
            contractDescription: p.contractDescription || p.contractName || "CONTRATO SIC",
            grossValue: Number(p.grossValue || p.valorBruto || 0),
            netValue: Number(p.netValue || p.valorLiquido || 0),
            payrollStatus: p.paymentStatus || p.status || "Pago",
            payrollType: p.payrollTypeLabel || "Produtividade / Repasse",
          };
        });

        // Salva as folhas reais no cache local do MySQL
        for (const item of mappedList) {
          await pool.query(
            `INSERT INTO cooperado_payrolls 
              (document, payroll_id, competence, year, month, client_name, contract_description, gross_value, net_value, payroll_status, raw_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              competence = VALUES(competence),
              gross_value = VALUES(gross_value),
              net_value = VALUES(net_value),
              payroll_status = VALUES(payroll_status),
              raw_json = VALUES(raw_json)`,
            [
              numericCpf,
              item.payrollId,
              item.competence,
              item.year,
              item.month,
              item.clientName,
              item.contractDescription,
              item.grossValue,
              item.netValue,
              item.payrollStatus,
              JSON.stringify(item),
            ]
          ).catch(() => {});
        }

        return mappedList;
      }
    }
  } catch (e: any) {
    console.warn(`[SIC Portal Payrolls Warning] Falha ao consultar pagamentos no Portal UI:`, e.message);
  }

  // 3. Fallback Resiliente: se as APIs falharam, busca as folhas salvas no banco local MySQL
  try {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM cooperado_payrolls WHERE document = ? ORDER BY year DESC, month DESC",
      [numericCpf]
    );
    if (rows && rows.length > 0) {
      console.log(`[DB Payroll Cache] Carregadas ${rows.length} folha(s) do banco local para CPF ${numericCpf}`);
      return rows.map((r: any) => {
        if (r.raw_json) {
          try {
            return typeof r.raw_json === "string" ? JSON.parse(r.raw_json) : r.raw_json;
          } catch (e) {}
        }
        return {
          payrollId: r.payroll_id,
          competence: r.competence,
          year: r.year,
          month: r.month,
          clientName: r.client_name,
          contractDescription: r.contract_description,
          grossValue: r.gross_value,
          netValue: r.net_value,
          payrollStatus: r.payroll_status,
        };
      });
    }
  } catch (e) {}

  return [];
}

/**
 * Filtra as páginas do PDF oficial para manter EXCLUSIVAMENTE a página do cooperado selecionado
 */
export async function filterPdfPagesByCpf(pdfBuffer: Buffer, cpf: string): Promise<Buffer> {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf || numericCpf.length !== 11) return pdfBuffer;

  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempIn = path.join(process.cwd(), `tmp_in_${uniqueId}.pdf`);
  const tempOut = path.join(process.cwd(), `tmp_out_${uniqueId}.pdf`);
  const scriptPath = path.join(process.cwd(), `tmp_script_${uniqueId}.py`);

  let logoPath = path.join(process.cwd(), "server", "assets", "logo-coopedu-horizontal-azul.png");
  if (!fs.existsSync(logoPath)) {
    logoPath = "C:\\Users\\ricar\\Downloads\\Coopedu\\logo-coopedu-horizontal azul.png";
  }

  try {
    fs.writeFileSync(tempIn, pdfBuffer);

    const pyCode = `
import sys, pypdf

pdf_in = r"${tempIn.replace(/\\/g, "/")}"
pdf_out = r"${tempOut.replace(/\\/g, "/")}"
cpf_num = "${numericCpf}"
cpf_fmt = f"{cpf_num[:3]}.{cpf_num[3:6]}.{cpf_num[6:9]}-{cpf_num[9:]}"

reader = pypdf.PdfReader(pdf_in)
writer = pypdf.PdfWriter()

pages_matched = []

for page in reader.pages:
    txt = page.extract_text() or ""
    if cpf_num in txt or cpf_fmt in txt:
        y_positions = []
        def visitor(text, cm, tm, fontDict, fontSize):
            actual_y = cm[5] + tm[5]
            t = text.strip()
            if cpf_num in t or cpf_fmt in t:
                y_positions.append(actual_y)
        page.extract_text(visitor_text=visitor)
        pages_matched.append((page, y_positions))

if pages_matched:
    for page, y_positions in pages_matched:
        height = float(page.mediabox.height)
        width = float(page.mediabox.width)
        mid_y = height / 2.0

        txt = page.extract_text() or ""
        count_header = txt.count("Demonstrativo de Produtividade") + txt.count("Demonstrativo de Pagamento")

        avg_y = sum(y_positions) / len(y_positions) if y_positions else 200.0

        if count_header > 1:
            if avg_y > mid_y:
                top_y = 842.0
                bottom_y = 450.0
            else:
                top_y = 468.0
                bottom_y = 65.0 # Espaço limpo abaixo da Assinatura, removendo Impresso em: (82.0) e Página 2 / 2 (83.0)
        else:
            top_y = 842.0
            bottom_y = 65.0

        page.cropbox.lower_left = (0, bottom_y)
        page.cropbox.upper_right = (width, top_y)

        writer.add_page(page)

    with open(pdf_out, "wb") as f:
        writer.write(f)
`;

    fs.writeFileSync(scriptPath, pyCode);

    try {
      execSync(`python3 "${scriptPath}" || python "${scriptPath}"`, { stdio: "pipe" });
    } catch (e: any) {}

    if (fs.existsSync(tempOut) && fs.statSync(tempOut).size > 0) {
      const croppedPdfBytes = fs.readFileSync(tempOut);

      // Aplicar customização de logo azul (50% menor) e título em negrito via pdf-lib no topo da caixa recortada
      try {
        const pdfDoc = await PDFDocument.load(croppedPdfBytes);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const pages = pdfDoc.getPages();
        if (pages.length > 0) {
          const firstPage = pages[0];
          const { width, height } = firstPage.getSize();

          // Limpar área do topo para aplicar o novo design
          firstPage.drawRectangle({
            x: 30,
            y: height - 42,
            width: width - 60,
            height: 40,
            color: rgb(1, 1, 1),
          });

          // Incorporar a logo azul horizontal (50% menor: width 60, height 18)
          if (fs.existsSync(logoPath)) {
            const logoBytes = fs.readFileSync(logoPath);
            const logoImage = await pdfDoc.embedPng(logoBytes);
            firstPage.drawImage(logoImage, {
              x: 40,
              y: height - 32,
              width: 60,
              height: 18,
            });
          }

          // Desenhar Título em negrito
          firstPage.drawText("Demonstrativo de Produtividade", {
            x: 135,
            y: height - 28,
            size: 15,
            font: boldFont,
            color: rgb(0, 0, 0),
          });

          const finalPdfBytes = await pdfDoc.save();
          console.log(`[SIC API PDF Filter] PDF customizado com sucesso para CPF ${numericCpf}: ${finalPdfBytes.length} bytes`);
          return Buffer.from(finalPdfBytes);
        }
      } catch (pdfLibErr: any) {
        console.warn(`[SIC API PDF Filter Warning] Erro no pdf-lib:`, pdfLibErr.message);
      }

      return croppedPdfBytes;
    }
  } catch (err: any) {
    console.warn(`[SIC API PDF Filter Warning] Não foi possível filtrar/recortar o PDF por CPF:`, err.message);
  } finally {
    if (fs.existsSync(tempIn)) try { fs.unlinkSync(tempIn); } catch (e) {}
    if (fs.existsSync(tempOut)) try { fs.unlinkSync(tempOut); } catch (e) {}
    if (fs.existsSync(scriptPath)) try { fs.unlinkSync(scriptPath); } catch (e) {}
  }

  return pdfBuffer;
}

/**
 * Baixa o fluxo de bytes em PDF do demonstrativo individual de pagamento do cooperado
 */
export async function getSicDemonstrative(cpf: string, payrollId: string, cooperativeUserId?: string): Promise<Buffer> {
  const numericCpf = cleanCpf(cpf);
  if (!numericCpf || !payrollId) {
    throw new Error("CPF e ID da folha são obrigatórios para demonstrativo em PDF");
  }

  try {
    const { jwtToken, cookieHeader } = await getAuthenticatedSicSession();
    const headers = { Authorization: `Bearer ${jwtToken}`, Cookie: cookieHeader };

    // 1. Resolver o ID do cooperado no SIC (sic_id / cooperativeUserId)
    let coopId = cooperativeUserId;
    if (!coopId) {
      try {
        const [rows] = await pool.query<any[]>(
          "SELECT sic_id FROM cooperados WHERE document = ? LIMIT 1",
          [numericCpf]
        );
        if (rows?.[0]?.sic_id) {
          coopId = rows[0].sic_id;
        }
      } catch (e: any) {}
    }

    if (!coopId) {
      try {
        const searchRes = await axios.get(
          `https://ui.coopedu.app.br/api/cooperado/listar?search=${numericCpf}&pageNumber=1&pageSize=10`,
          { headers, timeout: 8000 }
        );
        const items = searchRes.data?.body?.items || searchRes.data?.items || searchRes.data?.cooperados || [];
        const found = items.find((i: any) => cleanCpf(i.documents?.identification || i.document || i.cpf) === numericCpf);
        if (found?.id) {
          coopId = found.id;
          pool.query("UPDATE cooperados SET sic_id = ? WHERE document = ?", [coopId, numericCpf]).catch(() => {});
        }
      } catch (e: any) {}
    }

    // 2. Monta a rota oficial do demonstrativo individual exclusivo do cooperado
    const downloadBlobUrl = "https://ui.coopedu.app.br/api/download-blob";
    const reportPath = coopId
      ? `/PayrollDocuments/${payrollId}/individual-productivity-report?cooperativeUserId=${coopId}`
      : `/PayrollDocuments/${payrollId}/individual-productivity-report`;

    console.log(`[SIC API Request] Baixando demonstrativo individual oficial via path: ${reportPath}`);

    const res = await axios.post(downloadBlobUrl, { path: reportPath }, {
      headers,
      responseType: "arraybuffer",
      timeout: 15000,
    });

    if (res.data && res.data.length > 0) {
      const rawBuffer = Buffer.from(res.data);

      // 3. Ajusta o enquadramento estético do demonstrativo individual via pdf-lib
      try {
        const pdfDoc = await PDFDocument.load(rawBuffer);
        const pages = pdfDoc.getPages();
        if (pages.length > 0) {
          const page = pages[0];
          const { width, height } = page.getSize();
          // O demonstrativo oficial ocupa a metade superior do A4 (Y de ~445 até height)
          // Mantém cabeçalho original, logo, título e a linha de assinatura com margem limpa
          if (height >= 800) {
            page.setCropBox(0, 445, width, height - 445);
            const formattedBytes = await pdfDoc.save();
            console.log(`[SIC API Success] PDF Demonstrativo individual oficial formatado com sucesso (${formattedBytes.length} bytes)`);
            return Buffer.from(formattedBytes);
          }
        }
      } catch (cropErr: any) {
        console.warn(`[getSicDemonstrative] Aviso na formatação estética do PDF:`, cropErr.message);
      }

      return rawBuffer;
    }
  } catch (err: any) {
    console.error(`[SIC API Error] Falha na rota download-blob da API do SIC para folha ${payrollId}:`, err.message);
    throw new Error(`Falha ao baixar o PDF genuíno do Demonstrativo na API do SIC: ${err.message}`);
  }

  throw new Error("Não foi possível obter o PDF oficial do Demonstrativo na API do SIC.");
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
