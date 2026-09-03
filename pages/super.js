import React, { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'

export default function SuperDashboard(){
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [superTab, setSuperTab] = useState('areas');
  const [historial, setHistorial] = useState([]);
  const [historialTicketId, setHistorialTicketId] = useState(null);
  const [areas, setAreas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [escalados, setEscalados] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(()=>{ if(session) loadAll(); }, [session]);

  useEffect(()=>{
    // detectar móvil por ancho y actualizar en resize
    function check(){ if(typeof window !== 'undefined') setIsMobile(window.innerWidth <= 720); }
    check();
    window.addEventListener('resize', check);
    return ()=> window.removeEventListener('resize', check);
  }, []);

  useEffect(()=>{
    if(typeof window !== 'undefined') document.body.style.overflow = menuOpen ? 'hidden' : '';
    return ()=>{ if(typeof window !== 'undefined') document.body.style.overflow = ''; };
  }, [menuOpen]);

  async function loadAll(){
    try{
      const res = await api('/super');
      setAreas(res.areas || []);
      setMaquinas(res.maquinas || []);
      setProveedores(res.proveedores || []);
      setUsuarios(res.users || []);
      setTickets(res.tickets || []);
      setEscalados(res.escalados || []);
    }catch(e){ console.error('Carga Super error', e); }
  }

  async function loadHistorial(ticketId){
    try{
      setHistorial([]);
      setHistorialTicketId(ticketId);
      const res = await api('/historial?ticket_id='+encodeURIComponent(String(ticketId)));
      // endpoint returns { historial: [...] } or array
      setHistorial(res.historial || res || []);
    }catch(e){ console.error('Error cargando historial', e); setHistorial([]); }
  }

  function closeHistorial(){ setHistorial([]); setHistorialTicketId(null); }

  if(!session) return <div className="container"><div className="card"><h3>Debes iniciar sesión</h3></div></div>

  const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
  if(rol !== 'super' && rol !== 'admin') return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Necesitas rol <strong>super</strong> o <strong>admin</strong> para acceder.</p></div></div>

  const filtered = (arr, keys=[]) => arr.filter(r => {
    if(!filter) return true; const q = filter.toString().toLowerCase();
    return keys.some(k => (String(r[k]||'').toLowerCase().includes(q)));
  });

  return (
    <div className="container">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        {isMobile ? (
          <button onClick={()=>setMenuOpen(true)} aria-label="Abrir menú" style={{background:'transparent',border:0,fontSize:22,cursor:'pointer',color:'#111'}}>☰</button>
        ) : (
          <div style={{width:24}} />
        )}
        <h2 style={{margin:0}}>Panel (Super) — Vista solo lectura</h2>
        <div style={{width:36}} />
      </div>

      {menuOpen && isMobile && (
        <>
          <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:998}} />
          <div style={{position:'fixed',top:56,left:8,right:8,background:'#f6ebeb',border:'1px solid #f9f4f4',boxShadow:'0 6px 18px rgba(0,0,0,0.08)',padding:8,borderRadius:8,zIndex:999,maxHeight:'calc(100vh - 80px)',overflowY:'auto',boxSizing:'border-box'}}>
            <div style={{display:'flex',flexDirection:'column',width:'100%'}}>
              {['resumen','areas','maquinas','proveedores','usuarios','tiques','escalados'].map(tab=> (
                <button key={tab} onClick={()=>{ setMenuOpen(false); setSuperTab(tab); }} style={{padding:12,textAlign:'left',background:'transparent',border:'none',cursor:'pointer',width:'100%',color:'#111'}}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>
              ))}
            </div>
          </div>
        </>
      )}
      <div style={{marginBottom:12}}>
        <input placeholder="Filtro global..." value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:8,borderRadius:8,border:'1px solid #e6eef8',width:'100%'}} />
      </div>

      <div style={{marginTop:12}}>
        {!isMobile && (
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            {['resumen','areas','maquinas','proveedores','usuarios','tiques','escalados'].map(tab=> (
              <button key={tab} onClick={()=>setSuperTab(tab)} style={{padding:'8px 12px',borderRadius:6,border: superTab===tab ? '1px solid #2563eb' : '1px solid #e6eef8',background: superTab===tab ? '#eef6ff' : 'transparent',cursor:'pointer',color:'#111'}}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>
            ))}
          </div>
        )}

        {superTab === 'resumen' && (
          <div className="card">
            <h3>Resumen / Gráficos</h3>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6}}><strong>Áreas:</strong> {areas.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6}}><strong>Maquinarias:</strong> {maquinas.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6}}><strong>Proveedores:</strong> {proveedores.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6}}><strong>Usuarios:</strong> {usuarios.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6}}><strong>Tiques:</strong> {tickets.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6}}><strong>Escalados:</strong> {escalados.length}</div>
            </div>
            <p style={{marginTop:12}}>Pantalla de resumen.</p>
          </div>
        )}

        {superTab === 'areas' && (
          <div className="card">
            <h3>Áreas ({areas.length})</h3>
            <ul>{filtered(areas, ['nombre']).map(a=> <li key={a.id}>{a.nombre}</li>)}</ul>
          </div>
        )}

        {superTab === 'maquinas' && (
          <div className="card">
            <h3>Maquinarias ({maquinas.length})</h3>
            <ul>{filtered(maquinas, ['nombre']).map(m=> <li key={m.id}>{m.nombre}</li>)}</ul>
          </div>
        )}

        {superTab === 'proveedores' && (
          <div className="card">
            <h3>Proveedores ({proveedores.length})</h3>
            <div className="super-table-wrap" style={{overflowX:'auto'}}>
              <table className="super-table" style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>ID</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Nombre</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Contacto</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Teléfono</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered(proveedores, ['nombre','contacto']).map(p=> (
                    <tr key={p.id} style={{borderTop:'1px solid #eee'}}>
                      <td style={{padding:8}}>{p.id}</td>
                      <td style={{padding:8}}>{p.nombre}</td>
                      <td style={{padding:8}}>{p.contacto||''}</td>
                      <td style={{padding:8}}>{p.telefono||''}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{p.observaciones||''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {superTab === 'usuarios' && (
          <div className="card">
            <h3>Usuarios ({usuarios.length})</h3>
            {usuarios.length === 0 ? (
              <div style={{padding:12}}>No hay usuarios para mostrar.</div>
            ) : (
              <div className="super-table-wrap" style={{overflowX:'auto'}}>
                <table className="super-table" style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Email</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Nombre</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Rol</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u=> (
                      <tr key={u.id} style={{borderTop:'1px solid #eee'}}>
                        <td style={{padding:8}}>{u.email}</td>
                        <td style={{padding:8}}>{u.nombre}</td>
                        <td style={{padding:8}}>{u.rol}</td>
                        <td style={{padding:8}}>{formatDate(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {superTab === 'tiques' && (
          <div className="card">
            <h3>Tiques ({tickets.length})</h3>
            <div className="super-table-wrap" style={{overflowX:'auto'}}>
              <table className="super-table" style={{width:'100%',borderCollapse:'collapse',minWidth:1200}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>ID</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha creación</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Solicitante</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Area</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Maquina</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Urgencia</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Descripción</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Estado</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Técnico</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha asignación</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha en proceso</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha en espera</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha resuelto</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha escalado</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Nota</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Última actualización</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t=> (
                    <tr key={t.id} style={{borderTop:'1px solid #eee'}}>
                      <td style={{padding:8}}>{t.id}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_creacion)}</td>
                      <td style={{padding:8}}>{t.solicitante}</td>
                      <td style={{padding:8}}>{t.area}</td>
                      <td style={{padding:8}}>{t.maquina}</td>
                      <td style={{padding:8}}>{t.urgencia}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{t.descripcion}</td>
                      <td style={{padding:8}}>{t.estado}</td>
                      <td style={{padding:8}}>{t.tecnico}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_asignacion)}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_en_proceso)}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_en_espera)}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_resuelto)}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_escalado)}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{t.nota}</td>
                      <td style={{padding:8}}>{formatDate(t.ultima_actualizacion)}</td>
                      <td style={{padding:8}}>
                        <button onClick={()=>loadHistorial(t.id)} style={{padding:'6px 8px',borderRadius:6,cursor:'pointer'}}>Historial</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {superTab === 'escalados' && (
          <div className="card">
            <h3>Escalados ({escalados.length})</h3>
            <div className="super-table-wrap" style={{overflowX:'auto'}}>
              <table className="super-table" style={{width:'100%',borderCollapse:'collapse',minWidth:1400}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Ticket</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha escalado</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Proveedor</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Estado</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha en proceso</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha en espera</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha resuelto</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Solicitante</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Area</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Maquina</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Urgencia</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Descripción</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Responsable</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Nota</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Observaciones</th>
                    <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {escalados.map(e=> (
                    <tr key={e.id} style={{borderTop:'1px solid #eee'}}>
                      <td style={{padding:8}}>{e.ticket_id}</td>
                      <td style={{padding:8}}>{formatDate(e.fecha_escalado)}</td>
                      <td style={{padding:8}}>{e.proveedor}</td>
                      <td style={{padding:8}}>{e.estado}</td>
                      <td style={{padding:8}}>{formatDate(e.fecha_en_proceso)}</td>
                      <td style={{padding:8}}>{formatDate(e.fecha_en_espera)}</td>
                      <td style={{padding:8}}>{formatDate(e.fecha_resuelto)}</td>
                      <td style={{padding:8}}>{e.solicitante}</td>
                      <td style={{padding:8}}>{e.area}</td>
                      <td style={{padding:8}}>{e.maquina}</td>
                      <td style={{padding:8}}>{e.urgencia}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{e.descripcion}</td>
                      <td style={{padding:8}}>{e.responsable}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{e.nota}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{e.observaciones}</td>
                      <td style={{padding:8}}>
                        <button onClick={()=>loadHistorial(e.ticket_id)} style={{padding:'6px 8px',borderRadius:6,cursor:'pointer'}}>Historial</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {historialTicketId && String(historialTicketId) && (
          <div style={{marginTop:12}} className="card">
            <h4>Historial del tique {historialTicketId} ({(historial||[]).length})</h4>
            <div className="super-table-wrap" style={{overflowX:'auto'}}>
              <table className="super-table" style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
                <thead><tr><th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Fecha</th><th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Acción</th><th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Estado</th><th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Usuario</th><th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Detalle</th></tr></thead>
                <tbody>
                  {(historial||[]).map((h,i)=> (
                    <tr key={i} style={{borderTop:'1px solid #eee'}}>
                      <td style={{padding:8}}>{formatDate(h.fecha)}</td>
                      <td style={{padding:8}}>{h.accion}</td>
                      <td style={{padding:8}}>{h.estado}</td>
                      <td style={{padding:8}}>{h.usuario}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{h.detalle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:8}}><button onClick={closeHistorial} style={{padding:'6px 10px',borderRadius:6}}>Cerrar historial</button></div>
          </div>
        )}

      </div>

    </div>
  )
}
