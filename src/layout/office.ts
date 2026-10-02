import type { Vec2 } from './polyline'

/** Office floor is 80 × 80 m, split into four 40 × 40 m quadrants. */
export const QUAD_SIZE = 40
export const DESK_COLS = 6
export const DESK_ROWS = 8
export const DESKS_PER_ZONE = DESK_COLS * DESK_ROWS
export const DESK_SIZE: [number, number, number] = [3, 0.8, 1.6]

/** Quad 0 NW, 1 NE, 2 SW, 3 SE. */
export function quadLocal(quad: number): Vec2 {
  return [quad % 2 === 0 ? -20 : 20, quad < 2 ? -20 : 20]
}

export function deskLocal(quad: number, i: number): Vec2 {
  const [qx, qz] = quadLocal(quad)
  const c = i % DESK_COLS
  const r = Math.floor(i / DESK_COLS)
  return [qx - 12.5 + c * 5, qz - 14 + r * 4]
}

/** Four meeting rooms per meeting quadrant. */
export function meetingRoomLocal(quad: number, room: number): Vec2 {
  const [qx, qz] = quadLocal(quad)
  return [qx + (room % 2 === 0 ? -9.5 : 9.5), qz + (room < 2 ? -9.5 : 9.5)]
}

/** Board room is quad 3 on L3; screen hangs on the east wall facing west. */
export const BOARD_QUAD = 3
export const BOARD_FLOOR = 3
export const BOARD_SCREEN_LOCAL: Vec2 = [38.5, 20]
