import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../sim/rng'
import { Ring } from './history'
import { createFactoryStore, overlaysFor } from './store'

describe('Ring', () => {
  it('returns values oldest to newest and wraps', () => {
    const r = new Ring(3)
    r.push(1)
    r.push(2)
    expect(r.values()).toEqual([1, 2])
    r.push(3)
    r.push(4)
    expect(r.values()).toEqual([2, 3, 4])
    expect(r.length).toBe(3)
  })
})

describe('factory store', () => {
  const make = () => createFactoryStore(mulberry32(3))

  it('tick advances sim and appends history', () => {
    const store = make()
    store.getState().tick()
    store.getState().tick()
    const s = store.getState()
    expect(s.sim.t).toBe(2)
    expect(s.history.t.values()).toEqual([0, 1, 2])
    expect(s.history.tools.get('ETCH-03')!.length).toBe(3)
    expect(s.historyVersion).toBe(2)
  })

  it('drills site → block → floor with a default overlay', () => {
    const store = make()
    store.getState().openBlock('fab')
    expect(store.getState().view).toMatchObject({ level: 'block', block: 'fab', floor: null })
    store.getState().openFloor('fab', 2)
    expect(store.getState().view).toMatchObject({ level: 'floor', floor: 2, overlay: 'status' })
    store.getState().goSite()
    expect(store.getState().view).toMatchObject({ level: 'site', block: null, selection: null })
  })

  it('select drills to the asset floor', () => {
    const store = make()
    store.getState().select({ kind: 'tool', id: 'ETCH-03' })
    expect(store.getState().view).toMatchObject({ level: 'floor', block: 'fab', floor: 2 })
    store.getState().select({ kind: 'rack', id: 'R3-02B' })
    expect(store.getState().view).toMatchObject({ block: 'warehouse', floor: 3, overlay: 'stock' })
    store.getState().select({ kind: 'kpiBoard' })
    expect(store.getState().view).toMatchObject({ block: 'office', floor: 3 })
    store.getState().select(null)
    expect(store.getState().view.selection).toBeNull()
  })

  it('starts scenarios and derives alarms', () => {
    const store = make()
    store.getState().startScenario('toolDown')
    store.getState().tick()
    expect(store.getState().alarms.some(a => a.source === 'ETCH-03')).toBe(true)
    store.getState().normalDay()
    expect(store.getState().sim.scenarios).toHaveLength(0)
    expect(store.getState().alarms).toHaveLength(0)
  })

  it('lists overlays per floor', () => {
    expect(overlaysFor('fab', 2)).toContain('particles')
    expect(overlaysFor('fab', 1)).toEqual([])
    expect(overlaysFor('warehouse', 2)).toEqual(['stock'])
  })
})
