import { google, drive_v3 } from "googleapis";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pool } from "../db";
import { FichaExtractorService, formatCPF } from "./fichaExtractorService";

export type FichaTipo = "Ficha Manual" | "EasyCoop" | "Coopedu Interno" | "Outro";

export interface FichaItem {
  id: string;
  name: string;
  cooperadoName: string;
  cpf?: string | null;
  modifiedTime: string;
  createdTime?: string;
  size?: number;
  mimeType: string;
  tipo: FichaTipo;
  folderId: string;
  folderName: string;
  webViewLink?: string;
  webContentLink?: string;
  ocrStatus?: "PENDING" | "PROCESSING" | "SUCCESS" | "UNREADABLE" | "FAILED";
}

export interface FichasMetrics {
  total: number;
  fichaManual: number;
  easyCoop: number;
  coopeduInterno: number;
  outros: number;
  comCpf: number;
  semCpf: number;
}

export interface SearchFichasParams {
  search?: string;
  tipo?: string;
  cpfStatus?: "all" | "with_cpf" | "without_cpf";
  sortBy?: "cooperadoName" | "modifiedTime" | "tipo" | "cpf";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ScanStatus {
  isScanning: boolean;
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  unreadableCount: number;
  errorCount: number;
  startTime: string | null;
  lastFinishedTime: string | null;
  currentFileName?: string;
  progressPercentage: number;
  error?: string;
}

export interface SearchFichasResult {
  items: FichaItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  metrics: FichasMetrics;
  lastSync: string | null;
  scanStatus: ScanStatus;
  status: {
    configured: boolean;
    authMethod: string;
    rootFolderId: string;
    foldersFound: { name: string; id: string; tipo: FichaTipo }[];
    error?: string;
  };
}

class GoogleDriveService {
  private driveClient: drive_v3.Drive | null = null;
  private authMethod: "service_account" | "api_key" | "oauth2" | "none" = "none";
  private rootFolderId: string;
  private lastSyncTime: Date | null = null;
  private isSyncing = false;
  private syncError: string | null = null;
  private mappedFolders: { name: string; id: string; tipo: FichaTipo }[] = [];

  private scanStatus: ScanStatus = {
    isScanning: false,
    totalFiles: 0,
    processedFiles: 0,
    successCount: 0,
    unreadableCount: 0,
    errorCount: 0,
    startTime: null,
    lastFinishedTime: null,
    progressPercentage: 0,
  };

  constructor() {
    this.rootFolderId =
      process.env.GOOGLE_DRIVE_FOLDER_ID || "1X_pCFmZNmj-EoGi-ltFf0lZWxZ6DPzLP";
    this.initClient();
  }

