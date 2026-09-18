import React, { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'

const CalendarSchedule = dynamic(() => import('../components/CalendarScheduleSimple'), { ssr: false })

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
  const [selectedInfoTicket, setSelectedInfoTicket] = useState(null);
  const [filter, setFilter] = useState('');
  const [calendarView, setCalendarView] = useState('week');
  const [calendarDate, setCalendarDate] = useState(() => (new Date()).toISOString().slice(0,10));
  const [calendarTecnico, setCalendarTecnico] = useState(null);
  const [calendarOnlyAvailable, setCalendarOnlyAvailable] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);

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

  function sortHistorialAsc(historial){
    return [...(historial || [])].sort((a, b) => {
      const da = a && a.fecha ? new Date(a.fecha).getTime() : 0;
      const db = b && b.fecha ? new Date(b.fecha).getTime() : 0;
      return da - db;
    });
  }

  async function loadHistorial(ticketId){
    try{
      setHistorial([]);
      setHistorialTicketId(ticketId);
      const res = await api('/historial?ticket_id='+encodeURIComponent(String(ticketId)));
      const items = res.historial || res || [];
      setHistorial(sortHistorialAsc(items));
    }catch(e){ console.error('Error cargando historial', e); setHistorial([]); }
  }

  function closeHistorial(){ setHistorial([]); setHistorialTicketId(null); }

  function formatDateTime(value){
    if(!value) return '—';
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Guayaquil'
    }).format(d);
  }

  function getEscaladoInfo(ticketId){
    return (escalados || []).find(e => String(e.ticket_id) === String(ticketId)) || null;
  }

  function getTicketStateDate(ticket){
    if (!ticket) return null;
    const estado = String(ticket.estado || '').toLowerCase();
    const escalado = getEscaladoInfo(ticket.id);
    if (estado.includes('resuelto')) return ticket.fecha_resuelto || escalado?.fecha_resuelto || ticket.fecha_creacion || null;
    if (estado.includes('espera')) return ticket.fecha_en_espera || escalado?.fecha_en_espera || escalado?.fecha_escalado || ticket.fecha_creacion || null;
    if (estado.includes('proceso')) return ticket.fecha_en_proceso || escalado?.fecha_en_proceso || escalado?.fecha_escalado || ticket.fecha_creacion || null;
    if (estado.includes('escalado a servidor externo')) return escalado?.fecha_escalado || ticket.fecha_escalado || ticket.fecha_creacion || null;
    return ticket.fecha_creacion || null;
  }

  function getEscaladoStateDate(escalado){
    if (!escalado) return null;
    const estado = String(escalado.estado || '').toLowerCase();
    if (estado.includes('resuelto')) return escalado.fecha_resuelto || escalado.fecha_escalado || null;
    if (estado.includes('espera')) return escalado.fecha_en_espera || escalado.fecha_escalado || null;
    if (estado.includes('proceso')) return escalado.fecha_en_proceso || escalado.fecha_escalado || null;
    return escalado.fecha_escalado || null;
  }

  function downloadCSV(rows, filename){
    if(!rows || !rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(',')].concat(rows.map(r=> keys.map(k=> '"'+String(r[k]===undefined?'':r[k]).replace(/"/g,'""')+'"').join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  function downloadXLS(rows, filename){
    if(!rows || !rows.length) return;
    const keys = Object.keys(rows[0]);
    const html = ['<table><thead><tr>'+keys.map(k=>'<th>'+k+'</th>').join('')+'</tr></thead><tbody>'].concat(rows.map(r=> '<tr>'+keys.map(k=>'<td>'+String(r[k]===undefined?'':r[k])+'</td>').join('')+'</tr>')).concat(['</tbody></table>']).join('');
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  const tecnicos = useMemo(() => (usuarios || []).filter(u => String(u.rol || '').toLowerCase().includes('tecnico')), [usuarios]);

  function resolveTicketName(ticket, field, idField, fallback) {
    const value = ticket?.[field] || ticket?.[fallback] || '';
    if (value) return value;
    const idValue = ticket?.[idField];
    return idValue !== undefined && idValue !== null && idValue !== '' ? String(idValue) : '';
  }

  function getFilteredTickets({ ticketsList = tickets, view = calendarView, date = calendarDate, tecnico = calendarTecnico, onlyAvailable = calendarOnlyAvailable } = {}){
    if(!ticketsList) return [];
    const toDateOnly = (value) => {
      if(!value) return new Date();
      if(typeof value === 'string'){
        const trimmed = value.trim();
        const match = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
        if(match){
          const [y,m,day] = trimmed.split('-').map(Number); return new Date(y, m-1, day); }
      }
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? new Date() : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    };

    const d = toDateOnly(date);
    let windowStart, windowEnd;
    if(view === 'day'){
      windowStart = new Date(d); windowStart.setHours(0,0,0,0);
      windowEnd = new Date(d); windowEnd.setHours(23,59,59,999);
    } else if(view === 'week'){
      const wd = (d.getDay()+6)%7;
      windowStart = new Date(d); windowStart.setDate(d.getDate()-wd); windowStart.setHours(0,0,0,0);
      windowEnd = new Date(windowStart); windowEnd.setDate(windowStart.getDate()+6); windowEnd.setHours(23,59,59,999);
    } else if(view === 'month' || view === 'year'){
      windowStart = new Date(d.getFullYear(), d.getMonth(), 1); windowStart.setHours(0,0,0,0);
      windowEnd = new Date(d.getFullYear(), d.getMonth()+1, 0); windowEnd.setHours(23,59,59,999);
    } else {
      windowStart = new Date(d); windowStart.setHours(0,0,0,0);
      windowEnd = new Date(d); windowEnd.setHours(23,59,59,999);
    }

    return (ticketsList || []).filter(t => {
      const start = new Date(t.fecha_creacion || t.fecha || t.fecha_programada || t.created_at || null);
      if(!start || Number.isNaN(start.getTime())) return false;
      const end = t.fecha_resuelto ? new Date(t.fecha_resuelto) : new Date();
      if(end < windowStart || start > windowEnd) return false;
      if(tecnico){
        const norm = s => s ? String(s).toLowerCase().trim() : '';
        const tc = norm(tecnico);
        const ticketFields = [
          t.tecnico,
          t.tecnico_email,
          t.tecnico_nombre,
          t.tecnicoNombre,
          t.tecnico_id,
          t.tecnicoId,
          t.tecnicoId || t.tecnico_id,
        ].map(norm);
        const matches = ticketFields.some(f => f && (f === tc || f.includes(tc)));
        if(!matches) return false;
      }
      if(onlyAvailable){
        if(t.tecnico || t.tecnico_id || t.tecnico_email || t.tecnico_nombre || t.tecnicoNombre) return false;
      }
      return true;
    });
  }

  const filteredTickets = useMemo(() => getFilteredTickets(), [tickets, calendarView, calendarDate, calendarTecnico, calendarOnlyAvailable]);

  if(!session) return <div className="container"><div className="card"><h3>Debes iniciar sesión</h3></div></div>

  const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
  if(rol !== 'super' && rol !== 'admin') return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Necesitas rol <strong>super</strong> o <strong>admin</strong> para acceder.</p></div></div>

  const filtered = (arr, keys=[]) => arr.filter(r => {
    if(!filter) return true; const q = filter.toString().toLowerCase();
    return keys.some(k => (String(r[k]||'').toLowerCase().includes(q)));
  });

  return (
    <>
      <style jsx>{`
        .super-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          display: block;
        }
        .super-table {
          width: 100%;
          min-width: 980px;
          border-collapse: collapse;
          table-layout: auto;
        }
        .super-table th,
        .super-table td {
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.2;
          vertical-align: top;
          white-space: nowrap;
          text-align: left;
        }
        .super-table thead th {
          background: #f3f4f6;
          color: #111827;
          font-weight: 700;
        }
        .super-table tbody tr {
          border-top: 1px solid #e5e7eb;
        }
        @media (max-width: 720px) {
          .super-table {
            min-width: 820px;
          }
          .super-table th,
          .super-table td {
            font-size: 12px;
            padding: 8px 10px;
          }
        }
      `}</style>
      <div className="container">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        {isMobile ? (
          <button onClick={()=>setMenuOpen(true)} aria-label="Abrir menú" style={{background:'transparent',border:0,fontSize:22,cursor:'pointer',color:'#111'}}>☰</button>
        ) : (
          <div style={{width:24}} />
        )}
        <h2 style={{margin:0}}>Panel (Super) — Vista </h2>
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
          <div style={{display:'flex',gap:8,marginBottom:12,overflowX:'auto',WebkitOverflowScrolling:'touch',flexWrap:'nowrap',paddingBottom:4}}>
            {['resumen','areas','maquinas','proveedores','usuarios','tiques','escalados'].map(tab=> (
              <button key={tab} onClick={()=>setSuperTab(tab)} style={{padding:'8px 12px',borderRadius:6,border: superTab===tab ? '1px solid #2563eb' : '1px solid #e6eef8',background: superTab===tab ? '#eef6ff' : 'transparent',cursor:'pointer',color:'#111',whiteSpace:'nowrap',flex:'0 0 auto'}}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>
            ))}
          </div>
        )}

        {superTab === 'resumen' && (
          <div className="card" style={{padding:12}}>
            <h3 style={{marginTop:0}}>Resumen / Calendario y reportes</h3>

            <div style={{display:'flex',gap:12,flexWrap:'nowrap',marginBottom:12,overflowX:'auto',WebkitOverflowScrolling:'touch',minWidth:0,paddingBottom:4}}>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6,whiteSpace:'nowrap',flex:'0 0 auto'}}><strong>Áreas:</strong> {areas.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6,whiteSpace:'nowrap',flex:'0 0 auto'}}><strong>Maquinarias:</strong> {maquinas.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6,whiteSpace:'nowrap',flex:'0 0 auto'}}><strong>Proveedores:</strong> {proveedores.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6,whiteSpace:'nowrap',flex:'0 0 auto'}}><strong>Usuarios:</strong> {usuarios.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6,whiteSpace:'nowrap',flex:'0 0 auto'}}><strong>Tiques:</strong> {tickets.length}</div>
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6,whiteSpace:'nowrap',flex:'0 0 auto'}}><strong>Escalados:</strong> {escalados.length}</div>
            </div>

            <div className="filter-bar" style={{marginBottom:12, display:'flex', flexWrap:'nowrap', gap:12, alignItems:'center', overflowX:'auto', WebkitOverflowScrolling:'touch', minWidth:0, paddingBottom:4}}>
              <div className="filter-control">
                <label>Vista:</label>
                <select value={calendarView} onChange={e=>setCalendarView(e.target.value)} style={{marginLeft:8, padding:'8px 10px', borderRadius:6, border:'1px solid #dfe7f4', minWidth:120}}>
                  <option value="day">Diario</option>
                  <option value="week">Semanal</option>
                  <option value="month">Mensual</option>
                  <option value="year">Anual</option>
                </select>
              </div>
              <div className="filter-control">
                <label>Fecha:</label>
                <input type="date" value={calendarDate} onChange={e=>setCalendarDate(e.target.value)} style={{marginLeft:8, padding:'8px 10px', borderRadius:6, border:'1px solid #dfe7f4'}} />
              </div>
              <div className="filter-control">
                <label>Técnico:</label>
                <select value={calendarTecnico || ''} onChange={e=> setCalendarTecnico(e.target.value || null)} style={{marginLeft:8, padding:'8px 10px', borderRadius:6, border:'1px solid #dfe7f4', minWidth:140}}>
                  <option value="">-- Todos --</option>
                  {tecnicos.map(tc => <option key={tc.email || tc.id} value={tc.email || tc.id}>{tc.nombre || tc.email}</option>)}
                </select>
              </div>
              <div className="filter-control" style={{display:'flex', alignItems:'center', gap:8}}>
                <input type="checkbox" checked={calendarOnlyAvailable} onChange={e=> setCalendarOnlyAvailable(e.target.checked)} />
                <label>Mostrar sólo disponibles</label>
              </div>
              <div style={{marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap'}}>
                <button onClick={()=>{ const rows = (filteredTickets || []).map(t=>({ id:t.id, fecha:t.fecha_creacion || t.fecha, solicitante:t.solicitante, area:t.area, maquina:t.maquina, urgencia:t.urgencia, estado:t.estado, tecnico:t.tecnico })); downloadCSV(rows, 'super-calendario-tiques.csv'); }} style={{padding:'8px 14px',borderRadius:8,border:'1px solid #2563eb',background:'#2563eb',color:'#fff',cursor:'pointer'}}>Exportar visibles CSV</button>
                <button onClick={()=>{ const rows = (filteredTickets || []).map(t=>({ id:t.id, fecha:t.fecha_creacion || t.fecha, solicitante:t.solicitante, area:t.area, maquina:t.maquina, urgencia:t.urgencia, estado:t.estado, tecnico:t.tecnico })); downloadXLS(rows, 'super-calendario-tiques.xls'); }} style={{padding:'8px 14px',borderRadius:8,border:'1px solid #2563eb',background:'#2563eb',color:'#fff',cursor:'pointer'}}>Exportar visibles XLS</button>
              </div>
            </div>

            <CalendarSchedule
              tecnicos={tecnicos}
              tickets={filteredTickets}
              view={calendarView}
              currentDate={calendarDate || undefined}
              filterTecnico={calendarTecnico}
              onlyAvailable={calendarOnlyAvailable}
              escalados={escalados}
            />

            <div style={{marginTop:18}}>
              <h4 style={{margin:'0 0 12px'}}>Reportes / resumen</h4>
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
                <div style={{padding:12,border:'1px solid #eee',borderRadius:8,minWidth:120}}><strong>Tiques:</strong> {filteredTickets.length}</div>
                <div style={{padding:12,border:'1px solid #eee',borderRadius:8,minWidth:120}}><strong>Resueltos:</strong> {(filteredTickets.filter(t => String(t.estado || '').toLowerCase().includes('resuelto'))).length}</div>
                <div style={{padding:12,border:'1px solid #eee',borderRadius:8,minWidth:120}}><strong>En proceso:</strong> {(filteredTickets.filter(t => String(t.estado || '').toLowerCase().includes('proceso'))).length}</div>
                <div style={{padding:12,border:'1px solid #eee',borderRadius:8,minWidth:120}}><strong>Espera:</strong> {(filteredTickets.filter(t => String(t.estado || '').toLowerCase().includes('espera'))).length}</div>
                <div style={{padding:12,border:'1px solid #eee',borderRadius:8,minWidth:120}}><strong>Escalados:</strong> {(filteredTickets.filter(t => String(t.estado || '').toLowerCase().includes('escalad'))).length}</div>
              </div>

              <div className="super-table-wrap" style={{overflowX:'auto'}}>
                <table className="super-table" style={{width:'100%',borderCollapse:'collapse',minWidth:1000}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>ID</th>
                      <th style={{textAlign:'left',padding:8,background:'#1658db',fontWeight:700}}>Fecha</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Solicitante</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Area</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Máquina</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Estado</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Técnico</th>
                      <th style={{textAlign:'left',padding:8,background:'#f3f4f6',fontWeight:700}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const start = (reportPage - 1) * reportPageSize;
                      const pageItems = (filteredTickets || []).slice(start, start + reportPageSize);
                      if(pageItems.length === 0) return (<tr><td colSpan={8} style={{padding:12}}>No hay eventos para la selección.</td></tr>);
                      return pageItems.map(t => (
                        <tr key={t.id} style={{borderTop:'1px solid #161515'}}>
                          <td style={{padding:8}}>{t.id}</td>
                          <td style={{padding:8}}>{formatDate(t.fecha_creacion || t.fecha || t.fecha_programada)}</td>
                          <td style={{padding:8}}>{resolveTicketName(t, 'solicitante_nombre', 'solicitante_id', 'solicitante') || t.usuario || ''}</td>
                          <td style={{padding:8}}>{resolveTicketName(t, 'area_nombre', 'area_id', 'area') || ''}</td>
                          <td style={{padding:8}}>{resolveTicketName(t, 'maquina_nombre', 'maquina_id', 'maquina') || ''}</td>
                          <td style={{padding:8}}>{t.estado || ''}</td>
                          <td style={{padding:8}}>{resolveTicketName(t, 'tecnico_nombre', 'tecnico_id', 'tecnico') || ''}</td>
                          <td style={{padding:8, whiteSpace:'nowrap'}}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'nowrap' }}>
                              <button type="button" onClick={()=> setSelectedInfoTicket(t)} style={{padding:'6px 8px',borderRadius:6,cursor:'pointer',whiteSpace:'nowrap'}}>Info</button>
                              <button type="button" onClick={()=>loadHistorial(t.id)} style={{padding:'6px 8px',borderRadius:6,cursor:'pointer',whiteSpace:'nowrap'}}>Historial</button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12}}>
                <button onClick={()=> setReportPage(p => Math.max(1, p-1))} disabled={reportPage<=1} style={{padding:'6px 10px',borderRadius:6,cursor:reportPage<=1 ? 'not-allowed' : 'pointer'}}>Anterior</button>
                <div>Página {reportPage} / {Math.max(1, Math.ceil((filteredTickets.length||0)/reportPageSize))}</div>
                <button onClick={()=> setReportPage(p => Math.min(Math.ceil((filteredTickets.length||0)/reportPageSize), p+1))} disabled={reportPage>=Math.ceil((filteredTickets.length||0)/reportPageSize)} style={{padding:'6px 10px',borderRadius:6,cursor:reportPage>=Math.ceil((filteredTickets.length||0)/reportPageSize) ? 'not-allowed' : 'pointer'}}>Siguiente</button>
              </div>
            </div>
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
                      <td style={{padding:8}}>{resolveTicketName(t, 'solicitante_nombre', 'solicitante_id', 'solicitante')}</td>
                      <td style={{padding:8}}>{resolveTicketName(t, 'area_nombre', 'area_id', 'area')}</td>
                      <td style={{padding:8}}>{resolveTicketName(t, 'maquina_nombre', 'maquina_id', 'maquina')}</td>
                      <td style={{padding:8}}>{t.urgencia}</td>
                      <td style={{padding:8}}><input disabled value={t.descripcion || ''} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',background:'#fff',color:'#111827'}} /></td>
                      <td style={{padding:8}}>{t.estado}</td>
                      <td style={{padding:8}}>{resolveTicketName(t, 'tecnico_nombre', 'tecnico_id', 'tecnico')}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_asignacion)}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_en_proceso)}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_en_espera)}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_resuelto)}</td>
                      <td style={{padding:8}}>{formatDate(t.fecha_escalado)}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{t.nota}</td>
                      <td style={{padding:8}}>{formatDate(t.ultima_actualizacion)}</td>
                      <td style={{padding:8, whiteSpace:'nowrap'}}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'nowrap' }}>
                          <button onClick={()=>loadHistorial(t.id)} style={{padding:'6px 8px',borderRadius:6,cursor:'pointer',whiteSpace:'nowrap'}}>Historial</button>
                        </div>
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
                      <td style={{padding:8}}>{e.proveedor_nombre || e.proveedor}</td>
                      <td style={{padding:8}}>{e.estado}</td>
                      <td style={{padding:8}}>{formatDate(e.fecha_en_proceso)}</td>
                      <td style={{padding:8}}>{formatDate(e.fecha_en_espera)}</td>
                      <td style={{padding:8}}>{formatDate(e.fecha_resuelto)}</td>
                      <td style={{padding:8}}>{e.solicitante_nombre || e.solicitante}</td>
                      <td style={{padding:8}}>{e.area_nombre || e.area}</td>
                      <td style={{padding:8}}>{e.maquina_nombre || e.maquina}</td>
                      <td style={{padding:8}}>{e.urgencia}</td>
                      <td style={{padding:8}}><input disabled value={e.descripcion || ''} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',background:'#fff',color:'#111827'}} /></td>
                      <td style={{padding:8}}>{e.responsable_nombre || e.responsable}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{e.nota}</td>
                      <td style={{padding:8,whiteSpace:'pre-wrap'}}>{e.observaciones}</td>
                      <td style={{padding:8, whiteSpace:'nowrap'}}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'nowrap' }}>
                          <button type="button" onClick={()=> setSelectedInfoTicket({ ...e, id: e.ticket_id, estado: e.estado, area_nombre: e.area_nombre || e.area, maquina_nombre: e.maquina_nombre || e.maquina, solicitante_nombre: e.solicitante_nombre || e.solicitante, descripcion: e.descripcion || '', urgencia: e.urgencia || '' })} style={{padding:'6px 8px',borderRadius:6,cursor:'pointer',whiteSpace:'nowrap'}}>Info</button>
                          <button type="button" onClick={()=>loadHistorial(e.ticket_id)} style={{padding:'6px 8px',borderRadius:6,cursor:'pointer',whiteSpace:'nowrap'}}>Historial</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedInfoTicket && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.18)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000, padding:20 }} onClick={()=> setSelectedInfoTicket(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:18, padding:20, width:'min(760px, 92vw)', maxHeight:'82vh', overflowY:'auto', boxShadow:'0 30px 60px rgba(15, 23, 42, 0.22)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:18 }}>
                <div style={{ fontSize:18, fontWeight:700, color:'#0f172a' }}>Detalle del tique {selectedInfoTicket.id || '—'}</div>
                <button onClick={()=> setSelectedInfoTicket(null)} style={{ border:'none', background:'#e2e8f0', color:'#0f172a', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontWeight:600 }}>Cerrar</button>
              </div>

              <div style={{ display:'grid', gap:10, color:'#0f172a' }}>
                <div><strong>Estado:</strong> <span>{selectedInfoTicket.estado || '—'}</span></div>
                <div><strong>Fecha del estado:</strong> <span>{getTicketStateDate(selectedInfoTicket) ? formatDateTime(getTicketStateDate(selectedInfoTicket)) : '—'}</span></div>
                <div><strong>Fecha de creación del tique:</strong> <span>{selectedInfoTicket.fecha_creacion ? formatDateTime(selectedInfoTicket.fecha_creacion) : '—'}</span></div>
                <div><strong>Área:</strong> <span>{selectedInfoTicket.area_nombre || selectedInfoTicket.area || '—'}</span></div>
                <div><strong>Máquina:</strong> <span>{selectedInfoTicket.maquina_nombre || selectedInfoTicket.maquina || '—'}</span></div>
                <div><strong>Urgencia:</strong> <span>{selectedInfoTicket.urgencia || '—'}</span></div>
                <div><strong>Solicitante:</strong> <span>{selectedInfoTicket.solicitante_nombre || selectedInfoTicket.solicitante || '—'}</span></div>
                <div><strong>Descripción:</strong> <span>{selectedInfoTicket.descripcion || '—'}</span></div>
              </div>

              {String(selectedInfoTicket.estado || '').toLowerCase().includes('escalado a servidor externo') && (() => {
                const escalado = getEscaladoInfo(selectedInfoTicket.id);
                if(!escalado) return null;
                return (
                  <div style={{ marginTop:18, borderTop:'1px solid #e5e7eb', paddingTop:16 }}>
                    <div style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>Información del escalado</div>
                    <div style={{ display:'grid', gap:10 }}>
                      <div><strong>Proveedor:</strong> <span>{escalado.proveedor_nombre || escalado.proveedor || '—'}</span></div>
                      <div><strong>Responsable:</strong> <span>{escalado.responsable_nombre || escalado.responsable || '—'}</span></div>
                      <div><strong>Estado del escalado:</strong> <span>{escalado.estado || '—'}</span></div>
                      <div><strong>Fecha del estado:</strong> <span>{getEscaladoStateDate(escalado) ? formatDateTime(getEscaladoStateDate(escalado)) : '—'}</span></div>
                      <div><strong>Nota:</strong> <span>{escalado.nota || '—'}</span></div>
                      <div><strong>Observaciones:</strong> <span>{escalado.observaciones || '—'}</span></div>
                      <div><strong>Fecha de escalado a servidor externo:</strong> <span>{escalado.fecha_escalado ? formatDateTime(escalado.fecha_escalado) : '—'}</span></div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {historialTicketId && String(historialTicketId) && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.18)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000, padding:20 }} onClick={closeHistorial}>
            <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:18, padding:20, width:'min(900px, 92vw)', maxHeight:'82vh', overflowY:'auto', boxShadow:'0 30px 60px rgba(15, 23, 42, 0.22)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:18 }}>
                <div style={{ fontSize:18, fontWeight:700, color:'#0f172a' }}>Historial del tique {historialTicketId} ({(historial||[]).length})</div>
                <button onClick={closeHistorial} style={{ border:'none', background:'#e2e8f0', color:'#0f172a', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontWeight:600 }}>Cerrar</button>
              </div>
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
                    {(!historial || historial.length===0) && <tr><td colSpan={5} style={{padding:12}}>No hay historial para este tique.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
    </>
  )
}
