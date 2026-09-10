import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3307", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "centralizador_sic_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Inicializa a estrutura do banco de dados dedicado centralizador_sic_db e cria o SuperAdmin inicial
 */
export async function initDb() {
  let attempts = 0;
  const maxAttempts = 10;
  let connected = false;

  while (attempts < maxAttempts && !connected) {
    attempts++;
    try {
      // 0. Garante que o banco centralizador_sic_db existe no MySQL
      const rootConnection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "3307", 10),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "root",
      });
      await rootConnection.query("CREATE DATABASE IF NOT EXISTS centralizador_sic_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
      await rootConnection.end();
      connected = true;
    } catch (err: any) {
      console.warn(`[DB Init Warning] Aguardando inicialização do MySQL (Tentativa ${attempts}/${maxAttempts})...`);
      if (attempts >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  try {
    const connection = await pool.getConnection();
    console.log("[DB] Conectado ao banco MySQL dedicado: centralizador_sic_db");

    // 1. Tabela users
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('SUPER_ADMIN', 'USER') NOT NULL DEFAULT 'USER',
        status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Tabela cooperados
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cooperados (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document VARCHAR(20) NOT NULL UNIQUE,
        sic_id VARCHAR(100) NULL,
        registration_number BIGINT NULL,
        name VARCHAR(255) NOT NULL,
        mother_name VARCHAR(255) NULL,
        father_name VARCHAR(255) NULL,
        birth_date DATE NULL,
        birth_city VARCHAR(100) NULL,
        birth_state VARCHAR(10) NULL,
        contract_name VARCHAR(255) NULL,
        position VARCHAR(255) NULL,
        admission_date DATE NULL,
        association_date DATE NULL,
        termination_date DATE NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Ativo',
        email VARCHAR(255) NULL,
        whatsapp_number VARCHAR(50) NULL,
        secondary_phone VARCHAR(50) NULL,
        street VARCHAR(255) NULL,
        number VARCHAR(50) NULL,
        complement VARCHAR(255) NULL,
        neighborhood VARCHAR(100) NULL,
        city VARCHAR(100) NULL,
        state VARCHAR(10) NULL,
        zip_code VARCHAR(20) NULL,
        bank_name VARCHAR(100) NULL,
        bank_code VARCHAR(20) NULL,
        agency VARCHAR(20) NULL,
        account_number VARCHAR(50) NULL,
        account_digit VARCHAR(10) NULL,
        account_type VARCHAR(50) NULL,
        pix_key VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_document (document),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query("ALTER TABLE cooperados ADD COLUMN sic_id VARCHAR(100) NULL AFTER document;");
    } catch (e) {}

    // 3. Tabela upload_logs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS upload_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        filename VARCHAR(255) NOT NULL,
        total_records INT NOT NULL DEFAULT 0,
        processed_records INT NOT NULL DEFAULT 0,
        found_sic INT NOT NULL DEFAULT 0,
        errors_count INT NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Tabela api_tokens
    await connection.query(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        token_hash VARCHAR(64) NULL,
        status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
        last_used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_token_hash (token_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query("ALTER TABLE api_tokens ADD COLUMN token_hash VARCHAR(64) NULL AFTER token;");
      await connection.query("ALTER TABLE api_tokens ADD INDEX idx_token_hash (token_hash);");
    } catch (e) {}

    // 5. Tabela cooperado_payrolls (Cache Resiliente de Folhas de Pagamento)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cooperado_payrolls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document VARCHAR(20) NOT NULL,
        payroll_id VARCHAR(255) NOT NULL,
        competence VARCHAR(50) NULL,
        year INT NULL,
        month INT NULL,
        client_name VARCHAR(255) NULL,
        contract_description VARCHAR(255) NULL,
        gross_value DECIMAL(10,2) NULL,
        net_value DECIMAL(10,2) NULL,
        payroll_status VARCHAR(50) NULL,
        raw_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_doc_payroll (document, payroll_id),
        INDEX idx_document (document)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Tabela fichas_cadastrais (Indexação e Extração do Google Drive)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS fichas_cadastrais (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_id VARCHAR(100) NOT NULL UNIQUE,
        file_name VARCHAR(255) NOT NULL,
        cooperado_name VARCHAR(255) NOT NULL,
        cpf VARCHAR(20) NULL,
        matricula VARCHAR(50) NULL,
        birth_date DATE NULL,
        contract_name VARCHAR(255) NULL,
        tipo ENUM('Ficha Manual', 'EasyCoop', 'Coopedu Interno', 'Outro') NOT NULL DEFAULT 'Outro',
        folder_id VARCHAR(100) NOT NULL,
        folder_name VARCHAR(100) NOT NULL,
        mime_type VARCHAR(100) DEFAULT 'application/pdf',
        file_size BIGINT NULL,
        drive_modified_time DATETIME NULL,
        web_view_link TEXT NULL,
        web_content_link TEXT NULL,
        ocr_status ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'UNREADABLE', 'FAILED') NOT NULL DEFAULT 'PENDING',
        error_message TEXT NULL,
        indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_file_id (file_id),
        INDEX idx_cpf (cpf),
        INDEX idx_matricula (matricula),
        INDEX idx_cooperado_name (cooperado_name),
        INDEX idx_tipo (tipo),
        INDEX idx_ocr_status (ocr_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query("ALTER TABLE fichas_cadastrais ADD COLUMN matricula VARCHAR(50) NULL AFTER cpf;");
    } catch (e) {}
    try {
      await connection.query("ALTER TABLE fichas_cadastrais ADD COLUMN birth_date DATE NULL AFTER matricula;");
    } catch (e) {}
    try {
      await connection.query("ALTER TABLE fichas_cadastrais ADD COLUMN contract_name VARCHAR(255) NULL AFTER birth_date;");
    } catch (e) {}

    // 6. Tabela fichas_desligamento (Indexação e Extração do Google Drive - Desligamentos)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS fichas_desligamento (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_id VARCHAR(100) NOT NULL UNIQUE,
        file_name VARCHAR(255) NOT NULL,
        cooperado_name VARCHAR(255) NOT NULL,
        cpf VARCHAR(20) NULL,
        matricula VARCHAR(50) NULL,
        birth_date DATE NULL,
        termination_date DATE NULL,
        contract_name VARCHAR(255) NULL,
        tipo VARCHAR(100) NOT NULL DEFAULT 'Desligamento',
        folder_id VARCHAR(100) NOT NULL,
        folder_name VARCHAR(100) NOT NULL,
        mime_type VARCHAR(100) DEFAULT 'application/pdf',
        file_size BIGINT NULL,
        drive_modified_time DATETIME NULL,
        web_view_link TEXT NULL,
        web_content_link TEXT NULL,
        ocr_status ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'UNREADABLE', 'FAILED') NOT NULL DEFAULT 'PENDING',
        error_message TEXT NULL,
        indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_file_id (file_id),
        INDEX idx_cpf (cpf),
        INDEX idx_matricula (matricula),
        INDEX idx_cooperado_name (cooperado_name),
        INDEX idx_tipo (tipo),
        INDEX idx_ocr_status (ocr_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query("ALTER TABLE fichas_desligamento ADD COLUMN matricula VARCHAR(50) NULL AFTER cpf;");
    } catch (e) {}
    try {
      await connection.query("ALTER TABLE fichas_desligamento ADD COLUMN birth_date DATE NULL AFTER matricula;");
    } catch (e) {}
    try {
      await connection.query("ALTER TABLE fichas_desligamento ADD COLUMN termination_date DATE NULL AFTER birth_date;");
    } catch (e) {}
    try {
      await connection.query("ALTER TABLE fichas_desligamento ADD COLUMN contract_name VARCHAR(255) NULL AFTER termination_date;");
    } catch (e) {}

    // 7. Tabelas EasyCoop Analytics (Contratos, Alocações, Documentos, Fechamentos, etc.)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS easycoop_contratos (
        cliente_id INT NOT NULL,
        contrato_id INT NOT NULL,
        numero_doc VARCHAR(50) NULL,
        tomador_nome VARCHAR(255) NOT NULL,
        tomador_razao VARCHAR(255) NULL,
        tomador_cnpj VARCHAR(20) NULL,
        contrato_descricao VARCHAR(255) NULL,
        endereco VARCHAR(255) NULL,
        bairro VARCHAR(100) NULL,
        cidade VARCHAR(100) NULL,
        uf VARCHAR(10) NULL,
        cep VARCHAR(20) NULL,
        telefone VARCHAR(50) NULL,
        contato_responsavel VARCHAR(100) NULL,
        data_inicio DATE NULL,
        data_fim DATE NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'S',
        perc_taxa_adm DECIMAL(10,2) NULL,
        valor_taxa_adm DECIMAL(10,2) NULL,
        dia_pagamento INT NULL,
        centro_custo VARCHAR(50) NULL,
        total_cooperados INT NOT NULL DEFAULT 0,
        cooperados_ativos INT NOT NULL DEFAULT 0,
        PRIMARY KEY (cliente_id, contrato_id),
        INDEX idx_tomador (tomador_nome),
        INDEX idx_num_doc (numero_doc)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS easycoop_alocacoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        matricula VARCHAR(20) NOT NULL,
        document VARCHAR(20) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        cliente_id INT NOT NULL,
        contrato_id INT NOT NULL,
        tomador_nome VARCHAR(255) NULL,
        contrato_descricao VARCHAR(255) NULL,
        contrato_numero VARCHAR(50) NULL,
        cargo VARCHAR(255) NULL,
        cbo VARCHAR(50) NULL,
        valor_base DECIMAL(10,2) NULL,
        horas VARCHAR(50) NULL,
        data_inicio DATE NULL,
        data_fim DATE NULL,
        status_alocacao VARCHAR(20) NOT NULL DEFAULT 'Ativo',
        INDEX idx_doc (document),
        INDEX idx_matricula (matricula),
        INDEX idx_contrato (cliente_id, contrato_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS easycoop_dependentes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        matricula VARCHAR(20) NOT NULL,
        document VARCHAR(20) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        cpf VARCHAR(20) NULL,
        sexo VARCHAR(5) NULL,
        data_nascimento DATE NULL,
        deduz_irrf VARCHAR(5) NULL,
        tem_convenio VARCHAR(5) NULL,
        INDEX idx_doc (document),
        INDEX idx_matricula (matricula)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS easycoop_documentos (
        id INT PRIMARY KEY,
        matricula VARCHAR(20) NOT NULL,
        document VARCHAR(20) NOT NULL,
        tipo_documento VARCHAR(255) NOT NULL,
        status VARCHAR(100) NULL,
        data_criacao DATE NULL,
        data_assinatura VARCHAR(50) NULL,
        finalizado TINYINT(1) NOT NULL DEFAULT 0,
        INDEX idx_doc (document),
        INDEX idx_matricula (matricula)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NULL,
        description TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS easycoop_fechamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        matricula VARCHAR(20) NOT NULL,
        document VARCHAR(20) NOT NULL,
        ano INT NOT NULL,
        mes INT NOT NULL,
        folha INT NOT NULL DEFAULT 1,
        tomador VARCHAR(255) NULL,
        valor_bruto DECIMAL(10,2) NOT NULL DEFAULT 0,
        valor_producao DECIMAL(10,2) NOT NULL DEFAULT 0,
        outros_creditos DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_descontos DECIMAL(10,2) NOT NULL DEFAULT 0,
        ajuda_custo DECIMAL(10,2) NOT NULL DEFAULT 0,
        inss DECIMAL(10,2) NOT NULL DEFAULT 0,
        irrf DECIMAL(10,2) NOT NULL DEFAULT 0,
        taxa_adm DECIMAL(10,2) NOT NULL DEFAULT 0,
        valor_liquido DECIMAL(10,2) NOT NULL DEFAULT 0,
        data_pagamento DATE NULL,
        comprovante_doc VARCHAR(50) NULL,
        INDEX idx_doc_ano_mes (document, ano, mes),
        INDEX idx_matricula (matricula)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migrações defensivas para easycoop_fechamentos existente
    const fechCols = [
      "ALTER TABLE easycoop_fechamentos ADD COLUMN valor_producao DECIMAL(10,2) DEFAULT 0.00;",
      "ALTER TABLE easycoop_fechamentos ADD COLUMN outros_creditos DECIMAL(10,2) DEFAULT 0.00;",
      "ALTER TABLE easycoop_fechamentos ADD COLUMN total_descontos DECIMAL(10,2) DEFAULT 0.00;",
    ];
    for (const sql of fechCols) {
      await connection.query(sql).catch(() => {});
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS easycoop_esocial (
        id INT AUTO_INCREMENT PRIMARY KEY,
        matricula VARCHAR(20) NULL,
        document VARCHAR(20) NOT NULL,
        competencia VARCHAR(10) NULL,
        ano INT NOT NULL,
        mes INT NOT NULL,
        evento VARCHAR(50) NOT NULL DEFAULT 'S-1200',
        protocolo VARCHAR(100) NULL,
        nro_protocolo VARCHAR(100) NULL,
        recibo VARCHAR(100) NULL,
        nro_recibo VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Aceito',
        enviado TINYINT NOT NULL DEFAULT 1,
        data_envio DATE NULL,
        hora_envio VARCHAR(10) NULL,
        erro_envio TEXT NULL,
        detalhes TEXT NULL,
        INDEX idx_doc (document),
        INDEX idx_comp (competencia),
        INDEX idx_doc_ano_mes (document, ano, mes)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migrações defensivas para easycoop_esocial existente
    const esocialCols = [
      "ALTER TABLE easycoop_esocial ADD COLUMN hora_envio VARCHAR(10) NULL;",
      "ALTER TABLE easycoop_esocial ADD COLUMN enviado TINYINT NOT NULL DEFAULT 1;",
      "ALTER TABLE easycoop_esocial ADD COLUMN nro_protocolo VARCHAR(100) NULL;",
      "ALTER TABLE easycoop_esocial ADD COLUMN nro_recibo VARCHAR(100) NULL;",
      "ALTER TABLE easycoop_esocial ADD COLUMN erro_envio TEXT NULL;",
      "ALTER TABLE cooperados ADD COLUMN cod_cat_trab_esocial VARCHAR(10) NOT NULL DEFAULT '731';",
    ];
    for (const sql of esocialCols) {
      await connection.query(sql).catch(() => {});
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS easycoop_lancamento_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        matricula VARCHAR(20) NULL,
        document VARCHAR(20) NOT NULL,
        ano INT NOT NULL,
        mes INT NOT NULL,
        folha INT NOT NULL DEFAULT 1,
        cod_lancamento VARCHAR(20) NULL,
        descricao VARCHAR(255) NULL,
        codigo_rubrica VARCHAR(20) NULL,
        descricao_rubrica VARCHAR(255) NULL,
        tipo VARCHAR(10) NOT NULL DEFAULT 'C',
        valor DECIMAL(12,2) NOT NULL DEFAULT 0,
        INDEX idx_doc_comp (document, ano, mes, folha)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const itemCols = [
      "ALTER TABLE easycoop_lancamento_itens ADD COLUMN cod_lancamento VARCHAR(20) NULL;",
      "ALTER TABLE easycoop_lancamento_itens ADD COLUMN descricao VARCHAR(255) NULL;",
      "ALTER TABLE easycoop_lancamento_itens MODIFY COLUMN tipo VARCHAR(10) NOT NULL DEFAULT 'C';",
      "ALTER TABLE easycoop_lancamento_itens MODIFY COLUMN valor DECIMAL(12,2) NOT NULL DEFAULT 0;",
    ];
    for (const sql of itemCols) {
      await connection.query(sql).catch(() => {});
    }

    // 4. Seed do SuperAdmin Inicial
    const superAdminEmail = process.env.INITIAL_ADMIN_EMAIL || "ricardo.palacio@coopedu.com.br";
    const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || "Odracir48@@@";
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    await connection.query(
      "INSERT IGNORE INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
      ["Ricardo Palacio (SuperAdmin)", superAdminEmail, passwordHash, "SUPER_ADMIN", "ACTIVE"]
    );
    console.log(`[DB] SuperAdmin verificado/cadastrado: ${superAdminEmail}`);

    connection.release();
  } catch (error) {
    console.error("[DB Error] Falha ao inicializar o banco centralizador_sic_db:", error);
    throw error;
  }
}
