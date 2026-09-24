// Colour scales from the design. All demand colours are FIXED for the whole
// week (normalised by meta.scales), so a quiet hour looks quiet next to a busy one.

export type RGBA = [number, number, number, number]

export const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
// Real demand is heavy-tailed (Campo Grande has ~100x a typical bus stop), so the
// ramp is logarithmic: each class is a fixed fraction of log(max). Still fixed
// for the whole week, so hours and days compare fairly.
const LOG_BREAKS = [0.3, 0.45, 0.57, 0.68, 0.78, 0.87, 0.94]
const logPos = (v: number, max: number) => (v <= 0 ? 0 : Math.log1p(v) / Math.log1p(max))

export const DIVERGING = ['#2a78d6', '#9ec5f4', '#d7d6d1', '#f4a7a6', '#e34948']
const DIV_BREAKS = [0.6, 0.85, 1.15, 1.4]
export const DIV_LABELS = ['40% or more below', '15–40% below', 'within ±15%', '15–40% above', '40% or more above']

export const LOAD = ['#fbd7c4', '#f6ad88', '#eb6834', '#c24e1f', '#8f3714']
const LOAD_BREAKS = [0.5, 0.7, 0.85, 1.0]
export const LOAD_LABELS = ['under 50%', '50–70%', '70–85%', '85–100%', 'over capacity']

export const WAIT = { ok: '#6da7ec', slow: '#256abf', fragile: '#e34948' }

export const INK = '#141413'
export const MUTED = '#52514e'
export const SUBTLE = '#6b6a65'
export const LINE = '#e3e2dd'
export const RED = '#c42b2a'
export const BLUE = '#2a78d6'

/** Number of thresholds n passes. */
export const classify = (n: number, breaks: number[]) => breaks.reduce((c, t) => (n >= t ? c + 1 : c), 0)

/** Hex fill for a demand value relative to the week max; null = too small to draw. */
export function hexDemandColor(v: number, max: number): string | null {
  const c = classify(logPos(v, max), LOG_BREAKS)
  return c === 0 ? null : RAMP[c - 1]
}
export const stopDemandColor = (v: number, max: number) => RAMP[Math.max(0, classify(logPos(v, max), LOG_BREAKS) - 1)]
/** Boardings/hour where colour class i starts (for the legend). */
export const stopDemandThreshold = (i: number, max: number) => Math.expm1(LOG_BREAKS[i] * Math.log1p(max))
export const ratioColor = (r: number) => DIVERGING[classify(r, DIV_BREAKS)]
export const loadColor = (lf: number) => LOAD[classify(lf, LOAD_BREAKS)]
export const waitColor = (min: number) => (min >= 12 ? WAIT.fragile : min >= 8 ? WAIT.slow : WAIT.ok)

/** Circle radius in pixels: area proportional to boardings, fixed scale. */
export const stopRadius = (v: number, max: number) => 3 + 20 * Math.sqrt(Math.max(v, 0) / max)

export function rgba(hex: string, alpha = 255): RGBA {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha]
}
