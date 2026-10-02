import { polyline, type Polyline, type Vec2 } from './polyline'

export const RACK_ROWS = 10
export const RACK_COLS = 4
/** Rack size: x length, height, z depth. */
export const RACK_SIZE: [number, number, number] = [18, 4.5, 3]
export const DOOR_COUNT = 9
export const AGV_COUNT = 8
export const AGV_SPEED = 3

export function rackLocal(row: number, col: number): Vec2 {
  return [-45 + col * 23, -63 + row * 14]
}

export function rackId(floor: number, row: number, col: number): string {
  return `R${floor}-${String(row + 1).padStart(2, '0')}${'ABCD'[col]}`
}

/** Dock doors sit on the east wall (local x = 60). */
export function doorLocal(door: number): Vec2 {
  return [60, -60 + door * 15]
}

/** AGV route from its dock lane to the aisle beside a rack (L1 only). */
export function agvRoute(agvIndex: number, row: number, col: number): Polyline {
  const [, dz] = doorLocal(agvIndex % DOOR_COUNT)
  const [rx, rz] = rackLocal(row, col)
  const aisle = rz + 7
  return polyline([
    [54, dz],
    [40, dz],
    [40, aisle],
    [rx, aisle],
  ])
}