  public initClient(): boolean {
    try {
      this.rootFolderId =
        process.env.GOOGLE_DRIVE_FOLDER_ID || "1X_pCFmZNmj-EoGi-ltFf0lZWxZ6DPzLP";

      const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
      if (keyFilePath && fs.existsSync(keyFilePath)) {
        const auth = new google.auth.GoogleAuth({
          keyFile: keyFilePath,
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        });
        this.driveClient = google.drive({ version: "v3", auth });
        this.authMethod = "service_account";
        this.syncError = null;
        console.log("✅ Google Drive: Autenticado via Service Account Key File");
        return true;
      }

      const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
      if (credentialsJson) {
        try {
          const parsed = JSON.parse(credentialsJson);
          const auth = new google.auth.JWT({
            email: parsed.client_email,
            key: parsed.private_key,
            scopes: ["https://www.googleapis.com/auth/drive.readonly"],
          });
          this.driveClient = google.drive({ version: "v3", auth });
          this.authMethod = "service_account";
          this.syncError = null;
          console.log("✅ Google Drive: Autenticado via GOOGLE_CREDENTIALS_JSON");
          return true;
        } catch (e: any) {
          console.warn("⚠️ Falha ao parsear GOOGLE_CREDENTIALS_JSON:", e.message);
        }
      }

      const clientEmail =
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;

      if (clientEmail && privateKey) {
        privateKey = privateKey.replace(/\\n/g, "\n");
        const auth = new google.auth.JWT({
          email: clientEmail,
          key: privateKey,
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        });
        this.driveClient = google.drive({ version: "v3", auth });
        this.authMethod = "service_account";
        this.syncError = null;
        console.log("✅ Google Drive: Autenticado via Service Account Email/Key");
        return true;
      }

      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

      if (clientId && clientSecret && refreshToken) {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        this.driveClient = google.drive({ version: "v3", auth: oauth2Client });
        this.authMethod = "oauth2";
        this.syncError = null;
        console.log("✅ Google Drive: Autenticado via OAuth2 Refresh Token");
        return true;
      }

      const apiKey = process.env.GOOGLE_API_KEY;
      if (apiKey) {
        this.driveClient = google.drive({ version: "v3", auth: apiKey });
        this.authMethod = "api_key";
        this.syncError = null;
        console.log("✅ Google Drive: Configurado via Google API Key");
        return true;
      }

      this.driveClient = null;
      this.authMethod = "none";
      this.syncError = "Credenciais do Google Drive não configuradas no servidor.";
      return false;
    } catch (err: any) {
      console.error("❌ Erro ao inicializar cliente Google Drive:", err.message);
      this.syncError = err.message;
      this.driveClient = null;
      this.authMethod = "none";
      return false;
    }
  }

  private mapFolderNameAndType(folderName: string): FichaTipo {
    const normalized = folderName.toLowerCase().trim();

    if (normalized.includes("arquivo")) {
      return "Ficha Manual";
    }
    if (normalized.includes("assinacoop") || normalized.includes("assina")) {
      return "EasyCoop";
    }
    if (normalized.includes("gravata") || normalized.includes("gravat") || normalized.includes("interno")) {
      return "Coopedu Interno";
    }
    return "Outro";
  }

  public cleanCooperadoName(fileName: string): string {
    if (!fileName) return "Sem Nome";

    let clean = fileName.replace(/\.(pdf|png|jpg|jpeg|docx?|xlsx?)$/i, "");
    clean = clean.replace(/^(ficha\s*(cadastral|de\s*adesao|adesao)?[\s_-]*)/i, "");
    clean = clean.replace(/^(termo\s*(de\s*adesao)?[\s_-]*)/i, "");
    clean = clean.replace(/^(assinacoop[\s_-]*)/i, "");
    clean = clean.replace(/^(easycoop[\s_-]*)/i, "");
    clean = clean.replace(/^(coopedu[\s_-]*)/i, "");
    clean = clean.replace(/^(gravata[\s_-]*)/i, "");
    clean = clean.replace(/[\s_-]*(ficha|adesao|assinada|manual|digital)[\s_-]*$/i, "");
    clean = clean.replace(/[_-]+/g, " ");
    clean = clean.replace(/\s+/g, " ").trim();

    if (!clean) {
      clean = fileName.replace(/\.[^/.]+$/, "").trim();
    }

    return clean.toUpperCase();
  }

