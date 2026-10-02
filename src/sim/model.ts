export const TOOL_TYPES = ['LITHO', 'ETCH', 'DEPO', 'CMP', 'IMPL', 'METRO', 'DIFF', 'CLEAN'] as const
export type ToolType = (typeof TOOL_TYPES)[number]

export const BAY_NAMES: Record<ToolType, string> = {
  LITHO: 'Lithography',
  ETCH: 'Plasma etch',
  DEPO: 'Deposition',
  CMP: 'CMP',
  IMPL: 'Ion implant',
  METRO: 'Metrology',
  DIFF: 'Diffusion',
  CLEAN: 'Wet clean',
}

/** Re-entrant process route: the 8-step module flow repeated 3 times. */
export const ROUTE: ToolType[] = Array.from({ length: 3 }, () =>
  ['CLEAN', 'DIFF', 'LITHO', 'ETCH', 'DEPO', 'CMP', 'IMPL', 'METRO'] as ToolType[],
).flat()

export const LOT_COUNT = 1200
export const WAFERS_PER_LOT = 25
/** Demo-time seconds a lot spends on one route step at full bay capacity. */
export const STEP_SECONDS = 30
/** Nominal output shown on screen at full capacity. */
export const NOMINAL_WAFERS_PER_HOUR = 160
export const NOMINAL_CYCLE_DAYS = 42

export type ToolStatus = 'run' | 'idle' | 'pm' | 'down'

export interface Tool {
  id: string
  type: ToolType
  bay: number
  slot: number
  status: ToolStatus
  statusSince: number
  /** 0–100 */
  oee: number
  /** 0–100 */
  uptime: number
  queue: number
}

export interface Lot {
  id: string
  product: string
  /** Index into ROUTE. */
  step: number
  /** 0–1 progress through the current step. */
  progress: number
}

export interface Foup {
  lotIndex: number
  /** Distance along the AMHS track, metres. */
  s: number
}

export interface EnvCell {
  /** Particle count as % of the ISO 4 limit (≥ 0.1 µm). */
  particles: number
  tempC: number
  humidity: number
}

export const CATEGORIES = ['Raw wafers', 'Chemicals', 'Gases', 'Finished goods'] as const
export type Category = (typeof CATEGORIES)[number]
export const REORDER_FRACTION = 0.3

export interface Rack {
  id: string
  floor: number
  row: number
  col: number
  category: Category
  sku: string
  capacity: number
  stock: number
  target: number
}

export interface Agv {
  id: string
  index: number
  /** Target rack (row, col on L1). */
  row: number
  col: number
  sku: string
  /** Distance along the current route. */
  s: number
  dir: 1 | -1
  /** 0–100 */
  battery: number
  charging: boolean
}

export type ZoneKind = 'desks' | 'meeting' | 'board'

export interface OfficeZone {
  id: string
  floor: number
  quad: number
  name: string
  kind: ZoneKind
  capacity: number
  occupied: number
  tempC: number
  kw: number
}

export interface Utility {
  subfabKw: number
  chwSupplyC: number
  exhaustPa: number
  fanDeckKw: number
  ffuRunning: number
  ffuTotal: number
}

export interface Kpis {
  /** Fab mean OEE, 0–100 */
  oee: number
  /** Line yield, 0–100 */
  yield: number
  wip: number
  wafersOutPerHour: number
  waferStartsToday: number
  waferOutsToday: number
  cycleTimeDays: number
  fabKw: number
  warehouseKw: number
  officeKw: number
  energyMw: number
  /** Office occupancy, 0–100 */
  officeOccupancy: number
  /** Warehouse fill, 0–100 */
  stockFill: number
}

export type ScenarioId = 'toolDown' | 'particleSpike' | 'lowStock' | 'hvacPeak'

export interface ActiveScenario {
  id: ScenarioId
  startedAt: number
}

export interface FactoryState {
  /** Sim seconds since start. */
  t: number
  tools: Tool[]
  lots: Lot[]
  foups: Foup[]
  env: EnvCell[]
  racks: Rack[]
  agvs: Agv[]
  office: OfficeZone[]
  utility: Utility
  kpi: Kpis
  scenarios: ActiveScenario[]
  safetyDays: number
}

export type Rng = () => number
