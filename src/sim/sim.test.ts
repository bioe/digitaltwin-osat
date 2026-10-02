import { describe, expect, it } from 'vitest'
import { TRACK } from '../layout/fab'
import { deriveAlarms } from './alarms'
import { inventoryByCategory } from './inventory'
import { LOT_COUNT, type FactoryState } from './model'
import { mulberry32 } from './rng'
import { SCENARIOS, normalDay, startScenario } from './scenarios'
import { createInitialState } from './seed'
import { advance } from './tick'

function run(state: FactoryState, ticks: number, seed = 7): FactoryState {
  const rng = mulberry32(seed)
  for (let i = 0; i < ticks; i++) state = advance(state, 1, rng)
  return state
}

const officeKw = (s: FactoryState) => s.office.reduce((a, z) => a + z.kw, 0)

describe('seed', () => {
  const s = createInitialState()

  it('creates the planned asset counts', () => {
    expect(s.tools).toHaveLength(200)
    expect(new Set(s.tools.map(t => t.id)).size).toBe(200)
    expect(s.lots).toHaveLength(LOT_COUNT)
    expect(s.foups).toHaveLength(150)
    expect(s.racks).toHaveLength(120)
    expect(s.agvs).toHaveLength(8)
    expect(s.office).toHaveLength(12)
    expect(s.env).toHaveLength(96)
  })

  it('names tools <TYPE>-<NN>', () => {
    for (const t of s.tools) expect(t.id).toMatch(/^[A-Z]+-\d{2}$/)
    expect(s.tools.find(t => t.id === 'ETCH-03')?.type).toBe('ETCH')
  })

  it('is deterministic for the baseline seed', () => {
    expect(createInitialState()).toEqual(s)
  })

  it('has one board room on L3', () => {
    expect(s.office.filter(z => z.kind === 'board').map(z => z.id)).toEqual(['O-L3-D'])
  })
})

describe('tick invariants', () => {
  it('keeps every value in range for 10 minutes', () => {
    const rng = mulberry32(1)
    let s = createInitialState()
    for (let i = 0; i < 600; i++) {
      s = advance(s, 1, rng)
      for (const r of s.racks) {
        expect(r.stock).toBeGreaterThanOrEqual(0)
        expect(r.stock).toBeLessThanOrEqual(r.capacity)
      }
      for (const v of s.agvs) {
        expect(v.battery).toBeGreaterThanOrEqual(0)
        expect(v.battery).toBeLessThanOrEqual(100)
      }
      for (const f of s.foups) {
        expect(f.s).toBeGreaterThanOrEqual(0)
        expect(f.s).toBeLessThan(TRACK.length)
      }
      for (const t of s.tools) expect(t.oee).toBeGreaterThanOrEqual(0)
      expect(s.kpi.yield).toBeGreaterThan(0)
      expect(s.kpi.yield).toBeLessThanOrEqual(100)
      expect(s.kpi.oee).toBeLessThanOrEqual(100)
      expect(s.lots).toHaveLength(LOT_COUNT)
    }
    expect(s.t).toBe(600)
    // No scripted events: no tool goes down by itself.
    expect(s.tools.some(t => t.status === 'down')).toBe(false)
  })

  it('keeps output near nominal on a normal day', () => {
    const s = run(createInitialState(), 300)
    expect(s.kpi.wafersOutPerHour).toBeGreaterThan(120)
    expect(s.kpi.wafersOutPerHour).toBeLessThan(200)
  })
})

describe('scenarios', () => {
  const warm = run(createInitialState(), 30)

  it('toolDown: ETCH-03 goes down, queue grows, OEE drops, alarm shows, then recovers', () => {
    const base = warm.tools.find(t => t.id === 'ETCH-03')!
    const s = run(startScenario(warm, 'toolDown'), 30)
    const tool = s.tools.find(t => t.id === 'ETCH-03')!
    expect(tool.status).toBe('down')
    expect(tool.queue).toBeGreaterThan(base.queue + 5)
    expect(tool.oee).toBeLessThan(base.oee - 40)
    expect(deriveAlarms(s).some(a => a.source === 'ETCH-03')).toBe(true)

    const after = run(s, SCENARIOS.toolDown.duration)
    expect(after.scenarios).toHaveLength(0)
    expect(after.tools.find(t => t.id === 'ETCH-03')!.status).toBe('run')
  })

  it('particleSpike: a cell exceeds the limit and raises an alarm', () => {
    const s = run(startScenario(warm, 'particleSpike'), 30)
    expect(Math.max(...s.env.map(c => c.particles))).toBeGreaterThan(100)
    expect(deriveAlarms(s).some(a => a.key === 'particles')).toBe(true)
    expect(s.kpi.yield).toBeLessThan(warm.kpi.yield)
  })

  it('lowStock: chemicals fall below reorder level and warn', () => {
    const s = run(startScenario(warm, 'lowStock'), 40)
    expect(inventoryByCategory(s.racks).find(c => c.category === 'Chemicals')!.low).toBe(true)
    expect(deriveAlarms(s).some(a => a.key === 'stock-Chemicals')).toBe(true)
    const after = run(s, 200)
    expect(inventoryByCategory(after.racks).find(c => c.category === 'Chemicals')!.low).toBe(false)
  })

  it('hvacPeak: office load and temperature rise', () => {
    const s = run(startScenario(warm, 'hvacPeak'), 30)
    expect(officeKw(s)).toBeGreaterThan(officeKw(warm) * 1.2)
    expect(deriveAlarms(s).some(a => a.block === 'office')).toBe(true)
  })

  it('runs two scenarios at once', () => {
    const s = run(startScenario(startScenario(warm, 'toolDown'), 'hvacPeak'), 20)
    expect(s.scenarios.map(a => a.id).sort()).toEqual(['hvacPeak', 'toolDown'])
    expect(s.tools.find(t => t.id === 'ETCH-03')!.status).toBe('down')
    expect(officeKw(s)).toBeGreaterThan(officeKw(warm))
  })

  it('normalDay clears scenarios and keeps sim time', () => {
    const s = run(startScenario(warm, 'toolDown'), 10)
    const reset = normalDay(s)
    expect(reset.scenarios).toHaveLength(0)
    expect(reset.t).toBe(s.t)
    expect(reset.tools.some(t => t.status === 'down')).toBe(false)
  })
})
