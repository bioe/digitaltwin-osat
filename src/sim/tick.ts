import { BAY_COUNT, FOUP_SPEED, TOOLS_PER_BAY, TRACK } from '../layout/fab'
import { AGV_SPEED, RACK_COLS, RACK_ROWS, agvRoute } from '../layout/warehouse'
import { computeKpis } from './kpis'
import {
  CATEGORIES,
  ROUTE,
  STEP_SECONDS,
  TOOL_TYPES,
  type Agv,
  type EnvCell,
  type FactoryState,
  type Lot,
  type OfficeZone,
  type Rack,
  type Rng,
  type Tool,
  type ToolStatus,
  type Utility,
} from './model'
import { activeFx, expireScenarios, type Fx } from './scenarios'
import { OCCUPANCY_TARGET, OFFICE_TEMP_BASE, SKUS, UTILITY_BASE } from './seed'
import { approach, clamp, noise } from './rng'

const OEE_TARGET: Record<ToolStatus, number> = { run: 90, idle: 58, pm: 25, down: 0 }
const PM_SECONDS = 120

function advanceTools(tools: Tool[], fx: Fx, t: number, dt: number, rng: Rng, bayWip: number[]): Tool[] {
  const availableByBay = new Array(BAY_COUNT).fill(0)
  for (const tool of tools) if (tool.status === 'run' || tool.status === 'idle') availableByBay[tool.bay]++

  return tools.map(tool => {
    let status = tool.status
    if (fx.downTools.includes(tool.id)) status = 'down'
    else if (status === 'down') status = 'run'
    else if (status === 'pm' && t - tool.statusSince > PM_SECONDS) status = 'run'
    else if (status === 'run' && rng() < 0.002 * dt) status = 'idle'
    else if (status === 'idle' && rng() < 0.02 * dt) status = 'run'
    else if (status === 'run' && rng() < 0.0003 * dt) status = 'pm'

    const fairShare = bayWip[tool.bay] / Math.max(1, availableByBay[tool.bay])
    const queue =
      status === 'down' ? tool.queue + 0.25 * dt : approach(tool.queue, status === 'run' ? fairShare : 0, 0.1 * dt)

    return {
      ...tool,
      status,
      statusSince: status === tool.status ? tool.statusSince : t,
      oee: clamp(approach(tool.oee, OEE_TARGET[status], 0.04 * dt) + noise(rng) * 0.3, 0, 100),
      uptime: clamp(approach(tool.uptime, status === 'down' ? 0 : 97, 0.002 * dt), 0, 100),
      queue: Math.max(0, queue),
    }
  })
}

/** Bay throughput factor: available tools / tools in bay. */
function bayCapacity(tools: Tool[]): number[] {
  const cap = new Array(BAY_COUNT).fill(0)
  for (const t of tools) if (t.status === 'run' || t.status === 'idle') cap[t.bay]++
  return cap.map(c => c / TOOLS_PER_BAY)
}

function advanceLots(lots: Lot[], capacity: number[], dt: number, rng: Rng) {
  let lotsOut = 0
  const next = lots.map(lot => {
    const bay = TOOL_TYPES.indexOf(ROUTE[lot.step])
    let progress = lot.progress + (dt / STEP_SECONDS) * capacity[bay] * (0.8 + rng() * 0.4)
    let step = lot.step
    if (progress >= 1) {
      progress -= 1
      step += 1
      if (step >= ROUTE.length) {
        step = 0
        lotsOut++
      }
    }
    return step === lot.step && progress === lot.progress ? lot : { ...lot, step, progress }
  })
  // Closed loop: every lot out is replaced by a new start.
  return { lots: next, lotsOut, lotsIn: lotsOut }
}

export function wipByBay(lots: Lot[]): number[] {
  const wip = new Array(BAY_COUNT).fill(0)
  for (const lot of lots) wip[TOOL_TYPES.indexOf(ROUTE[lot.step])]++
  return wip
}

function advanceEnv(env: EnvCell[], fx: Fx, dt: number, rng: Rng): EnvCell[] {
  return env.map((c, i) => {
    const spiking = fx.particleCells.includes(i)
    return {
      particles: clamp(approach(c.particles, spiking ? 175 : 32, (spiking ? 0.12 : 0.06) * dt) + noise(rng) * 2, 0, 400),
      tempC: approach(c.tempC, 21 + (spiking ? 0.4 : 0), 0.05 * dt) + noise(rng) * 0.03,
      humidity: clamp(approach(c.humidity, 43, 0.05 * dt) + noise(rng) * 0.15, 0, 100),
    }
  })
}

