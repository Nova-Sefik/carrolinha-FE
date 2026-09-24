import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts'
import { compact, hourLabel, int } from '../lib/format'

const AXIS = { fontSize: 10.5, fill: '#6b6a65' }
const tickHour = (h: number) => (h === 24 ? '00' : String(h).padStart(2, '0'))
const TICKS = [6, 9, 12, 15, 18, 21, 24]

export interface HourDatum {
  hour: number
  value: number
  expected?: number
  line?: number
  fill: string
}

/** A short horizontal black tick: the "expected" marker drawn over each bar. */
function ExpectedTick(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return <line x1={cx - 8} x2={cx + 8} y1={cy} y2={cy} stroke="#141413" strokeWidth={2} strokeLinecap="round" />
}

interface Props {
  data: HourDatum[]
  height?: number
  valueName: string
  expectedName?: string
  lineName?: string
  lineColor?: string
  onPickHour?: (h: number) => void
  formatValue?: (n: number) => string
}

/**
 * Bars per service hour, with optional "expected" ticks (anomalies, stop day)
 * and an optional step line (places offered on the load chart).
 */
export function HourChart({
  data, height = 150, valueName, expectedName, lineName, lineColor = '#eb6834', onPickHour, formatValue = int,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="18%"
        onClick={(s) => {
          const h = data[Number(s?.activeIndex)]?.hour
          if (onPickHour && h != null) onPickHour(h)
        }}
        style={{ cursor: onPickHour ? 'pointer' : 'default' }}>
        <CartesianGrid vertical={false} stroke="#e8e6e0" />
        <XAxis dataKey="hour" tickFormatter={tickHour} ticks={TICKS} tick={AXIS} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={AXIS} tickFormatter={compact} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          cursor={{ fill: 'rgba(20,20,19,0.05)' }}
          labelFormatter={(h) => hourLabel(Number(h))}
          formatter={(v, name) => [formatValue(Number(v)), String(name)]}
          contentStyle={{ background: '#141413', border: 'none', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#fff', fontWeight: 600 }}
          itemStyle={{ color: '#d9d8d2', fontFamily: 'IBM Plex Mono, monospace', padding: 0 }}
        />
        <Bar dataKey="value" name={valueName} radius={[2.5, 2.5, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.hour} fill={d.fill} />)}
        </Bar>
        {lineName && (
          <Line dataKey="line" name={lineName} type="stepAfter" stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
        )}
        {expectedName && (
          <Scatter dataKey="expected" name={expectedName} shape={<ExpectedTick />} isAnimationActive={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
