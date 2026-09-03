const db = require('../../lib/db');
const bcrypt = require('bcryptjs');
const { getUserFromReq, requireRole } = require('../../lib/auth');

async function handler(req, res) {
  const user = await getUserFromReq(req);
  // GET can be performed by admin or super (read-only)
  if (req.method === 'GET') {
    if (!requireRole(user, ['admin','super'])) return res.status(403).json({ error: 'No autorizado' });
    const result = await db.query('SELECT id, email, nombre, rol, created_at FROM users ORDER BY id DESC');
    return res.json({ users: result.rows });
  }

  // POST/modify users: only admin allowed
  if (!requireRole(user, ['admin'])) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  if (req.method === 'POST') {
    const { email, nombre, rol, password } = req.body || {};
    if (!email || !nombre || !rol) return res.status(400).json({ error: 'Faltan campos' });

    const hash = password ? await bcrypt.hash(password, 10) : null;
    // upsert (insertar o actualizar)
    await db.query(
      `INSERT INTO users(email,nombre,rol,password_hash) VALUES($1,$2,$3,$4)
       ON CONFLICT (email) DO UPDATE SET nombre=EXCLUDED.nombre, rol=EXCLUDED.rol, password_hash=COALESCE(EXCLUDED.password_hash, users.password_hash)`,
      [email, nombre, rol, hash]
    );

    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
