import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'

// Funciones auxiliares para que la tabla no dé error si no las tienes importadas
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
  } catch (e) { return dateStr; }
};

const statusClass = (estado) => {
  if (!estado) return 'abierto';
  return estado.toString().toLowerCase().replace(/\s+/g, '-');
};

export default function Empleado(){
  const { data: session } = useSession();
  const [form, setForm] = useState({ solicitante:'', area:'', maquina:'', urgencia:'Baja', descripcion:'' });
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [tiques, setTiques] = useState([]);
  const [error, setError] = useState('');

  // 1. Auto-rellenar el solicitante con el nombre de la sesión activa en cuanto cargue
  useEffect(() => {
    if (session?.user?.name) {
      setForm(prevForm => ({
        ...prevForm,
        solicitante: session.user.name.toString().trim()
      }));
    } else if (session?.user?.email) {
      setForm(prevForm => ({
        ...prevForm,
        solicitante: session.user.email.split('@')[0]
      }));
    }
  }, [session]);

  async function enviar(e){
    e && e.preventDefault();
    if(!form.solicitante || !form.area || !form.maquina || !form.descripcion){ setError('Completa todos los campos.'); return }
    try{
      setLoading(true);
      const r = await api('/tickets', { method:'POST', body: JSON.stringify(form) });
      alert('Tique creado: ' + r.id);
      
      // 2. Al limpiar el formulario, conservamos el nombre del usuario logueado en vez de borrarlo
      setForm({ 
        solicitante: session?.user?.name || form.solicitante, 
        area:'', 
        maquina:'', 
        urgencia:'Baja', 
        descripcion:'' 
      });
      setError('');
      loadCatalogs(); // Recarga la lista de tiques para mostrar el recién creado
    }catch(err){
      alert(err.message || 'Error');
    }finally{ setLoading(false); }
  }

  useEffect(()=>{ loadCatalogs(); }, []);
  async function loadCatalogs(){
    try{ 
      const a = await api('/areas'); setAreas(a.areas || []); 
      const m = await api('/maquinas'); setMaquinas(m.maquinas || []);     
      const t = await api('/tickets'); setTiques(t.tiques || []);
    }catch(err){ 
      console.error(err); 
    }
  }

  if(!session) return (
    <div className="container"><div className="card"><h3>Debes iniciar sesión</h3></div></div>
  )

  // Validación de rol segura e insensible a mayúsculas/minúsculas
  const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
  if(!['empleado','admin','tecnico'].includes(rol)) return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Tu cuenta no tiene permiso para crear tiques.</p></div></div>

  return (
    <div className="container">
      <div className="card">
        <h2>Reportar Falla EA</h2>
        <form onSubmit={enviar}>
          <label>Tu nombre</label>
          <input 
            value={form.solicitante} 
            readOnly 
            style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} 
          />          
          <label>Área</label>
          <select value={form.area} onChange={e=>setForm({...form,area:e.target.value})}><option value="">Seleccione</option>{areas.map(a=> <option key={a.id} value={a.nombre}>{a.nombre}</option>)}</select>
          
          <label>Máquina</label>
          <select value={form.maquina} onChange={e=>setForm({...form,maquina:e.target.value})}><option value="">Seleccione</option>{maquinas.map(m=> <option key={m.id} value={m.nombre}>{m.nombre}</option>)}</select>
          
          <label>Urgencia</label>
          <select value={form.urgencia} onChange={e=>setForm({...form,urgencia:e.target.value})}><option>Baja</option><option>Media</option><option>Alta</option><option>Parada de Planta</option></select>
          
          <label>Descripción</label>
          <textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} rows={5}></textarea>
          
          {error && <div style={{color:'red',marginBottom:8}}>{error}</div>}
          <button type="submit" disabled={loading}>{loading? 'Enviando...':'Enviar Tique'}</button>
        </form>
      </div>
      
      <div className="card" style={{marginTop:12}}>
        <h3>Lista de Tiques</h3>
        <div className="spreadsheetTableRoot" style={{overflowX:'auto'}}>
          <table className="fixedTable" style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
            <thead style={{background:'#2563eb',color:'#fff'}}>
              <tr><th>ID</th><th>Fecha</th><th>Solicitante</th><th>Area</th><th>Máquina</th><th>Fallo</th><th>Urgencia</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {tiques.length===0 && <tr><td colSpan={8}>No hay tiques.</td></tr>}
              {tiques.map(t=>(
                  <tr key={t.id} style={{borderBottom:'1px solid #eee'}}>
                    <td><strong>{t.id}</strong></td>
                    <td>{formatDate(t.fecha_creacion || t.fecha)}</td>
                    <td>{t.solicitante}</td>
                    <td>{t.area}</td>
                    <td>{t.maquina}</td>
                    <td>{t.descripcion}</td>
                    <td>{t.urgencia}</td>
                    <td><span className={"badge " + statusClass(t.estado)}>{t.estado || 'Abierto'}</span></td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
