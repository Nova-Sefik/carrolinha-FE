import { useEffect } from 'react'
import { useMeta, usePrefetchDay } from './api/hooks'
import { API_URL } from './api/client'
import TopBar from './components/TopBar'
import Toolbar from './components/Toolbar'
import MapView from './components/MapView'
import TimeBar from './components/TimeBar'
import SidePanel from './panels/SidePanel'
import { useApp } from './state'

export default function App() {
  const meta = useMeta()
  const day = useApp((s) => s.day)
  const set = useApp((s) => s.set)

  // If the backend's week differs from our default day, snap to its first weekday.
  useEffect(() => {
    const days = meta.data?.days
    if (days && !days.some((d) => d.date === day)) set({ day: (days.find((d) => !d.is_weekend) ?? days[0]).date })
  }, [meta.data, day, set])

  usePrefetchDay(meta.data?.hours.map((h) => h.hour) ?? [])

  if (meta.isError) {
    return (
      <div className="app">
        <TopBar />
        <div style={{ padding: 40, maxWidth: 640 }}>
          <div className="error-box">
            <strong>Cannot reach the Carrolinha API at {API_URL}.</strong>
            <br />
            Start it from the <code>carrolinha-api</code> folder with <code>uvicorn app.main:app --reload</code>, then reload
            this page. To point at another server, set <code>VITE_API_URL</code> in <code>.env.local</code>.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar />
      <div className="body">
        <main className="stage">
          <Toolbar />
          <MapView />
          <TimeBar />
        </main>
        <SidePanel />
      </div>
    </div>
  )
}
