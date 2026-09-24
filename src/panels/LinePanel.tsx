import { useMemo } from 'react'
import { useLineProfiles, useMeta, useOperators } from '../api/hooks'
import type { LineProfile } from '../api/types'
import { dayLabel, hourLabel, int, pct } from '../lib/format'
import { loadColor } from '../lib/scales'
import { applyWhatIf, tightest } from '../lib/whatif'
import { useApp } from '../state'
import { HourChart } from './charts'
import { ErrorBox, Header, Loading} from './common'

const MIDDAY: [number, number] = [10, 16]

/** GET /api/lines/{id}/profile for every line → capacity view + what-if. */
export default function LinePanel() {
  const { data: meta } = useMeta()
  const lines = meta?.lines ?? []
  const qs = useLineProfiles(lines.map((l) => l.line_id))
  const { line, whatif, hour, day, set } = useApp()
  const opsById = useOperators()
  const activeId = line ?? lines[0]?.line_id
  const idx = lines.findIndex((l) => l.line_id === activeId)
  const q = qs[idx]
  const p = q?.data

  // Most loaded line-hours across all lines (what-if applied to the active line).
  const top = useMemo(() => {
    const rows: { p: LineProfile; hour: number; lf: number }[] = []
    for (const lq of qs) {
      const lp = lq.data
      if (!lp) continue
      const hours = lp.line_id === activeId ? applyWhatIf(lp, whatif) : lp.hours
      for (const h of hours) rows.push({ p: lp, hour: h.hour, lf: h.load_factor })
    }
    return rows.sort((a, b) => b.lf - a.lf).slice(0, 5)
  }, [qs, activeId, whatif])

  if (!lines.length) return <div className="footnote">No lines with trip-level capacity in this dataset yet.</div>
  if (q?.error) return <ErrorBox error={q.error} />
  if (!p) return <Loading />

  const base = p.hours
  const after = applyWhatIf(p, whatif)
  const peakBefore = tightest(base)
  const peakAfter = tightest(after)
  const midBefore = tightest(base, ...MIDDAY)
  const midAfter = tightest(after, ...MIDDAY)
  const maxMoves = p.whatif.move_to_hours.length

  return (
    <div className="stack">
      <Header kicker={`Load vs capacity · ${opsById[p.operator]?.name ?? p.operator}`}
        title={`${p.mode === 'ferry' ? 'Ferry' : 'Line'} ${p.label} · ${p.name}`} />

      <div className="line-pick" role="group" aria-label="Line">
        {lines.map((l) => (
          <button key={l.line_id} type="button" className="line-btn" aria-pressed={l.line_id === activeId}
            onClick={() => set({ line: l.line_id, whatif: 0 })} title={l.name}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-value" style={{ color: loadColor(peakAfter.load_factor) }}>{pct(peakAfter.load_factor)}</div>
          <div className="kpi-label">Tightest hour · {hourLabel(peakAfter.hour)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{p.vehicle.places}</div>
          <div className="kpi-label">
            Places per {p.mode === 'ferry' ? 'vessel' : 'vehicle'} ({p.vehicle.seats} seats + {p.vehicle.standing} standing · {p.vehicle.source})
          </div>
        </div>
      </div>

      <div>
        <HourChart
          height={170} valueName="Est. peak on-board load" lineName="Places offered"
          onPickHour={(h) => set({ hour: h })}
          data={after.map((h) => ({
            hour: h.hour, value: h.est_peak_load, line: h.places_offered,
            fill: h.hour === hour ? '#141413' : h.load_factor > 1 ? '#c24e1f' : '#2a78d6',
          }))}
        />
        <div className="chart-legend">
          <span><span className="swatch" style={{ background: '#2a78d6' }} />Estimated peak on-board load</span>
          <span><span className="swatch" style={{ background: '#c24e1f' }} />Over capacity</span>
          <span><span style={{ width: 16, height: 2, background: '#eb6834' }} />Places offered (each trip's vehicle)</span>
        </div>
      </div>

      {maxMoves > 0 && (
        <div className="whatif">
          <label htmlFor="whatif" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span>What-if: re-time midday trips into the peaks</span>
            <span className="mono">{whatif} moved</span>
          </label>
          <input id="whatif" type="range" min={0} max={maxMoves} step={1} value={whatif}
            onChange={(e) => set({ whatif: Number(e.target.value) })} />
          <div className="two-col">
            <div>Tightest hour
              <div className="mono">{pct(peakBefore.load_factor)} → {pct(peakAfter.load_factor)} <span style={{ color: '#6b6a65', fontSize: 12 }}>({hourLabel(peakAfter.hour)})</span></div>
            </div>
            <div>Tightest midday hour
              <div className="mono">{pct(midBefore.load_factor)} → {pct(midAfter.load_factor)} <span style={{ color: '#6b6a65', fontSize: 12 }}>({hourLabel(midAfter.hour)})</span></div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: '#52514e', marginTop: 8 }}>
            Same {p.mode === 'ferry' ? 'vessels' : 'buses'} and crew hours: trips are re-timed, not added.
            {whatif > 0 && ` Moved: ${p.whatif.move_from_hours.slice(0, whatif).map(hourLabel).join(', ')} → ${p.whatif.move_to_hours.slice(0, whatif).map(hourLabel).join(', ')}.`}
          </div>
        </div>
      )}

      <div>
        <div className="section-title">Most loaded line-hours · {dayLabel(meta?.days, day)}</div>
        {top.map((t) => (
          <button key={t.p.line_id + t.hour} type="button" className="row-btn" style={{ minHeight: 40, fontSize: 12.5 }}
            onClick={() => set({ line: t.p.line_id, hour: t.hour, whatif: t.p.line_id === activeId ? whatif : 0 })}>
            <span className="mono" style={{ fontWeight: 500 }}>{t.p.label}</span>
            <span style={{ flex: 1, color: '#52514e' }}>{hourLabel(t.hour)} · {t.p.name}</span>
            <span className="mono" style={{ fontWeight: 600, color: loadColor(t.lf) }}>{pct(t.lf)}</span>
          </button>
        ))}
      </div>

      <div className="footnote">
        Capacity per trip = seats + standing from blocks.txt, joined through trips.block_id. On-board load is estimated
        from boardings and inferred alightings (trip chaining); boardings alone would overstate crowding.
        {' '}Boardings on this line today: {int(base.reduce((a, h) => a + h.boardings, 0))}.
      </div>
    </div>
  )
}
