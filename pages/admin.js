import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
const CalendarSchedule = dynamic(()=> import('../components/CalendarScheduleSimple'), { ssr:false })
const SpreadsheetTable = dynamic(()=> import('../components/SpreadsheetTable'), { ssr:false })
import { useSession } from 'next-auth/react'
import { api } from '../lib/api'
import { formatDate, statusClass } from '../lib/format'
import { useDialog } from '../components/DialogProvider'

function BarChart({ data, width=300, height=120, color='#2563eb' }){
  const total = data.reduce((s,i)=>s+i.value,0) || 1;
  const gap = 6; const barW = (width - (data.length-1)*gap) / Math.max(1,data.length);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d,i)=>{
        const h = Math.round((d.value/total) * (height-24));
        const x = i*(barW+gap);
        return (<g key={d.label}>
          <rect x={x} y={height-16-h} width={barW} height={h} rx={4} fill={d.color||color} />
          <text x={x+barW/2} y={height-4} fontSize={10} fill="#111" textAnchor="middle">{d.label}</text>
        </g>)
      })}
    </svg>
  )
}

function ReportByStatus({ tickets }){
  const counts = {};
  (tickets||[]).forEach(t=> counts[t.estado || 'Abierto'] = (counts[t.estado || 'Abierto']||0)+1);
  const data = Object.keys(counts).map(k=>({ label:k, value:counts[k] }));
  return (<div><BarChart data={data} /><ul>{data.map(d=> <li key={d.label}><strong>{d.label}:</strong> {d.value}</li>)}</ul></div>)
}

function ReportByUrgencia({ tickets }){
  const counts = {};
  (tickets||[]).forEach(t=> counts[t.urgencia || 'Baja'] = (counts[t.urgencia || 'Baja']||0)+1);
  const data = Object.keys(counts).map(k=>({ label:k, value:counts[k] }));
  return (<div><BarChart data={data} color="#10b981" /><ul>{data.map(d=> <li key={d.label}><strong>{d.label}:</strong> {d.value}</li>)}</ul></div>)
}

function ReportByArea({ tickets }){
  const counts = {};
  (tickets||[]).forEach(t=> counts[t.area || 'Sin área'] = (counts[t.area || 'Sin área']||0)+1);
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>({ label:e[0], value:e[1] }));
  return (<div><BarChart data={entries} color="#7c3aed" /><ol>{entries.map(e=> <li key={e.label}>{e.label}: {e.value}</li>)}</ol></div>)
}

function ReportEscalados({ escalados }){
  const counts = {};
  (escalados||[]).forEach(e=> counts[e.proveedor || 'Sin proveedor'] = (counts[e.proveedor || 'Sin proveedor']||0)+1);
  const data = Object.keys(counts).map(k=>({ label:k, value:counts[k] }));
  return (<div><BarChart data={data} color="#ef4444" /><ul>{data.map(d=> <li key={d.label}><strong>{d.label}:</strong> {d.value}</li>)}</ul></div>)
}

function ReportByTecnico({ tickets }){
  const counts = {};
  (tickets||[]).forEach(t=> counts[t.tecnico || 'Sin asignar'] = (counts[t.tecnico || 'Sin asignar']||0)+1);
  const data = Object.keys(counts).map(k=>({ label:k, value:counts[k] }));
  return (<div><BarChart data={data} color="#f59e0b" /><ul>{data.map(d=> <li key={d.label}><strong>{d.label}:</strong> {d.value}</li>)}</ul></div>)
}

function ReportTiempoResolucion({ tickets }){
  // calcula el tiempo promedio de resolución en horas para tiques con fecha_creacion y fecha_resuelto
  const times = [];
  (tickets||[]).forEach(t=>{
    const a = t.fecha_creacion || t.fecha || t.fechaCreacion;
    const b = t.fecha_resuelto || t.fechaResuelto || t.resuelto_fecha;
    if(a && b){
      const diff = (new Date(b) - new Date(a)) / (1000*60*60); // horas
      if(!isNaN(diff)) times.push(diff);
    }
  });
  const avg = times.length? (times.reduce((s,x)=>s+x,0)/times.length) : 0;
  return (<div><div>Promedio resolución: <strong>{avg.toFixed(2)} horas</strong> ({times.length} tiques calculables)</div></div>)
}

