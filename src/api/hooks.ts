import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ALL_OPS, useApp } from '../state'
import { api, type Filters } from './client'
import type { Operator, Scales } from './types'

/** Current filters from the store, in the shape the API wants. */
export function useFilters(): Filters {
  const day = useApp((s) => s.day)
  const ops = useApp((s) => s.ops)
  const segment = useApp((s) => s.segment)
  return { day, ops, segment }
}

const key = (f: Filters) => [f.day, f.ops.join(','), f.segment]

// Keep showing the previous result while the next one loads, so the map does
// not flash empty every time the time slider moves.
const smooth = { placeholderData: keepPreviousData }

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: api.meta, staleTime: Infinity })

export function useOverview() {
  const f = useFilters()
  return useQuery({ queryKey: ['overview', ...key(f)], queryFn: () => api.overview(f), ...smooth })
}

export function useHex() {
  const f = useFilters()
  const hour = useApp((s) => s.hour)
  return useQuery({ queryKey: ['hex', ...key(f), hour], queryFn: () => api.hex(f, hour), ...smooth })
}

export function useStops() {
  const f = useFilters()
  const hour = useApp((s) => s.hour)
  return useQuery({ queryKey: ['stops', ...key(f), hour], queryFn: () => api.stops(f, hour), ...smooth })
}

export function useStopDetail(id: string | null) {
  const f = useFilters()
  const hour = useApp((s) => s.hour)
  return useQuery({
    queryKey: ['stop', id, ...key(f), hour],
    queryFn: () => api.stop(id!, f, hour),
    enabled: !!id,
    ...smooth,
  })
}

/** All line profiles for the day (the map draws every line, the panel details one). */
export function useLineProfiles(lineIds: string[]) {
  const day = useApp((s) => s.day)
  return useQueries({
    queries: lineIds.map((id) => ({
      queryKey: ['line', id, day],
      queryFn: () => api.line(id, day),
      ...smooth,
    })),
  })
}

export function useTransfers() {
  const day = useApp((s) => s.day)
  return useQuery({ queryKey: ['transfers', day], queryFn: () => api.transfers(day), ...smooth })
}

/** Golden lines (typical weekday, not filtered by day). */
export const useGolden = () => useQuery({ queryKey: ['golden'], queryFn: api.golden, staleTime: Infinity })

/** The whole week's alerts (the list is not filtered by day). */
export const useAnomalies = () => useQuery({ queryKey: ['anomalies', 'week'], queryFn: () => api.anomalies() })

/** Prefetch hex + stops for every hour of the current day, so play/scrub is instant. */
export function usePrefetchDay(hours: number[]) {
  const qc = useQueryClient()
  const f = useFilters()
  const fk = key(f).join('|')
  useEffect(() => {
    for (const hour of hours) {
      qc.prefetchQuery({ queryKey: ['hex', ...key(f), hour], queryFn: () => api.hex(f, hour) })
      qc.prefetchQuery({ queryKey: ['stops', ...key(f), hour], queryFn: () => api.stops(f, hour) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fk, hours.length])
}

/** Operator id → {name, color, …} from /api/meta. */
export function useOperators(): Record<string, Operator> {
  const { data } = useMeta()
  return Object.fromEntries((data?.operators ?? []).map((o) => [o.id, o]))
}

/**
 * Colour-scale maxima for the CURRENT filters.
 *
 * meta.scales are the week maxima for everyone on every operator. With a
 * filter (e.g. Sub-23 only, ~15% of taps) everything would fall into the
 * palest bucket, so we shrink the maxima by how much the filter shrinks the
 * network peak on a fixed reference weekday. The scale still never changes
 * with the hour or the day, only with the filter, so comparisons stay fair.
 */
export function useScales(): Scales | undefined {
  const { data: meta } = useMeta()
  const f = useFilters()
  const refDay = meta?.days.find((d) => !d.is_weekend)?.date ?? f.day
  const all: Filters = { day: refDay, ops: ALL_OPS, segment: 'all' }
  const cur: Filters = { ...f, day: refDay }
  const filtered = f.segment !== 'all' || f.ops.length !== ALL_OPS.length
  const qAll = useQuery({ queryKey: ['overview', ...key(all)], queryFn: () => api.overview(all), enabled: !!meta && filtered })
  const qCur = useQuery({ queryKey: ['overview', ...key(cur)], queryFn: () => api.overview(cur), enabled: !!meta && filtered, ...smooth })
  if (!meta) return undefined
  if (!filtered || !qAll.data || !qCur.data) return meta.scales
  const peak = (o: { network_hourly: { boardings: number }[] }) => Math.max(...o.network_hourly.map((h) => h.boardings))
  const r = Math.min(1, Math.max(0.02, peak(qCur.data) / (peak(qAll.data) || 1)))
  const s = meta.scales
  return { stop_boardings_max: s.stop_boardings_max * r, hex_boardings_max: s.hex_boardings_max * r, network_hour_max: s.network_hour_max * r }
}
