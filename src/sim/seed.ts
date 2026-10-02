import { BAY_COUNT, ENV_COLS, ENV_ROWS, FOUP_COUNT, TOOLS_PER_BAY, TRACK } from '../layout/fab'
import { DESKS_PER_ZONE } from '../layout/office'
import { AGV_COUNT, RACK_COLS, RACK_ROWS, rackId } from '../layout/warehouse'
import { computeKpis } from './kpis'
import {
  CATEGORIES,
  LOT_COUNT,
  ROUTE,
  TOOL_TYPES,
  type Agv,
  type Category,
  type EnvCell,
  type FactoryState,
  type Foup,
  type Lot,
  type OfficeZone,
  type Rack,
  type Rng,
  type Tool,
  type ToolStatus,
} from './model'
import { mulberry32, noise } from './rng'

export const BASELINE_SEED = 20261002

const PRODUCTS = ['N3-LOGIC', 'N5-SOC', 'N7-RF', 'N3-AI']

export const SKUS: Record<Category, string[]> = {
  'Raw wafers': ['WFR-300P', 'WFR-300N', 'WFR-SOI'],
  Chemicals: ['CHEM-HF', 'CHEM-H2SO4', 'CHEM-NH4OH', 'CHEM-PR193'],
  Gases: ['GAS-NF3', 'GAS-WF6', 'GAS-SIH4'],
  'Finished goods': ['FG-N3-LOGIC', 'FG-N5-SOC', 'FG-N7-RF'],
}

/** Utility/fan-deck baseline values. */
export const UTILITY_BASE = {
  subfabKw: 38000,
  chwSupplyC: 6.5,
  exhaustPa: -450,
  fanDeckKw: 21000,
  ffuTotal: 10000,
}

export const OFFICE_TEMP_BASE = 22.5
export const OCCUPANCY_TARGET = 0.72

function seedTools(rng: Rng): Tool[] {
  const tools: Tool[] = []
  for (let bay = 0; bay < BAY_COUNT; bay++) {
    const type = TOOL_TYPES[bay]
    for (let slot = 0; slot < TOOLS_PER_BAY; slot++) {
      const r = rng()
      const status: ToolStatus = r < 0.86 ? 'run' : r < 0.96 ? 'idle' : 'pm'
      tools.push({
        id: `${type}-${String(slot + 1).padStart(2, '0')}`,
        type,
        bay,
        slot,
        status,
        statusSince: -Math.floor(rng() * 600),
        oee: status === 'run' ? 86 + rng() * 8 : status === 'idle' ? 55 + rng() * 10 : 30,
        uptime: 90 + rng() * 8,
        queue: 0,
      })
    }
  }
  return tools
}

function seedLots(rng: Rng): Lot[] {
  return Array.from({ length: LOT_COUNT }, (_, i) => ({
    id: `L${String(260000 + i)}`,
    product: PRODUCTS[i % PRODUCTS.length],
    step: Math.floor((i / LOT_COUNT) * ROUTE.length),
    progress: rng(),
  }))
}

function seedFoups(): Foup[] {
  const gap = TRACK.length / FOUP_COUNT
  const stride = LOT_COUNT / FOUP_COUNT
  return Array.from({ length: FOUP_COUNT }, (_, i) => ({ lotIndex: i * stride, s: i * gap }))
}

function seedEnv(rng: Rng): EnvCell[] {
  return Array.from({ length: ENV_COLS * ENV_ROWS }, () => ({
    particles: 25 + rng() * 20,
    tempC: 21 + noise(rng) * 0.15,
    humidity: 43 + noise(rng) * 1,
  }))
}

function seedRacks(rng: Rng): Rack[] {
  const racks: Rack[] = []
  for (let floor = 1; floor <= 3; floor++)
    for (let row = 0; row < RACK_ROWS; row++)
      for (let col = 0; col < RACK_COLS; col++) {
        const category = CATEGORIES[(col + floor - 1) % CATEGORIES.length]
        const skus = SKUS[category]
        const capacity = 400
        const target = 0.55 + rng() * 0.25
        racks.push({
          id: rackId(floor, row, col),
          floor,
          row,
          col,
          category,
          sku: skus[row % skus.length],
          capacity,
          target,
          stock: Math.round(capacity * target),
        })
      }
  return racks
}

function seedAgvs(rng: Rng): Agv[] {
  return Array.from({ length: AGV_COUNT }, (_, i) => {
    const row = Math.floor(rng() * RACK_ROWS)
    const col = Math.floor(rng() * RACK_COLS)
    const category = CATEGORIES[col % CATEGORIES.length]
    return {
      id: `AGV-${String(i + 1).padStart(2, '0')}`,
      index: i,
      row,
      col,
      sku: SKUS[category][row % SKUS[category].length],
      s: rng() * 40,
      dir: 1 as const,
      battery: 45 + rng() * 50,
      charging: false,
    }
  })
}

function seedOffice(rng: Rng): OfficeZone[] {
  const zones: OfficeZone[] = []
  for (let floor = 1; floor <= 3; floor++)
    for (let quad = 0; quad < 4; quad++) {
      const kind = quad === 2 ? 'meeting' : floor === 3 && quad === 3 ? 'board' : 'desks'
      const capacity = kind === 'desks' ? DESKS_PER_ZONE : kind === 'meeting' ? 40 : 20
      const occupied = Math.round(capacity * (OCCUPANCY_TARGET + noise(rng) * 0.1))
      const name =
        kind === 'meeting' ? 'Meeting rooms' : kind === 'board' ? 'Board room' : `Open desks ${'ABCD'[quad]}`
      zones.push({
        id: `O-L${floor}-${'ABCD'[quad]}`,
        floor,
        quad,
        name,
        kind,
        capacity,
        occupied,
        tempC: OFFICE_TEMP_BASE + noise(rng) * 0.3,
        kw: 20 + occupied * 0.6,
      })
    }
  return zones
}

export function createInitialState(rng: Rng = mulberry32(BASELINE_SEED)): FactoryState {
  const base = {
    t: 0,
    tools: seedTools(rng),
    lots: seedLots(rng),
    foups: seedFoups(),
    env: seedEnv(rng),
    racks: seedRacks(rng),
    agvs: seedAgvs(rng),
    office: seedOffice(rng),
    utility: { ...UTILITY_BASE, ffuRunning: UTILITY_BASE.ffuTotal - 12 },
    scenarios: [],
    safetyDays: 412,
  }
  return { ...base, kpi: computeKpis(base, undefined, { lotsOut: 0, lotsIn: 0, dt: 1 }) }
}
