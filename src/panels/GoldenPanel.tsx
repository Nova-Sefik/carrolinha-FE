import { useState } from 'react'
import { useGolden, useOperators } from '../api/hooks'
import type { GoldenFlag, GoldenRoute } from '../api/types'
import { hourLabel, int, pct } from '../lib/format'

const share = (x: number | null) => (x == null ? '–' : x > 0 && x < 0.005 ? '<1%' : pct(x))
import { useApp } from '../state'
import { HourChart } from './charts'
import { ErrorBox, Header, Loading } from './common'

const VERDICT: Record<GoldenRoute['verdict'], { bg: string; fg: string; label: string }> = {
  strong: { bg: '#f7e7b8', fg: '#6b4a00', label: 'Strong' },
  viable: { bg: '#fbefd0', fg: '#7a5a10', label: 'Viable' },
  weak: { bg: '#f1f0ec', fg: '#6b6a65', label: 'Weak' },
}
const FLAG: Record<GoldenFlag['level'], { bg: string; line: string; fg: string; icon: string }> = {
  benefit: { bg: '#e3f5ec', line: '#b5e2cb', fg: '#0d5b3d', icon: '✓' },
  info: { bg: '#f3f8fe', line: '#d9e6f6', fg: '#184f95', icon: 'i' },
  risk: { bg: '#fdf1f0', line: '#f2c9c7', fg: '#7f1d1c', icon: '!' },
}

/** GET /api/golden → proposed direct lines where many people need 2+ vehicles today. */
export default function GoldenPanel() {
  const { data, isPending, error } = useGolden()
  const { gsel, set } = useApp()
  const [onlyViable, setOnlyViable] = useState(false)

  if (error) return <ErrorBox error={error} />
  if (isPending || !data) return <Loading />

  const routes = data.routes.filter((r) => !onlyViable || r.verdict !== 'weak')
  const sel = data.routes.find((r) => r.route_id === gsel) ?? null
  const a = data.assumptions

  return (
    <div className="stack">
      <Header kicker="Golden lines · typical weekday" title={sel ? `${sel.from.name} ↔ ${sel.to.name}` : 'Where a direct line would pay off'}>
        {sel ? (
          <button type="button" className="back" style={{ marginTop: 6 }} onClick={() => set({ gsel: null })}>
            ← All golden lines
          </button>
        ) : (
          <div style={{ fontSize: 12.5, color: '#52514e', marginTop: 6, lineHeight: 1.45 }}>
            Pairs of areas where an unusually high number of people need two or more vehicles every weekday, and a
            direct line would save them time. {data.routes.length} found.
          </div>
        )}
      </Header>

      {sel ? <Detail r={sel} /> : (
        <>
          <div className="tabs" role="group" aria-label="Filter" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className="tab small" aria-pressed={!onlyViable} onClick={() => setOnlyViable(false)}>All</button>
            <button type="button" className="tab small" aria-pressed={onlyViable} onClick={() => setOnlyViable(true)}>Strong + viable</button>
          </div>
          <div>
            {routes.map((r) => (
              <button key={r.route_id} type="button" className="row-btn" onClick={() => set({ gsel: r.route_id })}
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, padding: '9px 12px' }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="mono" style={{ color: '#6b6a65', fontSize: 12 }}>#{r.rank}</span>
                  <span className="grow">{r.from.name} ↔ {r.to.name}</span>
                  <Verdict v={r.verdict} />
                </span>
                <span style={{ display: 'flex', gap: 14, fontSize: 12, color: '#52514e' }}>
                  <span><b className="mono" style={{ color: '#141413' }}>{int(r.multi_per_day)}</b>/day need 2+ vehicles</span>
                  <span>saves <b className="mono" style={{ color: '#141413' }}>{Math.round(r.saved_min ?? 0)} min</b></span>
                  <span>{r.distance_km.toFixed(1)} km</span>
                </span>
              </button>
            ))}
            {routes.length === 0 && <div className="footnote">No area pair passes the thresholds.</div>}
          </div>
        </>
      )}

      <div className="footnote">
        {data.method}{' '}
        {a.golden_capture != null && (
          <>Projection: {pct(a.golden_capture)} switch · bus {a.golden_bus_kmh} km/h on a road
            {' '}{a.golden_detour}× the straight line · {a.golden_avg_wait_min} min average wait · {a.golden_bus_places} places per bus.</>
        )}
      </div>
    </div>
  )
}

function Verdict({ v }: { v: GoldenRoute['verdict'] }) {
  const s = VERDICT[v]
  return <span className="z-badge" style={{ background: s.bg, color: s.fg, fontFamily: 'inherit' }}>{s.label}</span>
}

