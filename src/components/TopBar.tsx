import { useMeta } from '../api/hooks'
import { useApp } from '../state'
import Logo from './Logo'

export default function TopBar() {
  const { data: meta, isError } = useMeta()
  const day = useApp((s) => s.day)
  const set = useApp((s) => s.set)

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand-name">Carrolinha</div>
          <div className="brand-sub">Metropolitan demand twin for TML</div>
        </div>
      </div>
      <div className="day-pills" role="group" aria-label="Day">
        {meta?.days.map((d) => (
          <button key={d.date} type="button" className="pill" aria-pressed={d.date === day}
            onClick={() => set({ day: d.date, playing: false })}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="spacer" />
      {isError ? (
        <span className="badge badge-down">API offline</span>
      ) : meta?.is_mock ? (
        <span className="badge badge-mock" title={meta.note}>Mock data · shapes only</span>
      ) : meta ? (
        <span className="badge badge-live" title={meta.note}>TML validations · {meta.week_start} → {meta.week_end}</span>
      ) : null}
    </header>
  )
}
