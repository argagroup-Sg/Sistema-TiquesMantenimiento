const db = require('../../../../lib/db');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'Ticket id requerido' });

  if (req.method === 'GET') {
    const result = await db.query('SELECT * FROM tickets WHERE id=$1', [id]);
    return res.json({ ticket: result.rows[0] });
  }

  if (req.method === 'PUT') {
    const data = req.body || {};
    const fields = [];
    const vals = [];
    let idx = 1;
    if (data.area) { fields.push(`area=$${idx++}`); vals.push(data.area); }
    if (data.maquina) { fields.push(`maquina=$${idx++}`); vals.push(data.maquina); }
    if (data.descripcion) { fields.push(`descripcion=$${idx++}`); vals.push(data.descripcion); }
    if (data.estado) { fields.push(`estado=$${idx++}`); vals.push(data.estado); }
    if (data.tecnico) { fields.push(`tecnico=$${idx++}`); vals.push(data.tecnico); }
    if (data.nota) { fields.push(`nota=$${idx++}`); vals.push(data.nota); }
    if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar' });

    const q = `UPDATE tickets SET ${fields.join(',')}, ultima_actualizacion=now() WHERE id=$${idx}`;
    vals.push(id);
    await db.query(q, vals);
    await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [id, 'Actualización', data.estado || null, data.usuario || 'Sistema', data.nota || '']);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
