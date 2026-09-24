export const hourLabel = (h: number) => (h === 24 ? '00:00' : `${String(h).padStart(2, '0')}:00`)

export function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e4) return Math.round(n / 1e3) + 'k'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return String(Math.round(n))
}

export const int = (n: number) => Math.round(n).toLocaleString('en-GB')
export const pct = (x: number) => `${Math.round(x * 100)}%`
export const signedPct = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(Math.round(p))}%`

/** "Tue 1 Sep" from the meta days list, falling back to the ISO date. */
export const dayLabel = (days: { date: string; label: string }[] | undefined, date: string) =>
  days?.find((d) => d.date === date)?.label ?? date
