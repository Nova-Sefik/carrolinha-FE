import { create } from 'zustand'
import type { OperatorId, SegmentId } from './api/types'

export type Mode = 'demand' | 'load' | 'anomalies' | 'transfers' | 'golden'
export type Layer = 'hex' | 'stops'

export const ALL_OPS: OperatorId[] = ['metro', 'carris', 'cm', 'rail', 'ferry', 'other']

/** Default camera: the whole Lisbon metro area. */
export const HOME = { lon: -9.14, lat: 38.715, zoom: 10.4 }

export interface FlyTarget { lon: number; lat: number; zoom?: number; key: number }

interface AppState {
  // filters (sent to the API)
  day: string
  hour: number
  ops: OperatorId[]
  segment: SegmentId
  // view state (frontend only)
  mode: Mode
  layer: Layer
  selStop: string | null
  line: string | null
  whatif: number
  alertId: string | null
  xsel: string | null
  /** selected flow on the transfers map: `${from}>${to}` */
  fsel: string | null
  /** selected golden line */
  gsel: string | null
  reviewed: Record<string, boolean>
  playing: boolean
  fly: FlyTarget | null

  set: (patch: Partial<AppState>) => void
  toggleOp: (op: OperatorId) => void
  pickStop: (id: string | null) => void
  flyTo: (lon: number, lat: number, zoom?: number) => void
}

export const useApp = create<AppState>((set, get) => ({
  day: '2026-09-01',
  hour: 8,
  ops: ALL_OPS,
  segment: 'all',
  mode: 'demand',
  layer: 'hex',
  selStop: null,
  line: null,
  whatif: 0,
  alertId: null,
  xsel: null,
  fsel: null,
  gsel: null,
  reviewed: {},
  playing: false,
  fly: null,

  set: (patch) => set(patch),
  toggleOp: (op) => {
    const ops = get().ops
    if (ops.includes(op)) {
      if (ops.length === 1) return // the API needs at least one operator
      set({ ops: ops.filter((o) => o !== op) })
    } else set({ ops: ALL_OPS.filter((o) => o === op || ops.includes(o)) })
  },
  // Clicking a stop from the load or transfers views jumps to its demand profile.
  pickStop: (id) => {
    const { mode } = get()
    set({ selStop: id, mode: id && (mode === 'load' || mode === 'transfers') ? 'demand' : mode })
  },
  flyTo: (lon, lat, zoom) => set({ fly: { lon, lat, zoom, key: Date.now() } }),
}))
