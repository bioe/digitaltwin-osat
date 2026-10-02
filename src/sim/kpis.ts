import {
  LOT_COUNT,
  NOMINAL_CYCLE_DAYS,
  NOMINAL_WAFERS_PER_HOUR,
  ROUTE,
  STEP_SECONDS,
  type FactoryState,
  type Kpis,
  type ToolStatus,
} from './model'
import { approach, clamp } from './rng'

export interface Flow {
  /** Lots that finished the route this tick. */
  lotsOut: number
  /** Lots that were started this tick. */
  lotsIn: number
  dt: number
}

const BASE_LOTS_PER_SEC = LOT_COUNT / (ROUTE.length * STEP_SECONDS)
const BASE_YIELD = 94.2

export const TOOL_KW: Record<ToolStatus, number> = { run: 140, idle: 60, pm: 20, down: 10 }

const toWafersPerHour = (lotsPerSec: number) => (lotsPerSec / BASE_LOTS_PER_SEC) * NOMINAL_WAFERS_PER_HOUR

export function computeKpis(s: Omit<FactoryState, 'kpi'>, prev: Kpis | undefined, flow: Flow): Kpis {
  const oee = s.tools.reduce((a, t) => a + t.oee, 0) / s.tools.length

  const particleExcess = s.env.reduce((a, c) => a + Math.max(0, c.particles - 100), 0)
  const yieldTarget = BASE_YIELD - Math.min(4, particleExcess * 0.01)

  const outRate = toWafersPerHour(flow.lotsOut / flow.dt)
  const inRate = toWafersPerHour(flow.lotsIn / flow.dt)
  const wafersOutPerHour = prev ? approach(prev.wafersOutPerHour, outRate, 0.05) : NOMINAL_WAFERS_PER_HOUR * 0.97

  const toolKw = s.tools.reduce((a, t) => a + TOOL_KW[t.status], 0)
  const fabKw = toolKw + s.utility.subfabKw + s.utility.fanDeckKw
  const warehouseKw = 1100 + s.agvs.reduce((a, v) => a + (v.charging ? 15 : 5), 0)
  const officeKw = s.office.reduce((a, z) => a + z.kw, 0)

  const occ = s.office.reduce((a, z) => a + z.occupied, 0)
  const cap = s.office.reduce((a, z) => a + z.capacity, 0)
  const stock = s.racks.reduce((a, r) => a + r.stock, 0)
  const rackCap = s.racks.reduce((a, r) => a + r.capacity, 0)

  return {
    oee: clamp(oee, 0, 100),
    yield: clamp(prev ? approach(prev.yield, yieldTarget, 0.1) : yieldTarget, 0, 100),
    wip: s.lots.length,
    wafersOutPerHour,
    waferStartsToday: (prev?.waferStartsToday ?? 1310) + (inRate * flow.dt) / 3600,
    waferOutsToday: (prev?.waferOutsToday ?? 1284) + (outRate * flow.dt) / 3600,
    cycleTimeDays: (NOMINAL_CYCLE_DAYS * NOMINAL_WAFERS_PER_HOUR) / Math.max(20, wafersOutPerHour),
    fabKw,
    warehouseKw,
    officeKw,
    energyMw: (fabKw + warehouseKw + officeKw) / 1000,
    officeOccupancy: (occ / cap) * 100,
    stockFill: (stock / rackCap) * 100,
  }
}
