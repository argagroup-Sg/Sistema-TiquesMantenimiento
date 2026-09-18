const db = require('../../../lib/db');

function normalizeString(value) {
  return String(value ?? '').trim();
}

async function handler(req, res) {
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'Ticket id requerido' });

  if (req.method === 'GET') {
    const result = await db.query(`
      SELECT t.*, 
        us.nombre AS solicitante_nombre,
        a.nombre AS area_nombre,
        m.nombre AS maquina_nombre,
        ut.nombre AS tecnico_nombre
      FROM tickets t
      LEFT JOIN users us ON us.id = t.solicitante_id
      LEFT JOIN areas a ON a.id = t.area_id
      LEFT JOIN maquinas m ON m.id = t.maquina_id
      LEFT JOIN users ut ON ut.id = t.tecnico_id
      WHERE t.id=$1
    `, [id]);
    return res.json({ ticket: result.rows[0] });
  }

  if (req.method === 'PUT') {
    const data = req.body || {};
    const fields = [];
    const vals = [];
    let idx = 1;
    const cur = await db.query('SELECT estado, fecha_en_proceso, fecha_en_espera, fecha_resuelto FROM tickets WHERE id=$1', [id]);
    const curRow = cur.rows[0] || {};
    const curEstado = curRow && curRow.estado ? String(curRow.estado).toLowerCase() : '';
    if (curEstado === 'resuelto') return res.status(403).json({ error: 'No se permiten modificaciones: el tique ya está Resuelto' });
    if (curEstado.includes('escalad')) return res.status(403).json({ error: 'No se permiten modificaciones: el tique fue escalado a servidor externo' });

    if (data.area_id !== undefined) { fields.push(`area_id=$${idx++}`); vals.push(data.area_id ? Number(data.area_id) : null); }
    if (data.maquina_id !== undefined) { fields.push(`maquina_id=$${idx++}`); vals.push(data.maquina_id ? Number(data.maquina_id) : null); }
    if (data.solicitante_id !== undefined) { fields.push(`solicitante_id=$${idx++}`); vals.push(data.solicitante_id ? Number(data.solicitante_id) : null); }

    if (data.descripcion) { fields.push(`descripcion=$${idx++}`); vals.push(normalizeString(data.descripcion)); }
    if (data.estado) { fields.push(`estado=$${idx++}`); vals.push(normalizeString(data.estado)); }
    if (data.nota) { fields.push(`nota=$${idx++}`); vals.push(normalizeString(data.nota)); }

    let resolvedTecnicoId = null;
    if (data.tecnico_id !== undefined) {
      resolvedTecnicoId = data.tecnico_id ? Number(data.tecnico_id) : null;
    } else if (data.tecnico !== undefined && data.tecnico !== '') {
      const userRow = await db.query('SELECT id FROM users WHERE lower(email)=lower($1) OR lower(nombre)=lower($2) LIMIT 1', [normalizeString(data.tecnico), normalizeString(data.tecnico)]);
      if (userRow.rows[0]) resolvedTecnicoId = Number(userRow.rows[0].id);
    }

    if (resolvedTecnicoId !== null || data.tecnico_id === null) {
      fields.push(`tecnico_id=$${idx++}`);
      vals.push(resolvedTecnicoId);
      fields.push('fecha_asignacion=now()');
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar' });

    const nextEstado = normalizeString(data.estado || curRow.estado || 'Abierto');
    const combinedNota = data.nota
      ? ('Nota: ' + normalizeString(data.nota) + (data.descripcion ? ' — Descripción: ' + normalizeString(data.descripcion) : ''))
      : (data.descripcion ? 'Descripción: ' + normalizeString(data.descripcion) : 'Sin nota');
    const { getUserFromReq } = require('../../../lib/auth');
    const user = await getUserFromReq(req);
    if (!user) return res.status(403).json({ error: 'No autorizado' });

    if (nextEstado) {
      const s = String(nextEstado).toLowerCase();
      if (s === 'en proceso' && !curRow.fecha_en_proceso) fields.push('fecha_en_proceso=now()');
      if (s === 'en espera' && !curRow.fecha_en_espera) fields.push('fecha_en_espera=now()');
      if (s === 'resuelto' && !curRow.fecha_resuelto) fields.push('fecha_resuelto=now()');
      if (s === 'escalado a servidor externo') fields.push('fecha_escalado=now()');
    }

    const q = `UPDATE tickets SET ${fields.join(',')}, ultima_actualizacion=now() WHERE id=$${idx}`;
    vals.push(id);
    await db.query(q, vals);
    await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [id, 'Actualización', nextEstado, user.email || user.name || 'Sistema', combinedNota]);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
