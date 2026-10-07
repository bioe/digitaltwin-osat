import { AISLE_N, AISLE_S, layout } from './layout'
import { project } from './path'
import type { Vec3 } from '../models/dsl'

export interface LiftSpot {
  x: number
  z: number
  rot: number
  port: Vec3
}

let cache: LiftSpot[] | null = null

/**
 * Overhead-conveyor drop lifts: one column per conveyor station (tool or stocker port on the
 * conveyor loop). The column stands 0.45 m on the aisle side of its port, carriage facing the port.
 * Shared by the renderer, the people routing and the tour collisions so they always agree.
 */
export function liftSpots(): LiftSpot[] {
  if (cache) return cache
  const L = layout()
  const loop = L.loops.CONV
  const list: LiftSpot[] = []
  const seen = new Set<string>()
  const add = (p: Vec3) => {
    if (project(loop, [p[0], p[2]]).dist > 0.6) return
    const key = `${p[0].toFixed(2)},${p[2].toFixed(2)}`
    if (seen.has(key)) return
    seen.add(key)
    const aisle = p[2] < 0 ? AISLE_N : AISLE_S
    const dir = Math.sign(aisle - p[2]) || 1
    list.push({ x: p[0] + 0.35, z: p[2] + dir * 0.45, rot: dir > 0 ? Math.PI : 0, port: p })
  }
  for (const t of L.tools) if (!t.aux && (t.proc === 'wb' || t.proc === 'mold' || t.proc === 'mark')) t.ports.forEach(add)
  for (const s of L.stockers) s.ports.forEach(add)
  cache = list
  return list
}
