const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token obrigatório' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function requireClient(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token obrigatório' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'client') return res.status(403).json({ error: 'Acesso negado' });
    req.client = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { requireAdmin, requireClient };
