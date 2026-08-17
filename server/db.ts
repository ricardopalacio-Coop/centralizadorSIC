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
        token VARCHAR(255) NOT NULL UNIQUE,
        status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
        last_used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Seed do SuperAdmin Inicial
    const superAdminEmail = "ricardo.palacio@coopedu.com.br";
    const defaultPassword = "Odracir48@@@";
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
