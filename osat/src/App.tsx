import { useEffect } from 'react'
import { LabelLayer } from './scene/labels'
import { Scene } from './scene/Scene'
import { useUI } from './store'
import { AiRecovery } from './ui/AiRecovery'
import { AlertQueue } from './ui/AlertQueue'
import { DetailPanel } from './ui/DetailPanel'
import { EquipmentStatus } from './ui/EquipmentStatus'
import { Performance } from './ui/Performance'
import { TopBar } from './ui/TopBar'
import { TourHud } from './ui/TourHud'
import { TwinPanel } from './ui/TwinPanel'
import { WarRoomOverlay } from './ui/WarRoomOverlay'

/**
 * Command-centre layout: header, left (equipment + AI recovery), centre twin, right (performance + alerts).
 * In 3D-only mode the side columns collapse (the canvas stays mounted) and details open as a popup.
 */
export function App() {
  const sel = useUI(s => s.sel)
  const focus = useUI(s => s.focus)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if ((e.key === 'f' || e.key === 'F') && !useUI.getState().tour) useUI.getState().toggleFocus()
      if (e.key === 'Escape' && useUI.getState().focus && !useUI.getState().tour && !useUI.getState().warRoom) useUI.getState().toggleFocus()
    }
    const onFs = () => {
      // leaving browser fullscreen ends whichever full-window mode is active (tour or fullscreen)
      if (document.fullscreenElement) return
      // (the tour keeps its full-window layout: Esc there first frees the mouse)
      if (!useUI.getState().tour && useUI.getState().focus) useUI.setState({ focus: false })
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])
  const detail = (popup: boolean) => (
    <div className={`cc-panel min-h-0 ${popup ? 'scroll-thin max-h-full overflow-y-auto' : 'flex-1 overflow-hidden'}`} style={{ background: '#081426' }}>
      <DetailPanel />
    </div>
  )
  return (
    <div className="cc-root flex h-full w-full flex-col">
      {!focus && <TopBar />}
      <div
        className={`grid min-h-0 flex-1 ${focus ? 'gap-0 p-2' : 'gap-2.5 px-2.5 pb-2.5'}`}
        style={{ gridTemplateColumns: focus ? '0 minmax(0, 1fr) 0' : 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)' }}
      >
        <div className={`grid min-h-0 gap-2.5 ${focus ? 'invisible overflow-hidden' : ''}`} style={{ gridTemplateRows: 'minmax(0, 1.45fr) minmax(0, 1fr)' }}>
          <EquipmentStatus />
          <AiRecovery />
        </div>
        <TwinPanel>
          <div className="absolute inset-0 isolate">
            <Scene />
            <LabelLayer />
            <TourHud />
          </div>
          {focus && sel && <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-24px)] w-[340px] flex-col shadow-2xl">{detail(true)}</div>}
        </TwinPanel>
        <div className={`relative grid min-h-0 gap-2.5 ${focus ? 'invisible overflow-hidden' : ''}`} style={{ gridTemplateRows: 'minmax(0, 1.25fr) minmax(0, 1fr)' }}>
          <Performance />
          <AlertQueue />
          {!focus && sel && <div className="absolute inset-0 z-20 flex flex-col">{detail(false)}</div>}
        </div>
      </div>
      <WarRoomOverlay />
    </div>
  )
}
