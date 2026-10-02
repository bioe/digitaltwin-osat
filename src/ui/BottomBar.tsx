import { BLOCKS, BLOCK_IDS } from '../layout/site'
import { useFactory, overlaysFor, type Overlay, type Selection } from '../store/store'
import { HEAT_HIGH, HEAT_LOW, STATUS_COLOR, STATUS_LABEL, WARN } from '../theme'

const OVERLAY_LABEL: Record<Overlay, string> = {
  none: 'None',
  status: 'Tool status',
  particles: 'Particles',
  temp: 'Temp',
  humidity: 'Humidity',
  occupancy: 'Occupancy',
  energy: 'Energy',
  officeTemp: 'Temp',
  stock: 'Stock level',
}

const HEAT_RANGE: Partial<Record<Overlay, [string, string]>> = {
  particles: ['0%', '100% of ISO 4 limit'],
  temp: ['20.5 °C', '21.5 °C'],
  humidity: ['40%', '46% RH'],
  energy: ['0 kW', '120 kW'],
  officeTemp: ['21 °C', '26 °C'],
  stock: ['empty', 'full'],
}

function selectionLabel(sel: Selection): string {
  switch (sel.kind) {
    case 'tool':
    case 'rack':
    case 'agv':
    case 'zone':
      return sel.id
    case 'foup':
      return `FOUP ${String(sel.index + 1).padStart(3, '0')}`
    case 'kpiBoard':
      return 'KPI board'
  }
}

function Crumb({ label, onClick }: { label: string; onClick?: () => void }) {
  return onClick ? (
    <button onClick={onClick} className="text-blue-600 hover:underline">
      {label}
    </button>
  ) : (
    <span className="font-medium text-slate-800">{label}</span>
  )
}

function Breadcrumb() {
  const view = useFactory(s => s.view)
  const goSite = useFactory(s => s.goSite)
  const openBlock = useFactory(s => s.openBlock)
  const openFloor = useFactory(s => s.openFloor)

  const parts: { label: string; onClick?: () => void }[] = [{ label: 'Site', onClick: goSite }]
  if (view.block) parts.push({ label: BLOCKS[view.block].name, onClick: () => openBlock(view.block!) })
  if (view.block && view.floor) parts.push({ label: `L${view.floor}`, onClick: () => openFloor(view.block!, view.floor!) })
  if (view.selection) parts.push({ label: selectionLabel(view.selection) })
  parts[parts.length - 1].onClick = undefined

  return (
    <nav data-testid="breadcrumb" className="flex items-center gap-1.5 text-sm">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-300">›</span>}
          <Crumb {...p} />
        </span>
      ))}
    </nav>
  )
}

function Navigator() {
  const view = useFactory(s => s.view)
  const openBlock = useFactory(s => s.openBlock)
  const openFloor = useFactory(s => s.openFloor)
  const btn = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`

  if (!view.block)
    return (
      <div className="flex gap-1">
        {BLOCK_IDS.map(id => (
          <button key={id} className={btn(false)} onClick={() => openBlock(id)}>
            {BLOCKS[id].name}
          </button>
        ))}
      </div>
    )
  const block = view.block
  return (
    <div className="flex gap-1">
      {BLOCKS[block].floorNames.map((name, i) => (
        <button key={i} title={name} className={btn(view.floor === i + 1)} onClick={() => openFloor(block, i + 1)}>
          L{i + 1}
        </button>
      ))}
    </div>
  )
}

function Legend({ overlay }: { overlay: Overlay }) {
  if (overlay === 'status')
    return (
      <div className="flex gap-3">
        {(Object.keys(STATUS_COLOR) as (keyof typeof STATUS_COLOR)[]).map(s => (
          <span key={s} className="flex items-center gap-1 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    )
  if (overlay === 'occupancy')
    return (
      <div className="flex gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR.run }} /> Occupied
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Free
        </span>
      </div>
    )
  const range = HEAT_RANGE[overlay]
  if (!range) return null
  const overLabel = overlay === 'stock' ? 'below reorder' : overlay === 'particles' ? 'over limit' : null
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <span>{range[0]}</span>
      <span className="h-2.5 w-24 rounded-sm" style={{ background: `linear-gradient(90deg, ${HEAT_LOW}, ${HEAT_HIGH})` }} />
      <span>{range[1]}</span>
      {overLabel && (
        <span className="flex items-center gap-1">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: overlay === 'stock' ? WARN : STATUS_COLOR.down }}
          />
          {overLabel}
        </span>
      )}
    </div>
  )
}

function OverlayBar() {
  const view = useFactory(s => s.view)
  const setOverlay = useFactory(s => s.setOverlay)
  const options = overlaysFor(view.block, view.floor)
  if (view.level !== 'floor' || !options.length) return null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm">
      <span className="text-xs text-slate-500">Overlay</span>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
        {options.map(o => (
          <button
            key={o}
            onClick={() => setOverlay(o)}
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              view.overlay === o ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {OVERLAY_LABEL[o]}
          </button>
        ))}
      </div>
      <Legend overlay={view.overlay} />
    </div>
  )
}

export function BottomBar() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 right-[392px] flex flex-wrap items-end justify-between gap-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm">
        <Breadcrumb />
        <span className="h-4 w-px bg-slate-200" />
        <Navigator />
      </div>
      <div className="pointer-events-auto">
        <OverlayBar />
      </div>
    </div>
  )
}
