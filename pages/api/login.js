const db = require('../../../lib/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change';

async function findUserByEmail(email) {
  const res = await db.query('SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
  return res.rows[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

  // If password exists, verify; otherwise allow login by email (legacy behavior)
  if (user.password_hash) {
    if (!password) return res.status(400).json({ error: 'Password requerido' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign({ sub: user.id, email: user.email, rol: user.rol, nombre: user.nombre }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
};
