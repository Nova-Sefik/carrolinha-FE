import { useMeta } from '../api/hooks'
import type { SegmentId } from '../api/types'
import { HOME, useApp, type Layer, type Mode } from '../state'

const MODES: [Mode, string][] = [
  ['demand', 'Demand'],
  ['load', 'Load vs capacity'],
  ['anomalies', 'Anomalies'],
  ['transfers', 'Transfers'],
  ['golden', 'Golden lines'],
]
const LAYERS: [Layer, string][] = [['hex', 'Hexagons'], ['stops', 'Stops']]
const SEG_SHORT: Record<string, string> = { all: 'All passengers', sub23: 'Sub-23', senior: '65+' }

export default function Toolbar() {
  const { data: meta } = useMeta()
  const { mode, layer, segment, set } = useApp()
  const showLayer = mode === 'demand' || mode === 'anomalies'

  return (
    <div className="toolbar">
      <div className="tabs" role="group" aria-label="View">
        {MODES.map(([id, label]) => (
          <button key={id} type="button" className="tab" aria-pressed={id === mode} onClick={() => {
              set({ mode: id })
              // Transfer arcs span the region: pull the camera back. (The load view frames its lines itself.)
              if (id === 'transfers') useApp.getState().flyTo(HOME.lon, HOME.lat, HOME.zoom)  // golden frames itself
            }}>
            {label}
          </button>
        ))}
      </div>
      <div className="spacer" />
      {showLayer && (
        <div className="tabs" role="group" aria-label="Map layer">
          {LAYERS.map(([id, label]) => (
            <button key={id} type="button" className="tab small" aria-pressed={id === layer} onClick={() => set({ layer: id })}>
              {label}
            </button>
          ))}
        </div>
      )}
      {(mode === 'demand' || mode === 'anomalies') && (
        <div className="tabs" role="group" aria-label="Passenger segment">
          {(meta?.segments ?? []).map((s) => (
            <button key={s.id} type="button" className="tab small" aria-pressed={s.id === segment}
              onClick={() => set({ segment: s.id as SegmentId })} title={s.label}>
              {SEG_SHORT[s.id] ?? s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
