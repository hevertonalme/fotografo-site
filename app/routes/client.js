const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');
const { requireClient } = require('../middleware/auth');

const router = express.Router();
const UPLOADS = '/app/uploads';

router.post('/login', (req, res) => {
  const { slug, password } = req.body;
  if (!slug || !password) return res.status(400).json({ error: 'Campos obrigatórios' });

  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE slug = ?').get(slug);
  if (!client || !bcrypt.compareSync(password, client.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  if (new Date(client.expires_at) < new Date()) {
    return res.status(403).json({ error: 'Acesso expirado' });
  }

  const token = jwt.sign(
    { role: 'client', id: client.id, slug: client.slug },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, name: client.name, expires_at: client.expires_at });
});

router.get('/photos', requireClient, (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.client.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  if (new Date(client.expires_at) < new Date()) {
    return res.status(403).json({ error: 'Acesso expirado' });
  }

  const photos = db.prepare('SELECT id, filename, original_name FROM client_photos WHERE client_id = ? ORDER BY id ASC').all(client.id);
  res.json({ photos, name: client.name, expires_at: client.expires_at });
});

router.get('/download', requireClient, (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.client.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  if (new Date(client.expires_at) < new Date()) {
    return res.status(403).json({ error: 'Acesso expirado' });
  }

  const photos = db.prepare('SELECT * FROM client_photos WHERE client_id = ? ORDER BY id ASC').all(client.id);
  if (!photos.length) return res.status(404).json({ error: 'Sem fotos disponíveis' });

  const dir = path.join(UPLOADS, 'clients', String(client.id));
  const safeName = client.name.replace(/[^a-zA-Z0-9-_]/g, '_');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}_fotos.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => { if (!res.headersSent) res.status(500).end(); });
  archive.pipe(res);

  for (const photo of photos) {
    const filePath = path.join(dir, photo.filename);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: photo.original_name || photo.filename });
    }
  }

  archive.finalize();
});

module.exports = router;
