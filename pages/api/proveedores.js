const db = require('../../lib/db');
function sanitize(s){return String(s||'').trim();}

module.exports = async function handler(req,res){
  if(req.method==='GET'){
    const r = await db.query('SELECT id,nombre,contacto,telefono,observaciones FROM proveedores ORDER BY nombre');
    return res.json({ proveedores: r.rows });
  }

  if(req.method==='POST'){
    const { nombre, contacto, telefono, observaciones } = req.body || {};
    const n = sanitize(nombre);
    if(!n) return res.status(400).json({ error: 'Nombre es obligatorio' });
    await db.query('INSERT INTO proveedores(nombre,contacto,telefono,observaciones) VALUES($1,$2,$3,$4)', [n, sanitize(contacto), sanitize(telefono), sanitize(observaciones)]);
    return res.json({ success: true });
  }

  if(req.method==='PUT'){
    const { id, nombre, contacto, telefono, observaciones } = req.body || {};
    if(!id) return res.status(400).json({ error: 'Id es obligatorio' });
    await db.query('UPDATE proveedores SET nombre=$1, contacto=$2, telefono=$3, observaciones=$4 WHERE id=$5', [sanitize(nombre), sanitize(contacto), sanitize(telefono), sanitize(observaciones), id]);
    return res.json({ success: true });
  }

  if(req.method==='DELETE'){
    const { id } = req.query || {};
    if(!id) return res.status(400).json({ error: 'Id requerido' });
    await db.query('DELETE FROM proveedores WHERE id=$1', [id]);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
