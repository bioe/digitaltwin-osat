import { useState } from 'react'
import { BLOCKS } from '../layout/site'
import { useFactory, type View } from '../store/store'
import { AgvPanel, RackPanel, WarehouseFloorPanel } from './panels/WarehousePanels'
import { FabFloorPanel, FoupPanel, ToolPanel } from './panels/FabPanels'
import { OfficeFloorPanel, ZonePanel } from './panels/OfficePanels'
import { SitePanel } from './panels/SitePanel'

function Content({ view }: { view: View }) {
  const sel = view.selection
  if (sel) {
    switch (sel.kind) {
      case 'tool':
        return <ToolPanel id={sel.id} />
      case 'foup':
        return <FoupPanel index={sel.index} />
      case 'rack':
        return <RackPanel id={sel.id} />
      case 'agv':
        return <AgvPanel id={sel.id} />
      case 'zone':
        return <ZonePanel id={sel.id} />
      case 'kpiBoard':
        return <SitePanel title="Site KPI board" />
    }
  }
  if (!view.block) return <SitePanel />

  const def = BLOCKS[view.block]
  const header = (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-slate-900">
        {def.name}
        {view.floor ? ` · L${view.floor}` : ''}
      </h2>
      <p className="text-xs text-slate-500">
        {view.floor
          ? def.floorNames[view.floor - 1]
          : `${def.size[0]} × ${def.size[1]} m · ${def.floorHeights.length} storeys · pick a floor`}
      </p>
    </div>
  )
  const body =
    view.block === 'fab' ? (
      <FabFloorPanel floor={view.floor ?? 2} />
    ) : view.block === 'warehouse' ? (
      <WarehouseFloorPanel floor={view.floor} />
    ) : (
      <OfficeFloorPanel floor={view.floor} />
    )
  return (
    <>
      {header}
      {body}
    </>
  )
}

export function DetailPanel() {
  const view = useFactory(s => s.view)
  const select = useFactory(s => s.select)
  const [open, setOpen] = useState(true)
  const key = JSON.stringify([view.block, view.floor, view.selection])

  return (
    <aside
      data-testid="detail-panel"
      className={`absolute bottom-4 right-4 top-20 w-[360px] transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-[376px]'
      }`}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="absolute -left-8 top-3 rounded-l-md border border-r-0 border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm"
        aria-label={open ? 'Hide panel' : 'Show panel'}
      >
        {open ? '›' : '‹'}
      </button>
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
        {view.selection && (
          <button
            onClick={() => select(null)}
            className="self-end px-3 pt-2 text-xs text-slate-400 hover:text-slate-700"
          >
            ✕ Close
          </button>
        )}
        <div key={key} className="panel-enter flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <Content view={view} />
        </div>
      </div>
    </aside>
  )
}