function Detail({ r }: { r: GoldenRoute }) {
  const opsById = useOperators()
  const opName = (op: string) => opsById[op]?.name ?? op
  const opColor = (op: string) => opsById[op]?.color ?? '#999'
  const maxShare = Math.max(0.01, ...r.replaced.map((x) => x.share_of_line ?? 0))

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Verdict v={r.verdict} />
        <span style={{ fontSize: 12.5, color: '#52514e' }}>
          #{r.rank} · {r.distance_km.toFixed(1)} km · volume ≈ top {Math.max(1, Math.round(100 * (1 - normalCdf(r.spike_z))))}% of area pairs
        </span>
      </div>

      <div className="kpis">
        <Kpi value={int(r.multi_per_day)} label={`journeys/day need 2+ vehicles (${pct(r.multi_share)} of all trips between the two areas)`} />
        <Kpi value={`${Math.round(r.current_min ?? 0)} → ${Math.round(r.projected_min)} min`}
          label={`door to door today → direct line (saves ${Math.round(r.saved_min ?? 0)} min)`} />
        <Kpi value={int(r.riders_per_day)} label={`projected riders/day · ${int(r.person_hours_per_day ?? 0)} person-hours saved daily`} />
        <Kpi value={r.peak_hour != null ? hourLabel(r.peak_hour) : '–'}
          label={`peak: ~${Math.round(r.peak_riders ?? 0)} riders/h → ${r.trips_needed_peak} buses/h (every ${Math.round(60 / (r.trips_needed_peak || 1))} min)`} />
      </div>

      {r.flags.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {r.flags.map((f, i) => {
            const s = FLAG[f.level]
            return (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.45, color: s.fg, background: s.bg,
                border: `1px solid ${s.line}`, borderRadius: 8, padding: '8px 10px' }}>
                <b style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>{s.icon}</b><span>{f.text}</span>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <div className="section-title">How people make this trip today</div>
        {r.paths.map((p, i) => (
          <div key={i} className="pair" style={{ flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid #efeee9' }}>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', flex: 1, fontSize: 12 }}>
              {p.legs.map((l, k) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {k > 0 && <span style={{ color: '#6b6a65' }}>→ {p.via[k - 1]?.name ?? ''} →</span>}
                  <span className="chip" style={{ height: 22 }} title={l.name}>
                    <span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: opColor(l.operator) }} />
                    {l.operator === 'metro' ? 'Metro' : `${opName(l.operator)} ${l.label}`}
                  </span>
                </span>
              ))}
            </span>
            <span className="mono" style={{ color: '#52514e', fontSize: 12 }}>{p.journeys_per_day.toFixed(0)}/day</span>
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: '#6b6a65', marginTop: 6 }}>
          The {r.paths.length} most common chains ({pct(r.paths.reduce((s, p) => s + p.share, 0))} of these journeys; the rest
          are spread over many combinations). Grey lines on the map.
        </div>
      </div>

      <div>
        <div className="section-title">What it would take off existing lines</div>
        {r.replaced.map((x) => (
          <div key={x.operator + x.line_id} className="pair" style={{ minHeight: 28 }}>
            <span className="pair-ops" title={x.name}>
              <span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: opColor(x.operator) }} />
              {x.operator === 'metro' ? 'Metro' : `${opName(x.operator)} ${x.label}`}
            </span>
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ height: 8, borderRadius: 2, background: (x.share_of_line ?? 0) >= 0.15 ? '#e34948' : '#c48c00',
                width: `${Math.max(3, ((x.share_of_line ?? 0) / maxShare) * 90)}px` }} />
              <span className="mono" style={{ color: '#52514e' }}>−{int(x.riders_removed_per_day)}/day</span>
            </span>
            <span className="mono" title={`of ${int(x.line_riders_per_day)} weekday riders`}>
              {share(x.share_of_line)}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: '#6b6a65', marginTop: 4 }}>
          Riders each line would lose, and the share of its weekday riders. Red = 15%+: its frequency should be reviewed.
        </div>
      </div>

      {r.hubs.length > 0 && (
        <div>
          <div className="section-title">Transfer points it removes</div>
          {r.hubs.map((h) => (
            <div key={h.stop_id} className="pair" style={{ minHeight: 26 }}>
              <span style={{ flex: 1 }}>{h.name}</span>
              <span className="mono" style={{ color: '#52514e' }}>−{int(h.transfers_removed_per_day)} boardings/day</span>
              <span className="mono" style={{ width: 52, textAlign: 'right' }}>{share(h.share_of_hub)}</span>
            </div>
          ))}
        </div>
      )}

      {r.direct_lines.length > 0 && (
        <div>
          <div className="section-title">Direct options people already use</div>
          {r.direct_lines.map((d) => (
            <div key={d.operator + d.line_id} className="pair" style={{ minHeight: 26 }}>
              <span style={{ flex: 1 }} title={d.name}>
                {d.operator === 'metro' ? 'Metro' : `${opName(d.operator)} ${d.label}`}
                {d.name && <span style={{ color: '#6b6a65' }}> · {d.name}</span>}
              </span>
              <span className="mono" style={{ color: '#52514e' }}>{int(d.journeys_per_day)}/day</span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: '#6b6a65', marginTop: 4 }}>
            {int(r.direct_per_day)}/day already travel between these areas on a single vehicle.
          </div>
        </div>
      )}

      <div>
        <div className="section-title">When they travel (multi-vehicle journeys, both directions)</div>
        <HourChart height={120} valueName="Journeys"
          data={r.hourly.map((h) => ({ hour: h.hour, value: h.journeys, fill: h.hour === r.peak_hour ? '#c48c00' : '#e8c878' }))} />
        {r.share_a_to_b != null && (
          <div style={{ fontSize: 11.5, color: '#6b6a65' }}>
            {pct(r.share_a_to_b)} travel {r.from.name} → {r.to.name}, {pct(1 - r.share_a_to_b)} the other way.
          </div>
        )}
      </div>
    </>
  )
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="kpi">
      <div className="kpi-value" style={{ fontSize: 19 }}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

/** Standard normal CDF (to express a z-score as "top X%"). */
function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}
