import type {
  AnomaliesResponse, HexResponse, LineProfile, Meta, OperatorId, Overview, SegmentId,
  StopDetail, StopsResponse, TransfersResponse,
} from './types'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(API_URL + path)
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v))
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new ApiError(0, `Cannot reach the API at ${API_URL}`)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, typeof body.detail === 'string' ? body.detail : res.statusText)
  }
  return res.json() as Promise<T>
}

/** Shared filter params most endpoints take. */
export interface Filters { day: string; ops: OperatorId[]; segment: SegmentId }
const f = (x: Filters) => ({ day: x.day, ops: x.ops.join(','), segment: x.segment })

export const api = {
  health: () => get<{ ok: boolean; provider: string }>('/api/health'),
  meta: () => get<Meta>('/api/meta'),
  overview: (x: Filters) => get<Overview>('/api/overview', f(x)),
  hex: (x: Filters, hour: number) => get<HexResponse>('/api/hex', { ...f(x), hour }),
  stops: (x: Filters, hour: number) => get<StopsResponse>('/api/stops', { ...f(x), hour }),
  stop: (id: string, x: Filters, hour: number) =>
    get<StopDetail>(`/api/stops/${encodeURIComponent(id)}`, { ...f(x), hour }),
  line: (id: string, day: string) => get<LineProfile>(`/api/lines/${encodeURIComponent(id)}/profile`, { day }),
  transfers: (day: string) => get<TransfersResponse>('/api/transfers', { day }),
  anomalies: (day?: string) => get<AnomaliesResponse>('/api/anomalies', { day }),
}
