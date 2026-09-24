import { useScales } from '../api/hooks'
import { compact, hourLabel } from '../lib/format'
import { DIV_LABELS, DIVERGING, LOAD, LOAD_LABELS, RAMP, stopDemandThreshold, WAIT } from '../lib/scales'
import { useApp } from '../state'

interface Row { color: string; label: string; ring?: boolean }

export default function Legend() {
  const scales = useScales()
  const { mode, layer, hour } = useApp()
  let title = ''
  let rows: Row[] = []
  let note = ''

  if (mode === 'demand' && layer === 'hex') {
    title = 'Boardings per hour, by area'
    const max = scales?.hex_boardings_max ?? 1
    rows = RAMP.map((c, i) => ({ color: c, label: 'from ' + compact(stopDemandThreshold(i, max)) + '/h' }))
    note = 'Log scale, fixed for the whole week (per filter), so hours and days compare fairly.'
  } else if (mode === 'demand') {
    const max = scales?.stop_boardings_max ?? 1
    title = 'Boardings per hour, by stop'
    rows = RAMP.map((c, i) => ({ color: c, label: 'from ' + compact(stopDemandThreshold(i, max)) + '/h' }))
    note = 'Circle area = boardings. Fixed scale.'
  } else if (mode === 'anomalies') {
    title = 'Observed vs expected'
    rows = DIVERGING.map((c, i) => ({ color: c, label: DIV_LABELS[i] }))
    note = layer === 'stops' ? 'Circle area = expected boardings. Expected = same hour on a typical weekday.' : 'Expected = same hour on a typical weekday.'
  } else if (mode === 'load') {
    title = `Load vs capacity at ${hourLabel(hour)}`
    rows = LOAD.map((c, i) => ({ color: c, label: LOAD_LABELS[i] }))
    note = 'Lines with trip-level capacity. Click a line to inspect it.'
  } else if (mode === 'golden') {
    title = 'Golden lines (typical weekday)'
    rows = [
      { color: '#c48c00', label: 'strong · 60+ riders/h at peak' },
      { color: '#e2aa1e', label: 'viable · 30–60 riders/h' },
      { color: '#e8c878', label: 'weak · under 30 riders/h' },
    ]
    note = 'Width = projected riders/day. Click a line to see how people travel today (grey) and what it would replace.'
  } else {
    title = 'Median transfer wait'
    rows = [
      { color: WAIT.ok, label: 'up to 7 min', ring: true },
      { color: WAIT.slow, label: '8–11 min', ring: true },
      { color: WAIT.fragile, label: '12 min or more', ring: true },
    ]
    note = 'The 20 busiest interchanges. Lines = most common journeys that change operator, drawn through the hub where people change. Click a ring or a line to isolate it.'
  }

  return (
    <div className="float-card legend">
      <div className="legend-title">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="legend-row">
          <span className="legend-chip" style={{ background: r.ring ? '#fcfcfb' : r.color, borderColor: r.color, borderWidth: r.ring ? 2 : 1 }} />
          <span>{r.label}</span>
        </div>
      ))}
      <div className="legend-note">{note}</div>
    </div>
  )
}
