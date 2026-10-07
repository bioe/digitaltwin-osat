import { PROCESSES, type ProcId, type ProcessDef } from '../data/processes'
import { bake, type Vec3 } from '../models/dsl'
import { MODELS } from '../models'
import { makePath, roundCorners, type P2, type Path } from './path'

/**
 * Floor plan (1 unit = 1 m, x = east, z = south). Every process is a walled
 * room; stocker bays sit between rooms and the OHT / conveyor / ARV routes run
 * through them from room to room.
 *
 *   North row (aisle z = -9), flow west → east:
 *     S0 | Sort | S1 | Grind | S2 | Saw | S3 | DA | S4 | WB  ─┐
 *                                                             S5 (east corridor)
 *   South row (aisle z = +9), flow east → west:              │
 *     S11 | T&R | S10 | FVI | S9 | Test | S8 | PSaw | S7 | Mark | S6 | Mold ─┘
 *
 *   Central corridor: ARV chargers and walkways; the war room sits on a
 *   mezzanine above the corridor centre.
 */

export const AISLE_N = -9
export const AISLE_S = 9
/** Aisle half width (clear walkway between tool fronts). */
export const AISLE_HALF = 1.7
/** OHT / conveyor lane offset from the aisle centre (above the load ports). */
export const LANE_OFF = 1.45
export const GAP = 7
export const AUX_W = 4
export const X0 = -80
/** The production floor is level 3: two 6 m storeys below it. */
export const FLOOR_Y = 12
export const OHT_Y = 4.0
export const CONV_Y = 2.75
/** Room partition height (rails and conveyors pass above it). */
export const WALL_H = 2.5
/** Room wall offset from the aisle centre. */
export const ROOM_HALF = 5.3
/** Mezzanine floor level of the war room. */
export const MEZZ_Y = 4.7
/** Corridor centre line for ARVs; with keep-right (±ARV_KEEP) the two lanes sit at 1.65 / 2.45 m. */
export const ARV_LANE = 2.05
/** Keep-right offset for ARVs (lane separation 0.8 m, ARV width 0.75 m). */
export const ARV_KEEP = 0.4
/** Keep-right offset for people: they walk at the aisle edge, outside the ARV lanes. */
export const WALK_KEEP = 1.1

export type Row = 'north' | 'south'

export interface ToolPlace {
  id: string
  proc: ProcId
  aux: boolean
  model: string
  name: string
  pos: Vec3
  rotY: number
  ports: Vec3[]
  /** Which aisle side: -1 = north of aisle centre, +1 = south. */
  side: -1 | 1
  size: Vec3
  inPort: Vec3
  outPort: Vec3
}

/** [input port index, output port index] where it differs from [first, last]. */
export const PORT_IO: Record<string, [number, number]> = { dieBonder: [2, 1] }

function ioOf(model: string, n: number): [number, number] {
  return PORT_IO[model] ?? [0, Math.max(0, n - 1)]
}

export interface StockerPlace {
  id: string
  idx: number
  name: string
  model: string
  pos: Vec3
  rotY: number
  ports: Vec3[]
  size: Vec3
  capacity: number
}

export interface ZonePlace {
  proc: ProcessDef
  row: Row
  x0: number
  x1: number
  aisleZ: number
  z0: number
  z1: number
}

export interface Layout {
  zones: ZonePlace[]
  tools: ToolPlace[]
  stockers: StockerPlace[]
  loops: Record<'OHT' | 'CONV', Path>
  /** Corridor crossing points (x) per row, used by ARVs and people. */
  crossX: Record<Row, number[]>
  chargers: { pos: P2; rotY: number }[]
  bounds: { x0: number; x1: number; z0: number; z1: number }
  warRoom: { x0: number; x1: number; z0: number; z1: number }
  /** Workbench spots (front part of each stocker bay), facing the bay centre. */
  benches: { pos: P2; rotY: number; row: Row }[]
  xEast: number
}