  public async discoverSubfolders(): Promise<{ name: string; id: string; tipo: FichaTipo }[]> {
    if (!this.driveClient) {
      throw new Error("Cliente Google Drive não inicializado.");
    }

    try {
      const q = "'" + this.rootFolderId + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
      const folderRes: any = await this.driveClient.files.list({
        q,
        fields: "files(id, name, modifiedTime)",
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const folders = folderRes.data.files || [];
      const mapped = folders.map((f: any) => ({
        name: f.name || "Sem Nome",
        id: f.id || "",
        tipo: this.mapFolderNameAndType(f.name || ""),
      }));

      this.mappedFolders = mapped;
      return mapped;
    } catch (err: any) {
      console.error("❌ Erro ao listar subpastas no Google Drive:", err.message);
      throw err;
    }
  }

  /**
   * Sincroniza metadados dos arquivos do Drive para a tabela MySQL fichas_cadastrais
   */
  public async syncMetadataToDb(): Promise<number> {
    if (!this.driveClient) {
      this.initClient();
      if (!this.driveClient) {
        throw new Error(this.syncError || "Google Drive não configurado.");
      }
    }

    console.log("🔄 Sincronizando catálogo de arquivos do Google Drive com o MySQL...");
    let subfolders = await this.discoverSubfolders();
    if (subfolders.length === 0) {
      subfolders = [{ name: "Raiz", id: this.rootFolderId, tipo: "Ficha Manual" }];
    }

    let totalDiscovered = 0;
    const connection = await pool.getConnection();

    try {
      for (const folder of subfolders) {
        let pageToken: string | undefined = undefined;

        do {
          const q = "'" + folder.id + "' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false";
          const fileRes: any = await this.driveClient.files.list({
            q,
            fields:
              "nextPageToken, files(id, name, modifiedTime, createdTime, size, mimeType, webViewLink, webContentLink)",
            pageSize: 1000,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });

          const files = fileRes.data.files || [];
          for (const file of files) {
            if (!file.id || !file.name) continue;

            const initialName = this.cleanCooperadoName(file.name);
            const driveModTime = file.modifiedTime ? new Date(file.modifiedTime) : new Date();

            await connection.query(
              `INSERT INTO fichas_cadastrais 
                (file_id, file_name, cooperado_name, tipo, folder_id, folder_name, mime_type, file_size, drive_modified_time, web_view_link, web_content_link, ocr_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
               ON DUPLICATE KEY UPDATE
                file_name = VALUES(file_name),
                folder_name = VALUES(folder_name),
                drive_modified_time = VALUES(drive_modified_time),
                web_view_link = VALUES(web_view_link),
                web_content_link = VALUES(web_content_link);`,
              [
                file.id,
                file.name,
                initialName,
                folder.tipo,
                folder.id,
                folder.name,
                file.mimeType || "application/pdf",
                file.size ? Number(file.size) : null,
                driveModTime,
                file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
                file.webContentLink || `https://drive.google.com/uc?export=download&id=${file.id}`,
              ]
            );

            totalDiscovered++;
          }

          pageToken = fileRes.data.nextPageToken || undefined;
        } while (pageToken);
      }

      this.lastSyncTime = new Date();
      return totalDiscovered;
    } finally {
      connection.release();
    }
  }

  /**
   * Retorna o status atual da varredura profunda
   */
  public getScanStatus(): ScanStatus {
    return { ...this.scanStatus };
  }

  /**
   * Dispara a varredura profunda e extração em lote em segundo plano
   */
  public startBackgroundScan(forceFullRescan = false): void {
    if (this.scanStatus.isScanning) {
      console.log("⚠️ Varredura já em andamento.");
      return;
    }

    // Dispara sem travar a requisição HTTP
    this.executeScanPipeline(forceFullRescan).catch((err) => {
      console.error("❌ Erro fatal na varredura profunda de fichas:", err);
      this.scanStatus.isScanning = false;
      this.scanStatus.error = err.message;
    });
  }

  /**
   * Execução da rotina de varredura profunda
   */
  private async executeScanPipeline(forceFullRescan: boolean): Promise<void> {
    this.scanStatus = {
      isScanning: true,
      totalFiles: 0,
      processedFiles: 0,
      successCount: 0,
      unreadableCount: 0,
      errorCount: 0,
      startTime: new Date().toISOString(),
      lastFinishedTime: null,
      progressPercentage: 0,
      error: undefined,
    };

    try {
      // 1. Garante que os metadados mais recentes do Drive estão no banco
      await this.syncMetadataToDb();

      // 2. Busca arquivos a processar
      const whereClause = forceFullRescan
        ? "WHERE mime_type = 'application/pdf'"
        : "WHERE (cpf IS NULL OR cpf = '' OR ocr_status IN ('PENDING', 'FAILED', 'UNREADABLE')) AND mime_type = 'application/pdf'";

      const [rows]: [any[], any] = await pool.query(
        `SELECT id, file_id, file_name, tipo FROM fichas_cadastrais ${whereClause} ORDER BY id ASC;`
      );

      this.scanStatus.totalFiles = rows.length;

      if (rows.length === 0) {
        console.log("✅ Todos os PDFs já foram processados e indexados.");
        this.scanStatus.isScanning = false;
        this.scanStatus.lastFinishedTime = new Date().toISOString();
        this.scanStatus.progressPercentage = 100;
        return;
      }

      console.log(`🚀 Iniciando extração profunda de ${rows.length} PDFs...`);

      // 3. Processamento em chunks concorrentes controlados (lote de 4 por vez)
      const CONCURRENCY = 4;
      for (let i = 0; i < rows.length; i += CONCURRENCY) {
        if (!this.scanStatus.isScanning) break; // Suporte a cancelamento

        const chunk = rows.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (row) => {
            this.scanStatus.currentFileName = row.file_name;
            try {
              // Baixa buffer do PDF direto da API do Drive
              const driveRes: any = await this.driveClient!.files.get(
                {
                  fileId: row.file_id,
                  alt: "media",
                  supportsAllDrives: true,
                },
                { responseType: "arraybuffer" }
              );

              const buffer = Buffer.from(driveRes.data);
              const extracted = await FichaExtractorService.parsePdfBuffer(buffer, row.file_name);

              const formattedCpf = formatCPF(extracted.cpf);
              const finalName = extracted.cooperadoName || this.cleanCooperadoName(row.file_name);

              await pool.query(
                `UPDATE fichas_cadastrais 
                 SET cooperado_name = ?, cpf = ?, ocr_status = ?, error_message = ?, indexed_at = NOW() 
                 WHERE file_id = ?;`,
                [
                  finalName,
                  formattedCpf,
                  extracted.status,
                  extracted.errorMessage || null,
                  row.file_id,
                ]
              );

              if (extracted.status === "SUCCESS") {
                this.scanStatus.successCount++;
              } else if (extracted.status === "UNREADABLE") {
                this.scanStatus.unreadableCount++;
              } else {
                this.scanStatus.errorCount++;
              }
            } catch (err: any) {
              console.warn(`⚠️ Erro ao processar arquivo ${row.file_name}:`, err.message);
              this.scanStatus.errorCount++;
              await pool.query(
                `UPDATE fichas_cadastrais SET ocr_status = 'FAILED', error_message = ? WHERE file_id = ?;`,
                [err.message, row.file_id]
              );
            } finally {
              this.scanStatus.processedFiles++;
              this.scanStatus.progressPercentage = Math.min(
                100,
                Math.round((this.scanStatus.processedFiles / this.scanStatus.totalFiles) * 100)
              );
            }
          })
        );
      }

      this.scanStatus.lastFinishedTime = new Date().toISOString();
      console.log(
        `🏁 Varredura concluída! Processados: ${this.scanStatus.processedFiles}/${this.scanStatus.totalFiles} | Sucesso: ${this.scanStatus.successCount} | Ilegíveis/Sem CPF: ${this.scanStatus.unreadableCount} | Falhas: ${this.scanStatus.errorCount}`
      );
    } catch (err: any) {
      this.scanStatus.error = err.message;
      throw err;
    } finally {
      this.scanStatus.isScanning = false;
      this.scanStatus.currentFileName = undefined;
    }
  }

