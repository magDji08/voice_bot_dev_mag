-- ============================================================
-- VOICEBOT ADMINISTRATIF SENEGALAIS — Base de données MySQL
-- Compatible XAMPP (phpMyAdmin)
-- Importer dans phpMyAdmin : Import → choisir ce fichier
-- ============================================================

CREATE DATABASE IF NOT EXISTS voicebot_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE voicebot_db;

-- ── UTILISATEURS ──────────────────────────────────────────────
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(100)        NOT NULL,
  prenom      VARCHAR(100)        NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255)        NOT NULL,  -- bcrypt hash
  role        ENUM('admin','user') DEFAULT 'user',
  actif       BOOLEAN             DEFAULT TRUE,
  created_at  DATETIME            DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME            DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── SESSIONS DE CONVERSATION ──────────────────────────────────
CREATE TABLE conversations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  session_id  VARCHAR(100) NOT NULL UNIQUE,  -- UUID
  intent      VARCHAR(100),                  -- derniere intention detectee
  statut      ENUM('en_cours','terminee','abandonnee') DEFAULT 'en_cours',
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  ended_at    DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── MESSAGES DE CHAQUE CONVERSATION ───────────────────────────
CREATE TABLE messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT          NOT NULL,
  role            ENUM('user','assistant') NOT NULL,
  contenu_wolof   TEXT,         -- texte wolof (ASR ou saisi)
  contenu_fr      TEXT,         -- texte francais (traduction ou reponse)
  intent_detecte  VARCHAR(100),
  slots_json      JSON,         -- snapshot des slots au moment du message
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- ── DOCUMENTS GENERES (PDFs) ──────────────────────────────────
CREATE TABLE documents_generes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT          NOT NULL,
  user_id         INT          NOT NULL,
  type_document   ENUM('casier_judiciaire','extrait_naissance','certificat_residence'),
  nom_fichier     VARCHAR(255),
  chemin_fichier  VARCHAR(500),
  slots_json      JSON,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (user_id)         REFERENCES users(id)
);

-- ── FICHIERS UPLOADÉS PAR L'ADMIN ─────────────────────────────
CREATE TABLE knowledge_files (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  admin_id      INT          NOT NULL,
  nom_original  VARCHAR(255) NOT NULL,
  nom_stockage  VARCHAR(255) NOT NULL,  -- nom unique sur disque
  type_fichier  ENUM('pdf','image','texte','autre') DEFAULT 'autre',
  mime_type     VARCHAR(100),
  taille_bytes  INT,
  statut        ENUM('en_attente','traite','erreur') DEFAULT 'en_attente',
  contenu_extrait LONGTEXT,            -- texte extrait pour la KB
  chemin        VARCHAR(500),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- ── ENTRÉES DE LA KNOWLEDGE BASE ──────────────────────────────
CREATE TABLE knowledge_entries (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  file_id     INT,                     -- source (optionnel si saisie manuelle)
  admin_id    INT          NOT NULL,
  categorie   VARCHAR(100),            -- ex: casier, mairie, extrait
  question    TEXT         NOT NULL,
  reponse     TEXT         NOT NULL,
  langue      ENUM('fr','wo','fr_wo') DEFAULT 'fr',
  actif       BOOLEAN      DEFAULT TRUE,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id)  REFERENCES knowledge_files(id) ON DELETE SET NULL,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- ── INDEX POUR LES PERFORMANCES ───────────────────────────────
CREATE INDEX idx_conversations_user   ON conversations(user_id);
CREATE INDEX idx_messages_conv        ON messages(conversation_id);
CREATE INDEX idx_documents_user       ON documents_generes(user_id);
CREATE INDEX idx_knowledge_categorie  ON knowledge_entries(categorie);
CREATE INDEX idx_knowledge_actif      ON knowledge_entries(actif);

-- ── DONNÉES DE TEST ───────────────────────────────────────────
-- Mot de passe : "admin123" (bcrypt)
INSERT INTO users (nom, prenom, email, password, role) VALUES
('Gueye', 'Mamadou Absa', 'admin@voicebot.sn',
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaHGm7T1FKnHJzxCvG5XAi9Hy', 'admin');

-- Mot de passe : "user123" (bcrypt)
INSERT INTO users (nom, prenom, email, password, role) VALUES
('Diallo', 'Aminata', 'user@voicebot.sn',
 '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC.CLZwEm5/B5PlHRFuu', 'user');
