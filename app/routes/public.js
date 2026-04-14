const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/portfolio', (req, res) => {
  const db = getDb();
  const photos = db.prepare('SELECT id, filename, original_name FROM portfolio_photos ORDER BY display_order ASC, id ASC').all();
  res.json(photos);
});

router.get('/texts', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM site_texts').all();
  const texts = {};
  for (const row of rows) texts[row.key] = row.value;
  res.json(texts);
});

module.exports = router;