function advanceRacks(racks: Rack[], fx: Fx, dt: number, rng: Rng): Rack[] {
  return racks.map(r => {
    const drain = fx.drainCategory === r.category ? 0.03 * r.capacity : 0
    const stock = r.stock + ((r.target * r.capacity - r.stock) * 0.03 + noise(rng) * 0.004 * r.capacity - drain) * dt
    return { ...r, stock: clamp(stock, 0, r.capacity) }
  })
}

function advanceAgvs(agvs: Agv[], dt: number, rng: Rng): Agv[] {
  return agvs.map(v => {
    if (v.charging) {
      const battery = clamp(v.battery + 1.5 * dt, 0, 100)
      return { ...v, battery, charging: battery < 95 }
    }
    const route = agvRoute(v.index, v.row, v.col)
    let { s, dir, row, col, sku } = v
    s += dir * AGV_SPEED * dt
    if (s >= route.length) {
      s = route.length
      dir = -1
    } else if (s <= 0) {
      // Back at the dock: pick the next job.
      s = 0
      dir = 1
      row = Math.floor(rng() * RACK_ROWS)
      col = Math.floor(rng() * RACK_COLS)
      const cat = CATEGORIES[col % CATEGORIES.length]
      sku = SKUS[cat][row % SKUS[cat].length]
    }
    const battery = clamp(v.battery - 0.12 * dt, 0, 100)
    // Only start charging when parked at the dock.
    const charging = battery < 20 && s === 0
    return { ...v, s, dir, row, col, sku, battery, charging }
  })
}

function advanceOffice(zones: OfficeZone[], fx: Fx, dt: number, rng: Rng): OfficeZone[] {
  return zones.map(z => {
    const target = z.capacity * OCCUPANCY_TARGET
    const occupied = Math.round(clamp(approach(z.occupied, target, 0.02 * dt) + noise(rng) * 1.2, 0, z.capacity))
    const tempC = approach(z.tempC, OFFICE_TEMP_BASE + fx.hvacBoost * 3.5, 0.08 * dt) + noise(rng) * 0.03
    const kw = 20 + occupied * 0.6 + fx.hvacBoost * 45 + Math.max(0, tempC - OFFICE_TEMP_BASE) * 4
    return { ...z, occupied, tempC, kw: approach(z.kw, kw, 0.2 * dt) }
  })
}

function advanceUtility(u: Utility, env: EnvCell[], dt: number, rng: Rng): Utility {
  const maxParticles = Math.max(...env.map(c => c.particles))
  const fanBoost = maxParticles > 100 ? 2500 : 0
  return {
    ...u,
    subfabKw: approach(u.subfabKw, UTILITY_BASE.subfabKw, 0.05 * dt) + noise(rng) * 120,
    chwSupplyC: approach(u.chwSupplyC, UTILITY_BASE.chwSupplyC, 0.1 * dt) + noise(rng) * 0.03,
    exhaustPa: approach(u.exhaustPa, UTILITY_BASE.exhaustPa, 0.1 * dt) + noise(rng) * 2,
    fanDeckKw: approach(u.fanDeckKw, UTILITY_BASE.fanDeckKw + fanBoost, 0.08 * dt) + noise(rng) * 60,
    ffuRunning: clamp(Math.round(u.ffuRunning + noise(rng) * 1.5), UTILITY_BASE.ffuTotal - 30, UTILITY_BASE.ffuTotal),
  }
}

/** Advance the plant by `dt` seconds. Pure: returns a new state. */
export function advance(state: FactoryState, dt: number, rng: Rng): FactoryState {
  const t = state.t + dt
  const fx = activeFx(state)
  const bayWip = wipByBay(state.lots)
  const tools = advanceTools(state.tools, fx, t, dt, rng, bayWip)
  const { lots, lotsOut, lotsIn } = advanceLots(state.lots, bayCapacity(tools), dt, rng)
  const env = advanceEnv(state.env, fx, dt, rng)

  const next = {
    ...state,
    t,
    tools,
    lots,
    foups: state.foups.map(f => ({ ...f, s: (f.s + FOUP_SPEED * dt) % TRACK.length })),
    env,
    racks: advanceRacks(state.racks, fx, dt, rng),
    agvs: advanceAgvs(state.agvs, dt, rng),
    office: advanceOffice(state.office, fx, dt, rng),
    utility: advanceUtility(state.utility, env, dt, rng),
  }
  return expireScenarios({ ...next, kpi: computeKpis(next, state.kpi, { lotsOut, lotsIn, dt }) })
}
