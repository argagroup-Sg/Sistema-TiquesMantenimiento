import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'
import { useToast } from '../components/ToastProvider'

export default function Empleado(){
  const { data: session } = useSession();
  const [form, setForm] = useState({ solicitante:'', area:'', maquina:'', urgencia:'Baja', descripcion:'' });
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [error, setError] = useState('');

  const showToast = useToast()

  async function enviar(e){
    e && e.preventDefault();
    if(!form.solicitante || !form.area || !form.maquina || !form.descripcion){ setError('Completa todos los campos.'); return }
    try{
      setLoading(true);
      const r = await api('/tickets', { method:'POST', body: JSON.stringify(form) });
      if (showToast) showToast('Tique creado: ' + r.id, 'success')
      setForm({ solicitante:'', area:'', maquina:'', urgencia:'Baja', descripcion:'' });
    }catch(err){
      if (showToast) showToast(err.message || 'Error', 'error')
    }finally{ setLoading(false); }
  }

  useEffect(()=>{ loadCatalogs(); }, []);
  async function loadCatalogs(){
    try{ const a = await api('/areas'); setAreas(a.areas || []); const m = await api('/maquinas'); setMaquinas(m.maquinas || []); }catch(err){ console.error(err); }
  }

  if(!session) return (
    <div className="container"><div className="card"><h3>Debes iniciar sesión</h3></div></div>
  )

  const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
  if(!['empleado','tecnico','admin'].includes(rol)) return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Tu cuenta no tiene permiso para crear tiques.</p></div></div>

  return (
    <div className="container">
      <div className="card">
        <h2>Reportar Falla</h2>
        <form onSubmit={enviar}>
          <label>Tu nombre</label>
          <input value={form.solicitante} onChange={e=>setForm({...form,solicitante:e.target.value})} />
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
    </div>
  )
}
