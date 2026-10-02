import { FOUP_SPEED, TOOL_SIZE, TRACK, TRACK_HEIGHT, toolLocal } from '../layout/fab'
import { BOARD_FLOOR, BOARD_SCREEN_LOCAL, quadLocal } from '../layout/office'
import { BLOCKS, blockHeight, floorBase, toWorld, type BlockId } from '../layout/site'
import { AGV_SPEED, agvRoute, rackLocal } from '../layout/warehouse'
import type { FactoryState } from '../sim/model'
import type { Selection, View } from '../store/store'

export type Vec3 = [number, number, number]

/** Floor surface height (slab top) for a block floor. */
export const SLAB = 0.4
export const floorY = (block: BlockId, floor: number) => floorBase(block, floor) + SLAB

/**
 * World position of a selected asset. `elapsed` (seconds since last tick)
 * extrapolates moving assets so they stay smooth between ticks.
 */
export function selectionWorldPos(sel: Selection, sim: FactoryState, elapsed = 0): Vec3 | null {
  switch (sel.kind) {
    case 'tool': {
      const t = sim.tools.find(x => x.id === sel.id)
      if (!t) return null
      const [x, z] = toWorld('fab', toolLocal(t.bay, t.slot))
      return [x, floorY('fab', 2) + TOOL_SIZE[1] / 2, z]
    }
    case 'foup': {
      const f = sim.foups[sel.index]
      if (!f) return null
      const [x, z] = toWorld('fab', TRACK.at(f.s + FOUP_SPEED * elapsed))
      return [x, floorY('fab', 2) + TRACK_HEIGHT - 1, z]
    }
    case 'rack': {
      const r = sim.racks.find(x => x.id === sel.id)
      if (!r) return null
      const [x, z] = toWorld('warehouse', rackLocal(r.row, r.col))
      return [x, floorY('warehouse', r.floor) + 2.25, z]
    }
    case 'agv': {
      const v = sim.agvs.find(x => x.id === sel.id)
      if (!v) return null
      const route = agvRoute(v.index, v.row, v.col)
      const s = v.charging ? v.s : v.s + v.dir * AGV_SPEED * elapsed
      const [x, z] = toWorld('warehouse', route.at(s))
      return [x, floorY('warehouse', 1) + 0.6, z]
    }
    case 'zone': {
      const zone = sim.office.find(x => x.id === sel.id)
      if (!zone) return null
      const [x, z] = toWorld('office', quadLocal(zone.quad))
      return [x, floorY('office', zone.floor) + 0.5, z]
    }
    case 'kpiBoard': {
      const [x, z] = toWorld('office', BOARD_SCREEN_LOCAL)
      return [x, floorY('office', BOARD_FLOOR) + 3, z]
    }
  }
}

export interface CameraGoal {
  pos: Vec3
  target: Vec3
}

export const SITE_GOAL: CameraGoal = { pos: [420, 470, 640], target: [0, 0, 0] }

/** Extra vertical gap between floors when a block is "exploded" for floor picking. */
export const explodeGap = (block: BlockId) => (block === 'fab' ? 16 : 10)

/**
 * Shift a goal sideways (along camera-right) so the subject sits in the part of
 * the screen that the right-hand detail panel does not cover.
 */
function besidePanel({ pos, target }: CameraGoal, k = 0.13): CameraGoal {
  const f = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]]
  const dist = Math.hypot(f[0], f[1], f[2])
  // right = forward × up, projected on the ground plane
  const rx = -f[2]
  const rz = f[0]
  const rl = Math.hypot(rx, rz) || 1
  const dx = (rx / rl) * dist * k
  const dz = (rz / rl) * dist * k
  return {
    pos: [pos[0] + dx, pos[1], pos[2] + dz],
    target: [target[0] + dx, target[1], target[2] + dz],
  }
}

function rawGoal(view: View, sim: FactoryState): CameraGoal {
  if (view.selection) {
    const p = selectionWorldPos(view.selection, sim)
    if (p) {
      // The KPI screen faces west, so look at it from the west.
      if (view.selection.kind === 'kpiBoard') return { target: p, pos: [p[0] - 30, p[1] + 10, p[2] + 6] }
      const far = view.selection.kind === 'zone' ? 2.2 : view.selection.kind === 'rack' ? 1.6 : 1.4
      return { target: p, pos: [p[0] + 40 * far, p[1] + 48 * far, p[2] + 60 * far] }
    }
  }
  if (!view.block) return SITE_GOAL
  const { center, size } = BLOCKS[view.block]
  const [cx, cz] = center
  const span = Math.max(size[0], size[1])
  if (view.level === 'block' || !view.floor) {
    const d = span * 1.6 + 60
    const h = (blockHeight(view.block) + explodeGap(view.block) * 2) / 2
    return { target: [cx, h, cz], pos: [cx + d * 0.5, h + d * 0.45, cz + d * 0.9] }
  }
  const y = floorY(view.block, view.floor)
  const d = span * 1.15 + 30
  return { target: [cx, y, cz + span * 0.05], pos: [cx + d * 0.3, y + d * 0.85, cz + d * 0.75] }
}

export function cameraGoal(view: View, sim: FactoryState): CameraGoal {
  const g = rawGoal(view, sim)
  return view.selection?.kind === 'kpiBoard' ? g : besidePanel(g)
}
