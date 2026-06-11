-- ============================================
-- SISTEMA DE RECARGA INTELIGENTE - SCHEMA SQL
-- Execute este arquivo no MySQL Workbench
-- ============================================

CREATE DATABASE IF NOT EXISTS recarga_inteligente
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE recarga_inteligente;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  credito DECIMAL(10,2) DEFAULT 0.00,
  plano VARCHAR(50) DEFAULT NULL,
  potencia_max DECIMAL(5,2) DEFAULT NULL,
  data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de recargas
CREATE TABLE IF NOT EXISTS recargas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  regiao VARCHAR(50) NOT NULL,
  local VARCHAR(100) NOT NULL,
  vaga VARCHAR(10) NOT NULL,
  energia_kwh DECIMAL(8,3) NOT NULL,
  custo DECIMAL(10,2) NOT NULL,
  potencia_real DECIMAL(6,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'concluida',
  data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabela de reservas
CREATE TABLE IF NOT EXISTS reservas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  regiao VARCHAR(50) NOT NULL,
  local VARCHAR(100) NOT NULL,
  vaga VARCHAR(10) NOT NULL,
  tempo_min INT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'ativa',
  data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabela de transações financeiras
CREATE TABLE IF NOT EXISTS transacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo ENUM('credito','debito','sistema') NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  descricao VARCHAR(255) NOT NULL,
  data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX idx_recargas_usuario ON recargas(usuario_id);
CREATE INDEX idx_reservas_usuario ON reservas(usuario_id);
CREATE INDEX idx_transacoes_usuario ON transacoes(usuario_id);

SELECT 'Banco de dados criado com sucesso!' AS status;
