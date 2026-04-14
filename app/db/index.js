const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join('/app/data', 'db.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    init(db);
  }
  return db;
}

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS portfolio_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_texts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // Admin padrão
  const admin = db.prepare('SELECT id FROM admin WHERE id = 1').get();
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)').run('admin', hash);
  }

  // Textos padrão do site
  const defaults = [
    ['hero_tag', 'Fotografia'],
    ['hero_title', 'Seu Nome'],
    ['hero_sub', 'Capturando momentos que duram para sempre'],
    ['about_title', 'Sobre'],
    ['about_text', 'Fotógrafo apaixonado por contar histórias através das imagens. Com anos de experiência, especializado em retratos, casamentos e eventos.'],
    ['contact_title', 'Contato'],
    ['contact_email', 'contato@exemplo.com'],
    ['contact_phone', '(11) 99999-9999'],
    ['contact_instagram', '@seuperfil'],
  ];

  const insertText = db.prepare('INSERT OR IGNORE INTO site_texts (key, value) VALUES (?, ?)');
  for (const [key, value] of defaults) {
    insertText.run(key, value);
  }
}

module.exports = { getDb };
