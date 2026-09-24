import type { LineHour, LineProfile } from '../api/types'

/**
 * What-if, as in API_CONTRACT.md: move n trips from quiet hours to the crush
 * hours. Same fleet, same crew hours. The API's places_offered already reflects
 * each trip's real vehicle (lines mix minibuses and standard buses), so only
 * the hours that gain or lose a trip change, by one typical vehicle each.
 * est_peak_load is unchanged: the same people travel, spread over more places.
 */
export function applyWhatIf(p: LineProfile, n: number): LineHour[] {
  const hours = p.hours.map((h) => ({ ...h }))
  const at = (hr: number) => hours.find((h) => h.hour === hr)
  const moved = Math.min(n, p.whatif.move_to_hours.length, p.whatif.move_from_hours.length)
  for (let i = 0; i < moved; i++) {
    const to = at(p.whatif.move_to_hours[i])
    const from = at(p.whatif.move_from_hours[i])
    if (!to || !from || from.trips <= 0) continue
    to.trips += 1
    to.places_offered += p.vehicle.places
    from.trips -= 1
    from.places_offered = Math.max(0, from.places_offered - p.vehicle.places)
  }
  for (const h of hours) h.load_factor = h.places_offered ? h.est_peak_load / h.places_offered : 0
  return hours
}

export const tightest = (hours: LineHour[], from = 0, to = 99) =>
  hours.filter((h) => h.hour >= from && h.hour <= to).reduce((a, b) => (b.load_factor > a.load_factor ? b : a))
