import React, { useMemo, useState, useRef, useEffect } from 'react'
import { formatDate } from '../lib/format'

function resolveDisplayText(row, preferredKey, fallbackKey, idKey) {
  if (!row) return '';
  const preferred = row[preferredKey] || row[fallbackKey] || '';
  if (preferred) return preferred;
  if (row[idKey] !== undefined && row[idKey] !== null && row[idKey] !== '') return String(row[idKey]);
  return '';
}

export default function SpreadsheetTable({ tickets = [], onCellEdit, areas = [], maquinas = [], tecnicos = [], onGuardar, onEscalar, onToggleHist, onShowInfo, serverTick=0 } ){
  const cols = useMemo(()=>[
    { key:'acciones', label:'Acciones', width:220 },
    { key:'estado', label:'Estado', width:160 },
    { key:'urgencia', label:'Urgencia', width:120 },
    { key:'solicitante', label:'Solicitante', width:240 },
    { key:'area', label:'Área', width:160 },
    { key:'maquina', label:'Máquina', width:160 },
    { key:'tecnico', label:'Técnico', width:200 },
    { key:'descripcion', label:'Descripción', width:320 },
    { key:'fecha_creacion', label:'Fecha creación', width:160 },
    { key:'fecha_asignacion', label:'Fecha asignación', width:160 },
    { key:'fecha_en_proceso', label:'Fecha en proceso', width:160 },
    { key:'fecha_en_espera', label:'Fecha en espera', width:160 },
    { key:'fecha_resuelto', label:'Fecha resuelto', width:160 },
    { key:'id', label:'ID', width:90 }
  ],[])

  const [filters, setFilters] = useState({})
  const [colWidths, setColWidths] = useState(() => Object.fromEntries(cols.map(c=>[c.key, c.width])))
  const [rows, setRows] = useState(tickets || [])
  const originalEstadoById = useRef({})
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  useEffect(()=>{
    try{
      originalEstadoById.current = Object.fromEntries((tickets||[]).map(t=>[t.id, t.estado || '']))
    }catch(e){ originalEstadoById.current = {}; }
  }, [serverTick])

  useEffect(()=>{ setRows(tickets || []) }, [tickets])

  function applyFilter(r){
    return cols.every(c=>{
      const f = (filters[c.key]||'').toString().toLowerCase().trim();
      if(!f) return true;
      const val = (() => {
        if (c.key === 'area') return resolveDisplayText(r, 'area_nombre', 'area', 'area_id');
        if (c.key === 'maquina') return resolveDisplayText(r, 'maquina_nombre', 'maquina', 'maquina_id');
        if (c.key === 'tecnico') return resolveDisplayText(r, 'tecnico_nombre', 'tecnico', 'tecnico_id');
        if (c.key === 'solicitante') return resolveDisplayText(r, 'solicitante_nombre', 'solicitante', 'solicitante_id');
        return (r[c.key] || '').toString();
      })().toLowerCase();
      return val.indexOf(f) !== -1;
    })
  }

  let filtered = rows.filter(applyFilter)
  if(sortKey){
    filtered = filtered.slice().sort((a,b)=>{
      const av = (() => {
        if (sortKey === 'area') return resolveDisplayText(a, 'area_nombre', 'area', 'area_id');
        if (sortKey === 'maquina') return resolveDisplayText(a, 'maquina_nombre', 'maquina', 'maquina_id');
        if (sortKey === 'tecnico') return resolveDisplayText(a, 'tecnico_nombre', 'tecnico', 'tecnico_id');
        if (sortKey === 'solicitante') return resolveDisplayText(a, 'solicitante_nombre', 'solicitante', 'solicitante_id');
        return (a[sortKey] || '').toString();
      })().toLowerCase();
      const bv = (() => {
        if (sortKey === 'area') return resolveDisplayText(b, 'area_nombre', 'area', 'area_id');
        if (sortKey === 'maquina') return resolveDisplayText(b, 'maquina_nombre', 'maquina', 'maquina_id');
        if (sortKey === 'tecnico') return resolveDisplayText(b, 'tecnico_nombre', 'tecnico', 'tecnico_id');
        if (sortKey === 'solicitante') return resolveDisplayText(b, 'solicitante_nombre', 'solicitante', 'solicitante_id');
        return (b[sortKey] || '').toString();
      })().toLowerCase();
      if(av < bv) return sortDir === 'asc' ? -1 : 1;
      if(av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    })
  }

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

  function onEdit(rowId, keyOrPatch, maybeValue){
    const patch = typeof keyOrPatch === 'object' && keyOrPatch !== null ? keyOrPatch : { [keyOrPatch]: maybeValue }
    const current = rows.find(p=> p.id === rowId)
    if(!current) return
    const id = current.id
    const updated = { ...current, ...patch }
    setRows(prev => prev.map(p=> p.id===id? updated : p))
    if(onCellEdit){
      const firstKey = Object.keys(patch)[0]
      const firstValue = patch[firstKey]
      onCellEdit(updated, firstKey, firstValue)
    }
  }

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
                    const isResolved = (origEstado + '').toString().toLowerCase().includes('resuelto');
                    const isLocked = isOriginallyEscalado || isResolved;

                    if(c.key === 'area') {
                      const areaValue = r.area_id !== undefined && r.area_id !== null && r.area_id !== '' ? String(r.area_id) : (r.area || '');
                      return (
                        <select value={areaValue} onChange={e=> {
                          const chosen = e.target.value;
                          const selectedArea = areas.find(a => String(a.id) === String(chosen));
                          onEdit(r.id, { area_id: chosen === '' ? null : Number(chosen), area: selectedArea?.nombre || '' });
                        }} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                          <option value="">--</option>
                          {(areas||[]).map(a=> <option key={a.id} value={String(a.id)}>{a.nombre}</option>)}
                        </select>
                      )
                    }

                    if(c.key === 'maquina') {
                      const value = r.maquina_id !== undefined && r.maquina_id !== null && r.maquina_id !== '' ? String(r.maquina_id) : (r.maquina || '');
                      return (
                        <select value={value} onChange={e=> {
                          const chosen = e.target.value;
                          const selectedMaquina = maquinas.find(m => String(m.id) === String(chosen));
                          onEdit(r.id, { maquina_id: chosen === '' ? null : Number(chosen), maquina: selectedMaquina?.nombre || '' });
                        }} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                          <option value="">--</option>
                          {(maquinas||[]).map(m=> <option key={m.id} value={String(m.id)}>{m.nombre}</option>)}
                        </select>
                      )
                    }

                    if(c.key === 'tecnico') {
                      const value = r.tecnico_id !== undefined && r.tecnico_id !== null && r.tecnico_id !== '' ? String(r.tecnico_id) : (r.tecnico || '');
                      return (
                        <select value={value} onChange={e=> {
                          const chosen = e.target.value;
                          const selectedTecnico = tecnicos.find(tc => String(tc.id) === String(chosen));
                          onEdit(r.id, { tecnico_id: chosen === '' ? null : Number(chosen), tecnico: selectedTecnico?.nombre || selectedTecnico?.email || '' });
                        }} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                          <option value="">--</option>
                          {(tecnicos||[]).filter(tc=> (tc.rol||'').toLowerCase()!=='empleado').map(tc=> <option key={tc.email||tc.id} value={String(tc.id)}>{tc.nombre || tc.email}</option>)}
                        </select>
                      )
                    }

                    if(c.key === 'estado') return (
                      <select value={r.estado||''} onChange={e=> onEdit(r.id, 'estado', e.target.value)} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}}>
                        <option>Abierto</option>
                        <option>En Proceso</option>
                        <option>En Espera</option>
                        <option>Resuelto</option>
                        <option>Escalado a Servidor Externo</option>
                      </select>
                    )

                    if(c.key === 'solicitante') return (
                      <input value={resolveDisplayText(r, 'solicitante_nombre', 'solicitante', 'solicitante_id')} onChange={e=> onEdit(r.id, 'solicitante', e.target.value)} disabled={isLocked} style={{minWidth:120,width:'auto',padding:6,borderRadius:4,border:'1px solid #e6eef8',whiteSpace:'nowrap'}} />
                    )

                    if(c.key === 'descripcion') return (
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
                        <button onClick={()=> onShowInfo && onShowInfo(r)} className="btn-secondary" title="Ver información del ticket" style={{minWidth: 34, padding: '6px 8px'}}>Info</button>
                      </div>
                    )

                    if(c.key === 'fecha_creacion') return (
                      <div style={{fontSize:13}}> { r.fecha_creacion ? formatDate(r.fecha_creacion) : '' }</div>
                    )

                    return (<div style={{fontSize:13}}>{resolveDisplayText(r, c.key === 'area' ? 'area_nombre' : c.key === 'maquina' ? 'maquina_nombre' : c.key === 'tecnico' ? 'tecnico_nombre' : c.key === 'solicitante' ? 'solicitante_nombre' : c.key, c.key, c.key + '_id') || ''}</div>)
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
