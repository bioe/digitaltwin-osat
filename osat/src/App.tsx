import { LabelLayer } from './scene/labels'
import { Scene } from './scene/Scene'
import { DetailPanel } from './ui/DetailPanel'
import { FlowBar } from './ui/FlowBar'
import { Legend } from './ui/Legend'
import { Minimap } from './ui/Minimap'
import { TopBar } from './ui/TopBar'
import { WarRoomOverlay } from './ui/WarRoomOverlay'

/** Docked layout: top bar, left sidebar (route + radar), 3D view, right sidebar (details), bottom bar. */
export function App() {
  return (
    <div className="grid h-full w-full" style={{ gridTemplateRows: 'auto minmax(0, 1fr) auto', gridTemplateColumns: '256px minmax(0, 1fr) 340px' }}>
      <div className="col-span-3">
        <TopBar />
      </div>
      <aside className="dock flex min-h-0 flex-col border-r">
        <FlowBar />
        <Minimap />
      </aside>
      <main className="relative isolate min-h-0 min-w-0">
        <Scene />
        <LabelLayer />
      </main>
      <aside className="min-h-0">
        <DetailPanel />
      </aside>
      <div className="col-span-3">
        <Legend />
      </div>
      <WarRoomOverlay />
    </div>
  )
}
