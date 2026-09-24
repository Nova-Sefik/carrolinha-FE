import { useMeta } from '../api/hooks'
import { useApp } from '../state'

/** Operator filter, from meta.operators (names + colours come from the API). */
export default function OperatorCard() {
  const { data: meta } = useMeta()
  const ops = useApp((s) => s.ops)
  const toggleOp = useApp((s) => s.toggleOp)
  if (!meta) return null
  return (
    <div className="float-card ops-card">
      <div className="card-kicker">Operators</div>
      {meta.operators.map((o) => {
        const on = ops.includes(o.id)
        return (
          <button key={o.id} type="button" className="op-row" aria-pressed={on} onClick={() => toggleOp(o.id)}
            title={`agency_code ${o.agency_codes.join(', ')}`}>
            <span className="swatch" style={{ background: o.color, opacity: on ? 1 : 0.3 }} />
            <span style={{ flex: 1 }}>{o.name}</span>
            {on && (
              <svg width="14" height="14" aria-hidden="true">
                <path d="M3 7.5 L6 10.5 L11.5 4" fill="none" stroke="#141413" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
