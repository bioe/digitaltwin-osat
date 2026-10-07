import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { FLOOR_Y, OHT_Y } from './layout/layout'
import { pathAt } from './layout/path'
import { world } from './sim/world'

export type Sel =
  | { kind: 'tool'; id: string }
  | { kind: 'stocker'; id: string }
  | { kind: 'oht'; id: string }
  | { kind: 'arv'; id: string }
  | { kind: 'tech'; id: string }
  | { kind: 'zone'; id: string }
  | null

export interface FlyTarget {
  target: [number, number, number]
  /** Camera offset from the target. */
  offset: [number, number, number]
  key: number
}

interface UI {
  sel: Sel
  fly: FlyTarget | null
  warRoom: boolean
  layers: { oht: boolean; conv: boolean; arv: boolean; labels: boolean; people: boolean }
  /** Auto-rotate the building. */
  spin: boolean
  /** Pending camera orbit step (radians). */
  orbitReq: { az: number; pol: number; key: number } | null
  orbit: (az: number, pol?: number) => void
  toggleSpin: () => void
  select: (s: Sel, focus?: boolean) => void
  flyTo: (target: [number, number, number], dist?: number) => void
  setWarRoom: (v: boolean) => void
  toggle: (k: keyof UI['layers']) => void
}

export const useUI = create<UI>(set => ({
  sel: null,
  fly: null,
  warRoom: false,
  layers: { oht: true, conv: true, arv: true, labels: true, people: true },
  spin: false,
  orbitReq: null,
  orbit: (az, pol = 0) => set({ orbitReq: { az, pol, key: Math.random() } }),
  toggleSpin: () => set(s => ({ spin: !s.spin })),
  select: (sel, focus) => {
    set({ sel })
    if (sel && isMoving(sel)) focus = true
    if (focus && sel) {
      const p = worldPos(sel)
      if (p) set({ fly: { target: p, offset: [6, 9.5, 10 * side(p[2])], key: Math.random() } })
    }
  },
  flyTo: (t, dist = 1) =>
    set({ fly: { target: [t[0], t[1] + FLOOR_Y, t[2]], offset: [18 * dist, Math.max(13, 42 * dist), 32 * dist * side(t[2])], key: Math.random() } }),
  setWarRoom: warRoom => set({ warRoom }),
  toggle: k => set(s => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
}))

/** Look at each row from the outside wall, so the central mezzanine never blocks the view. */
function side(z: number) {
  return z < -3 ? -1 : 1
}

/** Vehicles and people: the camera follows them while selected. */
export function isMoving(sel: NonNullable<Sel>) {
  return sel.kind === 'oht' || sel.kind === 'arv' || sel.kind === 'tech'
}

/** Position in world space (the factory floor sits at FLOOR_Y). */
export function worldPos(sel: NonNullable<Sel>): [number, number, number] | null {
  const p = positionOf(sel)
  return p ? [p[0], p[1] + FLOOR_Y, p[2]] : null
}

/** Position on the factory floor (local to the level-3 group). */
export function positionOf(sel: NonNullable<Sel>): [number, number, number] | null {
  switch (sel.kind) {
    case 'tool': {
      const t = world.toolById.get(sel.id)
      return t ? [t.pos[0], 1, t.pos[2]] : null
    }
    case 'stocker': {
      const s = world.stockers.find(x => x.id === sel.id)
      return s ? [s.pos[0], 1.5, s.pos[2]] : null
    }
    case 'arv': {
      const a = world.arvs.find(x => x.id === sel.id)
      return a ? [a.pos[0], 0.5, a.pos[1]] : null
    }
    case 'tech': {
      const k = [...world.techs, ...world.operators].find(x => x.id === sel.id)
      return k ? [k.pos[0], 1, k.pos[1]] : null
    }
    case 'zone': {
      const z = world.L.zones.find(x => x.proc.id === sel.id)
      return z ? [(z.x0 + z.x1) / 2, 0, z.aisleZ] : null
    }
    case 'oht': {
      const v = world.oht.find(x => x.id === sel.id)
      if (!v) return null
      const q = pathAt(world.L.loops.OHT, v.s).p
      return [q[0], OHT_Y - 0.6, q[1]]
    }
  }
}

/** Re-render the calling component at the given rate while the world ticks. */
export function useTick(hz = 4) {
  const [, set] = useState(0)
  useEffect(() => {
    const id = setInterval(() => set(v => v + 1), 1000 / hz)
    return () => clearInterval(id)
  }, [hz])
  return world
}

if (import.meta.env.DEV) (window as unknown as { __ui: typeof useUI }).__ui = useUI
