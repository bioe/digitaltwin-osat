import { LabelLayer } from './scene/labels'
import { Scene } from './scene/Scene'
import { useUI } from './store'
import { AiRecovery } from './ui/AiRecovery'
import { AlertQueue } from './ui/AlertQueue'
import { DetailPanel } from './ui/DetailPanel'
import { EquipmentStatus } from './ui/EquipmentStatus'
import { Performance } from './ui/Performance'
import { TopBar } from './ui/TopBar'
import { TwinPanel } from './ui/TwinPanel'
import { WarRoomOverlay } from './ui/WarRoomOverlay'

/** Command-centre layout: header, left (equipment + AI recovery), centre twin, right (performance + alerts). */
export function App() {
  const sel = useUI(s => s.sel)
  return (
    <div className="cc-root flex h-full w-full flex-col">
      <TopBar />
      <div className="grid min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)' }}>
        <div className="grid min-h-0 gap-2.5" style={{ gridTemplateRows: 'minmax(0, 1.45fr) minmax(0, 1fr)' }}>
          <EquipmentStatus />
          <AiRecovery />
        </div>
        <TwinPanel>
          <div className="absolute inset-0 isolate">
            <Scene />
            <LabelLayer />
          </div>
        </TwinPanel>
        <div className="relative grid min-h-0 gap-2.5" style={{ gridTemplateRows: 'minmax(0, 1.25fr) minmax(0, 1fr)' }}>
          <Performance />
          <AlertQueue />
          {sel && (
            <div className="cc-panel absolute inset-0 z-20 overflow-hidden" style={{ background: "#081426" }}>
              <DetailPanel />
            </div>
          )}
        </div>
      </div>
      <WarRoomOverlay />
    </div>
  )
}
