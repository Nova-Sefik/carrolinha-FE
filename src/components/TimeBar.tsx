import { useEffect } from 'react'
import { useMeta, useOverview, useScales } from '../api/hooks'
import { dayLabel, hourLabel, int } from '../lib/format'
import { useApp } from '../state'

/** Play button + network pulse strip (overview.network_hourly) + hour slider. */
export default function TimeBar() {
  const { data: meta } = useMeta()
  const { data: ov } = useOverview()
  const { hour, day, playing, set } = useApp()
  const hours = meta?.hours.map((h) => h.hour) ?? []
  const min = hours[0] ?? 5
  const max = hours[hours.length - 1] ?? 24
  const scaleMax = useScales()?.network_hour_max ?? 1

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const h = useApp.getState().hour
      useApp.setState({ hour: h >= max ? min : h + 1 })
    }, 900)
    return () => clearInterval(t)
  }, [playing, min, max])

  const series = new Map(ov?.network_hourly.map((v) => [v.hour, v.boardings]))

  return (
    <div className="timebar">
      <button type="button" className="play" aria-label={playing ? 'Pause' : 'Play the day'} onClick={() => set({ playing: !playing })}>
        {playing ? (
          <svg width="14" height="14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg width="14" height="14"><path d="M3 1 L13 7 L3 13 Z" fill="currentColor" /></svg>
        )}
      </button>
      <div className="scrub">
        <div className="pulse" aria-hidden="true">
          {hours.map((h) => {
            const v = series.get(h) ?? 0
            return (
              <button key={h} type="button" tabIndex={-1} className={'pulse-bar' + (h === hour ? ' on' : '')}
                style={{ height: `${Math.max(7, Math.min(100, (v / scaleMax) * 100))}%` }}
                title={`${hourLabel(h)} · ${int(v)} boardings`} onClick={() => set({ hour: h })} />
            )
          })}
        </div>
        <input type="range" min={min} max={max} step={1} value={hour} aria-label="Hour of day"
          onChange={(e) => set({ hour: Number(e.target.value) })} />
      </div>
      <div className="clock">
        <div className="clock-hour">{hourLabel(hour)}</div>
        <div className="clock-day">{dayLabel(meta?.days, day)}</div>
      </div>
    </div>
  )
}
