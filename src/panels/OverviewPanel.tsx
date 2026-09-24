import { useAnomalies, useMeta, useOverview, useStops, useOperators } from '../api/hooks'
import { compact, dayLabel, hourLabel, int, pct } from '../lib/format'
import { useApp } from '../state'
import { Chevron, ErrorBox, Header, Loading, Warn } from './common'

/** GET /api/overview → KPIs, operator share, busiest interchanges, alert CTA. */
export default function OverviewPanel() {
  const { data: meta } = useMeta()
  const { data: ov, isPending, error } = useOverview()
  const { data: week } = useAnomalies()
  const { data: stops } = useStops()
  const { day, set, pickStop, flyTo } = useApp()
  const opsById = useOperators()

  if (error) return <ErrorBox error={error} />
  if (isPending || !ov) return <Loading />

  const kpis = [
    { value: compact(ov.kpis.boardings), label: 'boardings (entry taps), with current filters' },
    { value: hourLabel(ov.kpis.busiest_hour), label: 'busiest hour' },
    { value: compact(ov.kpis.transfers), label: 'cross-operator transfers' },
    { value: String(ov.kpis.alerts), label: ov.kpis.alerts === 1 ? 'anomaly alert today' : 'anomaly alerts today' },
  ]
  const share = ov.operator_share.filter((s) => s.share > 0)
  const weekAlerts = week?.alerts.length ?? 0

  return (
    <div className="stack">
      <Header kicker={`Network · ${dayLabel(meta?.days, day)}`} title="How the metro area moved" />

      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="section-title">Boardings by operator</div>
        <div className="stacked" role="img" aria-label="Share of boardings by operator">
          {share.map((s) => (
            <span key={s.operator} style={{ flex: s.share, background: opsById[s.operator]?.color }} title={`${opsById[s.operator]?.name}: ${pct(s.share)}`} />
          ))}
        </div>
        <div className="legend-grid">
          {ov.operator_share.map((s) => (
            <div key={s.operator} className="legend-item">
              <span className="swatch" style={{ background: opsById[s.operator]?.color }} />
              <span>{opsById[s.operator]?.name ?? s.operator}</span>
              <span className="mono" title={`${int(s.boardings)} boardings`}>{pct(s.share)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">Busiest interchanges</div>
        {ov.top_interchanges.map((x) => (
          <button key={x.stop_id} type="button" className="row-btn" onClick={() => {
            pickStop(x.stop_id)
            const s = stops?.stops.find((p) => p.stop_id === x.stop_id)
            if (s) flyTo(s.lon, s.lat, 12.5)
          }}>
            <span className="grow">{x.name}</span>
            <span className="meta">{int(x.transfers)} transfers</span>
            <Chevron />
          </button>
        ))}
      </div>

      <button type="button" className="cta-alert" onClick={() => set({ mode: 'anomalies' })}>
        <Warn />
        <span style={{ flex: 1 }}>
          {ov.kpis.alerts > 0
            ? `${ov.kpis.alerts} unusual stop-hour${ov.kpis.alerts > 1 ? 's' : ''} today · ${weekAlerts} this week`
            : `No alerts today · ${weekAlerts} this week`}
        </span>
        <Chevron />
      </button>

      <div className="footnote">
        Counts entries only (event types 1, 3, 13); Metro exit taps are used for origin–destination, never as
        boardings. {meta?.note}
      </div>
    </div>
  )
}
