const db = require('../../../lib/db');

function sanitize(s){return String(s||'').trim();}

function buildEscaladoNota(notaBase){
  const nota = sanitize(notaBase);
  return nota || 'Escalado';
}

function buildHistorialDetalle(notaBase, observacionesBase, proveedorNombre){
  const nota = sanitize(notaBase);
  const observaciones = sanitize(observacionesBase);
  const proveedor = sanitize(proveedorNombre);
  const parts = [];
  if (nota) parts.push(`Nota: ${nota}`);
  if (proveedor) parts.push(`Proveedor: ${proveedor}`);
  if (observaciones) parts.push(`Observaciones: ${observaciones}`);
  return parts.join(' | ');
}

async function handler(req,res){
  const { id } = req.query || {};
  if(!id) return res.status(400).json({ error: 'Id requerido' });

  if(req.method==='GET'){
    const r = await db.query(`
      SELECT e.*,
        u_solicitante.nombre AS solicitante_nombre,
        a.nombre AS area_nombre,
        m.nombre AS maquina_nombre,
        p.nombre AS proveedor_nombre,
        u_responsable.nombre AS responsable_nombre
      FROM escalados e
      LEFT JOIN users u_solicitante ON u_solicitante.id = e.solicitante_id
      LEFT JOIN areas a ON a.id = e.area_id
      LEFT JOIN maquinas m ON m.id = e.maquina_id
      LEFT JOIN proveedores p ON p.id = e.proveedor_id
      LEFT JOIN users u_responsable ON u_responsable.id = e.responsable_id
      WHERE e.id=$1
    `, [id]);
    return res.json({ escalado: r.rows[0] });
  }

  if(req.method==='PUT'){
    const { getUserFromReq, requireRole } = require('../../../lib/auth');
    const user = await getUserFromReq(req);
    if (!requireRole(user, ['admin','tecnico'])) return res.status(403).json({ error: 'No autorizado' });

    const { estado, proveedor, proveedor_id, responsable, responsable_id, nota, observaciones, descripcion } = req.body || {};
    const sel = await db.query('SELECT * FROM escalados WHERE id=$1', [id]);
    const row = sel.rows[0];
    if(!row) return res.status(404).json({ error: 'Escalado no encontrado' });

    const fields = [];
    const vals = [];
    let idx = 1;
    if(proveedor_id!==undefined){ fields.push(`proveedor_id=$${idx++}`); vals.push(proveedor_id ? Number(proveedor_id) : null); }
    if(estado!==undefined){ fields.push(`estado=$${idx++}`); vals.push(estado); }
    if(responsable_id!==undefined){ fields.push(`responsable_id=$${idx++}`); vals.push(responsable_id ? Number(responsable_id) : null); }
    if(descripcion!==undefined){ fields.push(`descripcion=$${idx++}`); vals.push(descripcion); }
    if(nota!==undefined){
      const nextNota = buildEscaladoNota(nota);
      fields.push(`nota=$${idx++}`); vals.push(nextNota);
    }
    if(observaciones!==undefined){ fields.push(`observaciones=$${idx++}`); vals.push(observaciones); }

    if(estado!==undefined){
      const s = String(estado).toLowerCase();
      if(s === 'en proceso' && !row.fecha_en_proceso) fields.push('fecha_en_proceso=now()');
      if(s === 'en espera' && !row.fecha_en_espera) fields.push('fecha_en_espera=now()');
      if(s === 'resuelto' && !row.fecha_resuelto) fields.push('fecha_resuelto=now()');
    }

    if(!fields.length) return res.status(400).json({ error: 'Nada para actualizar' });
    const q = `UPDATE escalados SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`;
    vals.push(id);
    try{
      await db.query('BEGIN');
      const up = await db.query(q, vals);
      const updatedEscalado = up.rows[0];

      const historialInserted = [];
      if(estado!==undefined){
        const s = String(estado).toLowerCase();
        const ticketId = row.ticket_id;
        if(ticketId){
          const detalle = buildHistorialDetalle(
            nota !== undefined ? nota : row.nota,
            observaciones !== undefined ? observaciones : row.observaciones,
            proveedor || row.proveedor_nombre || row.proveedor || ''
          );
          if(s === 'en proceso'){
            const h = await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5) RETURNING *', [ticketId, 'Proveedor '+ String(proveedor || row.proveedor || 'Proveedor') +': En Proceso', 'En Proceso', user?.email || user?.name || 'Proveedor', detalle]);
            historialInserted.push(...h.rows);
          }
          if(s === 'en espera'){
            const h = await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5) RETURNING *', [ticketId, 'Proveedor '+ String(proveedor || row.proveedor || 'Proveedor') +': En Espera', 'En Espera', user?.email || user?.name || 'Proveedor', detalle]);
            historialInserted.push(...h.rows);
          }
          if(s === 'resuelto'){
            const h = await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5) RETURNING *', [ticketId, 'Proveedor '+ String(proveedor || row.proveedor || 'Proveedor') +': Resuelto', 'Resuelto', user?.email || user?.name || 'Proveedor', detalle]);
            historialInserted.push(...h.rows);
          }
        }
      }

      await db.query('COMMIT');
      return res.json({ success: true, escalado: updatedEscalado, historial: historialInserted });
    }catch(e){
      console.error('Error updating escalado transaction', e);
      await db.query('ROLLBACK');
      return res.status(500).json({ error: 'Error actualizando escalado' });
    }
  }

  if(req.method==='DELETE'){
    await db.query('DELETE FROM escalados WHERE id=$1', [id]);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
