const db = require('../../../lib/db');

async function handler(req,res){
  const { id } = req.query || {};
  if(!id) return res.status(400).json({ error: 'Id requerido' });

  if(req.method==='GET'){
    const r = await db.query('SELECT * FROM escalados WHERE id=$1', [id]);
    return res.json({ escalado: r.rows[0] });
  }

  if(req.method==='PUT'){
    const { estado, proveedor, responsable, nota, observaciones, solicitante, area, maquina, urgencia, descripcion } = req.body || {};
    const fields = [];
    const vals = [];
    let idx = 1;
    if(proveedor!==undefined){ fields.push(`proveedor=$${idx++}`); vals.push(proveedor); }
    if(estado!==undefined){ fields.push(`estado=$${idx++}`); vals.push(estado); }
    if(responsable!==undefined){ fields.push(`responsable=$${idx++}`); vals.push(responsable); }
    if(nota!==undefined){ fields.push(`nota=$${idx++}`); vals.push(nota); }
    if(observaciones!==undefined){ fields.push(`observaciones=$${idx++}`); vals.push(observaciones); }
    if(solicitante!==undefined){ fields.push(`solicitante=$${idx++}`); vals.push(solicitante); }
    if(area!==undefined){ fields.push(`area=$${idx++}`); vals.push(area); }
    if(maquina!==undefined){ fields.push(`maquina=$${idx++}`); vals.push(maquina); }
    if(urgencia!==undefined){ fields.push(`urgencia=$${idx++}`); vals.push(urgencia); }
    if(descripcion!==undefined){ fields.push(`descripcion=$${idx++}`); vals.push(descripcion); }
    if(!fields.length) return res.status(400).json({ error: 'Nada para actualizar' });
    const q = `UPDATE escalados SET ${fields.join(',')} WHERE id=$${idx}`;
    vals.push(id);
    await db.query(q, vals);
    // Optionally sync ticket status
    if(estado==='Resuelto'){
      const r = await db.query('SELECT ticket_id FROM escalados WHERE id=$1', [id]);
      if(r.rows[0] && r.rows[0].ticket_id){
        await db.query('UPDATE tickets SET estado=$1, fecha_resuelto=now(), ultima_actualizacion=now() WHERE id=$2', ['Resuelto', r.rows[0].ticket_id]);
        await db.query('INSERT INTO historial(ticket_id, accion, estado, usuario, detalle) VALUES($1,$2,$3,$4,$5)', [r.rows[0].ticket_id, 'Proveedor Resuelto', 'Resuelto', responsable || 'Proveedor', nota || '']);
      }
    }
    return res.json({ success: true });
  }

  if(req.method==='DELETE'){
    await db.query('DELETE FROM escalados WHERE id=$1', [id]);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;
