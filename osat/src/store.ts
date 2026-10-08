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
  | { kind: 'truck'; id: string }
  | { kind: 'ship'; id: string }
  | null

export interface FlyTarget {
  target: [number, number, number]
  /** Camera offset from the target. */
  offset: [number, number, number]
  key: number
}

export interface Layers {
  /** Status rings per state. */
  run: boolean
  idle: boolean
  down: boolean
  ai: boolean
  oht: boolean
  conv: boolean
  arv: boolean
  people: boolean
  /** Glowing material-flow overlay on the transport tracks. */
  flow: boolean
  /** Animated product route through the process rooms. */
  route: boolean
  labels: boolean
  callouts: boolean
  walls: boolean
  site: boolean
  floors: boolean
}

interface UI {
  sel: Sel
  fly: FlyTarget | null
  warRoom: boolean
  /** What-if analysis page. */
  analysis: boolean
  layers: Layers
  /** Auto-rotate the building. */
  spin: boolean
  /** Lighting: fixed day, fixed night, or an automatic compressed day/night cycle. */
  dayMode: 'day' | 'night' | 'auto'
  setDayMode: (m: 'day' | 'night' | 'auto') => void
  /** First-person walking tour of the production floor. */
  tour: boolean
  setTour: (v: boolean) => void
  /** 3D-only mode: side panels and header hidden, details shown as a popup. */
  focus: boolean
  toggleFocus: () => void
  /** Pending camera orbit step (radians). */
  orbitReq: { az: number; pol: number; key: number } | null
  orbit: (az: number, pol?: number) => void
  toggleSpin: () => void
  select: (s: Sel, focus?: boolean) => void
  flyTo: (target: [number, number, number], dist?: number) => void
  setWarRoom: (v: boolean) => void
  setAnalysis: (v: boolean) => void
  toggle: (k: keyof UI['layers']) => void
}

/** Browser fullscreen on/off (Esc in the browser exits it, see App). */
function setBrowserFullscreen(on: boolean) {
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
  if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
}

export const useUI = create<UI>(set => ({
  sel: null,
  fly: null,
  warRoom: false,
  analysis: false,
  layers: {
    run: true, idle: true, down: true, ai: true,
    oht: true, conv: true, arv: true, people: true,
    flow: false, route: true, labels: true, callouts: true,
    walls: true, site: true, floors: true,
  },
  spin: false,
  focus: false,
  tour: false,
  // Tour and Fullscreen are separate, mutually exclusive modes. The tour uses the same
  // full-window layout (+ browser fullscreen); leaving it always returns to the normal layout.
  setTour: tour => {
    if (tour === useUI.getState().tour) return
    set({ tour, focus: tour, sel: null })
    setBrowserFullscreen(tour)
  },
  dayMode: 'day',
  setDayMode: dayMode => set({ dayMode }),
  toggleFocus: () => {
    // fullscreen while touring means "leave the tour"
    if (useUI.getState().tour) return useUI.getState().setTour(false)
    const next = !useUI.getState().focus
    set({ focus: next })
    setBrowserFullscreen(next)
  },
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
  setWarRoom: warRoom => set({ warRoom, analysis: false }),
  setAnalysis: analysis => set({ analysis, warRoom: false }),
  toggle: k => set(s => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
}))

/** Look at each row from the outside wall, so the central mezzanine never blocks the view. */
function side(z: number) {
  return z < -3 ? -1 : 1
}

/** Vehicles and people: the camera follows them while selected. */
export function isMoving(sel: NonNullable<Sel>) {
  return sel.kind === 'oht' || sel.kind === 'arv' || sel.kind === 'tech' || sel.kind === 'truck'
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
    case 'truck': {
      // trucks drive at ground level: local to the level-3 group that is FLOOR_Y below
      const t = world.shipping.truck
      return t && t.id === sel.id ? [t.pos[0], 1.8 - FLOOR_Y, t.pos[1]] : null
    }
    case 'ship': {
      if (sel.id === 'TRUCK' && world.shipping.truck) return positionOf({ kind: 'truck', id: world.shipping.truck.id })
      return world.shipUnits().find(u => u.id === sel.id)?.pos ?? null
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
