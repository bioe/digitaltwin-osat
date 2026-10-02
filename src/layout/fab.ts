import { polyline, type Vec2 } from './polyline'

export const BAY_COUNT = 8
export const TOOLS_PER_BAY = 25
/** Tool box size: x width, height, z depth (stylised, larger than life for readability). */
export const TOOL_SIZE: [number, number, number] = [6, 4.5, 7]

/** Block-local position of a tool. Bays are rows along x; 25 tools per row. */
export function toolLocal(bay: number, slot: number): Vec2 {
  return [-120 + slot * 10, -87.5 + bay * 25]
}

/**
 * Overhead AMHS loop: serpentine through the 7 aisles between bay rows,
 * then back along the north and west edges.
 */
const AISLES = [-75, -50, -25, 0, 25, 50, 75]
const trackPoints: Vec2[] = []
AISLES.forEach((z, k) => {
  const east = k % 2 === 0
  trackPoints.push([east ? -135 : 135, z], [east ? 135 : -135, z])
})
trackPoints.push([135, 97], [-145, 97], [-145, -75])

export const TRACK = polyline(trackPoints, true)
/** Track height above the cleanroom floor (cleanroom is 8 m tall). */
export const TRACK_HEIGHT = 6.2
export const FOUP_COUNT = 150
export const FOUP_SPEED = 5

export const ENV_COLS = 12
export const ENV_ROWS = 8
export const ENV_CELL = 25

export function envCellLocal(index: number): Vec2 {
  const c = index % ENV_COLS
  const r = Math.floor(index / ENV_COLS)
  return [-137.5 + c * ENV_CELL, -87.5 + r * ENV_CELL]
}

export function envCellName(index: number): string {
  const c = index % ENV_COLS
  const r = Math.floor(index / ENV_COLS)
  return `${String.fromCharCode(65 + r)}${c + 1}`
}

/** Decorative utility equipment grids for L1 (sub-fab) and L3 (fan deck). */
export function utilityGrid(floor: 1 | 3): Vec2[] {
  const out: Vec2[] = []
  const [cols, rows, dx, dz] = floor === 1 ? [16, 8, 17, 22] : [24, 16, 12, 12]
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push([(c - (cols - 1) / 2) * dx, (r - (rows - 1) / 2) * dz])
  return out
}
