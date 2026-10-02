import { useState } from 'react'
import type { BlockId } from '../layout/site'
import type { Kpis, ScenarioId } from '../sim/model'
import { SCENARIOS, SCENARIO_IDS } from '../sim/scenarios'
import { useFactory } from '../store/store'
import { clock, fmt } from './bits'

interface Chip {
  label: string
  value: string
  tone?: 'warn' | 'alarm'
}

function chipsFor(block: BlockId | null, k: Kpis, alarms: number, extra: { lowStock: number; agvsActive: number; officeTemp: number }): Chip[] {
  if (block === 'fab')
    return [
      { label: 'Fab OEE', value: `${fmt(k.oee, 1)}%` },
      { label: 'Line yield', value: `${fmt(k.yield, 1)}%` },
      { label: 'WIP', value: `${fmt(k.wip)} lots` },
      { label: 'Cycle time', value: `${fmt(k.cycleTimeDays, 1)} d` },
      { label: 'Output', value: `${fmt(k.wafersOutPerHour)} wfr/h` },
    ]
  if (block === 'warehouse')
    return [
      { label: 'Stock fill', value: `${fmt(k.stockFill, 1)}%` },
      { label: 'Below reorder', value: String(extra.lowStock), tone: extra.lowStock ? 'warn' : undefined },
      { label: 'AGVs active', value: `${extra.agvsActive} / 8` },
      { label: 'Load', value: `${fmt(k.warehouseKw)} kW` },
    ]
  if (block === 'office')
    return [
      { label: 'Occupancy', value: `${fmt(k.officeOccupancy)}%` },
      { label: 'Office load', value: `${fmt(k.officeKw)} kW` },
      { label: 'Avg temp', value: `${fmt(extra.officeTemp, 1)} °C`, tone: extra.officeTemp > 25 ? 'warn' : undefined },
    ]
  return [
    { label: 'Output', value: `${fmt(k.wafersOutPerHour)} wfr/h` },
    { label: 'Line yield', value: `${fmt(k.yield, 1)}%` },
    { label: 'Fab OEE', value: `${fmt(k.oee, 1)}%` },
    { label: 'Energy', value: `${fmt(k.energyMw, 1)} MW` },
    { label: 'Alarms', value: String(alarms), tone: alarms ? 'alarm' : undefined },
  ]
}

function KpiChips() {
  const block = useFactory(s => s.view.block)
  const kpi = useFactory(s => s.sim.kpi)
  const alarms = useFactory(s => s.alarms)
  const agvs = useFactory(s => s.sim.agvs)
  const office = useFactory(s => s.sim.office)
  const chips = chipsFor(block, kpi, alarms.length, {
    lowStock: new Set(alarms.filter(a => a.block === 'warehouse').map(a => a.source)).size,
    agvsActive: agvs.filter(v => !v.charging).length,
    officeTemp: office.reduce((a, z) => a + z.tempC, 0) / office.length,
  })
  return (
    <div className="flex flex-wrap justify-center gap-2" data-testid="kpi-chips">
      {chips.map(c => (
        <div key={c.label} className="rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-900">
            {c.tone && (
              <span className={`h-2 w-2 rounded-full ${c.tone === 'alarm' ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden />
            )}
            {c.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function ScenarioMenu() {
  const [open, setOpen] = useState(false)
  const active = useFactory(s => s.sim.scenarios)
  const t = useFactory(s => s.sim.t)
  const start = useFactory(s => s.startScenario)
  const normalDay = useFactory(s => s.normalDay)
  const select = useFactory(s => s.select)
  const openFloor = useFactory(s => s.openFloor)
  const setOverlay = useFactory(s => s.setOverlay)

  // Fly to where each scenario's story plays out.
  const focus = (id: ScenarioId) => {
    if (id === 'toolDown') return select({ kind: 'tool', id: 'ETCH-03' })
    if (id === 'particleSpike') {
      openFloor('fab', 2)
      return setOverlay('particles')
    }
    if (id === 'lowStock') return openFloor('warehouse', 1)
    openFloor('office', 2)
    setOverlay('officeTemp')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-blue-400"
      >
        Scenarios
        {active.length > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 text-xs text-white">{active.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {SCENARIO_IDS.map(id => {
            const def = SCENARIOS[id]
            const run = active.find(a => a.id === id)
            const left = run ? Math.max(0, Math.ceil(def.duration - (t - run.startedAt))) : 0
            return (
              <button
                key={id}
                onClick={() => {
                  start(id)
                  focus(id)
                  setOpen(false)
                }}
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="flex justify-between text-sm font-medium text-slate-800">
                  {def.name}
                  {run && <span className="text-xs font-normal text-red-600">running · {left}s</span>}
                </div>
                <div className="text-xs text-slate-500">{def.description}</div>
              </button>
            )
          })}
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => {
              normalDay()
              setOpen(false)
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Normal day
            <div className="text-xs font-normal text-slate-500">Stop all scenarios and reset to baseline.</div>
          </button>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const t = useFactory(s => s.sim.t)
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
      <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">FAB-01 Digital Twin</div>
        <div className="text-[11px] tabular-nums text-slate-500">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500 align-middle" />
          Live sim · {clock(t)}
        </div>
      </div>
      <div className="pointer-events-auto">
        <KpiChips />
      </div>
      <div className="pointer-events-auto">
        <ScenarioMenu />
      </div>
    </header>
  )
}
