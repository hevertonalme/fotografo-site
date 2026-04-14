const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const UPLOADS = '/app/uploads';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(UPLOADS, 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}_tmp`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Apenas imagens'));
    cb(null, true);
  },
});

async function savePhoto(tmpPath, dir, filename) {
  fs.mkdirSync(dir, { recursive: true });
  const webPath = path.join(dir, filename);
  const thumbPath = path.join(dir, 'thumb_' + filename);

  await sharp(tmpPath).resize(2400, 2400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(webPath);
  await sharp(tmpPath).resize(600, 600, { fit: 'cover' }).jpeg({ quality: 75 }).toFile(thumbPath);

  fs.unlinkSync(tmpPath);
  return filename;
}

// ── CLIENTES ──────────────────────────────────────────────
router.get('/clients', requireAdmin, (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*, COUNT(cp.id) as photo_count
    FROM clients c
    LEFT JOIN client_photos cp ON cp.client_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(clients);
});

router.post('/clients', requireAdmin, (req, res) => {
  const { name, slug, password, expires_at } = req.body;
  if (!name || !slug || !password || !expires_at) return res.status(400).json({ error: 'Campos obrigatórios' });

  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO clients (name, slug, password_hash, expires_at) VALUES (?, ?, ?, ?)').run(name, slug, hash, expires_at);
    res.json({ id: result.lastInsertRowid });
  } catch {
    res.status(400).json({ error: 'Slug já em uso' });
  }
});

router.put('/clients/:id', requireAdmin, (req, res) => {
  const { name, slug, password, expires_at } = req.body;
  const db = getDb();
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE clients SET name=?, slug=?, password_hash=?, expires_at=? WHERE id=?').run(name, slug, hash, expires_at, req.params.id);
  } else {
    db.prepare('UPDATE clients SET name=?, slug=?, expires_at=? WHERE id=?').run(name, slug, expires_at, req.params.id);
  }
  res.json({ ok: true });
});

router.delete('/clients/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const dir = path.join(UPLOADS, 'clients', req.params.id);
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  res.json({ ok: true });
});

// ── FOTOS DO CLIENTE ──────────────────────────────────────
router.get('/clients/:id/photos', requireAdmin, (req, res) => {
  const db = getDb();
  const photos = db.prepare('SELECT * FROM client_photos WHERE client_id = ? ORDER BY id ASC').all(req.params.id);
  res.json(photos);
});

router.post('/clients/:id/photos', requireAdmin, upload.array('photos', 100), async (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const dir = path.join(UPLOADS, 'clients', req.params.id);
  const insert = db.prepare('INSERT INTO client_photos (client_id, filename, original_name) VALUES (?, ?, ?)');

  const saved = [];
  for (const file of req.files) {
    const filename = `${uuidv4()}.jpg`;
    try {
      await savePhoto(file.path, dir, filename);
      insert.run(req.params.id, filename, file.originalname);
      saved.push(filename);
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.error(`Erro ao processar ${file.originalname}:`, err.message);
    }
  }

  res.json({ saved: saved.length });
});

router.delete('/clients/:clientId/photos/:photoId', requireAdmin, (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT * FROM client_photos WHERE id = ? AND client_id = ?').get(req.params.photoId, req.params.clientId);
  if (!photo) return res.status(404).json({ error: 'Foto não encontrada' });

  const dir = path.join(UPLOADS, 'clients', req.params.clientId);
  const webFile = path.join(dir, photo.filename);
  const thumbFile = path.join(dir, 'thumb_' + photo.filename);
  if (fs.existsSync(webFile)) fs.unlinkSync(webFile);
  if (fs.existsSync(thumbFile)) fs.unlinkSync(thumbFile);

  db.prepare('DELETE FROM client_photos WHERE id = ?').run(req.params.photoId);
  res.json({ ok: true });
});

// ── PORTFÓLIO ─────────────────────────────────────────────
router.get('/portfolio', requireAdmin, (req, res) => {
  const db = getDb();
  const photos = db.prepare('SELECT * FROM portfolio_photos ORDER BY display_order ASC, id ASC').all();
  res.json(photos);
});

router.post('/portfolio', requireAdmin, upload.array('photos', 50), async (req, res) => {
  const dir = path.join(UPLOADS, 'portfolio');
  const db = getDb();
  const insert = db.prepare('INSERT INTO portfolio_photos (filename, original_name) VALUES (?, ?)');

  const saved = [];
  for (const file of req.files) {
    const filename = `${uuidv4()}.jpg`;
    try {
      await savePhoto(file.path, dir, filename);
      insert.run(filename, file.originalname);
      saved.push(filename);
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.error(`Erro ao processar ${file.originalname}:`, err.message);
    }
  }
  res.json({ saved: saved.length });
});

router.put('/portfolio/order', requireAdmin, (req, res) => {
  const { order } = req.body; // array of ids
  const db = getDb();
  const update = db.prepare('UPDATE portfolio_photos SET display_order = ? WHERE id = ?');
  order.forEach((id, i) => update.run(i, id));
  res.json({ ok: true });
});

router.delete('/portfolio/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const photo = db.prepare('SELECT * FROM portfolio_photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Foto não encontrada' });

  const dir = path.join(UPLOADS, 'portfolio');
  const webFile = path.join(dir, photo.filename);
  const thumbFile = path.join(dir, 'thumb_' + photo.filename);
  if (fs.existsSync(webFile)) fs.unlinkSync(webFile);
  if (fs.existsSync(thumbFile)) fs.unlinkSync(thumbFile);

  db.prepare('DELETE FROM portfolio_photos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── TEXTOS ────────────────────────────────────────────────
router.get('/texts', requireAdmin, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM site_texts').all();
  const texts = {};
  for (const row of rows) texts[row.key] = row.value;
  res.json(texts);
});

router.put('/texts', requireAdmin, (req, res) => {
  const db = getDb();
  const upsert = db.prepare('INSERT INTO site_texts (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [key, value] of Object.entries(req.body)) {
    upsert.run(key, String(value));
  }
  res.json({ ok: true });
});

module.exports = router;