function downloadCSV(rows, filename){
  if(!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(',')].concat(rows.map(r=> keys.map(k=> '"'+String(r[k]===undefined?'':r[k]).replace(/"/g,'""')+'"').join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function downloadXLS(rows, filename){
  if(!rows || !rows.length) return;
  // tabla HTML simple que Excel podrá abrir
  const keys = Object.keys(rows[0]);
  const html = ['<table><thead><tr>'+keys.map(k=>'<th>'+k+'</th>').join('')+'</tr></thead><tbody>'].concat(
    rows.map(r=> '<tr>'+keys.map(k=>'<td>'+String(r[k]===undefined?'':r[k])+'</td>').join('')+'</tr>')
  ).concat(['</tbody></table>']).join('');
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function Admin(){
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState('areas');
  const [areas, setAreas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [serverTick, setServerTick] = useState(0);
  const [tecnicos, setTecnicos] = useState([]);
  const [escalados, setEscalados] = useState([]);
  const [escaladosEdit, setEscaladosEdit] = useState({});
  const [savingIds, setSavingIds] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUserForm, setEditingUserForm] = useState({ email:'', nombre:'', rol:'', password:'' });
  const [editingProveedorId, setEditingProveedorId] = useState(null);
  const [editingProveedorForm, setEditingProveedorForm] = useState({ nombre:'', contacto:'' });
  const [editingAreaId, setEditingAreaId] = useState(null);
  const [editingAreaForm, setEditingAreaForm] = useState({ nombre:'' });
  const [editingMaquinaId, setEditingMaquinaId] = useState(null);
  const [editingMaquinaForm, setEditingMaquinaForm] = useState({ nombre:'' });

  const [newArea, setNewArea] = useState('');
  const [newMaquina, setNewMaquina] = useState('');
  const [userForm, setUserForm] = useState({ email:'', nombre:'', rol:'empleado', password:'' });
  const [areaLoading, setAreaLoading] = useState(false);
  const [maquinaLoading, setMaquinaLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(()=>{ if(session) loadAll(); }, [session]);
  const [toasts, setToasts] = useState([]);
  const [calendarView, setCalendarView] = useState('week');
  const [calendarDate, setCalendarDate] = useState(() => (new Date()).toISOString().slice(0,10));
  const [calendarTecnico, setCalendarTecnico] = useState(null);
  const [calendarOnlyAvailable, setCalendarOnlyAvailable] = useState(false);
  const [historialByTicket, setHistorialByTicket] = useState({});
  const [expandedTickets, setExpandedTickets] = useState([]);
  const [expandedEscalados, setExpandedEscalados] = useState([]);
  const [adminTab, setAdminTab] = useState('tiques');
  const [ticketSort, setTicketSort] = useState('fecha_desc');
  const [ticketQuery, setTicketQuery] = useState('');
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);
  const { openPrompt, openConfirm } = useDialog();

  // filtro centralizado usado por el calendario, la tabla y las exportaciones
  function getFilteredTickets({ ticketsList = tickets, view = calendarView, date = calendarDate, tecnico = calendarTecnico, onlyAvailable = calendarOnlyAvailable }){
    if(!ticketsList) return [];
    const toCalendarDate = (value) => {
      if(!value) return new Date();
      if(typeof value === 'string'){
        const trimmed = value.trim();
        const match = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
        if(match){
          const [y,m,day] = trimmed.split('-').map(Number);
          return new Date(y, m-1, day);
        }
      }
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? new Date() : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    };
    const toLocalDateOnly = (value) => {
      if(!value) return null;
      const dt = new Date(value);
      if(Number.isNaN(dt.getTime())) return null;
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' });
      const parts = fmt.formatToParts(dt).reduce((acc, p) => { if(p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
      if(parts.year && parts.month && parts.day){
        return new Date(Number(parts.year), Number(parts.month)-1, Number(parts.day));
      }
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    };
    const d = toCalendarDate(date);
    // inicio/fin de la ventana según la vista
    let windowStart, windowEnd;
    if(view === 'day'){
      windowStart = new Date(d); windowStart.setHours(0,0,0,0);
      windowEnd = new Date(d); windowEnd.setHours(23,59,59,999);
    } else if(view === 'week'){
      const wd = (d.getDay()+6)%7; // 0=Lun
      windowStart = new Date(d); windowStart.setDate(d.getDate() - wd); windowStart.setHours(0,0,0,0);
      windowEnd = new Date(windowStart); windowEnd.setDate(windowStart.getDate()+6); windowEnd.setHours(23,59,59,999);
    } else if(view === 'month' || view === 'year'){
      windowStart = new Date(d.getFullYear(), d.getMonth(), 1); windowStart.setHours(0,0,0,0);
      windowEnd = new Date(d.getFullYear(), d.getMonth()+1, 0); windowEnd.setHours(23,59,59,999);
    } else {
      windowStart = new Date(d); windowStart.setHours(0,0,0,0);
      windowEnd = new Date(d); windowEnd.setHours(23,59,59,999);
    }

    const result = (ticketsList||[]).filter(t=>{
      const start = toLocalDateOnly(t.fecha_creacion || t.fecha || t.fechaProgramada || t.fecha_programada || t.created_at || null);
      if(!start || isNaN(start)) return false;
      const end = toLocalDateOnly(t.fecha_resuelto || t.fechaResuelto || t.fecha_resuelto || null) || new Date();
      // comprobación de solapamiento usando la fecha local de la región
      if(end < windowStart || start > windowEnd) return false;
      // filtro de técnico: coincidir por id, email o nombre (exacto o parcial)
      if(tecnico){
        const norm = s => s ? String(s).toLowerCase().trim() : '';
        const tc = norm(tecnico);
        const ticketFields = [t.tecnico, t.tecnico_email, t.tecnico_id, t.tecnicoNombre, t.tecnico_nombre, t.tecnicoId, t.tecnico_id].map(norm);
        const matches = ticketFields.some(f => f && (f === tc || f.includes(tc)));
        if(!matches) return false;
      }
      // onlyAvailable -> solo tiques sin técnico asignado (comprobar campos comunes)
      if(onlyAvailable){ if(t.tecnico || t.tecnico_id || t.tecnico_email || t.tecnico_nombre || t.tecnicoNombre) return false; }
      return true;
    });
    return result;
  }

  const filteredTickets = useMemo(()=> getFilteredTickets({}), [tickets, calendarView, calendarDate, calendarTecnico, calendarOnlyAvailable]);

  function showToast(message, type='info', ttl=4000){
    const id = Date.now() + Math.random().toString(36).slice(2,8);
    setToasts(t => t.concat([{ id, message, type }]));
    setTimeout(()=> setToasts(t => t.filter(x=>x.id!==id)), ttl);
  }

  async function loadAll(){
    // petición robusta: si un endpoint devuelve 403/500 no abortamos las demás cargas
    const safeApi = async (path) => { try{ return await api(path); }catch(e){ console.warn('safeApi error', path, e && e.message); return null; } };
    try{
      const [a,m,p,u,t,tec,es] = await Promise.all([
        safeApi('/areas'),
        safeApi('/maquinas'),
        safeApi('/proveedores'),
        safeApi('/users'),
        safeApi('/tickets'),
        safeApi('/tecnicos'),
        safeApi('/escalados')
      ]);
      if(a) setAreas(a.areas || []);
      if(m) setMaquinas(m.maquinas || []);
      if(p) setProveedores(p.proveedores || []);
      if(u) setUsuarios(u.users || []);
      if(t) setTickets(t.tickets || t.tiques || []);
      if(tec) setTecnicos(tec.users || tec.tecnicos || []);
      if(es) setEscalados(es.escalados || []);
      // marcar esto como una recarga desde el servidor para que los componentes hijos actualicen sus mapas de estado original
      setServerTick(s => s + 1);
    }catch(err){ console.error('loadAll unexpected error', err); showToast('Error al cargar datos', 'error'); }
  }

  async function guardarTicketAdmin(id){
    const ok = await openConfirm('Guardar cambios en el ticket?');
    if(!ok) return;
    // solicitar una nota para incluir en historial (opcional)
    const notaInput = await openPrompt('Nota para el historial (opcional):', '');
    const confirmarId = String(id);
    setSavingIds(prev => Array.from(new Set(prev.concat([confirmarId]))));
    try{
      // leer ticket actual desde el estado para construir el payload
      const t = (tickets||[]).find(x=> String(x.id) === String(id));
      if(!t) throw new Error('Ticket no encontrado en estado local');
      const detalleNota = (notaInput && notaInput.trim()) ? notaInput.trim() : '';
      const combinedNota = detalleNota ? (detalleNota + ' — Descripción: ' + (t.descripcion || '')) : ('Descripción: ' + (t.descripcion || ''));
      const payload = {
        descripcion: t.descripcion || '',
        nota: combinedNota,
        area: t.area || '',
        maquina: t.maquina || '',
        estado: t.estado || '',
        tecnico: t.tecnico || ''
      };
      // Si el estado cambiado es Escalado a Servidor Externo, crear un escalado en vez de sobrescribir el ticket
      if((payload.estado||'').toString().toLowerCase().includes('escalad')){
        const proveedor = await openPrompt('Proveedor externo (nombre):', '');
        if(!proveedor) throw new Error('Proveedor requerido para escalado');
        const okEsc = await openConfirm('Confirmar escalado a proveedor: ' + proveedor + '?');
        if(!okEsc) return;
        const responsable = (session?.user?.nombre) || (session?.user?.email) || '';
        await api('/escalados', { method:'POST', body: JSON.stringify({ ticket_id: id, proveedor, nota: combinedNota, responsable }) });
        await loadAll();
        showToast('Ticket escalado y guardado', 'success');
      } else {
        await api('/tickets/'+id, { method:'PUT', body: JSON.stringify(payload) });
        await loadAll();
        showToast('Ticket guardado', 'success');
      }
    }catch(e){ console.error(e); showToast && showToast(e.message || String(e), 'error'); }
    finally{ setSavingIds(prev => prev.filter(x=>x!==confirmarId)); }
  }

  async function guardarCampoTicket(id, field, value){
    const confirmarId = String(id) + '::' + field;
    setSavingIds(prev => Array.from(new Set(prev.concat([confirmarId]))));
    try{
      const body = { [field]: value };
      await api('/tickets/'+id, { method:'PUT', body: JSON.stringify(body) });
      // refrescar un poco
      await loadAll();
      showToast('Campo guardado', 'success');
    }catch(e){ console.error(e); showToast && showToast(e.message || String(e), 'error'); }
    finally{ setSavingIds(prev => prev.filter(x=>x!==confirmarId)); }
  }

  async function guardarEscalado(id){
    try{
      showToast('Guardando escalado...', 'info');
      console.log('guardarEscalado start', id, escaladosEdit[id]);
      // usar valores editados si están presentes
      const row = (escalados || []).find(x=> String(x.id) === String(id)) || {};
      const ed = escaladosEdit[String(id)] || {};
      const proveedor = (ed.proveedor !== undefined) ? ed.proveedor : (row.proveedor || '');
      const estado = (ed.estado !== undefined) ? ed.estado : (row.estado || '');
      const responsable = (ed.responsable !== undefined) ? ed.responsable : (row.responsable || '');
      const nota = (ed.nota !== undefined) ? ed.nota : (row.nota || '');
      const observaciones = (ed.observaciones !== undefined) ? ed.observaciones : (row.observaciones || '');
      // encontrar id del ticket para este escalado para invalidar la caché de historial
      const ticketId = row.ticket_id;
      const res = await api('/escalados/'+id, { method:'PUT', body: JSON.stringify({ proveedor, estado, responsable, nota, observaciones }) });
      console.log('guardarEscalado response', res);
      // borrar caché de edición para esta fila
      setEscaladosEdit(prev => { const c = { ...prev }; delete c[String(id)]; return c; });
      // refrescar listas
      await loadAll();
      // obtener y actualizar el historial en caché para el ticket relacionado, de modo que la UI muestre las entradas más recientes de inmediato
      if(ticketId){
        try{
          const rh = await api('/historial?ticket_id='+encodeURIComponent(String(ticketId)));
          setHistorialByTicket(prev => ({ ...prev, [String(ticketId)]: rh.historial || [] }));
        }catch(fetchErr){ console.error('Error recargando historial', fetchErr); }
      }
      showToast('Escalado actualizado', 'success');
    }catch(e){ console.error('guardarEscalado error', e); showToast(e.message || String(e), 'error'); }
  }

  async function eliminarEscalado(id){
    const ok = await openConfirm('Confirmar eliminación del registro de escalado?');
    if(!ok) return;
    try{ await api('/escalados/'+id, { method:'DELETE' }); await loadAll(); showToast('Eliminado', 'success'); }
    catch(e){ showToast(e.message || String(e), 'error'); }
  }

  async function escalarTicket(id){
    const proveedor = await openPrompt('Proveedor externo (nombre):', '');
    if(!proveedor) return;
    const nota = await openPrompt('Nota para el escalado (opcional):', '') || '';
    const ok = await openConfirm('Confirmar escalado a proveedor: ' + proveedor + '?');
    if(!ok) return;
    const confirmarId = String(id);
    setSavingIds(prev => Array.from(new Set(prev.concat([confirmarId]))));
    try{
      const responsable = (session?.user?.nombre) || (session?.user?.email) || '';
      await api('/escalados', { method:'POST', body: JSON.stringify({ ticket_id: id, proveedor, nota, responsable }) });
      await loadAll();
      showToast('Ticket escalado', 'success');
    }catch(e){ console.error(e); showToast && showToast(e.message || String(e), 'error'); }
    finally{ setSavingIds(prev => prev.filter(x=>x!==confirmarId)); }
  }

  async function addArea(){
    if(!newArea.trim()) return showToast('Nombre requerido', 'error');
    try{
      setAreaLoading(true);
      await api('/areas', { method:'POST', body: JSON.stringify({ nombre:newArea }) });
      setNewArea('');
      await loadAll();
    }catch(e){ showToast && showToast(e.message || String(e), 'error'); }
    finally{ setAreaLoading(false); }
  }

  async function addMaquina(){
    if(!newMaquina.trim()) return showToast('Nombre requerido', 'error');
    try{
      setMaquinaLoading(true);
      await api('/maquinas', { method:'POST', body: JSON.stringify({ nombre:newMaquina }) });
      setNewMaquina('');
      await loadAll();
    }catch(e){ showToast && showToast(e.message || String(e), 'error'); }
    finally{ setMaquinaLoading(false); }
  }

  async function addProveedor(){
    const nombre = await openPrompt('Nombre del proveedor:','');
    if(!nombre) return;
    const contacto = await openPrompt('Contacto (email/telefono) (opcional):','') || '';
    try{ await api('/proveedores', { method:'POST', body: JSON.stringify({ nombre, contacto }) }); await loadAll(); }
    catch(e){ showToast(e.message || String(e), 'error'); }
  }

  async function removeItem(path){
    const ok = await openConfirm('Confirmar eliminación');
    if(!ok) return;
    try{ await api(path, { method:'DELETE' }); await loadAll(); showToast('Eliminado', 'success'); }
    catch(e){ showToast(e.message || String(e), 'error'); }
  }

  async function editItem(path, current){
    const nuevo = await openPrompt('Nuevo valor', current || '');
    if(nuevo==null) return;
    try{ await api(path, { method:'PUT', body: JSON.stringify({ nombre:nuevo }) }); await loadAll(); showToast('Actualizado', 'success'); }
    catch(e){ showToast(e.message || String(e), 'error'); }
  }

  function startEditUser(u){
    setEditingUserId(u.id);
    setEditingUserForm({ email: u.email||'', nombre: u.nombre||'', rol: u.rol||u.role||'empleado', password: '' });
  }

  async function saveUserEdit(id){
    if(!editingUserForm.email || !editingUserForm.nombre) return showToast('Email y nombre son obligatorios', 'error');
    if(editingUserForm.password && editingUserForm.password.length < 6) return showToast('Password mínimo 6 caracteres', 'error');
    try{
      setUserLoading(true);
      const payload = { email: editingUserForm.email, nombre: editingUserForm.nombre, rol: editingUserForm.rol };
      if(editingUserForm.password) payload.password = editingUserForm.password;
      await api('/users/'+encodeURIComponent(id), { method:'PUT', body: JSON.stringify(payload) });
      setEditingUserId(null); setEditingUserForm({ email:'', nombre:'', rol:'', password:'' });
      await loadAll(); showToast('Usuario actualizado', 'success');
    }catch(e){ showToast(e.message || String(e), 'error'); }
    finally{ setUserLoading(false); }
  }

  function cancelEditUser(){ setEditingUserId(null); setEditingUserForm({ email:'', nombre:'', rol:'', password:'' }); }

  function startEditProveedor(p){ setEditingProveedorId(p.id); setEditingProveedorForm({ nombre: p.nombre||'', contacto: p.contacto||'' }); }

  async function saveProveedorEdit(id){
    try{
      const payload = { id, ...editingProveedorForm };
      await api('/proveedores', { method:'PUT', body: JSON.stringify(payload) });
      setEditingProveedorId(null);
      setEditingProveedorForm({ nombre:'', contacto:'' });
      await loadAll();
      showToast('Proveedor actualizado','success');
    }catch(e){ showToast(e.message||String(e),'error'); }
  }

  function cancelEditProveedor(){ setEditingProveedorId(null); setEditingProveedorForm({ nombre:'', contacto:'' }); }

  function startEditArea(a){ setEditingAreaId(a.id); setEditingAreaForm({ nombre: a.nombre||'' }); }

  async function saveAreaEdit(id){
    try{
      const payload = { id, nombre: editingAreaForm.nombre };
      await api('/areas', { method:'PUT', body: JSON.stringify(payload) });
      setEditingAreaId(null);
      setEditingAreaForm({ nombre:'' });
      await loadAll();
      showToast('Área actualizada','success');
    }catch(e){ showToast(e.message||String(e),'error'); }
  }

  function cancelEditArea(){ setEditingAreaId(null); setEditingAreaForm({ nombre:'' }); }

  function startEditMaquina(m){ setEditingMaquinaId(m.id); setEditingMaquinaForm({ nombre: m.nombre||'' }); }

  async function saveMaquinaEdit(id){
    try{
      const payload = { id, nombre: editingMaquinaForm.nombre };
      await api('/maquinas', { method:'PUT', body: JSON.stringify(payload) });
      setEditingMaquinaId(null);
      setEditingMaquinaForm({ nombre:'' });
      await loadAll();
      showToast('Máquina actualizada','success');
    }catch(e){ showToast(e.message||String(e),'error'); }
  }

  function cancelEditMaquina(){ setEditingMaquinaId(null); setEditingMaquinaForm({ nombre:'' }); }

  async function addUsuario(){
    if(!userForm.email || !userForm.nombre) return showToast('Email y nombre son obligatorios', 'error');
    if(userForm.password && userForm.password.length < 6) return showToast('Password mínimo 6 caracteres', 'error');
    try{
      setUserLoading(true);
      await api('/users', { method:'POST', body: JSON.stringify(userForm) });
      setUserForm({ email:'', nombre:'', rol:'empleado', password:'' });
      await loadAll();
    }catch(e){ showToast(e.message || String(e), 'error'); }
    finally{ setUserLoading(false); }
  }

  async function toggleHist(id){
    const key = String(id);
    if(expandedTickets.includes(key)){
      setExpandedTickets(prev => prev.filter(x=>x!==key));
      return;
    }
    // fetch historial if not present
    if(!historialByTicket[key]){
      try{
        showToast('Cargando historial...', 'info');
        const r = await api('/historial?ticket_id='+encodeURIComponent(key));
        console.log('toggleHist loaded', key, r);
        setHistorialByTicket(h => ({ ...h, [key]: r.historial || [] }));
      }catch(e){ showToast('Error cargando historial', 'error'); return; }
    }
    setExpandedTickets(prev => Array.from(new Set(prev.concat([key]))));
  }

  async function toggleHistEsc(ticketId){
    const key = String(ticketId);
    if(expandedEscalados.includes(key)){
      setExpandedEscalados(prev => prev.filter(x=>x!==key));
      return;
    }
    if(!historialByTicket[key]){
      try{
        showToast('Cargando historial...', 'info');
        const r = await api('/historial?ticket_id='+encodeURIComponent(key));
        setHistorialByTicket(h => ({ ...h, [key]: r.historial || [] }));
      }catch(e){ showToast('Error cargando historial', 'error'); return; }
    }
    setExpandedEscalados(prev => Array.from(new Set(prev.concat([key]))));
  }
    // protección por rol: solo admins
    // si el usuario es `super`, redirigir a la plantilla super
    useEffect(()=>{
      // esperar a que la sesión esté autenticada para evitar redirecciones prematuras
      if(status !== 'authenticated') return;
      try{
        if(session){
          const currentRol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
          if(currentRol === 'super' && router && router.pathname !== '/super'){
            router.replace('/super');
          }
        }
      }catch(e){ /* ignore */ }
    }, [status, session, router]);

    if(!session) return <div className="container"><div className="card"><h3>Debes iniciar sesión</h3><p>Inicia sesión para acceder al panel de administración.</p></div></div>

    const rol = ((session?.user?.rol || session?.user?.role || '') + '').toString().toLowerCase();
    if(rol !== 'admin') return <div className="container"><div className="card"><h3>Acceso restringido</h3><p>Necesitas rol <strong>admin</strong> para acceder.</p></div></div>

  return (
    <div className="container">
      <style jsx global>{`
        /* Recommended table defaults for dense, legible data tables */
        .container table {
          min-width: 1200px;
          width: auto;
          table-layout: auto;
          font-size: 12px;
          line-height: 1.3;
        }
        .container .card table, .container table { border-collapse: collapse; }
        .container table th, .container table td {
          padding: 8px 10px;
          white-space: normal; /* allow wrapping */
          word-break: break-word;
          vertical-align: top;
        }
        .container table tr { min-height: 44px; }
        /* Filter inputs in headers: give them room so they don't collapse */
        .container table thead input, .container table thead select {
          min-width: 140px;
          width: 140px;
          box-sizing: border-box;
          font-size: 12px;
        }
        /* Mantener fila de encabezados visible al hacer scroll */
        .container table thead th {
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 5;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
        }
        /* spreadsheetTableRoot: rely on native table rendering; use wrapper for overflow and inline min-width on table elements */
        /* fixedTable: per-table rule to ensure real table layout on small screens (avoid list/card fallback) */
        .fixedTable { width: 100%; border-collapse: collapse; table-layout: auto; min-width: 800px; }
        .fixedTable th, .fixedTable td { padding: 8px 10px; vertical-align: top; white-space: nowrap; }
        .fixedTable thead th { background: #fff; position: sticky; top: 0; z-index: 12; }
        .container table thead th { vertical-align: bottom; }
        /* Description column smaller font to fit more content */
        .container table td.description, .container table th.description { font-size:12px; }
        /* Only the actual table containers should scroll; avoid locking the whole card */
        .admin-scroll-shell { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .admin-scroll-shell > table, .admin-scroll-shell > div { min-width: 760px; }
        /* Tables size to content: columns follow text width like the screenshot. */
        .container .tableWrapper { overflow-x: auto; }
        .container table { table-layout: auto; width: auto; min-width: 0; border-collapse: collapse; }
        .container table th, .container table td { text-align: left; vertical-align: middle; white-space: nowrap; padding: 10px 12px; }
        /* Allow specific long text fields to wrap when needed by adding class 'wrap' to their contents */
        .container table td .wrap { white-space: normal; }

        /* Selects and inputs inside table cells: prefer auto width sized to content, with sensible limits */
        .container table td select, .container table td input, .container table td textarea {
          min-width: 120px;
          /* try to size to content */
          width: -moz-fit-content;
          width: fit-content;
          width: max-content;
          max-width: 600px;
          box-sizing: border-box;
          display: inline-block;
          white-space: nowrap;
        }
        .container table td select option { white-space: nowrap; }
        /* Text styling for table headers and cells */
        .container table th {
          font-weight: 600;
          color: #0f172a;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          padding-bottom: 10px;
        }
        .container table td {
          color: #111827;
          font-size: 12px;
        }
        /* Inputs/selects visual polish inside cells */
        .container table td input, .container table td select, .container table td textarea {
          padding: 6px 8px;
          border-radius: 8px;
          border: 1px solid #e6eef8;
          background: #fff;
          color: #0f172a;
        }
        .container table thead input::placeholder { color: #9ca3af; }
        /* Responsive list rows for users and providers */
        .listItem { margin-bottom: 8px; }
        .listRow { display:flex; gap:8px; align-items:center; }
        .listRowMain { flex:1; }
        .listRowActions { display:flex; gap:8px; }

        @media (max-width: 640px) {
          /* Stack list rows on small screens */
          .listRow { flex-direction:column; align-items:flex-start; }
          .listRowActions { width:100%; display:flex; gap:8px; margin-top:8px; }
          .listRowActions button { flex: 1 1 auto; }
          /* Make inputs/selects full width on mobile inside lists */
          .listRow input, .listRow select { width:100%; box-sizing:border-box; }
          /* Keep tables wider than viewport to enable horizontal scroll on mobile (like Tiques) */
          .container table { min-width: 800px; font-size: 13px; }
          /* Ensure header row remains above table body on mobile */
          .container table thead th { position: sticky; top: 0; background: #fff; z-index: 6; }
          /* Improve touch scrolling and ensure header visibility inside horizontal scrollers */
          .spreadsheetTableRoot { -webkit-overflow-scrolling: touch; }
          /* On very small screens, offset sticky header to account for the admin header bar */
          @media (max-width: 420px) {
            .fixedTable thead th { top: 56px; }
          }
          .container table th, .container table td { padding: 8px; white-space: normal; }
        }
      `}</style>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <h2 style={{margin:0}}>Panel de Administración</h2>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>setShowMenu(s=>!s)} style={{padding:8,borderRadius:6}}>☰</button>
        </div>
      </div>

      {showMenu && (
        <div style={{position:'absolute',right:18,top:80,background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',padding:8,zIndex:50}}>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <button className={adminTab==='tiques' ? 'tab-active' : 'tab'} onClick={()=>{ setAdminTab('tiques'); setShowMenu(false); }}>Tiques</button>
            <button className={adminTab==='administrar' ? 'tab-active' : 'tab'} onClick={()=>{ setAdminTab('administrar'); setShowMenu(false); }}>Administrar</button>
            <button className={adminTab==='servicios' ? 'tab-active' : 'tab'} onClick={()=>{ setAdminTab('servicios'); setShowMenu(false); }}>Servicios Externos</button>
            <button className={adminTab==='reportes' ? 'tab-active' : 'tab'} onClick={()=>{ setAdminTab('reportes'); setShowMenu(false); }}>Reportes</button>
            <button className={adminTab==='calendario' ? 'tab-active' : 'tab'} onClick={()=>{ setAdminTab('calendario'); setShowMenu(false); }}>Calendario</button>
          </div>
        </div>
      )}

      {adminTab === 'tiques' && (
        <div className="card">
          <h3>Tiques</h3>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
            <input placeholder="Buscar tiques..." value={ticketQuery} onChange={e=>setTicketQuery(e.target.value)} style={{padding:8,borderRadius:8,border:'1px solid #e6eef8',flex:1}} />
          </div>
            <div style={{marginTop:8}}>
            <SpreadsheetTable tickets={tickets} areas={areas} maquinas={maquinas} tecnicos={tecnicos}
              onCellEdit={(row, field, value)=>{
                // update local state optimistically; actual save happens when user clicks Guardar
                const id = row.id;
                const updated = { ...row, [field]: value };
                setTickets(prev=> prev.map(p=> p.id===id? updated: p));
              }}
              onGuardar={(id)=> guardarTicketAdmin(id)}
              onEscalar={(id)=> escalarTicket(id)}
              onToggleHist={(id)=> toggleHist(id)}
              serverTick={serverTick}
            />
          </div>
          {expandedTickets.length>0 && (
            <div className="card" style={{marginTop:12}}>
              <h4>Historial</h4>
              {(expandedTickets||[]).map(key=> (
                <div key={key} style={{marginBottom:12,borderBottom:'1px solid #eef2ff',paddingBottom:8}}>
                  <div style={{fontWeight:700,marginBottom:6}}>Tique {key}</div>
                  <div className="historial-list">
                    {(historialByTicket[key]||[]).length===0 && <div className="small">No hay historial.</div>}
                    {(historialByTicket[key]||[]).map(h=> (
                      <div key={h.id} className="historial-item" style={{padding:8,background:'#fff'}}>
                        <div style={{fontSize:12,color:'#374151'}}>{formatDate(h.fecha)}</div>
                        <div style={{fontWeight:600}}>{h.accion} — {h.estado || ''}</div>
                        <div className="small">{h.usuario} — {h.detalle || ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {adminTab === 'administrar' && (
        <div className="card" style={{marginTop:12}}>
          <div className="admin-subtabs" style={{display:'flex',gap:8,marginBottom:12}}>
            <button className={adminSubTab==='areas'?'tab-active':'tab'} onClick={()=>setAdminSubTab('areas')}>Áreas</button>
            <button className={adminSubTab==='maquinas'?'tab-active':'tab'} onClick={()=>setAdminSubTab('maquinas')}>Maquinarias</button>
            <button className={adminSubTab==='proveedores'?'tab-active':'tab'} onClick={()=>setAdminSubTab('proveedores')}>Proveedores</button>
            <button className={adminSubTab==='usuarios'?'tab-active':'tab'} onClick={()=>setAdminSubTab('usuarios')}>Usuarios</button>
          </div>

          {adminSubTab === 'areas' && (
            <div>
              <h3>Áreas</h3>
              <div className="inline-form">
                <input value={newArea} onChange={e=>setNewArea(e.target.value)} placeholder="Ej. Planta 1" />
                <button onClick={addArea} disabled={areaLoading}>{areaLoading? 'Guardando...':'Guardar Área'}</button>
              </div>
              <div className="spreadsheetTableRoot" style={{overflowX:'auto', marginTop:12}}>
                <div style={{display:'table', width:'100%', minWidth:600, borderCollapse:'collapse'}}>
                  <div style={{display:'table-header-group', background:'#f8fafc'}}>
                    <div style={{display:'table-row'}}>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>ID</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Nombre</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Acciones</div>
                    </div>
                  </div>
                  <div style={{display:'table-row-group'}}>
                    {(areas||[]).map(a => (
                      <div key={a.id} style={{display:'table-row', borderTop:'1px solid #f1f5f9'}}>
                        <div style={{display:'table-cell', padding:8}}>{a.id}</div>
                        {editingAreaId === a.id ? (
                          <>
                            <div style={{display:'table-cell', padding:8}}>
                              <input value={editingAreaForm.nombre} onChange={e=> setEditingAreaForm(prev=> ({ ...prev, nombre: e.target.value }))} placeholder="Nombre" />
                            </div>
                            <div style={{display:'table-cell', padding:8}}>
                              <button onClick={()=> saveAreaEdit(a.id)}>Guardar</button>
                              <button onClick={cancelEditArea} style={{marginLeft:8}}>Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{display:'table-cell', padding:8}}>{a.nombre}</div>
                            <div style={{display:'table-cell', padding:8}}>
                              <button onClick={()=>startEditArea(a)}>Editar</button>
                              <button onClick={()=>removeItem('/areas/'+a.id)} style={{marginLeft:8}}>Eliminar</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {adminSubTab === 'maquinas' && (
            <div>
              <h3>Maquinarias</h3>
              <div className="inline-form">
                <input value={newMaquina} onChange={e=>setNewMaquina(e.target.value)} placeholder="Ej. Compresor #3" />
                <button onClick={addMaquina} disabled={maquinaLoading}>{maquinaLoading? 'Guardando...':'Guardar Máquina'}</button>
              </div>
              <div className="spreadsheetTableRoot" style={{overflowX:'auto', marginTop:12}}>
                <div style={{display:'table', width:'100%', minWidth:600, borderCollapse:'collapse'}}>
                  <div style={{display:'table-header-group', background:'#f8fafc'}}>
                    <div style={{display:'table-row'}}>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>ID</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Nombre</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Acciones</div>
                    </div>
                  </div>
                  <div style={{display:'table-row-group'}}>
                    {(maquinas||[]).map(m => (
                      <div key={m.id} style={{display:'table-row', borderTop:'1px solid #f1f5f9'}}>
                        <div style={{display:'table-cell', padding:8}}>{m.id}</div>
                        {editingMaquinaId === m.id ? (
                          <>
                            <div style={{display:'table-cell', padding:8}}>
                              <input value={editingMaquinaForm.nombre} onChange={e=> setEditingMaquinaForm(prev=> ({ ...prev, nombre: e.target.value }))} placeholder="Nombre" />
                            </div>
                            <div style={{display:'table-cell', padding:8}}>
                              <button onClick={()=> saveMaquinaEdit(m.id)}>Guardar</button>
                              <button onClick={cancelEditMaquina} style={{marginLeft:8}}>Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{display:'table-cell', padding:8}}>{m.nombre}</div>
                            <div style={{display:'table-cell', padding:8}}>
                              <button onClick={()=>startEditMaquina(m)}>Editar</button>
                              <button onClick={()=>removeItem('/maquinas/'+m.id)} style={{marginLeft:8}}>Eliminar</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {adminSubTab === 'proveedores' && (
            <div>
              <h3>Proveedores</h3>
              <button onClick={addProveedor}>Añadir Proveedor</button>
              <div className="spreadsheetTableRoot" style={{overflowX:'auto'}}>
                <div style={{display:'table', width:'100%', minWidth:800, borderCollapse:'collapse'}}>
                  <div style={{display:'table-header-group', background:'#f8fafc'}}>
                    <div style={{display:'table-row'}}>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>ID</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Nombre</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Contacto</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Acciones</div>
                    </div>
                  </div>
                  <div style={{display:'table-row-group'}}>
                    {(proveedores||[]).map(p => (
                      <div key={p.id} style={{display:'table-row', borderTop:'1px solid #f1f5f9'}}>
                        <div style={{display:'table-cell', padding:8}}>{p.id}</div>
                        {editingProveedorId === p.id ? (
                          <>
                            <div style={{display:'table-cell', padding:8}}><input value={editingProveedorForm.nombre} onChange={e=> setEditingProveedorForm(prev=> ({ ...prev, nombre: e.target.value }))} placeholder="Nombre" /></div>
                            <div style={{display:'table-cell', padding:8}}><input value={editingProveedorForm.contacto} onChange={e=> setEditingProveedorForm(prev=> ({ ...prev, contacto: e.target.value }))} placeholder="Contacto" /></div>
                            <div style={{display:'table-cell', padding:8}}>
                              <button onClick={()=> saveProveedorEdit(p.id)}>Guardar</button>
                              <button onClick={cancelEditProveedor} style={{marginLeft:8}}>Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{display:'table-cell', padding:8}}>{p.nombre}</div>
                            <div style={{display:'table-cell', padding:8}}>{p.contacto||''}</div>
                            <div style={{display:'table-cell', padding:8}}>
                              <button onClick={()=>startEditProveedor(p)}>Editar</button>
                              <button onClick={()=>removeItem('/proveedores/'+p.id)} style={{marginLeft:8}}>Eliminar</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {adminSubTab === 'usuarios' && (
            <div>
              <h3>Usuarios</h3>
              <div className="inline-form users-inline-form">
                <input placeholder="correo@empresa.com" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} />
                <input placeholder="Nombre" value={userForm.nombre} onChange={e=>setUserForm({...userForm,nombre:e.target.value})} />
                <select value={userForm.rol} onChange={e=>setUserForm({...userForm,rol:e.target.value})}>
                  <option value="empleado">Empleado</option>
                  <option value="tecnico">Técnico</option>
                  <option value="admin">Admin</option>
                  <option value="super">Super</option>
                </select>
                <input placeholder="Password (opcional)" type="password" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} />
                <button onClick={addUsuario} disabled={userLoading}>{userLoading? 'Guardando...':'Guardar Usuario'}</button>
              </div>
              <div className="spreadsheetTableRoot" style={{overflowX:'auto'}}>
                <div style={{display:'table', width:'100%', minWidth:800, borderCollapse:'collapse'}}>
                  <div style={{display:'table-header-group', background:'#f8fafc'}}>
                    <div style={{display:'table-row'}}>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>ID</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Email</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Nombre</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Rol</div>
                      <div style={{display:'table-cell', padding:8, fontWeight:600}}>Acciones</div>
                    </div>
                  </div>
                  <div style={{display:'table-row-group'}}>
                    {(usuarios||[]).map(u => (
                      <div key={u.id} style={{display:'table-row', borderTop:'1px solid #f1f5f9'}}>
                        <div style={{display:'table-cell', padding:8}}>{u.id}</div>
                        {editingUserId === u.id ? (
                          <>
                            <div style={{display:'table-cell', padding:8}}><input value={editingUserForm.email} onChange={e=> setEditingUserForm(prev=> ({ ...prev, email: e.target.value }))} placeholder="Email" /></div>
                            <div style={{display:'table-cell', padding:8}}><input value={editingUserForm.nombre} onChange={e=> setEditingUserForm(prev=> ({ ...prev, nombre: e.target.value }))} placeholder="Nombre" /></div>
                            <div style={{display:'table-cell', padding:8}}>
                              <select value={editingUserForm.rol} onChange={e=> setEditingUserForm(prev=> ({ ...prev, rol: e.target.value }))}>
                                <option value="empleado">Empleado</option>
                                <option value="tecnico">Técnico</option>
                                <option value="admin">Admin</option>
                                <option value="super">Super</option>
                              </select>
                              <input placeholder="Nueva contraseña" type="password" value={editingUserForm.password} onChange={e=> setEditingUserForm(prev=> ({ ...prev, password: e.target.value }))} style={{marginLeft:8}} />
                            </div>
                            <div style={{display:'table-cell', padding:8, minWidth:220, whiteSpace:'nowrap'}}>
                              <button onClick={()=> saveUserEdit(u.id)}>Guardar</button>
                              <button onClick={cancelEditUser} style={{marginLeft:8}}>Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{display:'table-cell', padding:8}}>{u.email}</div>
                            <div style={{display:'table-cell', padding:8}}>{u.nombre}</div>
                            <div style={{display:'table-cell', padding:8}}>{u.rol}</div>
                            <div style={{display:'table-cell', padding:8, minWidth:220, whiteSpace:'nowrap'}}>
                              <button onClick={()=>startEditUser(u)}>Editar</button>
                              <button onClick={()=>removeItem('/users/'+u.id)} style={{marginLeft:8}}>Eliminar</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {adminTab === 'servicios' && (
        <div className="card" style={{marginTop:12}}>
          <h3>Escalados / Servidores Externos</h3>
          <div className="admin-scroll-shell spreadsheetTableRoot" style={{overflowX:'auto', background:'#fff', padding:8, borderRadius:8, border:'1px solid #eef2ff'}}>
                <table className="fixedTable escalados-admin-table" style={{width:'100%', borderCollapse:'collapse', minWidth:800, writingMode:'horizontal-tb', textOrientation:'mixed', transform:'none'}}>
                  <thead style={{background:'#f8fafc'}}>
                    <tr style={{textAlign:'left'}}>
                      <th style={{padding:8}}>ID</th>
                      <th style={{padding:8}}>Fecha</th>
                      <th style={{padding:8}}>Fecha En Proceso</th>
                      <th style={{padding:8}}>Fecha En Espera</th>
                      <th style={{padding:8}}>Fecha Resuelto</th>
                      <th style={{padding:8}}>Proveedor</th>
                      <th style={{padding:8}}>Estado</th>
                      <th style={{padding:8}}>Responsable</th>
                      <th style={{padding:8}}>Nota</th>
                      <th style={{padding:8}}>Observaciones</th>
                      <th style={{padding:8}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalados.length===0 && (<tr><td colSpan={11} style={{padding:8}}>No hay registros.</td></tr>)}
                    {escalados.map(e => (
                      <React.Fragment key={e.id}>
                        <tr style={{borderTop:'1px solid #f1f5f9'}}>
                          <td style={{padding:8}}><strong>{e.ticket_id}</strong></td>
                          <td style={{padding:8}}>{formatDate(e.fecha_escalado)}</td>
                          <td style={{padding:8}}>{e.fecha_en_proceso ? formatDate(e.fecha_en_proceso) : ''}</td>
                          <td style={{padding:8}}>{e.fecha_en_espera ? formatDate(e.fecha_en_espera) : ''}</td>
                          <td style={{padding:8}}>{e.fecha_resuelto ? formatDate(e.fecha_resuelto) : ''}</td>
                          <td style={{padding:8}}>
                            {(()=>{
                              const isResolved = ((e.estado||'')+'').toString().toLowerCase().includes('resuelto');
                              const locked = isResolved;
                              return (
                                <select disabled={locked} value={(escaladosEdit[e.id] && escaladosEdit[e.id].proveedor) ?? (e.proveedor || '')} onChange={ev=> setEscaladosEdit(prev=> ({ ...prev, [e.id]: { ...(prev[e.id]||{}), proveedor: ev.target.value } }))}>
                                  <option value="">-- Seleccionar proveedor --</option>
                                  {(proveedores||[]).map(p=> (
                                    <option key={p.id} value={p.nombre}>{p.nombre}</option>
                                  ))}
                                </select>
                              )
                            })()}
                          </td>
                          <td style={{padding:8}}>
                            {(()=>{
                              const isResolved = ((e.estado||'')+'').toString().toLowerCase().includes('resuelto');
                              const locked = isResolved;
                              return (
                                <select disabled={locked} value={(escaladosEdit[e.id] && escaladosEdit[e.id].estado) ?? (e.estado || '')} onChange={ev=> setEscaladosEdit(prev=> ({ ...prev, [e.id]: { ...(prev[e.id]||{}), estado: ev.target.value } }))}>
                                  <option>Asignado a Proveedor</option>
                                  <option>En Proceso</option>
                                  <option>En Espera</option>
                                  <option>Resuelto</option>
                                </select>
                              )
                            })()}
                          </td>
                          <td style={{padding:8}}>
                            {(()=>{
                              const isResolved = ((e.estado||'')+'').toString().toLowerCase().includes('resuelto');
                              const locked = isResolved;
                              return (
                                <select disabled={locked} value={(escaladosEdit[e.id] && escaladosEdit[e.id].responsable) ?? (e.responsable || '')} onChange={ev=> setEscaladosEdit(prev=> ({ ...prev, [e.id]: { ...(prev[e.id]||{}), responsable: ev.target.value } }))}>
                                  <option value="">-- Seleccionar responsable --</option>
                                  {(usuarios||[]).filter(u=> {
                                    const r = ((u.rol||u.role||'')+'').toString().toLowerCase(); return r === 'tecnico' || r === 'admin';
                                  }).map(u=> (
                                    <option key={u.id} value={u.nombre || u.email || u.id}>{u.nombre || u.email}</option>
                                  ))}
                                </select>
                              )
                            })()}
                          </td>
                          <td style={{padding:8}}>
                            {(()=>{
                              const isResolved = ((e.estado||'')+'').toString().toLowerCase().includes('resuelto');
                              const locked = isResolved;
                              return (
                                <input disabled={locked} value={(escaladosEdit[e.id] && escaladosEdit[e.id].nota) ?? (e.nota || '')} onChange={ev=> setEscaladosEdit(prev=> ({ ...prev, [e.id]: { ...(prev[e.id]||{}), nota: ev.target.value } }))} />
                              )
                            })()}
                          </td>
                          <td style={{padding:8}}>
                            {(()=>{
                              const isResolved = ((e.estado||'')+'').toString().toLowerCase().includes('resuelto');
                              const locked = isResolved;
                              return (
                                <input disabled={locked} value={(escaladosEdit[e.id] && escaladosEdit[e.id].observaciones) ?? (e.observaciones || '')} onChange={ev=> setEscaladosEdit(prev=> ({ ...prev, [e.id]: { ...(prev[e.id]||{}), observaciones: ev.target.value } }))} />
                              )
                            })()}
                          </td>
                          <td style={{padding:8, minWidth:220, whiteSpace:'nowrap'}}>
                            {(()=>{
                              const isResolved = ((e.estado||'')+'').toString().toLowerCase().includes('resuelto');
                              const locked = isResolved;
                              return (
                                <>
                                  <button type="button" onClick={()=>guardarEscalado(e.id)} className="btn-success" disabled={locked}>Guardar</button>
                                  <button type="button" onClick={()=>eliminarEscalado(e.id)} className="btn-danger" style={{marginLeft:8}} disabled={locked}>Eliminar</button>
                                  <button type="button" onClick={()=> toggleHistEsc && toggleHistEsc(e.ticket_id)} className="btn-secondary" style={{marginLeft:8}}>Historial</button>
                                </>
                              )
                            })()}
                          </td>
                        </tr>
                        {expandedEscalados.includes(String(e.ticket_id)) && (
                          <tr key={`hist-${e.id}`}>
                            <td colSpan={11} style={{padding:8, background:'#fbfdff'}}>
                              {(historialByTicket[String(e.ticket_id)]||[]).length===0 && <div className="small">No hay historial.</div>}
                              {(historialByTicket[String(e.ticket_id)]||[]).map(h=> (
                                <div key={h.id} style={{padding:6,borderBottom:'1px solid #eef2ff'}}>
                                  <div style={{fontSize:12,color:'#374151'}}>{formatDate(h.fecha)}</div>
                                  <div style={{fontWeight:600}}>{h.accion} — {h.estado || ''}</div>
                                  <div className="small">{h.usuario} — {h.detalle || ''}</div>
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
        </div>
      )}

      {adminTab === 'reportes' && (
        <div className="card" style={{marginTop:12}}>
          <h3>Reportes</h3>
          <div className="summary-row" style={{display:'flex',gap:12,marginBottom:12}}>
            <div className="card" style={{padding:12,flex:'1 1 0'}}>
              <div style={{fontSize:12,color:'#6b7280'}}>Tiques totales</div>
              <div style={{fontWeight:700,fontSize:20}}>{tickets.length}</div>
            </div>
            <div className="card" style={{padding:12,flex:'1 1 0'}}>
              <div style={{fontSize:12,color:'#6b7280'}}>Abiertos / Pendientes</div>
              <div style={{fontWeight:700,fontSize:20}}>{tickets.filter(t=> !(t.estado||'').toString().toLowerCase().includes('resuelto') && !(t.estado||'').toString().toLowerCase().includes('escalad')).length}</div>
            </div>
            <div className="card" style={{padding:12,flex:'1 1 0'}}>
              <div style={{fontSize:12,color:'#6b7280'}}>Escalados</div>
              <div style={{fontWeight:700,fontSize:20}}>{escalados.length}</div>
            </div>
            <div className="card" style={{padding:12,flex:'1 1 0'}}>
              <div style={{fontSize:12,color:'#6b7280'}}>Resueltos</div>
              <div style={{fontWeight:700,fontSize:20}}>{tickets.filter(t=> (t.estado||'').toString().toLowerCase().includes('resuelto')).length}</div>
            </div>
          </div>
          <div className="filter-bar" style={{marginBottom:12}}>
            <div style={{marginLeft:'auto'}} className="report-actions">
              <button onClick={()=>downloadCSV(tickets.map(t=>({ id:t.id, fecha:t.fecha_creacion||t.fecha, solicitante:t.solicitante, area:t.area, maquina:t.maquina, urgencia:t.urgencia, estado:t.estado, tecnico:t.tecnico })), 'tiques.csv')}>Exportar Tiques CSV</button>
              <button onClick={()=>downloadXLS(tickets.map(t=>({ id:t.id, fecha:t.fecha_creacion||t.fecha, solicitante:t.solicitante, area:t.area, maquina:t.maquina, urgencia:t.urgencia, estado:t.estado, tecnico:t.tecnico })), 'tiques.xls')}>Exportar Tiques XLS</button>
              <button onClick={()=>downloadCSV(escalados.map(e=>({ id:e.id, ticket_id:e.ticket_id, fecha:e.fecha_escalado, proveedor:e.proveedor, estado:e.estado, responsable:e.responsable })), 'escalados.csv')}>Exportar Escalados CSV</button>
              <button onClick={()=>downloadXLS(escalados.map(e=>({ id:e.id, ticket_id:e.ticket_id, fecha:e.fecha_escalado, proveedor:e.proveedor, estado:e.estado, responsable:e.responsable })), 'escalados.xls')}>Exportar Escalados XLS</button>
            </div>
          </div>
          <div className="reports-shell" style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
            <div className="reports-charts-shell">
              <div className="report-grid-shell">
                <div className="report-grid" style={{gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="report-card card">
                    <h4>Tiques por Estado</h4>
                    <ReportByStatus tickets={tickets} />
                  </div>
                  <div className="report-card card">
                    <h4>Tiques por Técnico</h4>
                    <ReportByTecnico tickets={tickets} />
                  </div>
                  <div className="report-card card">
                    <h4>Tiques por Área (Top 10)</h4>
                    <ReportByArea tickets={tickets} />
                  </div>
                  <div className="report-card card">
                    <h4>Tiempo promedio de resolución</h4>
                    <ReportTiempoResolucion tickets={tickets} />
                  </div>
                  <div className="report-card card">
                    <h4>Tiques por Urgencia</h4>
                    <ReportByUrgencia tickets={tickets} />
                  </div>
                  <div className="report-card card">
                    <h4>Escalados por Proveedor</h4>
                    <ReportEscalados escalados={escalados} />
                  </div>
                </div>
              </div>
            </div>
            <div className="reports-table-shell" style={{marginTop:12}}>
              <h4>Vista previa de tiques</h4>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <label>Mostrar por página:</label>
                <select value={reportPageSize} onChange={e=>{ setReportPageSize(Number(e.target.value)); setReportPage(1); }}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={200}>200</option>
                  <option value={1000}>1000</option>
                </select>
                <div style={{marginLeft:'auto',fontSize:12,color:'#6b7280'}}>Total: {tickets.length} tiques</div>
              </div>
              <div className="admin-scroll-shell spreadsheetTableRoot" style={{overflowX:'auto',background:'#fff',padding:8,borderRadius:8,border:'1px solid #eef2ff'}}>
                <table className="fixedTable" style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
                  <thead>
                    <tr style={{textAlign:'left'}}>
                      <th>ID</th><th>Fecha</th><th>Solicitante</th><th>Area</th><th>Máquina</th><th>Urgencia</th><th>Estado</th><th>Técnico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(()=>{
                      const start = (reportPage-1)*reportPageSize;
                      const pageItems = (tickets||[]).slice(start, start+reportPageSize);
                      if(pageItems.length===0) return (<tr><td colSpan={8}>No hay tiques en esta página.</td></tr>);
                      return pageItems.map(t=> (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>{formatDate(t.fecha_creacion||t.fecha||t.fecha_creacion)}</td>
                          <td>{t.solicitante||t.usuario||''}</td>
                          <td>{t.area||''}</td>
                          <td>{t.maquina||''}</td>
                          <td>{t.urgencia||''}</td>
                          <td>{t.estado||''}</td>
                          <td>{t.tecnico||''}</td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
                <button onClick={()=> setReportPage(p => Math.max(1, p-1))} disabled={reportPage<=1}>Anterior</button>
                <div>Página {reportPage} / {Math.max(1, Math.ceil((tickets.length||0)/reportPageSize))}</div>
                <button onClick={()=> setReportPage(p => Math.min(Math.ceil((tickets.length||0)/reportPageSize), p+1))} disabled={reportPage>=Math.ceil((tickets.length||0)/reportPageSize)}>Siguiente</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {adminTab === 'calendario' && (
        <div className="card" style={{marginTop:12}}>
          <h3>Calendario de Técnicos</h3>
          <div className="filter-bar" style={{marginBottom:12}}>
            <div className="filter-control">
              <label>Vista:</label>
              <select value={calendarView} onChange={e=>setCalendarView(e.target.value)}>
                <option value="day">Diario</option>
                <option value="week">Semanal</option>
                <option value="month">Mensual</option>
                <option value="year">Anual</option>
              </select>
            </div>
            <div className="filter-control">
              <label>Fecha:</label>
              <input type="date" value={calendarDate} onChange={e=>setCalendarDate(e.target.value)} />
            </div>
            <div className="filter-control">
              <label>Técnico:</label>
              <select value={calendarTecnico||''} onChange={e=> setCalendarTecnico(e.target.value||null)}>
                <option value="">-- Todos --</option>
                {tecnicos.map(tc=> <option key={tc.email||tc.id} value={tc.email||tc.id}>{tc.nombre || tc.email}</option>)}
              </select>
            </div>
            <div className="filter-control">
              <label style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" checked={calendarOnlyAvailable} onChange={e=> setCalendarOnlyAvailable(e.target.checked)} />
                Mostrar sólo disponibles
              </label>
            </div>
            <div style={{marginLeft:'auto'}} className="report-actions">
              <button onClick={()=>{ const rows = (filteredTickets||[]).map(t=>({ id:t.id, fecha:t.fecha_creacion||t.fecha, solicitante:t.solicitante, area:t.area, maquina:t.maquina, urgencia:t.urgencia, estado:t.estado, tecnico:t.tecnico })); downloadCSV(rows, 'calendario-tiques.csv'); }}>Exportar visibles CSV</button>
              <button onClick={()=>{ const rows = (filteredTickets||[]).map(t=>({ id:t.id, fecha:t.fecha_creacion||t.fecha, solicitante:t.solicitante, area:t.area, maquina:t.maquina, urgencia:t.urgencia, estado:t.estado, tecnico:t.tecnico })); downloadXLS(rows, 'calendario-tiques.xls'); }}>Exportar visibles XLS</button>
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
            onEventClick={(ticket)=>{
              const rec = (escalados||[]).find(e=> String(e.ticket_id) === String(ticket.id));
              const fechaTicket = formatDate(ticket.fecha_creacion || ticket.fecha || ticket.fechaProgramada || ticket.fecha_programada || '');
              const fechaEscalado = rec ? formatDate(rec.fecha_escalado || rec.fechaEscalado || '') : '';
              const fechaResuelto = rec ? formatDate(rec.fecha_resuelto || rec.fechaResuelto || '') : formatDate(ticket.fecha_resuelto || ticket.fechaResuelto || '');
              const html = rec
                ? `Ticket #${ticket.id} - Escalado\nProveedor: ${rec.proveedor||''}\nResponsable: ${rec.responsable||''}\nFecha ticket: ${fechaTicket}\nFecha escalado: ${fechaEscalado}\nFecha resuelto (escalado): ${fechaResuelto}\nEstado: ${rec.estado||ticket.estado||''}`
                : `Ticket #${ticket.id}\nFecha ticket: ${fechaTicket}\nFecha resuelto: ${fechaResuelto}\nEstado: ${ticket.estado||''}`;
              if(typeof window !== 'undefined' && window.alert){ window.alert(html); }
            }}
          />
          <div style={{marginTop:12}}>
            <h4>Eventos / Tiques en fecha</h4>
            <div className="admin-scroll-shell spreadsheetTableRoot" style={{overflowX:'auto',background:'#fff',padding:8,borderRadius:8,border:'1px solid #eef2ff'}}>
              <table className="fixedTable" style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
                <thead>
                  <tr style={{textAlign:'left'}}><th>ID</th><th>Fecha</th><th>Solicitante</th><th>Area</th><th>Máquina</th><th>Estado</th><th>Técnico</th></tr>
                </thead>
                <tbody>
                  {(()=>{
                    const start = (reportPage-1)*reportPageSize; const pageItems = (filteredTickets||[]).slice(start, start+reportPageSize);
                    if(pageItems.length===0) return (<tr><td colSpan={7}>No hay eventos para la selección.</td></tr>);
                    return pageItems.map(t=> (
                      <tr key={t.id}><td>{t.id}</td><td>{formatDate(t.fecha_creacion||t.fecha||t.fecha_creacion)}</td><td>{t.solicitante||t.usuario||''}</td><td>{t.area||''}</td><td>{t.maquina||''}</td><td>{t.estado||''}</td><td>{t.tecnico||''}</td></tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
              <button onClick={()=> setReportPage(p => Math.max(1, p-1))} disabled={reportPage<=1}>Anterior</button>
                <div>Página {reportPage} / {Math.max(1, Math.ceil(((filteredTickets||[]).length||0)/reportPageSize))}</div>
                  <button onClick={()=> setReportPage(p => Math.min(Math.ceil(((filteredTickets||[]).length||0)/reportPageSize), p+1))} disabled={reportPage>=Math.ceil(((filteredTickets||[]).length||0)/reportPageSize)}>Siguiente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
