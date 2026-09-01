const db = require('../../../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev-secret-replace';

async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body || {};
  if(!email || !password) return res.status(400).json({ error: 'email and password required' });

  const r = await db.query('SELECT id,email,nombre,rol,password_hash FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
  const user = r.rows[0];
  if(!user) return res.status(401).json({ error: 'Invalid credentials' });

  if(user.password_hash){
    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(401).json({ error: 'Invalid credentials' });
  }

  const payload = { sub: String(user.id), email: user.email, name: user.nombre, role: user.rol };
  const token = jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '7d' });
  return res.json({ token, user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
}

export default handler;
