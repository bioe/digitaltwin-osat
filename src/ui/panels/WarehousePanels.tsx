import { DOOR_COUNT } from '../../layout/warehouse'
import { inventoryByCategory } from '../../sim/inventory'
import { REORDER_FRACTION } from '../../sim/model'
import { useFactory } from '../../store/store'
import { AlarmList, FillBar, Section, Stat, StatGrid, fmt } from '../bits'
import { TrendChart } from '../TrendChart'

export function WarehouseFloorPanel({ floor }: { floor: number | null }) {
  const allRacks = useFactory(s => s.sim.racks)
  const agvs = useFactory(s => s.sim.agvs)
  const kpi = useFactory(s => s.sim.kpi)
  const history = useFactory(s => s.history)
  const alarms = useFactory(s => s.alarms).filter(a => a.block === 'warehouse')
  const select = useFactory(s => s.select)

  const racks = floor ? allRacks.filter(r => r.floor === floor) : allRacks
  const inventory = inventoryByCategory(allRacks)
  const fill = (racks.reduce((a, r) => a + r.stock, 0) / racks.reduce((a, r) => a + r.capacity, 0)) * 100
  const active = agvs.filter(v => !v.charging).length

  return (
    <div>
      <StatGrid>
        <Stat label={floor ? `L${floor} fill` : 'Stock fill'} value={fmt(fill, 1)} unit="%" />
        <Stat
          label="Below reorder"
          value={String(inventory.filter(c => c.low).length)}
          unit="categories"
          tone={inventory.some(c => c.low) ? 'warn' : undefined}
        />
        <Stat label="AGVs active" value={`${active} / ${agvs.length}`} />
        <Stat label="Warehouse load" value={fmt(kpi.warehouseKw)} unit="kW" />
      </StatGrid>

      <Section title="Inventory vs reorder level" aside="all floors">
        <div className="space-y-2">
          {inventory.map(c => (
            <div key={c.category}>
              <div className="flex justify-between text-xs">
                <span className="text-slate-700">
                  {c.low && <span className="mr-1 font-bold text-amber-500">!</span>}
                  {c.category}
                </span>
                <span className="tabular-nums text-slate-500">
                  {fmt(c.stock)} / {fmt(c.capacity)}
                </span>
              </div>
              <FillBar value={c.stock} max={c.capacity} marker={c.reorder} low={c.low} />
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Black tick = reorder level ({REORDER_FRACTION * 100}%)</p>
      </Section>

      <Section title="Stock fill" aside="% · last 10 min">
        <TrendChart ring={history.site.stockFill} unit="%" />
      </Section>

      {(floor === 1 || floor === null) && (
        <Section title="AGVs" aside={`${DOOR_COUNT} dock doors`}>
          <div className="grid grid-cols-2 gap-1">
            {agvs.map(v => (
              <button
                key={v.id}
                onClick={() => select({ kind: 'agv', id: v.id })}
                className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 text-xs hover:border-blue-400"
              >
                <span className="font-medium text-slate-700">{v.id}</span>
                <span className={`tabular-nums ${v.battery < 25 ? 'text-amber-600' : 'text-slate-500'}`}>
                  {v.charging ? '⚡ ' : ''}
                  {fmt(v.battery)}%
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Warehouse alarms">
        <AlarmList alarms={alarms} />
      </Section>
    </div>
  )
}

export function RackPanel({ id }: { id: string }) {
  const rack = useFactory(s => s.sim.racks.find(r => r.id === id))
  const ring = useFactory(s => s.history.racks.get(id))
  if (!rack) return null
  const low = rack.stock < rack.capacity * REORDER_FRACTION
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">Rack {rack.id}</h2>
      <p className="text-xs text-slate-500">
        Warehouse L{rack.floor} · Row {rack.row + 1} · Column {'ABCD'[rack.col]}
      </p>
      <Section title="Contents">
        <StatGrid>
          <Stat label="Category" value={rack.category} />
          <Stat label="SKU" value={rack.sku} />
          <Stat label="Stock" value={fmt(rack.stock)} unit={`/ ${fmt(rack.capacity)}`} tone={low ? 'warn' : undefined} />
          <Stat label="Fill" value={fmt((rack.stock / rack.capacity) * 100)} unit="%" />
        </StatGrid>
      </Section>
      <Section title="Fill vs reorder level">
        <FillBar value={rack.stock} max={rack.capacity} marker={rack.capacity * REORDER_FRACTION} low={low} />
      </Section>
      <Section title="Stock" aside="units · last 10 min">
        <TrendChart ring={ring} unit="units" digits={0} />
      </Section>
    </div>
  )
}

export function AgvPanel({ id }: { id: string }) {
  const agv = useFactory(s => s.sim.agvs.find(v => v.id === id))
  const ring = useFactory(s => s.history.agvs.get(id))
  if (!agv) return null
  const rack = `R1-${String(agv.row + 1).padStart(2, '0')}${'ABCD'[agv.col]}`
  const dock = (agv.index % DOOR_COUNT) + 1
  const state = agv.charging ? 'Charging at dock' : agv.dir === 1 ? `To rack ${rack}` : `Returning to dock ${dock}`
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{agv.id}</h2>
      <p className="text-xs text-slate-500">Warehouse L1 · {state}</p>
      <Section title="Task">
        <StatGrid>
          <Stat label="Job" value={`Pick ${agv.sku}`} />
          <Stat label="Route" value={`${rack} ↔ D${dock}`} />
          <Stat label="Battery" value={fmt(agv.battery)} unit="%" tone={agv.battery < 25 ? 'warn' : undefined} />
          <Stat label="Status" value={agv.charging ? 'Charging' : 'Moving'} />
        </StatGrid>
      </Section>
      <Section title="Battery" aside="% · last 10 min">
        <TrendChart ring={ring} unit="%" domain={[0, 100]} />
      </Section>
    </div>
  )
}
