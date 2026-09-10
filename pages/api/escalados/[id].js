const db = require('../../../lib/db');

async function handler(req,res){
  const { id } = req.query || {};
  if(!id) return res.status(400).json({ error: 'Id requerido' });

  if(req.method==='GET'){
    const r = await db.query('SELECT * FROM escalados WHERE id=$1', [id]);
    return res.json({ escalado: r.rows[0] });
  }

  if(req.method==='PUT'){
    const { getUserFromReq, requireRole } = require('../../../lib/auth');
    const user = await getUserFromReq(req);
    if (!requireRole(user, ['admin','tecnico'])) return res.status(403).json({ error: 'No autorizado' });

    const { estado, proveedor, responsable, nota, observaciones } = req.body || {};
    // obtener la fila actual de escalado
    const sel = await db.query('SELECT * FROM escalados WHERE id=$1', [id]);
    const row = sel.rows[0];
    if(!row) return res.status(404).json({ error: 'Escalado no encontrado' });

    const fields = [];
    const vals = [];
    let idx = 1;
    if(proveedor!==undefined){ fields.push(`proveedor=$${idx++}`); vals.push(proveedor); }
    if(estado!==undefined){ fields.push(`estado=$${idx++}`); vals.push(estado); }
    if(responsable!==undefined){ fields.push(`responsable=$${idx++}`); vals.push(responsable); }
    if(nota!==undefined){ fields.push(`nota=$${idx++}`); vals.push(nota); }
    if(observaciones!==undefined){ fields.push(`observaciones=$${idx++}`); vals.push(observaciones); }
    // Evitar sobreescribir los campos snapshot del ticket original (solicitante, area, maquina, urgencia, descripcion)
    // Permitir solo editar campos específicos de escalado: proveedor, estado, responsable, nota, observaciones

    // agregar marcas de tiempo en la primera transición
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
      // Si `estado` cambió a estados importantes, añadir una entrada de historial (sin modificar ticket aquí)
      if(estado!==undefined){
        const s = String(estado).toLowerCase();
        const ticketId = row.ticket_id;
        if(ticketId){
            if(s === 'en proceso'){
              // NO modificar la tabla `tickets` aquí. Solo insertar historial para trazabilidad.
              console.log('escalados/[id] - inserting historial En Proceso (no ticket update)', ticketId, user?.email || user?.name, nota);
              const h = await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5) RETURNING *', [ticketId, 'Proveedor '+ proveedor +': En Proceso', 'En Proceso', user?.email || user?.name || 'Proveedor', 'Not: '+ nota  + 'Obs: '+ observaciones || '']);
              historialInserted.push(...h.rows);
            }
            if(s === 'en espera'){
              console.log('escalados/[id] - inserting historial En Espera (no ticket update)', ticketId, user?.email || user?.name, nota);
              const h = await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5) RETURNING *', [ticketId, 'Proveedor '+ proveedor +': En Espera', 'En Espera', user?.email || user?.name || 'Proveedor', 'Not: '+ nota  + 'Obs: '+ observaciones || '']);
              historialInserted.push(...h.rows);
            }
            if(s === 'resuelto'){
              console.log('escalados/[id] - inserting historial Resuelto (no ticket update)', ticketId, user?.email || user?.name, nota);
              const h = await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5) RETURNING *', [ticketId, 'Proveedor '+ proveedor +': Resuelto', 'Resuelto', user?.email || user?.name || 'Proveedor', 'Not: '+ nota  + 'Obs: '+ observaciones || '']);
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
