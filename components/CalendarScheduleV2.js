import React, { useMemo, useState } from 'react'
import { formatDate } from '../lib/format'

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(date) {
  const d = startOfDay(date)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d
}

function diffDays(a, b) {
  const A = startOfDay(a)
  const B = startOfDay(b)
  return Math.round((B - A) / (1000 * 60 * 60 * 24))
}

function statusColor(status) {
  if (!status) return '#6b7280'
  const s = String(status).toLowerCase()
  if (s.includes('resuelto')) return '#10b981'
  if (s.includes('proceso')) return '#f59e0b'
  if (s.includes('espera')) return '#9ca3af'
  if (s.includes('escalad')) return '#ef4444'
  return '#2563eb'
}

function initials(name) {
  if (!name) return ''
  const parts = String(name).trim().split(/\s+/)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''
  return `${first}${second}`.toUpperCase()
}

export default function CalendarScheduleV2({
  tecnicos = [],
  tickets = [],
  view = 'week',
  currentDate = null,
  filterTecnico = null,
  onlyAvailable = false,
  escalados = [],
  onEventClick = null,
}) {
  const referenceDate = currentDate ? new Date(currentDate) : new Date()
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null })

  const techRows = useMemo(() => {
    const rows = (tecnicos || []).map((t) => ({
      id: String(t.email || t.id || t.nombre || 'tech'),
      title: t.nombre || t.email || 'Técnico',
      avatar: t.avatar || t.foto || t.image || t.profile_image || null,
    }))
    rows.push({ id: '__sin_asignar', title: 'Sin asignar', avatar: null })
    return rows
  }, [tecnicos])

  const weekStart = useMemo(() => startOfWeek(referenceDate), [referenceDate])
  const weekDays = useMemo(() => {
    const arr = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [weekStart])

  const evs = useMemo(() => {
    const items = (tickets || []).map((tt) => {
      const startRaw = tt.fecha_creacion || tt.fecha || null
      if (!startRaw) return null
      const startDate = new Date(startRaw)
      const escaladoRecord = (escalados || []).find((e) => String(e.ticket_id) === String(tt.id)) || null
      const endRaw = escaladoRecord?.fecha_resuelto || escaladoRecord?.fechaResuelto || tt.fecha_resuelto || tt.fechaResuelto || startDate
      const endDate = new Date(endRaw)
      const techKey = String(tt.tecnico || tt.tecnico_email || tt.tecnicoId || tt.tecnico_id || '__sin_asignar')
      const isEscalado = !!escaladoRecord || String(tt.estado || '').toLowerCase().includes('escalad')
      return {
        raw: tt,
        startDate,
        endDate,
        techKey,
        isEscalado,
        escaladoRecord,
        color: isEscalado ? statusColor('escalad') : statusColor(tt.estado || 'pendiente'),
      }
    }).filter(Boolean)

    return items.filter((item) => {
      const endDate = startOfDay(item.endDate)
      const startDate = startOfDay(item.startDate)
      return endDate >= weekDays[0] && startDate <= weekDays[weekDays.length - 1]
    })
  }, [tickets, escalados, weekDays])

  const visibleRows = useMemo(() => {
    let rows = techRows
    if (filterTecnico) {
      rows = rows.filter((r) => r.id === String(filterTecnico))
    }

    if (!onlyAvailable) return rows

    const busyByTech = new Set()
    for (const row of rows) {
      const hasEvent = evs.some((ev) => String(ev.techKey) === String(row.id))
      if (hasEvent) busyByTech.add(row.id)
    }
    return rows.filter((row) => !busyByTech.has(row.id))
  }, [techRows, filterTecnico, onlyAvailable, evs])

  const showTooltip = (event, item) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(window.innerWidth - 340, rect.right + 14)
    const y = Math.max(10, rect.top - 12)
    setTooltip({ visible: true, x, y, data: item })
  }

  const hideTooltip = () => setTooltip({ visible: false, x: 0, y: 0, data: null })

  const dayHeaders = weekDays.map((d) => ({
    label: d.getDate(),
    text: d.toLocaleDateString('es-EC', { weekday: 'short' }),
    full: d,
  }))

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #eef2ff', borderRadius: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 12, borderBottom: '1px solid #f3f4f6', background: '#f8fafc' }}>
        <div style={{ width: 300, minWidth: 220, fontWeight: 700, color: '#111827' }}>Técnicos / Semana</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, flexWrap: 'nowrap' }}>
          {[
            { label: 'Resuelto', color: '#10b981' },
            { label: 'En Proceso', color: '#f59e0b' },
            { label: 'En Espera', color: '#9ca3af' },
            { label: 'Escalado', color: '#ef4444' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <div style={{ width: 12, height: 12, background: item.color, borderRadius: 4 }} />
              <div style={{ fontSize: 12, color: '#374151' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 900 }}>
        <div style={{ width: 300, minWidth: 220, borderRight: '1px solid #eef2ff', background: '#fff' }}>
          {visibleRows.map((row) => (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', minHeight: 88, borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1d4ed8', fontSize: 14 }}>
                {row.avatar ? (
                  <img src={row.avatar} alt={row.title} style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' }} />
                ) : (
                  initials(row.title)
                )}
              </div>
              <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.2 }}>{row.title}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 700 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDays.length}, minmax(120px, 1fr))`, borderBottom: '1px solid #eef2ff' }}>
            {dayHeaders.map((day) => (
              <div key={day.full.toISOString()} style={{ height: 36, borderRight: '1px solid #eef2ff', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#475569' }}>
                <span>{day.label}</span>
              </div>
            ))}
          </div>

          {visibleRows.map((row) => {
            const rowEvents = evs.filter((ev) => String(ev.techKey) === String(row.id))

            return (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDays.length}, minmax(120px, 1fr))`, minHeight: 88, borderBottom: '1px solid #f3f4f6' }}>
                {weekDays.map((day) => {
                  const dayEvents = rowEvents.filter((ev) => {
                    const startDay = startOfDay(ev.startDate)
                    const endDay = startOfDay(ev.endDate)
                    return startDay <= day && endDay >= day
                  })

                  return (
                    <div key={day.toISOString()} style={{ position: 'relative', minHeight: 88, borderRight: '1px solid #f1f5f9', background: '#fff' }}>
                      {dayEvents.map((ev, idx) => {
                        const startIdx = diffDays(weekDays[0], startOfDay(ev.startDate))
                        const endIdx = diffDays(weekDays[0], startOfDay(ev.endDate))
                        const clampedStart = Math.max(0, startIdx)
                        const clampedEnd = Math.min(weekDays.length - 1, endIdx)
                        const span = Math.max(1, clampedEnd - clampedStart + 1)
                        const leftPct = (clampedStart / weekDays.length) * 100
                        const widthPct = (span / weekDays.length) * 100

                        return (
                          <div
                            key={`${row.id}-${ev.raw.id}-${idx}`}
                            onMouseEnter={(event) => showTooltip(event, ev.raw)}
                            onMouseLeave={hideTooltip}
                            onClick={() => onEventClick && onEventClick(ev.raw)}
                            title={ev.raw.solicitante || ev.raw.descripcion || ev.raw.id}
                            style={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              width: `calc(${widthPct}% - 4px)`,
                              top: 8 + (idx % 3) * 24,
                              minHeight: 26,
                              padding: '6px 8px',
                              borderRadius: 8,
                              background: ev.color,
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              boxShadow: '0 3px 8px rgba(2, 6, 23, 0.12)',
                              cursor: onEventClick ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              zIndex: 2,
                            }}
                          >
                            <span style={{ width: 14, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800 }}>T</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              #{ev.raw.id}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {tooltip.visible && tooltip.data && (
        <div style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999, width: 320, background: '#0f172a', color: '#fff', borderRadius: 10, boxShadow: '0 16px 32px rgba(2, 6, 23, 0.35)', padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Tique #{tooltip.data.id}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{tooltip.data.solicitante || tooltip.data.usuario || 'Sin solicitante'}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>{tooltip.data.estado || 'Sin estado'}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
            {tooltip.data.tecnico ? `Técnico: ${tooltip.data.tecnico}` : 'Sin técnico'}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
            {tooltip.data.fecha_creacion ? `Inicio: ${formatDate(tooltip.data.fecha_creacion)}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