export function rotate(local: Vec3, rotY: number): Vec3 {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  return [local[0] * c + local[2] * s, local[1], -local[0] * s + local[2] * c]
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function portsOf(model: string) {
  return bake(MODELS[model]).ports
}

function build(): Layout {
  const zones: ZonePlace[] = []
  const tools: ToolPlace[] = []
  const stockers: StockerPlace[] = []
  const gapCenters: Record<Row, number[]> = { north: [], south: [] }


  function placeStocker(idx: number, gx: number, row: Row) {
    const model = idx <= 3 ? 'stockerWafer' : 'stockerMag'
    const def = MODELS[model]
    const local = portsOf(model)[0] ?? [0, 0.9, def.size[1] / 2 + 0.25]
    const aisle = row === 'north' ? AISLE_N : AISLE_S
    // stocker sits on the back side, its front faces the aisle, ports under the back lane
    const rotY = row === 'north' ? 0 : Math.PI
    const laneZ = row === 'north' ? aisle - LANE_OFF : aisle + LANE_OFF
    const z = row === 'north' ? laneZ - local[2] : laneZ + local[2]
    const pos: Vec3 = [gx, 0, z]
    stockers.push({
      id: `S${idx}`, idx, name: stockerName(idx), model, pos, rotY,
      ports: portsOf(model).map(p => add(pos, rotate(p, rotY))), size: def.size,
      capacity: idx <= 3 ? 120 : 160,
    })
  }

  function placeZone(p: ProcessDef, row: Row, xa: number, xb: number) {
    const aisle = row === 'north' ? AISLE_N : AISLE_S
    zones.push({ proc: p, row, x0: xa, x1: xb, aisleZ: aisle, z0: aisle - ROOM_HALF, z1: aisle + ROOM_HALF })
    const dir = row === 'north' ? 1 : -1 // flow direction along x
    const start = row === 'north' ? xa : xb
    const mainW = p.zoneW
    const pitch = mainW / p.perSide
    const def = MODELS[p.model]
    const mp = portsOf(p.model)
    const lp = mp[ioOf(p.model, mp.length)[0]] ?? [0, 1, def.size[1] / 2]
    let n = 0
    for (let k = 0; k < p.perSide && n < p.count; k++) {
      for (const side of [-1, 1] as const) {
        if (n >= p.count) break
        const x = start + dir * (pitch * (k + 0.5))
        tools.push(makeTool(`${p.short}-${String(n + 1).padStart(2, '0')}`, p, p.model, false, x, side, aisle, lp, def.size))
        n++
      }
    }
    if (p.aux) {
      const adef = MODELS[p.aux.model]
      const alp = portsOf(p.aux.model)[0] ?? [0, 1, adef.size[1] / 2]
      for (let i = 0; i < p.aux.count; i++) {
        const x = start + dir * (mainW + AUX_W / 2)
        const side = i % 2 === 0 ? -1 : 1
        const prefix = p.aux.model === 'cureOven' ? 'OVN' : p.aux.model === 'uvCurer' ? 'UV' : p.aux.model === 'trimForm' ? 'TF' : 'PLS'
        tools.push(makeTool(`${p.short}-${prefix}${i + 1}`, p, p.aux.model, true, x, side, aisle, alp, adef.size, p.aux.name))
      }
    }
  }

  function makeTool(id: string, p: ProcessDef, model: string, aux: boolean, x: number, side: -1 | 1, aisle: number, lp: Vec3, size: Vec3, name?: string): ToolPlace {
    // side -1: tool north of the aisle, front faces +z (rotY 0); side +1: faces -z (rotY π)
    const rotY = side === -1 ? 0 : Math.PI
    const laneZ = aisle + side * LANE_OFF
    let z: number
    if (p.mode === 'ARV' || aux) {
      z = aisle + side * (AISLE_HALF + size[1] / 2)
    } else {
      z = side === -1 ? laneZ - lp[2] : laneZ + lp[2]
      // never let the tool body intrude into the walkway by more than 0.4 m
      const front = side === -1 ? z + size[1] / 2 : z - size[1] / 2
      const limit = aisle + side * (AISLE_HALF - 0.4)
      if (side === -1 && front > limit) z -= front - limit
      if (side === 1 && front < limit) z += limit - front
    }
    const pos: Vec3 = [x, 0, z]
    const ports = portsOf(model).map(pp => add(pos, rotate(pp, rotY)))
    const [ii, oi] = ioOf(model, ports.length)
    const fallback: Vec3 = [x, 1, z]
    return {
      id, proc: p.id, aux, model, name: name ?? p.toolName, pos, rotY, side, size, ports,
      inPort: ports[ii] ?? fallback, outPort: ports[oi] ?? fallback,
    }
  }

  // ---- north row
  let x = X0
  const north = PROCESSES.slice(0, 5)
  north.forEach((p, i) => {
    gapCenters.north.push(x + GAP / 2)
    placeStocker(i, x + GAP / 2, 'north')
    x += GAP
    const w = p.zoneW + (p.aux ? AUX_W : 0)
    placeZone(p, 'north', x, x + w)
    x += w
  })
  const xEast = x

  // ---- south row (flow east → west)
  const south = PROCESSES.slice(5)
  south.forEach((p, i) => {
    const w = p.zoneW + (p.aux ? AUX_W : 0)
    placeZone(p, 'south', x - w, x)
    x -= w
    gapCenters.south.push(x - GAP / 2)
    placeStocker(6 + i, x - GAP / 2, 'south')
    x -= GAP
  })

  // ---- S5: east corridor, between WB and Mold, faces west
  const xV0 = xEast + 1.2
  const xV1 = xEast + 4.2
  {
    const model = 'stockerMag'
    const def = MODELS[model]
    const lp = portsOf(model)[0] ?? [0, 0.9, def.size[1] / 2 + 0.25]
    const rotY = -Math.PI / 2
    const pos: Vec3 = [xV1 + lp[2], 0, -lp[0] - 1.2]
    stockers.splice(5, 0, {
      id: 'S5', idx: 5, name: stockerName(5), model, pos, rotY, size: def.size, capacity: 160,
      ports: portsOf(model).map(p => add(pos, rotate(p, rotY))),
    })
  }
  stockers.sort((a, b) => a.idx - b.idx)

  // ---- OHT loop: S0 .. S4 (west port)
  const s4 = stockers[4]
  const s4w = s4.ports.reduce((a, b) => (b[0] < a[0] ? b : a))
  const s4e = s4.ports.reduce((a, b) => (b[0] > a[0] ? b : a))
  const ohtX0 = X0 - 0.2
  const ohtX1 = s4w[0] + 1.6
  const nB = AISLE_N - LANE_OFF
  const nF = AISLE_N + LANE_OFF
  const sB = AISLE_S + LANE_OFF
  const sF = AISLE_S - LANE_OFF
  const oht = makePath(
    roundCorners([[ohtX0, nB], [ohtX1, nB], [ohtX1, nF], [ohtX0, nF]], LANE_OFF, true, 8),
    true,
  )

  // ---- conveyor loop: S4 (east port) → WB → S5 → Mold → Mark → S7 (east port)
  const s7 = stockers[7]
  const s7e = s7.ports.reduce((a, b) => (b[0] > a[0] ? b : a))
  const cx0 = s4e[0] - 1.6
  const cx1 = s7e[0] - 1.6
  const conv = makePath(
    roundCorners(
      [[cx0, nB], [xV1, nB], [xV1, sB], [cx1, sB], [cx1, sF], [xV0, sF], [xV0, nF], [cx0, nF]],
      1.2,
      true,
      8,
    ),
    true,
  )

  const bounds = { x0: X0 - 3, x1: xEast + 8, z0: AISLE_N - ROOM_HALF - 1.2, z1: AISLE_S + ROOM_HALF + 1.2 }
  const cx = (bounds.x0 + bounds.x1) / 2
  // ARV docks along the corridor edge in front of the test rooms
  const chargers: Layout['chargers'] = []
  const wr0 = cx - 8
  // one dock per ARV; the fleet is right-sized to measured demand (ARVs are expensive)
  const ARV_FLEET = 8
  for (let i = 0; i < ARV_FLEET; i++) chargers.push({ pos: [wr0 - 2.5 - (ARV_FLEET - 1) * 1.6 + i * 1.6, 3.2], rotY: Math.PI })
  // workbenches in the front half of every stocker bay (beside the walkway)
  const benches: Layout['benches'] = []
  for (const row of ['north', 'south'] as const) {
    const aisle = row === 'north' ? AISLE_N : AISLE_S
    const zf = aisle + (row === 'north' ? 3.3 : -3.3)
    for (const gx of gapCenters[row]) {
      benches.push({ pos: [gx - 2.4, zf], rotY: row === 'north' ? Math.PI / 2 : -Math.PI / 2, row })
      benches.push({ pos: [gx + 2.4, zf], rotY: row === 'north' ? -Math.PI / 2 : Math.PI / 2, row })
    }
  }
  return {
    zones, tools, stockers, loops: { OHT: oht, CONV: conv },
    crossX: { north: gapCenters.north, south: gapCenters.south },
    chargers, bounds, benches,
    warRoom: { x0: cx - 8, x1: cx + 8, z0: -4.5, z1: 4.5 },
    xEast,
  }
}

export function stockerName(idx: number) {
  if (idx === 0) return 'Incoming wafer stocker'
  if (idx === 11) return 'Finished goods stocker'
  return `${PROCESSES[idx - 1].short} → ${PROCESSES[idx].short} stocker`
}

let cached: Layout | null = null
export function layout(): Layout {
  if (!cached) cached = build()
  return cached
}
