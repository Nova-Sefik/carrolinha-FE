import { useMeta, useTransfers, useOperators } from '../api/hooks'
import type { Interchange } from '../api/types'
import { dayLabel, int } from '../lib/format'
import { RED, waitColor } from '../lib/scales'
import { useApp } from '../state'
import { HourChart } from './charts'
import { ErrorBox, Header, Loading} from './common'

/** GET /api/transfers → interchange list, pair breakdown, fragile connections. */
export default function TransferPanel() {
  const { data: meta } = useMeta()
  const { data, isPending, error } = useTransfers()
  const { xsel, day, set, flyTo, pickStop } = useApp()
  const opsById = useOperators()

  if (error) return <ErrorBox error={error} />
  if (isPending || !data) return <Loading />

  const sel = data.interchanges.find((i) => i.stop_id === xsel) ?? data.interchanges[0]
  const pick = (i: Interchange) => {
    set({ xsel: i.stop_id })
    flyTo(i.lon, i.lat, 12.5)
  }
  const name = (op: string) => opsById[op]?.name ?? op

  return (
    <div className="stack">
      <Header kicker={`Cross-operator transfers · ${dayLabel(meta?.days, day)}`} title="Where journeys change operator" />

      <div>
        {data.interchanges.map((i) => (
          <button key={i.stop_id} type="button" className="row-btn" aria-pressed={i.stop_id === sel?.stop_id} onClick={() => pick(i)}>
            <span className="grow">{i.name}</span>
            {i.fragile && <span className="fragile">⚠ Fragile</span>}
            <span className="meta">{int(i.transfers)}/day</span>
          </button>
        ))}
        {data.interchanges.length === 0 && <div className="footnote">No transfers computed for this day yet.</div>}
      </div>

      {sel && <Detail i={sel} name={name} colorOf={(op) => opsById[op]?.color ?? '#999'}
        onOpenStop={() => pickStop(sel.stop_id)} />}

      {data.flows.length > 0 && (
        <div>
          <div className="section-title">Top journeys with a transfer</div>
          {data.flows.slice(0, 5).map((f) => (
            <div key={f.from_stop_id + f.to_stop_id} className="pair" style={{ minHeight: 26 }}>
              <span style={{ flex: 1 }}>{f.from_name} → {f.to_name}</span>
              <span className="mono" style={{ color: '#52514e' }}>{int(f.journeys)}/day</span>
            </div>
          ))}
        </div>
      )}

      <div className="footnote">{data.method} Arcs show the most common journeys that include a transfer.</div>
    </div>
  )
}

function Detail({ i, name, colorOf, onOpenStop }: {
  i: Interchange; name: (op: string) => string; colorOf: (op: string) => string; onOpenStop: () => void
}) {
  const maxPair = Math.max(1, ...i.pairs.map((p) => p.transfers))
  const worst = i.pairs.reduce((a, b) => (b.median_wait_min > a.median_wait_min ? b : a), i.pairs[0])
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="card-title" style={{ flex: 1 }}>{i.name}</div>
        <button type="button" className="btn" style={{ height: 32 }} onClick={onOpenStop}>Stop profile</button>
      </div>
      {i.pairs.map((p) => (
        <div key={p.from_operator + p.to_operator} className="pair">
          <span className="pair-ops">
            <span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(p.from_operator) }} />
            {name(p.from_operator)}
            <span style={{ color: '#6b6a65' }}>→</span>
            <span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(p.to_operator) }} />
            {name(p.to_operator)}
          </span>
          <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ height: 8, width: `${Math.max(4, (p.transfers / maxPair) * 90)}px`, borderRadius: 2, background: '#3987e5' }} />
            <span className="mono" style={{ color: '#52514e' }}>{int(p.transfers)}</span>
          </span>
          <span className="mono" title={`p90 ${p.p90_wait_min} min`}
            style={{ color: p.median_wait_min >= 12 ? RED : waitColor(p.median_wait_min), fontWeight: p.median_wait_min >= 12 ? 600 : 400 }}>
            {p.median_wait_min} min
          </span>
        </div>
      ))}
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Transfers through the day</div>
      <HourChart height={96} valueName="Transfers"
        data={i.hourly.map((h) => ({ hour: h.hour, value: h.transfers, fill: '#6da7ec' }))} />
      {i.fragile && worst && (
        <div className="note-red">
          Passengers going from {name(worst.from_operator)} to {name(worst.to_operator)} wait a median{' '}
          {worst.median_wait_min} min, and 1 in 10 waits {worst.p90_wait_min} min or more. Worth checking whether{' '}
          {name(worst.to_operator)} departures here are timed to {name(worst.from_operator)} arrivals.
        </div>
      )}
    </div>
  )
}
