import React, { useState, useEffect } from 'react'
import { signIn, signOut, useSession, getSession } from 'next-auth/react'
import { useToast } from '../components/ToastProvider'
import { useRouter } from 'next/router'
import { formatDate, statusClass } from '../lib/format'

async function api(path, opts) {
  const res = await fetch('/api' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  return res.json();
}

export default function Home(){
  const { data: session } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [areas, setAreas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [form, setForm] = useState({ solicitante: '', area: '', maquina: '', urgencia: 'Baja', descripcion: '' });
  const [tiques, setTiques] = useState([]);

  useEffect(()=>{ loadCatalogs() }, []);

  useEffect(()=>{
    // si está autenticado, redirigir al panel específico según rol
    if(session){
      const role = ((session.user?.role || session.user?.rol || '') + '').toString().toLowerCase();
      if(role === 'admin') { router.replace('/admin'); return; }
      if(role === 'super') { router.replace('/super'); return; }
      if(role === 'tecnico') { router.replace('/tecnico'); return; }
      router.replace('/empleado');
    }
  }, [session]);

  const showToast = useToast()

  async function handleSignIn(e){
    e && e.preventDefault();
    if(!email) return showToast('Ingresa correo', 'error');
    if(!password) return showToast('Ingresa contraseña', 'error');
    const res = await signIn('credentials', { redirect: false, email, password });
    if(res?.error) return showToast(res.error || 'Error de autenticación', 'error');
    // redirigir según rol sin recarga completa
    const session = await getSession();
    const role = ((session?.user?.role || session?.user?.rol || '') + '').toString().toLowerCase();
    if(role === 'admin') return router.replace('/admin');
    if(role === 'super') return router.replace('/super');
    if(role === 'tecnico') return router.replace('/tecnico');
    return router.replace('/empleado');
  }

  async function loadCatalogs(){
    const a = await api('/areas'); setAreas((a.areas||[]).map(x=>x.nombre));
    const m = await api('/maquinas'); setMaquinas((m.maquinas||[]).map(x=>x.nombre));
    const t = await api('/tickets'); setTiques(t.tiques||[]);
  }

  async function enviarReporte(e){
    e && e.preventDefault();
    if(!form.solicitante||!form.area||!form.maquina||!form.descripcion) return showToast('Completa todos los campos.', 'error');
    const r = await api('/tickets', { method: 'POST', body: JSON.stringify(form) });
    if(r.error) return showToast(r.error, 'error');
    showToast('Tique creado: ' + r.id, 'success'); setForm({ solicitante:'', area:'', maquina:'', urgencia:'Baja', descripcion:'' }); loadCatalogs();
  }

  if(!session) {
    return (
      <div className="container" style={{maxWidth:520,margin:'60px auto'}}>
        <div className="card" style={{textAlign:'center'}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              background: '#ffffff', // Fondo blanco para que resalte el logo perfectamente
              borderRadius: '12px',
              width: 'fit-content'
            }}>
              <img
                src="https://exportgagroup.com/wp-content/uploads/2023/02/350x100-logo-pag-hori-e1745438808154.png"
                alt="Exportgagroup Prawn Exporter Logo"
                style={{
                  width: '100%',
                  maxWidth: '350px', // Mantiene la resolución óptima original
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            </div>

{/*         <div style={{width:80,height:80,borderRadius:12,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:24}}>SM</div> */}            
            <h2 style={{margin:0}}>Sistema de Mantenimiento</h2>
            <p style={{margin:0,color:'#6b7280'}}>Inicia sesión con tu cuenta de empresa</p>
          </div>
          <form onSubmit={handleSignIn} style={{marginTop:18}}>
            <div className="form-row">
              <input type="text" placeholder="correo@empresa.com" value={email} onChange={e=>setEmail(e.target.value)} />
              <input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)} />
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
              <label style={{fontSize:13,color:'#6b7280'}}><input type="checkbox" style={{marginRight:8}} /> Recordarme</label>
              <button type="submit">Entrar</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Sistema de Mantenimiento</h2>
        <div>
          <span style={{marginRight:12}}>Hola, {session.user.name || session.user.email} ({session.user.role})</span>
          <button onClick={()=>signOut()}>Cerrar sesión</button>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <h3> AE Reportar Falla</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label>Tu nombre</label>
            <input value={form.solicitante} onChange={e=>setForm({...form,solicitante:e.target.value})} />
          </div>
          <div>
            <label>Urgencia</label>
            <select value={form.urgencia} onChange={e=>setForm({...form,urgencia:e.target.value})}><option>Baja</option><option>Media</option><option>Alta</option><option>Parada de Planta</option></select>
          </div>
          <div>
            <label>Área</label>
            <select value={form.area} onChange={e=>setForm({...form,area:e.target.value})}><option value="">Seleccione</option>{areas.map(a=><option key={a}>{a}</option>)}</select>
          </div>
          <div>
            <label>Máquina</label>
            <select value={form.maquina} onChange={e=>setForm({...form,maquina:e.target.value})}><option value="">Seleccione</option>{maquinas.map(m=><option key={m}>{m}</option>)}</select>
          </div>
        </div>
        <label>Descripción</label>
        <textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} rows={5}></textarea>
        <button onClick={enviarReporte}>Enviar Tique</button>
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
