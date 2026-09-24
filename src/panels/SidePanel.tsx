import { useApp } from '../state'
import AnomalyPanel from './AnomalyPanel'
import LinePanel from './LinePanel'
import OverviewPanel from './OverviewPanel'
import StopPanel from './StopPanel'
import TransferPanel from './TransferPanel'

export default function SidePanel() {
  const mode = useApp((s) => s.mode)
  const selStop = useApp((s) => s.selStop)
  return (
    <aside className="panel" aria-live="polite">
      {mode === 'demand' && (selStop ? <StopPanel stopId={selStop} /> : <OverviewPanel />)}
      {mode === 'load' && <LinePanel />}
      {mode === 'anomalies' && <AnomalyPanel />}
      {mode === 'transfers' && <TransferPanel />}
    </aside>
  )
}
