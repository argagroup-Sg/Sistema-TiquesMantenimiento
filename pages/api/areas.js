const db = require('../../lib/db');
const { getUserFromReq, requireRole } = require('../../lib/auth');

function sanitize(s) { return String(s||'').trim(); }

async function handler(req, res) {
  if (req.method === 'GET') {
    const r = await db.query('SELECT id, nombre FROM areas ORDER BY nombre');
    return res.json({ areas: r.rows });
  }

  const user = await getUserFromReq(req);
  if (!requireRole(user, ['admin'])) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  if (req.method === 'POST') {
    const { nombre } = req.body || {};
    const n = sanitize(nombre);
    if (!n) return res.status(400).json({ error: 'Nombre es obligatorio' });
    try {
      await db.query('INSERT INTO areas(nombre) VALUES($1) ON CONFLICT (nombre) DO NOTHING', [n]);
      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al guardar área' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'Id requerido' });
    await db.query('DELETE FROM areas WHERE id=$1', [id]);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
