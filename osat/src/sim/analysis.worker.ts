import { DAILY_TARGET, PROCESSES } from '../data/processes'
import { pathAt } from '../layout/path'
import { BASE_CONFIG, World, type SimConfig } from './world'

/** One what-if run: settings, a fixed seed (common random numbers across runs), warm-up and measured steps. */
export interface RunRequest {
  id: string
  cfg: SimConfig
  seed: number
  warm: number
  steps: number
  /** Live mode: stream a frame + time-series point every `every` steps, paced to last about `wallMs`. */
  live?: { every: number; wallMs: number }
}

/** Averages over the measured window. */
export interface RunResult {
  id: string
  /** Line throughput as units/h: lot completions per step, scaled so today's release rate = plan. */
  uph: number
  /** Production tools idle for lack of material. */
  starved: number
  /** Share of time vehicles are busy (not free / parked / returning), %. */
  ohtUtil: number
  arvUtil: number
  /** Average move time, request → delivery, s. */
  ohtMove: number
  arvMove: number
  /** Share of production tools in alarm, %. */
  down: number
  /** Lots in stockers and on tools. */
  wip: number
}

export interface LivePoint {
  uph: number
  wip: number
  ohtUtil: number
  arvUtil: number
  starved: number
  down: number
}

/** A live sample: the moment's state for the mini map and one point for each live chart. */
export interface LiveTick {
  id: string
  /** 0..1 of the whole run (warm-up + measured). */
  progress: number
  /** Sim minutes since start. */
  min: number
  point: LivePoint
  /** Tool states in world.tools order: 0 run, 1 idle, 2 alarm, 3 AI recovery. */
  tools: number[]
  oht: [number, number][]
  arv: [number, number][]
  people: [number, number][]
}

export type WorkerOut = { type: 'result'; result: RunResult } | { type: 'tick'; tick: LiveTick }

/** Units per lot so that today's release rate (lots/h) maps to the daily plan per hour. */
const UNITS_PER_LOT = DAILY_TARGET / 24 / (3600 / BASE_CONFIG.takt)
const STEPS_IN_LINE = PROCESSES.length

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const isStarved = (reason: string) => /Waiting for material|Starved/.test(reason)

function wipOf(w: World, prod: World['tools']) {
  return w.stockers.reduce((a, s) => a + s.lots.length, 0) + prod.reduce((a, t) => a + (t.lot ? 1 : 0) + (t.next ? 1 : 0) + (t.out ? 1 : 0), 0)
}
function busyOht(w: World) {
  return w.oht.filter(v => v.phase !== 'free').length / Math.max(1, w.oht.length)
}
function busyArv(w: World) {
  return w.arvs.filter(a => a.phase !== 'parked' && a.phase !== 'toPark').length / Math.max(1, w.arvs.length)
}

async function run(req: RunRequest, post: (m: WorkerOut) => void) {
  const { id, cfg, seed, warm, steps, live } = req
  Math.random = mulberry32(seed)
  const w = new World(cfg, { lean: true })
  const prod = w.tools.filter(t => !t.aux)
  const total = warm + steps
  const started = performance.now()
  // rolling throughput for the live chart: completions over the last 2 sim-minutes
  const hist: { t: number; done: number }[] = []
  let done0 = 0
  let t0 = 0
  let n = 0
  let starved = 0
  let down = 0
  let wip = 0
  let ohtBusy = 0
  let arvBusy = 0
  for (let i = 0; i < total; i++) {
    w.step(0.1)
    if (i === warm - 1) {
      done0 = w.stepDone
      t0 = w.t
    }
    if (i >= warm && i % 10 === 0) {
      n++
      for (const t of prod) {
        if (t.state === 'alarm') down++
        else if (t.state === 'idle' && isStarved(t.reason)) starved++
      }
      wip += wipOf(w, prod)
      ohtBusy += busyOht(w)
      arvBusy += busyArv(w)
    }
    if (live && i % live.every === 0) {
      hist.push({ t: w.t, done: w.stepDone })
      while (hist.length > 2 && w.t - hist[0].t > 120) hist.shift()
      const span = w.t - hist[0].t
      const rate = span > 0 ? (((w.stepDone - hist[0].done) / STEPS_IN_LINE) * 3600) / span : 0
      post({
        type: 'tick',
        tick: {
          id,
          progress: (i + 1) / total,
          min: w.t / 60,
          point: {
            uph: rate * UNITS_PER_LOT,
            wip: wipOf(w, prod),
            ohtUtil: busyOht(w) * 100,
            arvUtil: busyArv(w) * 100,
            starved: prod.filter(t => t.state === 'idle' && isStarved(t.reason)).length,
            down: prod.filter(t => t.state === 'alarm').length,
          },
          tools: w.tools.map(t => (t.alarm?.ai ? 3 : t.state === 'alarm' ? 2 : t.state === 'idle' ? 1 : 0)),
          oht: w.oht.map(v => pathAt(w.L.loops.OHT, v.s).p as [number, number]),
          arv: w.arvs.map(a => [a.pos[0], a.pos[1]] as [number, number]),
          people: [...w.techs, ...w.operators].map(p => [p.pos[0], p.pos[1]] as [number, number]),
        },
      })
      // pace the run so the animation is watchable
      const wait = ((i + 1) / total) * live.wallMs - (performance.now() - started)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
    }
  }
  const recent = w.doneLog.filter(d => d.t >= t0)
  const avg = (mode: string) => {
    const l = recent.filter(d => d.mode === mode)
    return l.length ? l.reduce((a, d) => a + d.dur, 0) / l.length : 0
  }
  post({
    type: 'result',
    result: {
      id,
      uph: ((((w.stepDone - done0) / STEPS_IN_LINE) * 3600) / (w.t - t0)) * UNITS_PER_LOT,
      starved: starved / n,
      ohtUtil: (ohtBusy / n) * 100,
      arvUtil: (arvBusy / n) * 100,
      ohtMove: avg('OHT'),
      arvMove: avg('ARV'),
      down: (down / n / prod.length) * 100,
      wip: wip / n,
    },
  })
}

// worker scope (the project types against the DOM lib)
const scope = self as unknown as { onmessage: (e: MessageEvent<RunRequest>) => void; postMessage: (m: WorkerOut) => void }
scope.onmessage = e => void run(e.data, m => scope.postMessage(m))
