import { useEffect } from 'react'
import { createStore, useStore } from 'zustand'
import type { BlockId } from '../layout/site'
import { deriveAlarms, type Alarm } from '../sim/alarms'
import type { FactoryState, Rng, ScenarioId } from '../sim/model'
import { normalDay, startScenario } from '../sim/scenarios'
import { createInitialState } from '../sim/seed'
import { advance } from '../sim/tick'
import { History } from './history'

export type Level = 'site' | 'block' | 'floor'

export type Overlay =
  | 'none'
  | 'status'
  | 'particles'
  | 'temp'
  | 'humidity'
  | 'occupancy'
  | 'energy'
  | 'officeTemp'
  | 'stock'

export type Selection =
  | { kind: 'tool'; id: string }
  | { kind: 'foup'; index: number }
  | { kind: 'rack'; id: string }
  | { kind: 'agv'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'kpiBoard' }

export interface View {
  level: Level
  block: BlockId | null
  floor: number | null
  selection: Selection | null
  overlay: Overlay
}

export function overlaysFor(block: BlockId | null, floor: number | null): Overlay[] {
  if (block === 'fab' && floor === 2) return ['status', 'particles', 'temp', 'humidity']
  if (block === 'office' && floor) return ['occupancy', 'energy', 'officeTemp']
  if (block === 'warehouse' && floor) return ['stock']
  return []
}

const defaultOverlay = (block: BlockId | null, floor: number | null): Overlay => overlaysFor(block, floor)[0] ?? 'none'

/** Block and floor that hold a selected asset. */
export function selectionLocation(sel: Selection, sim: FactoryState): { block: BlockId; floor: number } {
  switch (sel.kind) {
    case 'tool':
    case 'foup':
      return { block: 'fab', floor: 2 }
    case 'rack':
      return { block: 'warehouse', floor: sim.racks.find(r => r.id === sel.id)?.floor ?? 1 }
    case 'agv':
      return { block: 'warehouse', floor: 1 }
    case 'zone':
      return { block: 'office', floor: sim.office.find(z => z.id === sel.id)?.floor ?? 1 }
    case 'kpiBoard':
      return { block: 'office', floor: 3 }
  }
}

export interface FactoryStore {
  sim: FactoryState
  alarms: Alarm[]
  history: History
  /** Bumped on every tick so chart components re-read history. */
  historyVersion: number
  /** performance.now() of the last tick, for motion interpolation. */
  lastTickAt: number
  view: View
  tick(dt?: number): void
  goSite(): void
  openBlock(block: BlockId): void
  openFloor(block: BlockId, floor: number): void
  select(sel: Selection | null): void
  setOverlay(overlay: Overlay): void
  startScenario(id: ScenarioId): void
  normalDay(): void
}

const now = () => (typeof performance === 'undefined' ? 0 : performance.now())

export function createFactoryStore(rng: Rng = Math.random) {
  const sim = createInitialState()
  const history = new History()
  history.record(sim)

  return createStore<FactoryStore>()((set, get) => {
    const setSim = (next: FactoryState) => set({ sim: next, alarms: deriveAlarms(next) })

    return {
      sim,
      alarms: deriveAlarms(sim),
      history,
      historyVersion: 0,
      lastTickAt: now(),
      view: { level: 'site', block: null, floor: null, selection: null, overlay: 'none' },

      tick(dt = 1) {
        const next = advance(get().sim, dt, rng)
        get().history.record(next)
        setSim(next)
        set(s => ({ historyVersion: s.historyVersion + 1, lastTickAt: now() }))
      },
      goSite() {
        set({ view: { level: 'site', block: null, floor: null, selection: null, overlay: 'none' } })
      },
      openBlock(block) {
        set({ view: { level: 'block', block, floor: null, selection: null, overlay: 'none' } })
      },
      openFloor(block, floor) {
        set({ view: { level: 'floor', block, floor, selection: null, overlay: defaultOverlay(block, floor) } })
      },
      select(sel) {
        if (!sel) return set(s => ({ view: { ...s.view, selection: null } }))
        const { block, floor } = selectionLocation(sel, get().sim)
        set(s => {
          const sameFloor = s.view.block === block && s.view.floor === floor
          const overlay = sameFloor ? s.view.overlay : defaultOverlay(block, floor)
          return { view: { level: 'floor', block, floor, selection: sel, overlay } }
        })
      },
      setOverlay(overlay) {
        set(s => ({ view: { ...s.view, overlay } }))
      },
      startScenario(id) {
        setSim(startScenario(get().sim, id))
      },
      normalDay() {
        setSim(normalDay(get().sim))
      },
    }
  })
}

export const factoryStore = createFactoryStore()

export function useFactory<T>(selector: (s: FactoryStore) => T): T {
  return useStore(factoryStore, selector)
}

/** Runs the 1 s sim loop. Pauses while the tab is hidden; no catch-up on return. */
export function useSimLoop() {
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) factoryStore.getState().tick(1)
    }, 1000)
    return () => clearInterval(id)
  }, [])
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __store: typeof factoryStore }).__store = factoryStore
}
