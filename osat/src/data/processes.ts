/**
 * Process flow and capacity sizing for a QFN 5×5 mm 32L line on 300 mm wafers.
 * See osat/docs/capacity.md for the derivation.
 *
 *   tools = demand / (UPH × 22 h × OEE 0.85)
 *   demand = 1.2 M units/day ≈ 175 wafers/day (≈7,000 good die per wafer)
 */

export type ProcId =
  | 'sort'
  | 'grind'
  | 'saw'
  | 'da'
  | 'wb'
  | 'mold'
  | 'mark'
  | 'pkgsaw'
  | 'test'
  | 'fvi'
  | 'tnr'

export type Mode = 'OHT' | 'CONV' | 'ARV'
export type CarrierKey = 'foup' | 'frameCassette' | 'magazine' | 'trayStack' | 'reelBox'

export interface AuxDef {
  model: string
  name: string
  count: number
}

export interface ProcessDef {
  id: ProcId
  name: string
  short: string
  model: string
  toolName: string
  count: number
  /** Effective units per hour per tool. */
  uph: number
  /** Which transport system serves this zone (in and out). */
  mode: Mode
  /** Carrier the zone receives. */
  carrier: CarrierKey
  /** Units per carrier (lot) at this step. */
  lotQty: number
  /** Zone width along the row (m). */
  zoneW: number
  /** Number of tool positions along each side of the aisle. */
  perSide: number
  aux?: AuxDef
  basis: string
}

export const DAILY_TARGET = 1_200_000
export const OEE_PLAN = 0.85
export const HOURS = 22

export const PROCESSES: ProcessDef[] = [
  {
    id: 'sort', name: 'Wafer Sort', short: 'SORT', model: 'proberCell', toolName: 'Prober + tester cell',
    count: 14, uph: 4_900, mode: 'OHT', carrier: 'foup', lotQty: 175_000, zoneW: 25, perSide: 7,
    basis: '7,400 die/wafer, 16-site probe card, ~1.4 h/wafer incl. index → 0.7 wafer/h. 175 wafers/day ÷ 13/day → 14 cells.',
  },
  {
    id: 'grind', name: 'Wafer Back Grind', short: 'BG', model: 'backGrinder', toolName: 'Grinder / polisher + inline mounter',
    count: 2, uph: 100_000, mode: 'OHT', carrier: 'foup', lotQty: 175_000, zoneW: 13, perSide: 1,
    basis: 'DGP8761 class, ~15 wafers/h. 1 tool covers 175 wafers/day; 2 for N+1.',
  },
  {
    id: 'saw', name: 'Wafer Saw', short: 'SAW', model: 'dicingSaw', toolName: 'Dual-spindle dicing saw',
    count: 4, uph: 21_000, mode: 'OHT', carrier: 'frameCassette', lotQty: 175_000, zoneW: 11, perSide: 2,
    aux: { model: 'uvCurer', name: 'UV curer', count: 2 },
    basis: 'DFD6362 class, 2×~100 streets per wafer, ~3 wafers/h → 56/day. 175 ÷ 56 → 4 saws.',
  },
  {
    id: 'da', name: 'Die Attach', short: 'DA', model: 'dieBonder', toolName: 'Epoxy die bonder',
    count: 6, uph: 12_000, mode: 'OHT', carrier: 'frameCassette', lotQty: 11_520, zoneW: 16, perSide: 3,
    aux: { model: 'cureOven', name: 'Snap cure oven', count: 2 },
    basis: 'AD838 class, ~12k UPH effective. 1.2 M ÷ (12k × 18.7 h) = 5.3 → 6 bonders.',
  },
  {
    id: 'wb', name: 'Wire Bond', short: 'WB', model: 'wireBonder', toolName: 'Cu ball bonder',
    count: 32, uph: 2_050, mode: 'CONV', carrier: 'magazine', lotQty: 11_520, zoneW: 34, perSide: 16,
    aux: { model: 'plasmaCleaner', name: 'Plasma cleaner', count: 2 },
    basis: '32 wires/unit at ~20 wires/s incl. index → ~2,050 UPH. 1.2 M ÷ (2.05k × 18.7 h) = 31.3 → 32 bonders.',
  },
  {
    id: 'mold', name: 'Molding', short: 'MOLD', model: 'moldPress', toolName: 'Auto mold system (2 press)',
    count: 2, uph: 92_000, mode: 'CONV', carrier: 'magazine', lotQty: 11_520, zoneW: 14, perSide: 1,
    aux: { model: 'cureOven', name: 'Post mold cure oven', count: 2 },
    basis: '576 units/strip, 2 strips/shot, 90 s cycle per press ×2 → 92k UPH. 1 system needed, 2 for N+1.',
  },
  {
    id: 'mark', name: 'Marking', short: 'MARK', model: 'laserMarker', toolName: 'Strip laser marker',
    count: 3, uph: 24_000, mode: 'CONV', carrier: 'magazine', lotQty: 11_520, zoneW: 10, perSide: 2,
    basis: '~0.15 s per unit, 42 strips/h → 24k UPH. 1.2 M ÷ (24k × 18.7 h) = 2.7 → 3 markers.',
  },
  {
    id: 'pkgsaw', name: 'Package Saw / Trim & Form', short: 'PSAW', model: 'packageSaw', toolName: 'Package saw + sorter',
    count: 8, uph: 8_600, mode: 'ARV', carrier: 'magazine', lotQty: 11_520, zoneW: 18, perSide: 4,
    aux: { model: 'trimForm', name: 'Trim & form (leaded)', count: 2 },
    basis: '59 cuts/strip, ~15 strips/h → 8.6k UPH. 1.2 M ÷ (8.6k × 18.7 h) = 7.4 → 8 saws. 2 T&F presses for leaded SKUs.',
  },
  {
    id: 'test', name: 'Final Test', short: 'FT', model: 'testCell', toolName: 'Handler + tester cell',
    count: 9, uph: 7_500, mode: 'ARV', carrier: 'trayStack', lotQty: 11_520, zoneW: 18, perSide: 5,
    basis: '8-site pick-and-place handler, ~7.5k UPH with retest. 1.2 M ÷ (7.5k × 18.7 h) = 8.6 → 9 cells.',
  },
  {
    id: 'fvi', name: 'Final Inspection', short: 'FVI', model: 'visionInspection', toolName: '2D/3D vision turret',
    count: 3, uph: 22_000, mode: 'ARV', carrier: 'trayStack', lotQty: 11_520, zoneW: 10, perSide: 2,
    basis: 'Turret vision ~25k UPH nominal, 22k effective. 1.2 M ÷ (22k × 18.7 h) = 2.9 → 3.',
  },
  {
    id: 'tnr', name: 'Tape & Reel', short: 'T&R', model: 'tapeReel', toolName: 'Turret tape & reel',
    count: 3, uph: 22_000, mode: 'ARV', carrier: 'trayStack', lotQty: 11_520, zoneW: 10, perSide: 2,
    basis: '~25k UPH turret, 5k units per 13" reel. 1.2 M ÷ (22k × 18.7 h) = 2.9 → 3.',
  },
]

export const PROC_BY_ID = Object.fromEntries(PROCESSES.map(p => [p.id, p])) as Record<ProcId, ProcessDef>

export const MODE_LABEL: Record<Mode, string> = {
  OHT: 'Overhead hoist transport',
  CONV: 'Overhead conveyor',
  ARV: 'Autonomous robotic vehicle',
}

/** Theoretical tool count for the daily target. */
export function requiredTools(p: ProcessDef) {
  return DAILY_TARGET / (p.uph * HOURS * OEE_PLAN)
}
