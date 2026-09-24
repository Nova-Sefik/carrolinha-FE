import { useMeta, useTransfers, useOperators } from '../api/hooks'
import type { Flow, Interchange } from '../api/types'
import { flowKey } from '../lib/flows'
import { dayLabel, int } from '../lib/format'
import { RED, waitColor } from '../lib/scales'
import { useApp } from '../state'
import { HourChart } from './charts'
import { ErrorBox, Header, Loading} from './common'

/** GET /api/transfers → interchange list, pair breakdown, journeys through each hub. */
export default function TransferPanel() {
  const { data: meta } = useMeta()
  const { data, isPending, error } = useTransfers()
  const { xsel, fsel, day, set, flyTo, pickStop } = useApp()
  const opsById = useOperators()

  if (error) return <ErrorBox error={error} />
  if (isPending || !data) return <Loading />

  const interchanges = [...data.interchanges].sort((a, b) => b.transfers - a.transfers).slice(0, 20)
  const sel = interchanges.find((i) => i.stop_id === xsel) ?? null
  const pick = (i: Interchange) => {
    set({ xsel: i.stop_id === xsel ? null : i.stop_id, fsel: null })
    if (i.stop_id !== xsel) flyTo(i.lon, i.lat, 12.5)
  }
  const name = (op: string) => opsById[op]?.name ?? op
  const through = (f: Flow) => !sel || f.from_stop_id === sel.stop_id || f.to_stop_id === sel.stop_id
    || f.via.some((v) => v.stop_id === sel.stop_id)
  const flows = data.flows.filter(through).slice(0, sel ? 20 : 12)
  const pickFlow = (f: Flow) => {
    const k = flowKey(f)
    set({ fsel: k === fsel ? null : k })
    if (k !== fsel) flyTo((f.from_lon + f.to_lon) / 2, (f.from_lat + f.to_lat) / 2, 11.5)
  }

  return (
    <div className="stack">
      <Header kicker={`Cross-operator transfers · ${dayLabel(meta?.days, day)}`} title="Where journeys change operator">
        {(xsel || fsel) && (
          <button type="button" className="back" style={{ marginTop: 6 }} onClick={() => set({ xsel: null, fsel: null })}>
            ✕ Clear selection (show all)
          </button>
        )}
      </Header>

      {sel && <Detail i={sel} name={name} colorOf={(op) => opsById[op]?.color ?? '#999'}
        onOpenStop={() => pickStop(sel.stop_id)} />}

      <div>
        <div className="section-title">
          {sel ? `Journeys that change at ${sel.name}` : 'Most common journeys that change operator'}
        </div>
        {flows.map((f) => (
          <button key={flowKey(f)} type="button" className="row-btn" aria-pressed={flowKey(f) === fsel}
            style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, padding: '8px 12px' }} onClick={() => pickFlow(f)}>
            <span style={{ display: 'flex', gap: 8 }}>
              <span className="grow">{f.from_name} → {f.to_name}</span>
              <span className="meta">{int(f.journeys)}/day</span>
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontSize: 11.5, color: '#52514e' }}>
              {f.modes.map((m, k) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {k > 0 && <span>→{f.via[k - 1] ? ` ${f.via[k - 1].name} →` : ''}</span>}
                  <span className="chip" style={{ height: 20, padding: '0 7px' }}>
                    <span className="swatch" style={{ width: 7, height: 7, borderRadius: 2, background: opsById[m]?.color }} />
                    {name(m)}
                  </span>
                </span>
              ))}
              {f.via_share != null && f.via_share < 1 && (
                <span title="Share of these journeys that change at the hub(s) shown" style={{ marginLeft: 'auto' }}>
                  {Math.round(f.via_share * 100)}% change here
                </span>
              )}
            </span>
          </button>
        ))}
        {flows.length === 0 && <div className="footnote">No journeys in the top list change here.</div>}
      </div>

      <div>
        <div className="section-title">Busiest interchanges</div>
        {interchanges.map((i) => (
          <button key={i.stop_id} type="button" className="row-btn" aria-pressed={i.stop_id === xsel} onClick={() => pick(i)}>
            <span className="grow">{i.name}</span>
            {i.fragile && <span className="fragile">⚠ Fragile</span>}
            <span className="meta">{int(i.transfers)}/day</span>
          </button>
        ))}
        {interchanges.length === 0 && <div className="footnote">No transfers computed for this day yet.</div>}
      </div>

      <div className="footnote">
        {data.method} Journey lines run from where the journey starts, through the hub(s) where people change, to
        where it ends (the next place the card starts a journey, or its Metro exit).
      </div>
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
