const db = require('../../../lib/db');
const bcrypt = require('bcryptjs');

async function handler(req, res){
  const { id } = req.query || {};
  if(!id) return res.status(400).json({ error: 'User id requerido' });

  const { getUserFromReq, requireRole } = require('../../../lib/auth');
  const user = await getUserFromReq(req);
  if(!requireRole(user, ['admin'])) return res.status(403).json({ error: 'No autorizado' });

  if(req.method === 'GET'){
    const r = await db.query('SELECT id,email,nombre,rol,created_at FROM users WHERE id=$1', [id]);
    return res.json({ user: r.rows[0] });
  }

  if(req.method === 'PUT'){
    const data = req.body || {};
    const fields = [];
    const vals = [];
    let idx = 1;
    if(data.nombre){ fields.push(`nombre=$${idx++}`); vals.push(data.nombre); }
    if(data.rol){ fields.push(`rol=$${idx++}`); vals.push(data.rol); }
    if(data.email){ fields.push(`email=$${idx++}`); vals.push(data.email); }
    if(data.password){ const h = await bcrypt.hash(data.password, 10); fields.push(`password_hash=$${idx++}`); vals.push(h); }
    if(!fields.length) return res.status(400).json({ error: 'Nada para actualizar' });
    const q = `UPDATE users SET ${fields.join(',')} WHERE id=$${idx}`;
    vals.push(id);
    await db.query(q, vals);
    return res.json({ success: true });
  }

  if(req.method === 'DELETE'){
    await db.query('DELETE FROM users WHERE id=$1', [id]);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
