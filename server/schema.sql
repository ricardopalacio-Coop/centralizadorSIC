-- Schema para o banco de dados dedicado centralizador_sic_db

CREATE DATABASE IF NOT EXISTS centralizador_sic_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE centralizador_sic_db;

-- Tabela de Usuários do Sistema (SuperAdmin e Usuários)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('SUPER_ADMIN', 'USER') NOT NULL DEFAULT 'USER',
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela Principal de Cooperados
CREATE TABLE IF NOT EXISTS cooperados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document VARCHAR(20) NOT NULL UNIQUE,
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
);

-- Tabela de Histórico de Uploads de Planilhas XLS
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
);
