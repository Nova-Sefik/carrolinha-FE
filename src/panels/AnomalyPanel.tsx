import { useAnomalies, useMeta } from '../api/hooks'
import type { Alert } from '../api/types'
import { hourLabel, int, signedPct } from '../lib/format'
import { BLUE, RED } from '../lib/scales'
import { useApp } from '../state'
import { HourChart } from './charts'
import { ErrorBox, Header, Loading } from './common'

/** GET /api/anomalies (whole week) → alert list + detail card. */
export default function AnomalyPanel() {
  const { data: meta } = useMeta()
  const { data, isPending, error } = useAnomalies()
  const { alertId, reviewed, set, flyTo } = useApp()

  if (error) return <ErrorBox error={error} />
  if (isPending || !data) return <Loading />

  const weekday = (date: string) => meta?.days.find((d) => d.date === date)?.weekday ?? date
  const when = (a: Alert) => `${weekday(a.date)} ${hourLabel(a.hour)}`
  const sel = data.alerts.find((a) => a.alert_id === alertId) ?? null
  const open = reviewed ? data.alerts.filter((a) => !reviewed[a.alert_id]).length : data.alerts.length

  const pick = (a: Alert) => {
    // Jump the whole app to the alert's moment and place.
    set({ alertId: a.alert_id, day: a.date, hour: a.hour, selStop: a.stop_id, playing: false })
    flyTo(a.lon, a.lat, 12.5)
  }

  return (
    <div className="stack">
      <Header kicker="Anomaly alerts · observed vs expected"
        title={`${data.alerts.length} alert${data.alerts.length === 1 ? '' : 's'} this week`}>
        <div style={{ fontSize: 12.5, color: '#52514e', marginTop: 4 }}>{open} not yet reviewed</div>
      </Header>

      <div>
        {data.alerts.map((a) => {
          const up = a.direction === 'above'
          return (
            <button key={a.alert_id} type="button" className="row-btn" aria-pressed={a.alert_id === alertId}
              style={{ minHeight: 48, opacity: reviewed[a.alert_id] ? 0.55 : 1 }} onClick={() => pick(a)}>
              <span className="z-badge" style={{ background: up ? '#fde4e3' : '#e1edfb', color: up ? '#9f1d1c' : '#184f95' }}>
                {up ? '▲' : '▼'} {signedPct(a.deviation_pct)}
              </span>
              <span className="grow">{a.name}</span>
              <span className="meta">{when(a)}</span>
            </button>
          )
        })}
        {data.alerts.length === 0 && <div className="footnote">No stop-hour passed the threshold this week.</div>}
      </div>

      {sel ? (
        <div className="card">
          <div className="card-title">{sel.name} · {when(sel)}</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Stat value={int(sel.observed)} label="observed" />
            <Stat value={int(sel.expected)} label="expected" muted />
            <Stat value={signedPct(sel.deviation_pct)} label="deviation" color={sel.direction === 'above' ? RED : BLUE} />
            <Stat value={sel.robust_z.toFixed(1)} label="robust z" muted />
          </div>
          <HourChart
            height={130} valueName="Observed" expectedName="Expected"
            onPickHour={(h) => set({ hour: h })}
            data={sel.hourly.map((h) => ({
              hour: h.hour, value: h.observed, expected: h.expected,
              fill: h.hour === sel.hour ? (sel.direction === 'above' ? '#e34948' : BLUE) : '#cfcdc6',
            }))}
          />
          <div className="chart-legend">
            <span><span className="swatch" style={{ background: '#cfcdc6' }} />Observed</span>
            <span><span style={{ width: 14, height: 2, background: '#141413' }} />Expected (same hour, typical weekday)</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn primary"
              onClick={() => set({ mode: 'demand', layer: 'stops', selStop: sel.stop_id })}>
              Open stop profile
            </button>
            <button type="button" className="btn" aria-pressed={!!reviewed[sel.alert_id]}
              onClick={() => set({ reviewed: { ...reviewed, [sel.alert_id]: !reviewed[sel.alert_id] } })}>
              {reviewed[sel.alert_id] ? 'Reviewed ✓' : 'Mark as reviewed'}
            </button>
          </div>
        </div>
      ) : (
        data.alerts.length > 0 && <div style={{ fontSize: 13, color: '#52514e' }}>Pick an alert to jump the map to that stop and hour.</div>
      )}

      <div className="footnote">{data.method} No forecasting model.</div>
    </div>
  )
}

function Stat({ value, label, color, muted }: { value: string; label: string; color?: string; muted?: boolean }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 20, fontWeight: color ? 600 : 500, color: color ?? (muted ? '#52514e' : undefined) }}>{value}</div>
      <div style={{ fontSize: 12, color: '#52514e' }}>{label}</div>
    </div>
  )
}