  /**
   * Consulta e lista fichas cadastradas com paginação e busca por Nome, CPF e filtros
   */
  public async searchFichas(params: SearchFichasParams): Promise<SearchFichasResult> {
    const {
      search = "",
      tipo,
      cpfStatus = "all",
      sortBy = "modifiedTime",
      sortOrder = "desc",
      page = 1,
      pageSize = 30,
      dateFrom,
      dateTo,
    } = params;

    // Se a tabela estiver vazia, sincroniza automaticamente o catálogo básico
    const [countRows]: [any[], any] = await pool.query(
      "SELECT COUNT(*) as total FROM fichas_cadastrais;"
    );
    if (countRows[0]?.total === 0) {
      try {
        await this.syncMetadataToDb();
      } catch (e) {}
    }

    const whereClauses: string[] = ["1 = 1"];
    const queryParams: any[] = [];

    if (search.trim()) {
      const cleanDigits = search.replace(/\D/g, "");
      if (cleanDigits.length >= 4) {
        // Busca flexível de CPF com e sem formatação
        whereClauses.push(
          "(cooperado_name LIKE ? OR file_name LIKE ? OR cpf LIKE ? OR REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') LIKE ?)"
        );
        const searchPattern = `%${search.trim()}%`;
        const digitsPattern = `%${cleanDigits}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, digitsPattern);
      } else {
        whereClauses.push("(cooperado_name LIKE ? OR file_name LIKE ? OR cpf LIKE ?)");
        const searchPattern = `%${search.trim()}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }
    }

    if (tipo && tipo !== "Todos") {
      whereClauses.push("tipo = ?");
      queryParams.push(tipo);
    }

    if (cpfStatus === "with_cpf") {
      whereClauses.push("(cpf IS NOT NULL AND cpf != '')");
    } else if (cpfStatus === "without_cpf") {
      whereClauses.push("(cpf IS NULL OR cpf = '')");
    }

    if (dateFrom) {
      whereClauses.push("drive_modified_time >= ?");
      queryParams.push(new Date(dateFrom));
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      whereClauses.push("drive_modified_time <= ?");
      queryParams.push(toDate);
    }

    const whereSql = whereClauses.join(" AND ");

    // Valida ordenação
    let sortColumn = "drive_modified_time";
    if (sortBy === "cooperadoName") sortColumn = "cooperado_name";
    else if (sortBy === "tipo") sortColumn = "tipo";
    else if (sortBy === "cpf") sortColumn = "cpf";
    else if (sortBy === "modifiedTime") sortColumn = "drive_modified_time";

    const sortDir = sortOrder === "asc" ? "ASC" : "DESC";

    // Contagem filtrada
    const [totalRows]: [any[], any] = await pool.query(
      `SELECT COUNT(*) as filteredTotal FROM fichas_cadastrais WHERE ${whereSql};`,
      queryParams
    );
    const totalCount = Number(totalRows[0]?.filteredTotal || 0);

    const safePageSize = Math.max(1, Number(pageSize) || 30);
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const offset = (safePage - 1) * safePageSize;

    // Busca registros paginados
    const [dbRows]: [any[], any] = await pool.query(
      `SELECT id, file_id, file_name, cooperado_name, cpf, tipo, folder_id, folder_name,
              mime_type, file_size, drive_modified_time, web_view_link, web_content_link, ocr_status
       FROM fichas_cadastrais
       WHERE ${whereSql}
       ORDER BY ${sortColumn} ${sortDir}
       LIMIT ? OFFSET ?;`,
      [...queryParams, safePageSize, offset]
    );

    const items: FichaItem[] = dbRows.map((r: any) => ({
      id: r.file_id,
      name: r.file_name,
      cooperadoName: r.cooperado_name,
      cpf: r.cpf,
      modifiedTime: r.drive_modified_time
        ? new Date(r.drive_modified_time).toISOString()
        : new Date().toISOString(),
      size: r.file_size ? Number(r.file_size) : undefined,
      mimeType: r.mime_type || "application/pdf",
      tipo: r.tipo,
      folderId: r.folder_id,
      folderName: r.folder_name,
      webViewLink: r.web_view_link,
      webContentLink: r.web_content_link,
      ocrStatus: r.ocr_status,
    }));

    // Métricas globais
    const [metricRows]: [any[], any] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN tipo = 'Ficha Manual' THEN 1 END) as fichaManual,
        COUNT(CASE WHEN tipo = 'EasyCoop' THEN 1 END) as easyCoop,
        COUNT(CASE WHEN tipo = 'Coopedu Interno' THEN 1 END) as coopeduInterno,
        COUNT(CASE WHEN tipo = 'Outro' THEN 1 END) as outros,
        COUNT(CASE WHEN cpf IS NOT NULL AND cpf != '' THEN 1 END) as comCpf,
        COUNT(CASE WHEN cpf IS NULL OR cpf = '' THEN 1 END) as semCpf
      FROM fichas_cadastrais;
    `);

    const m = metricRows[0] || {};
    const metrics: FichasMetrics = {
      total: Number(m.total || 0),
      fichaManual: Number(m.fichaManual || 0),
      easyCoop: Number(m.easyCoop || 0),
      coopeduInterno: Number(m.coopeduInterno || 0),
      outros: Number(m.outros || 0),
      comCpf: Number(m.comCpf || 0),
      semCpf: Number(m.semCpf || 0),
    };

    return {
      items,
      totalCount,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
      metrics,
      lastSync: this.lastSyncTime ? this.lastSyncTime.toISOString() : null,
      scanStatus: this.getScanStatus(),
      status: this.getStatus(),
    };
  }

  public async getDownloadStream(
    fileId: string
  ): Promise<{ stream: Readable; name: string; mimeType: string; size?: number }> {
    if (!this.driveClient) {
      this.initClient();
      if (!this.driveClient) {
        throw new Error("Cliente Google Drive não inicializado.");
      }
    }

    const metaRes: any = await this.driveClient.files.get({
      fileId,
      fields: "id, name, mimeType, size",
      supportsAllDrives: true,
    });

    const fileMeta = metaRes.data;
    const fileName = fileMeta.name || ("ficha_" + fileId + ".pdf");
    const mimeType = fileMeta.mimeType || "application/pdf";
    const size = fileMeta.size ? Number(fileMeta.size) : undefined;

    const downloadRes: any = await this.driveClient.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "stream" }
    );

    return {
      stream: downloadRes.data as unknown as Readable,
      name: fileName,
      mimeType,
      size,
    };
  }

  /**
   * Atualiza manualmente Nome do Cooperado e/ou CPF de uma Ficha Cadastral
   */
  public async updateFicha(
    fileId: string,
    cooperadoName: string,
    cpf?: string | null
  ): Promise<FichaItem | null> {
    const formattedCpf = cpf ? formatCPF(cpf) : null;
    const cleanName = cooperadoName?.trim().toUpperCase() || "SEM NOME";

    await pool.query(
      `UPDATE fichas_cadastrais 
       SET cooperado_name = ?, 
           cpf = ?, 
           ocr_status = CASE WHEN ? != '' AND ? IS NOT NULL THEN 'SUCCESS' ELSE ocr_status END, 
           indexed_at = NOW() 
       WHERE file_id = ?;`,
      [cleanName, formattedCpf, formattedCpf, formattedCpf, fileId]
    );

    const [rows]: [any[], any] = await pool.query(
      `SELECT id, file_id, file_name, cooperado_name, cpf, tipo, folder_id, folder_name,
              mime_type, file_size, drive_modified_time, web_view_link, web_content_link, ocr_status
       FROM fichas_cadastrais
       WHERE file_id = ?;`,
      [fileId]
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.file_id,
      name: r.file_name,
      cooperadoName: r.cooperado_name,
      cpf: r.cpf,
      modifiedTime: r.drive_modified_time
        ? new Date(r.drive_modified_time).toISOString()
        : new Date().toISOString(),
      size: r.file_size ? Number(r.file_size) : undefined,
      mimeType: r.mime_type || "application/pdf",
      tipo: r.tipo,
      folderId: r.folder_id,
      folderName: r.folder_name,
      webViewLink: r.web_view_link,
      webContentLink: r.web_content_link,
      ocrStatus: r.ocr_status,
    };
  }

  public getStatus() {
    return {
      configured: this.authMethod !== "none" && !this.syncError,
      authMethod: this.authMethod,
      rootFolderId: this.rootFolderId,
      foldersFound: this.mappedFolders,
      lastSync: this.lastSyncTime ? this.lastSyncTime.toISOString() : null,
      isSyncing: this.isSyncing,
      error: this.syncError || undefined,
    };
  }
}

export const googleDriveService = new GoogleDriveService();
