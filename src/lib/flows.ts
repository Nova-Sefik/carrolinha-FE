import type { Flow } from '../api/types'

/** Stable id of a flow (origin > destination) for selection. */
export const flowKey = (f: Flow) => `${f.from_stop_id}>${f.to_stop_id}`
