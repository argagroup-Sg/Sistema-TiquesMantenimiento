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
    // obtener ticket actual para aplicar reglas de negocio y respetar marcas de tiempo existentes
    const cur = await db.query('SELECT estado, fecha_en_proceso, fecha_en_espera, fecha_resuelto FROM tickets WHERE id=$1', [id]);
    const curRow = cur.rows[0] || {};
    const curEstado = curRow && curRow.estado ? String(curRow.estado).toLowerCase() : '';
    if (curEstado === 'resuelto') return res.status(403).json({ error: 'No se permiten modificaciones: el tique ya está Resuelto' });
    if (curEstado.includes('escalad')) return res.status(403).json({ error: 'No se permiten modificaciones: el tique fue escalado a servidor externo' });
    if (data.area) { fields.push(`area=$${idx++}`); vals.push(data.area); }
    if (data.maquina) { fields.push(`maquina=$${idx++}`); vals.push(data.maquina); }
    if (data.descripcion) { fields.push(`descripcion=$${idx++}`); vals.push(data.descripcion); }
    if (data.estado) { fields.push(`estado=$${idx++}`); vals.push(data.estado); }
    if (data.tecnico) { fields.push(`tecnico=$${idx++}`); vals.push(data.tecnico); fields.push('fecha_asignacion=now()'); }
    if (data.nota) { fields.push(`nota=$${idx++}`); vals.push(data.nota); }
    if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar' });

    // requerir autenticación para actualizaciones
    const { getUserFromReq, requireRole } = require('../../../lib/auth');
    const user = await getUserFromReq(req);
    if (!user) return res.status(403).json({ error: 'No autorizado' });

    // Si `estado` incluye un estado que requiere una marca de tiempo, añadir las asignaciones correspondientess
    if (data.estado) {
      const s = String(data.estado).toLowerCase();
      // solo establecer la marca de tiempo la primera vez que el ticket entra en ese estado (evitar sobreescribir marcas existentes)
      if (s === 'en proceso' && !curRow.fecha_en_proceso) fields.push('fecha_en_proceso=now()');
      if (s === 'en espera' && !curRow.fecha_en_espera) fields.push('fecha_en_espera=now()');
      if (s === 'resuelto' && !curRow.fecha_resuelto) fields.push('fecha_resuelto=now()');
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
