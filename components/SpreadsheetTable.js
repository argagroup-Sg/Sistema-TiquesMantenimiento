import React, { useMemo, useState, useRef, useEffect } from 'react'
import { formatDate } from '../lib/format'

export default function SpreadsheetTable({ tickets = [], onCellEdit, areas = [], maquinas = [], tecnicos = [], onGuardar, onEscalar, onToggleHist, serverTick=0 } ){
  const cols = useMemo(()=>[
    { key:'id', label:'ID', width:90 },
    { key:'fecha_creacion', label:'Fecha creación', width:160 },
    { key:'fecha_asignacion', label:'Fecha asignación', width:160 },
    { key:'fecha_en_proceso', label:'Fecha en proceso', width:160 },
    { key:'fecha_en_espera', label:'Fecha en espera', width:160 },
    { key:'fecha_resuelto', label:'Fecha resuelto', width:160 },
    { key:'solicitante', label:'Solicitante', width:240 },
    { key:'area', label:'Área', width:160 },
    { key:'maquina', label:'Máquina', width:160 },
    { key:'urgencia', label:'Urgencia', width:120 },
    { key:'estado', label:'Estado', width:160 },
    { key:'tecnico', label:'Técnico', width:200 },
    { key:'descripcion', label:'Descripción', width:320 },
    { key:'acciones', label:'Acciones', width:220 }
  ],[])

  const [filters, setFilters] = useState({})
  const [colWidths, setColWidths] = useState(() => Object.fromEntries(cols.map(c=>[c.key, c.width])))
  const [rows, setRows] = useState(tickets || [])
  const originalEstadoById = useRef({})
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Actualizar originalEstadoById solo cuando serverTick indica un recargo desde el servidor
  useEffect(()=>{
    try{
      originalEstadoById.current = Object.fromEntries((tickets||[]).map(t=>[t.id, t.estado || '']))
    }catch(e){ originalEstadoById.current = {}; }
  }, [serverTick])

  // Mantener las filas locales sincronizadas con la prop tickets pero NO mutar originalEstadoById aquí
  useEffect(()=>{ setRows(tickets || []) }, [tickets])

  function applyFilter(r){
    return cols.every(c=>{
      const f = (filters[c.key]||'').toString().toLowerCase().trim();
      if(!f) return true;
      const val = (r[c.key]||'').toString().toLowerCase();
      return val.indexOf(f) !== -1;
    })
  }

  let filtered = rows.filter(applyFilter)
  if(sortKey){
    filtered = filtered.slice().sort((a,b)=>{
      const va = (a[sortKey]||'').toString().toLowerCase();
      const vb = (b[sortKey]||'').toString().toLowerCase();
      if(va < vb) return sortDir === 'asc' ? -1 : 1;
      if(va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    })
  }

  // controladores de redimensionamiento de columnas
  const startX = useRef(0)
  const startWidth = useRef(0)
  const resizingKey = useRef(null)

  function onMouseDownResize(e, key){
    startX.current = e.clientX
    startWidth.current = colWidths[key]
    resizingKey.current = key
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
  function onMouseMove(e){
    if(!resizingKey.current) return
    const dx = e.clientX - startX.current
    const nw = Math.max(60, startWidth.current + dx)
    setColWidths(prev=> ({ ...prev, [resizingKey.current]: nw }))
  }
  function onMouseUp(){
    resizingKey.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  function onEdit(rowId, key, value){
    const r = rows.find(p=> p.id === rowId)
    if(!r) return
    const id = r.id
    const updated = { ...r, [key]: value }
    setRows(prev => prev.map(p=> p.id===id? updated : p))
    if(onCellEdit) onCellEdit(updated, key, value)
  }

  // reiniciar la página cuando cambian filtros o el orden
  useEffect(()=> setPage(1), [filters, sortKey, sortDir])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const paged = filtered.slice((page-1)*pageSize, page*pageSize)

  return (
    <div style={{overflow:'auto', border:'1px solid #e6eef8', borderRadius:6}}>
      <div style={{display:'table', width:'100%'}} className="spreadsheetTableRoot">
        <div style={{display:'table-header-group', background:'#f8fafc'}}>
          <div style={{display:'table-row'}}>
            {cols.map(c=> (
              <div key={c.key} style={{display:'table-cell', padding:8, borderRight:'1px solid #e6eef8', minWidth: colWidths[c.key], width: 'auto', position:'relative'}}>
                <div style={{display:'flex',alignItems:'center',gap:8, justifyContent:'space-between'}}>
                  <strong style={{fontSize:13, cursor:'pointer'}} onClick={()=>{
                    if(sortKey===c.key) setSortDir(d=> d==='asc'?'desc':'asc'); else { setSortKey(c.key); setSortDir('asc'); }
                  }}>{c.label} {sortKey===c.key ? (sortDir==='asc'? '▲':'▼') : ''}</strong>
                </div>
                <div style={{marginTop:6}}>
                  {c.key === 'area' ? (
                    <select value={filters[c.key]||''} onChange={e=> setFilters(prev=> ({ ...prev, [c.key]: e.target.value }))} style={{minWidth:120,width:'auto',padding:6,borderRadius:6,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                      <option value="">--</option>
                      {(areas||[]).map(a=> <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                    </select>
                  ) : c.key === 'maquina' ? (
                    <select value={filters[c.key]||''} onChange={e=> setFilters(prev=> ({ ...prev, [c.key]: e.target.value }))} style={{minWidth:120,width:'auto',padding:6,borderRadius:6,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                      <option value="">--</option>
                      {(maquinas||[]).map(m=> <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                    </select>
                  ) : c.key === 'estado' ? (
                    <select value={filters[c.key]||''} onChange={e=> setFilters(prev=> ({ ...prev, [c.key]: e.target.value }))} style={{minWidth:120,width:'auto',padding:6,borderRadius:6,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                      <option value="">--</option>
                      <option>Abierto</option>
                      <option>En Proceso</option>
                      <option>En Espera</option>
                      <option>Resuelto</option>
                      <option>Escalado a Servidor Externo</option>
                    </select>
                  ) : c.key === 'urgencia' ? (
                    <select value={filters[c.key]||''} onChange={e=> setFilters(prev=> ({ ...prev, [c.key]: e.target.value }))} style={{minWidth:120,width:'auto',padding:6,borderRadius:6,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                      <option value="">--</option>
                      <option>Baja</option>
                      <option>Media</option>
                      <option>Alta</option>
                    </select>
                  ) : (
                    <input placeholder="Filtro" value={filters[c.key]||''} onChange={e=> setFilters(prev=> ({ ...prev, [c.key]: e.target.value }))} style={{minWidth:120,width:'auto',padding:6,borderRadius:6,border:'1px solid #e6eef8',whiteSpace:'nowrap'}} />
                  )}
                </div>
                <div onMouseDown={(e)=>onMouseDownResize(e,c.key)} style={{position:'absolute', right:0, top:0, width:6, height:'100%', cursor:'col-resize'}} />
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'table-row-group'}}>
          {paged.map((r, idx)=> (
            <div key={r.id} style={{display:'table-row', borderTop:'1px solid #f1f5f9'}}>
              {cols.map(c=> (
                <div key={c.key} style={{display:'table-cell', padding:8, borderRight:'1px solid #e6eef8', minWidth: colWidths[c.key], width: 'auto', verticalAlign:'top'}}>
                  {(() => {
                    const origEstado = (originalEstadoById.current && originalEstadoById.current[r.id]) || '';
                    const isOriginallyEscalado = (origEstado + '').toString().toLowerCase().includes('escalad');
                    // Considerar 'resuelto' solo cuando proviene del servidor (originalEstado),
                    // no desde el valor editado localmente `r.estado` para evitar bloquear antes de guardar.
                    const isResolved = (origEstado + '').toString().toLowerCase().includes('resuelto');
                    const isLocked = isOriginallyEscalado || isResolved;
                      if(c.key === 'area') return (
                                      <select value={r.area||''} onChange={e=> onEdit(r.id, 'area', e.target.value)} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                        <option value="">--</option>
                        {(areas||[]).map(a=> <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                      </select>
                    )
                      if(c.key === 'maquina') return (
                      <select value={r.maquina||''} onChange={e=> onEdit(r.id, 'maquina', e.target.value)} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                        <option value="">--</option>
                        {(maquinas||[]).map(m=> <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                      </select>
                    )
                      if(c.key === 'tecnico') return (
                      <select value={r.tecnico||''} onChange={e=> onEdit(r.id, 'tecnico', e.target.value)} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                        <option value="">--</option>
                        {(tecnicos||[]).filter(tc=> (tc.rol||'').toLowerCase()!=='empleado').map(tc=> <option key={tc.email||tc.id} value={tc.email||tc.id}>{tc.nombre || tc.email}</option>)}
                      </select>
                    )
                      if(c.key === 'estado') return (
                      <select value={r.estado||''} onChange={e=> onEdit(r.id, 'estado', e.target.value)} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                        <option>Abierto</option>
                        <option>En Proceso</option>
                        <option>En Espera</option>
                        <option>Resuelto</option>
                        <option>Escalado a Servidor Externo</option>
                      </select>
                    )
                    if(c.key === 'descripcion' || c.key === 'solicitante') return (
                      <input value={r[c.key] || ''} onChange={e=> onEdit(r.id, c.key, e.target.value)} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}} />
                    )
                    if(c.key === 'fecha_asignacion' || c.key === 'fecha_en_proceso' || c.key === 'fecha_en_espera' || c.key === 'fecha_resuelto') return (
                      <div style={{fontSize:13}}> { r[c.key] ? formatDate(r[c.key]) : '' }</div>
                    )
                    if(c.key === 'acciones') return (
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=> onGuardar && onGuardar(r.id)} disabled={isLocked} className="btn-success">Guardar</button>
                        <button onClick={()=> onEscalar && onEscalar(r.id)} disabled={isLocked} className="btn-warning">Escalar</button>
                        <button onClick={()=> onToggleHist && onToggleHist(r.id)} className="btn-secondary">Historial</button>
                      </div>
                    )
                    if(c.key === 'fecha_creacion') return (
                      <div style={{fontSize:13}}> { r.fecha_creacion ? formatDate(r.fecha_creacion) : '' }</div>
                    )
                    return (<div style={{fontSize:13}}>{r[c.key] || ''}</div>)
                  })()}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:8}}>
        <div>
          <select value={pageSize} onChange={e=> { setPageSize(Number(e.target.value)); setPage(1); }} style={{padding:6,borderRadius:6,border:'1px solid #e6eef8'}}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={200}>200</option>
            <option value={1000}>1000</option>
          </select>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=> setPage(1)} disabled={page===1}>«</button>
          <button onClick={()=> setPage(p=> Math.max(1,p-1))} disabled={page===1}>‹</button>
          <div style={{minWidth:120,textAlign:'center'}}>Página {page} de {totalPages} — {total} registros</div>
          <button onClick={()=> setPage(p=> Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
          <button onClick={()=> setPage(totalPages)} disabled={page===totalPages}>»</button>
        </div>
      </div>
    </div>
  )
}
