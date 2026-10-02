import { ENV_COLS } from '../layout/fab'
import type { BlockId } from '../layout/site'
import type { Category, FactoryState, ScenarioId } from './model'
import { createInitialState } from './seed'

/** Effects that active scenarios impose on one tick. */
export interface Fx {
  downTools: string[]
  particleCells: number[]
  drainCategory: Category | null
  /** 0–1 ramp of extra office HVAC load. */
  hvacBoost: number
}

export interface ScenarioDef {
  id: ScenarioId
  name: string
  description: string
  block: BlockId
  /** Seconds before the scenario ends and the plant recovers by itself. */
  duration: number
  fx(elapsed: number): Partial<Fx>
}

const spikeCenter = 3 * ENV_COLS + 7
const SPIKE_CELLS = [spikeCenter, spikeCenter - 1, spikeCenter + 1, spikeCenter - ENV_COLS, spikeCenter + ENV_COLS]

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  toolDown: {
    id: 'toolDown',
    name: 'Tool down',
    description: 'ETCH-03 RF generator fault. Etch queue grows, OEE drops.',
    block: 'fab',
    duration: 90,
    fx: () => ({ downTools: ['ETCH-03'] }),
  },
  particleSpike: {
    id: 'particleSpike',
    name: 'Particle spike',
    description: 'Filter breach near bay D. Particle count exceeds ISO 4 limit.',
    block: 'fab',
    duration: 75,
    fx: () => ({ particleCells: SPIKE_CELLS }),
  },
  lowStock: {
    id: 'lowStock',
    name: 'Low chemical stock',
    description: 'High chemical use. Stock falls below reorder level until delivery.',
    block: 'warehouse',
    duration: 90,
    fx: () => ({ drainCategory: 'Chemicals' }),
  },
  hvacPeak: {
    id: 'hvacPeak',
    name: 'Office HVAC peak',
    description: 'Afternoon heat. Office cooling load and temperature rise.',
    block: 'office',
    duration: 60,
    fx: elapsed => ({ hvacBoost: Math.min(1, elapsed / 15) }),
  },
}

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[]

export function activeFx(state: FactoryState): Fx {
  const fx: Fx = { downTools: [], particleCells: [], drainCategory: null, hvacBoost: 0 }
  for (const a of state.scenarios) {
    const p = SCENARIOS[a.id].fx(state.t - a.startedAt)
    if (p.downTools) fx.downTools.push(...p.downTools)
    if (p.particleCells) fx.particleCells.push(...p.particleCells)
    if (p.drainCategory) fx.drainCategory = p.drainCategory
    if (p.hvacBoost) fx.hvacBoost = Math.max(fx.hvacBoost, p.hvacBoost)
  }
  return fx
}

/** Start (or restart) a scenario. Other active scenarios keep running. */
export function startScenario(state: FactoryState, id: ScenarioId): FactoryState {
  return {
    ...state,
    scenarios: [...state.scenarios.filter(s => s.id !== id), { id, startedAt: state.t }],
  }
}

/** Remove scenarios whose duration has passed. */
export function expireScenarios(state: FactoryState): FactoryState {
  const live = state.scenarios.filter(a => state.t - a.startedAt < SCENARIOS[a.id].duration)
  return live.length === state.scenarios.length ? state : { ...state, scenarios: live }
}

/** Stop all scenarios and reset to baseline. Sim time keeps going. */
export function normalDay(state: FactoryState): FactoryState {
  return { ...createInitialState(), t: state.t, safetyDays: state.safetyDays }
}
