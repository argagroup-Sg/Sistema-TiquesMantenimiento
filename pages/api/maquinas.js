const db = require('../../lib/db');
function sanitize(s){return String(s||'').trim();}

module.exports = async function handler(req,res){
  if(req.method==='GET'){
    const r = await db.query('SELECT id,nombre FROM maquinas ORDER BY nombre');
    return res.json({ maquinas: r.rows });
  }

  if(req.method==='POST'){
    const { nombre } = req.body || {};
    const n = sanitize(nombre);
    if(!n) return res.status(400).json({ error: 'Nombre es obligatorio' });
    try{
      await db.query('INSERT INTO maquinas(nombre) VALUES($1) ON CONFLICT (nombre) DO NOTHING', [n]);
      return res.json({ success: true });
    }catch(err){
      console.error(err);
      return res.status(500).json({ error: 'Error al guardar máquina' });
    }
  }

  if(req.method==='DELETE'){
    const { id } = req.query || {};
    if(!id) return res.status(400).json({ error: 'Id requerido' });
    await db.query('DELETE FROM maquinas WHERE id=$1', [id]);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
