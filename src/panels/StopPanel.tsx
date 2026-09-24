import { useMeta, useOperators, useScales, useStopDetail } from '../api/hooks'
import type { Facilities, StopDetail } from '../api/types'
import { hourLabel, int, pct, signedPct } from '../lib/format'
import { BLUE, RED, stopDemandColor } from '../lib/scales'
import { useApp } from '../state'
import { HourChart } from './charts'
import { Chevron, ErrorBox, Loading} from './common'

const MIX: [keyof StopDetail['mix'], string, string][] = [
  ['regular', 'Regular', '#2a78d6'],
  ['sub23', 'Sub-23', '#eb6834'],
  ['senior', '65+', '#1baf7a'],
]

const FACILITIES: [keyof Facilities, string][] = [
  ['shelter', 'Shelter'],
  ['step_free', 'Step-free'],
  ['realtime_display', 'Real-time display'],
  ['wheelchair_boarding', 'Wheelchair boarding'],
]

/** GET /api/stops/{id} → the stop drawer. */
export default function StopPanel({ stopId }: { stopId: string }) {
  const { data: meta } = useMeta()
  const { data: s, isPending, error } = useStopDetail(stopId)
  const { hour, day, set, pickStop } = useApp()
  const opsById = useOperators()
  const scales = useScales()

  const back = (
    <button type="button" className="back" onClick={() => pickStop(null)}>
      <Chevron dir="left" /> Network
    </button>
  )
  if (error) return <div className="stack">{back}<ErrorBox error={error} /></div>
  if (isPending || !s) return <div className="stack">{back}<Loading /></div>

  const stopMax = scales?.stop_boardings_max ?? 1
  const dev = s.now.deviation_pct
  const devColor = dev > 15 ? RED : dev < -15 ? BLUE : '#52514e'
  const hours = meta?.hours.map((h) => h.hour) ?? s.hourly.map((h) => h.hour)

  return (
    <div className="stack">
      <div>
        {back}
        <h2 className="h2" style={{ marginTop: 2 }}>{s.name}</h2>
        <div className="chips">
          {s.operators.map((o) => (
            <span key={o} className="chip">
              <span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: opsById[o]?.color }} />
              {opsById[o]?.name ?? o}
            </span>
          ))}
        </div>
      </div>

      <div className="big-number">
        <span className="value">{int(s.now.boardings)}</span>
        <span style={{ fontSize: 13, color: '#52514e' }}>boardings at {hourLabel(hour)}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: devColor }} title={`expected ${int(s.now.expected)}`}>
          {signedPct(dev)} vs typical
        </span>
      </div>

      <div>
        <div className="section-title">Across the day</div>
        <HourChart
          valueName="Boardings" expectedName="Expected" onPickHour={(h) => set({ hour: h })}
          data={s.hourly.map((h) => ({
            hour: h.hour, value: h.boardings, expected: h.expected,
            fill: h.hour === hour ? '#141413' : '#9ec5f4',
          }))}
        />
        <div className="chart-legend">
          <span><span className="swatch" style={{ background: '#9ec5f4' }} />Boardings</span>
          <span><span style={{ width: 14, height: 2, background: '#141413' }} />Expected (typical same weekday hour)</span>
        </div>
      </div>

      <div>
        <div className="section-title">Week by hour</div>
        <div role="grid" aria-label="Boardings by day and hour">
          {s.week_grid.map((row) => (
            <div key={row.date} className="week-grid" role="row" style={{ marginBottom: 2 }}>
              <span className={'wd' + (row.date === day ? ' on' : '')}>{row.weekday}</span>
              {row.hourly.map((v, i) => {
                const h = hours[i]
                const on = row.date === day && h === hour
                return (
                  <button key={i} type="button" role="gridcell" className={'week-cell' + (on ? ' on' : '')}
                    style={{ background: stopDemandColor(v, stopMax) }}
                    title={`${row.weekday} ${hourLabel(h)} · ${int(v)} boardings`}
                    aria-label={`${row.weekday} ${hourLabel(h)}: ${int(v)} boardings`}
                    onClick={() => set({ day: row.date, hour: h })} />
                )
              })}
            </div>
          ))}
          <div className="week-ticks">
            <span />
            {hours.map((h) => <span key={h} style={{ textAlign: 'center' }}>{h % 3 === 0 ? (h === 24 ? '00' : h) : ''}</span>)}
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Who boards here</div>
        <div className="stacked" style={{ height: 14 }}>
          {MIX.map(([k, , c]) => <span key={k} style={{ flex: s.mix[k], background: c }} />)}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {MIX.map(([k, label, c]) => (
            <span key={k} className="legend-item">
              <span className="swatch" style={{ background: c }} />{label}
              <span className="mono" style={{ marginLeft: 4 }}>{pct(s.mix[k])}</span>
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">Stop facilities <span style={{ fontWeight: 400, color: '#6b6a65' }}>(stops.csv)</span></div>
        <div className="chips" style={{ marginTop: 0 }}>
          {FACILITIES.map(([k, label]) => (
            <span key={k} className={'fac ' + (s.facilities[k] ? 'ok' : 'no')}>
              {s.facilities[k] ? '✓' : '✕'} {label}
            </span>
          ))}
        </div>
      </div>

      {s.transfers_here && (
        <button type="button" className="row-btn" onClick={() => set({ mode: 'transfers', xsel: s.stop_id })}>
          <span className="grow">Interchange: {int(s.transfers_here.transfers)} transfers/day</span>
          <span className="meta" style={{ color: s.transfers_here.worst_median_wait_min >= 12 ? RED : undefined }}>
            worst wait {s.transfers_here.worst_median_wait_min} min
          </span>
          <Chevron />
        </button>
      )}

      <details style={{ fontSize: 12, color: '#52514e' }}>
        <summary style={{ cursor: 'pointer' }}>Operator stop ids grouped into this hub</summary>
        <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
          {Object.entries(s.operator_stop_ids).map(([op, ids]) => (
            <div key={op}><strong>{opsById[op]?.name ?? op}:</strong> <span className="mono">{ids.join(', ')}</span></div>
          ))}
        </div>
      </details>

      <div className="footnote">
        Carris and Metro taps carry no trip_id, so their demand is shown per stop and hour, never per trip.
      </div>
    </div>
  )
}
