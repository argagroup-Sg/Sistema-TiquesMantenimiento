const db = require('../../../lib/db');

async function handler(req, res) {
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
    if (data.tecnico) { fields.push(`tecnico=$${idx++}`); vals.push(data.tecnico); fields.push('fecha_asignacion=now()'); }
    if (data.nota) { fields.push(`nota=$${idx++}`); vals.push(data.nota); }
    if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar' });

    // require authentication for updates
    const { getUserFromReq, requireRole } = require('../../../lib/auth');
    const user = await getUserFromReq(req);
    if (!user) return res.status(403).json({ error: 'No autorizado' });

    // If estado includes status that warrants a timestamp, add corresponding timestamp assignments
    if (data.estado) {
      const s = String(data.estado).toLowerCase();
      if (s === 'en proceso') fields.push('fecha_en_proceso=now()');
      if (s === 'en espera') fields.push('fecha_en_espera=now()');
      if (s === 'resuelto') fields.push('fecha_resuelto=now()');
      if (s === 'escalado a servidor externo') fields.push('fecha_escalado=now()');
    }

    const q = `UPDATE tickets SET ${fields.join(',')}, ultima_actualizacion=now() WHERE id=$${idx}`;
    vals.push(id);
    await db.query(q, vals);
    await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [id, 'Actualización', data.estado || null, user.email || user.name || 'Sistema', data.nota || '']);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
