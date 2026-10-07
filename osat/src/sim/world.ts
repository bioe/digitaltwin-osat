import { DAILY_TARGET, PROCESSES, type CarrierKey, type Mode, type ProcId } from '../data/processes'
import {
  AISLE_N, AISLE_S, ARV_LANE, CONV_Y, OHT_Y, layout,
  type StockerPlace, type ToolPlace,
} from '../layout/layout'
import { ahead, project, type P2 } from '../layout/path'
import type { Vec3 } from '../models/dsl'
import { ALARMS } from './alarms'
import { PARAMS, PRODUCTS, RECIPES } from './params'

export type State = 'run' | 'idle' | 'alarm'

export interface Lot {
  id: string
  product: string
  stage: number // index of the next process
  carrier: CarrierKey
}

export type Severity = 'High' | 'Medium' | 'Low'

/** AI auto-recovery pipeline: 0 detect → 1 diagnose → 2 plan → 3 execute → 4 resolved. */
export interface AiRecovery {
  stage: number
  t: number
  action: string
}

export interface Alarm {
  code: string
  text: string
  soft: boolean
  severity: Severity
  tool: string
  proc: ProcId
  at: number
  cleared?: number
  by?: string
  ai?: AiRecovery
}

export const AI_STAGES = ['Detect anomaly', 'AI diagnosis', 'Generate recovery plan', 'Execute & validate', 'Resolved · auto close']
const AI_STAGE_S = [1.5, 3, 2.5, 4]

const AI_ACTIONS: Record<string, string[]> = {
  sort: ['Wafer re-align & retry', 'Chuck vacuum purge'],
  grind: ['Thickness offset auto-correct', 'Chuck re-clamp'],
  saw: ['Auto kerf calibration', 'Coolant flow re-balance'],
  da: ['Ejector height re-teach', 'Placement offset auto-calibration', 'Wafer map re-load'],
  wb: ['Bond parameter auto-tuning', 'Tail length re-optimise', 'Re-bond & resume'],
  mold: ['Loader jam auto-clear', 'Degate re-cycle'],
  mark: ['OCV re-inspection & re-mark'],
  pkgsaw: ['Pick-up nozzle re-teach', 'Vision threshold auto-tune'],
  test: ['Handler auto-recovery', 'Bin limit re-evaluation'],
  fvi: ['Vision recipe re-tune', 'Nozzle vacuum purge'],
  tnr: ['Auto reel change', 'Splice skip & resume', 'Pocket re-fill'],
}

export interface Tool extends ToolPlace {
  state: State
  reason: string
  /** Lot in process. */
  lot: Lot | null
  /** Next lot, staged on the input port. */
  next: Lot | null
  /** Finished lot waiting on the output port. */
  out: Lot | null
  progress: number
  pt: number
  inbound: Job | null
  outbound: Job | null
  alarm: Alarm | null
  history: Alarm[]
  /** Person assigned to this tool's alarm. */
  tech: Worker | null
  runS: number
  idleS: number
  alarmS: number
  unitsToday: number
  uph: number
  timeline: State[]
  uphHist: number[]
  phase: number
  activeT: number
  recipe: string
  params: { label: string; nominal: number; tol: number; unit: string; dec: number; value: number }[]
  nextAlarm: number
  perf: number
}

export interface Stocker extends StockerPlace {
  lots: Lot[]
  reserved: number
  crane: { x: number; y: number; tx: number; ty: number }
  activeT: number
  moves: number
}

export interface Loc {
  kind: 'tool' | 'stocker'
  id: string
  port: Vec3
}

export interface Job {
  id: number
  mode: Mode
  lot: Lot
  from: Loc
  to: Loc
  created: number
  started?: number
  vehicle?: string
}

export interface Oht {
  id: string
  s: number
  v: number
  job: Job | null
  phase: 'free' | 'toPick' | 'down' | 'up' | 'toDrop' | 'downDrop' | 'upDrop'
  hoist: number
  hoistTarget: number
  carry: Lot | null
  timer: number
  activeT: number
  moves: number
}

export interface ConvItem {
  id: number
  job: Job
  phase: 'up' | 'move' | 'down'
  s: number
  sTo: number
  y: number
  fromPort: Vec3
  toPort: Vec3
}

export interface Arv {
  id: string
  pos: P2
  heading: number
  path: P2[]
  job: Job | null
  phase: 'parked' | 'wait' | 'toPick' | 'xferPick' | 'toDrop' | 'xferDrop' | 'toPark'
  lift: number
  liftTarget: number
  carry: Lot | null
  /** 0 = carrier on deck, 1 = carrier at the port. */
  slide: number
  slidePort: Vec3 | null
  battery: number
  timer: number
  charger: number
  moving: boolean
  /** Stopped to give way to another vehicle or a person. */
  yielding: boolean
  waitT: number
  moves: number
}

export type Step =
  | { go: P2; face?: number; label: string }
  | { work: number; label: string; carry?: CarrierKey | null; done?: () => void }

export interface Worker {
  id: string
  name: string
  role: 'tech' | 'operator'
  zone: ProcId | null
  pos: P2
  heading: number
  path: P2[]
  moving: boolean
  plan: Step[]
  /** What the person is doing now (shown in the UI). */
  label: string
  task: 'repair' | 'reset' | 'attend' | 'supply' | 'qa' | 'pm' | 'standby' | null
  working: boolean
  timer: number
  carry: CarrierKey | null
  tool: Tool | null
  home: P2
  jobs: number
}
/** Kept for older call sites. */
export type Tech = Worker

/** Line takt (s per lot). Each zone runs at ~80% load: pt = count × TAKT × 0.8. */
const TAKT = 36

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export class World {
  L = layout()
  t = 0
  /** Simulated clock (ms since epoch) – runs real time from a mid-shift start. */
  clock: number
  tools: Tool[] = []
  toolById = new Map<string, Tool>()
  stockers: Stocker[] = []
  jobs: Job[] = []
  oht: Oht[] = []
  conv: ConvItem[] = []
  arvs: Arv[] = []
  techs: Worker[] = []
  operators: Worker[] = []
  alarmLog: Alarm[] = []
  hourly: { h: number; units: number; plan: number }[] = []
  unitsToday: number
  lotSeq = 41000
  jobSeq = 1
  convSeq = 1
  done = { OHT: 0, CONV: 0, ARV: 0 }
  doneLog: { t: number; mode: Mode; dur: number }[] = []
  /** Simulation speed (fixed; the UI has no speed control). */
  speed = 2
  version = 0

  constructor() {
    const now = new Date()
    now.setHours(14, 12, 0, 0)
    this.clock = now.getTime()
    const dayFrac = (14 * 60 + 12 - 7 * 60) / (24 * 60) // day starts 07:00
    this.unitsToday = Math.round(DAILY_TARGET * dayFrac * 0.97)
    for (let h = 7; h < 14; h++) {
      this.hourly.push({ h, units: Math.round((DAILY_TARGET / 24) * rand(0.88, 1.05)), plan: Math.round(DAILY_TARGET / 24) })
    }
    this.hourly.push({ h: 14, units: Math.round((DAILY_TARGET / 24) * 0.2 * 0.97), plan: Math.round(DAILY_TARGET / 24) })

    for (const tp of this.L.tools) this.addTool(tp)
    for (const sp of this.L.stockers) {
      const s: Stocker = { ...sp, lots: [], reserved: 0, crane: { x: 0.5, y: 0.2, tx: 0.5, ty: 0.2 }, activeT: 0, moves: 0 }
      const n = sp.idx === 0 ? 24 : sp.idx === 11 ? 18 : Math.round(rand(4, 12))
      for (let i = 0; i < n; i++) s.lots.push(this.newLot(sp.idx))
      this.stockers.push(s)
    }
    // pre-load most production tools with a lot in progress
    for (const t of this.tools) {
      if (t.aux) continue
      if (Math.random() < 0.9) {
        t.lot = this.newLot(this.stageOf(t.proc))
        t.progress = Math.random()
        t.state = 'run'
        t.reason = 'Processing'
        if (Math.random() < 0.5) t.next = this.newLot(this.stageOf(t.proc))
      }
    }
    // fleets
    const ohtLoop = this.L.loops.OHT
    for (let i = 0; i < 22; i++) {
      this.oht.push({
        id: `OHT-${String(i + 1).padStart(2, '0')}`, s: (ohtLoop.length / 22) * i, v: 1.5, job: null,
        phase: 'free', hoist: 0, hoistTarget: 0, carry: null, timer: 0, activeT: 0, moves: Math.round(rand(80, 160)),
      })
    }
    this.L.chargers.forEach((c, i) => {
      this.arvs.push({
        id: `ARV-${String(i + 1).padStart(2, '0')}`, pos: [c.pos[0], c.pos[1]], heading: c.rotY, path: [], job: null,
        phase: 'parked', lift: 0, liftTarget: 0, carry: null, slide: 0, slidePort: null,
        battery: rand(55, 98), timer: 0, charger: i, moving: false, yielding: false, waitT: 0, moves: Math.round(rand(60, 140)),
      })
    })
    const wr = this.L.warRoom
    const mk = (id: string, name: string, role: Worker['role'], zone: ProcId | null, home: P2): Worker => ({
      id, name, role, zone, pos: [...home] as P2, heading: rand(-3, 3), path: [], moving: false, plan: [],
      label: 'Standing by', task: null, working: false, timer: rand(0, 4), carry: null, tool: null, home, jobs: Math.round(rand(8, 30)),
    })
    const techNames = ['A. Rahman', 'L. Chen', 'P. Kumar', 'S. Tan', 'M. Ong', 'R. Lim', 'K. Wong', 'N. Aziz']
    techNames.forEach((name, i) => this.techs.push(mk(`TECH-${i + 1}`, name, 'tech', null, [wr.x1 + 9 + i * 0.9, -1.4])))
    const crew: [ProcId, number][] = [
      ['sort', 2], ['grind', 1], ['saw', 1], ['da', 2], ['wb', 3], ['mold', 1], ['mark', 1], ['pkgsaw', 2], ['test', 2], ['fvi', 1], ['tnr', 1],
    ]
    const opNames = ['Aisyah', 'Bala', 'Chong', 'Devi', 'Eng', 'Farah', 'Gopal', 'Hui Min', 'Irfan', 'Jia Wei', 'Kavitha', 'Lim', 'Mei Ling', 'Nurul', 'Omar', 'Priya', 'Qistina', 'Raj']
    let k = 0
    for (const [proc, n] of crew) {
      const z = this.L.zones.find(q => q.proc.id === proc)!
      for (let i = 0; i < n; i++) {
        const home: P2 = [z.x0 + (z.x1 - z.x0) * rand(0.2, 0.8), z.aisleZ]
        this.operators.push(mk(`OP-${String(k + 1).padStart(2, '0')}`, opNames[k % opNames.length], 'operator', proc, home))
        k++
      }
    }
    // a few alarms already active at start
    for (const t of this.tools) if (Math.random() < 0.035) this.raise(t)
  }

  private addTool(tp: ToolPlace) {
    const specs = PARAMS[tp.model] ?? []
    const p = PROCESSES.find(q => q.id === tp.proc)!
    const runShare = rand(0.78, 0.93)
    const elapsed = 7.2 * 3600
    const t: Tool = {
      ...tp,
      state: 'idle', reason: tp.aux ? 'Standby' : 'Waiting for material', lot: null, next: null, out: null, progress: 0,
      pt: tp.aux ? rand(60, 120) : p.count * TAKT * rand(0.74, 0.84),
      inbound: null, outbound: null, alarm: null, history: [], tech: null,
      runS: elapsed * runShare, idleS: elapsed * (1 - runShare) * 0.6, alarmS: elapsed * (1 - runShare) * 0.4,
      unitsToday: 0, uph: tp.aux ? 0 : p.uph, timeline: [], uphHist: [],
      phase: Math.random(), activeT: Math.random() * 100,
      recipe: pick(RECIPES[tp.model] ?? ['STD']),
      params: specs.map(([label, nominal, tol, unit, dec]) => ({ label, nominal, tol, unit, dec, value: nominal })),
      nextAlarm: rand(200, 2400), perf: rand(0.9, 0.98),
    }
    t.unitsToday = Math.round((t.runS * t.uph * t.perf) / 3600)
    for (let i = 0; i < 72; i++) {
      const r = Math.random()
      t.timeline.push(r < runShare ? 'run' : r < runShare + 0.07 ? 'idle' : 'alarm')
    }
    for (let i = 0; i < 24; i++) t.uphHist.push(t.uph * rand(0.75, 1.0))
    if (tp.aux) {
      t.state = 'run'
      t.reason = 'Cycle running'
    }
    this.tools.push(t)
    this.toolById.set(t.id, t)
  }

  stageOf(proc: ProcId) {
    return PROCESSES.findIndex(p => p.id === proc)
  }

  newLot(stage: number): Lot {
    const p = PROCESSES[Math.min(stage, PROCESSES.length - 1)]
    return { id: `L${this.lotSeq++}`, product: pick(PRODUCTS), stage, carrier: p.carrier }
  }

  // ------------------------------------------------------------------ alarms
  raise(t: Tool) {
    const key = (t.aux ? t.model : t.proc) as keyof typeof ALARMS
    const [code, text, soft] = pick(ALARMS[key] ?? ALARMS.wb)
    const low = /reel full|splice|empty pocket|calibration expired|spool empty/i.test(text)
    const severity: Severity = !soft ? 'High' : low ? 'Low' : 'Medium'
    const a: Alarm = { code, text, soft, severity, tool: t.id, proc: t.proc, at: this.clock }
    // most soft alarms are handled by the AI virtual operator without a person
    if (soft && Math.random() < 0.65) a.ai = { stage: 0, t: 0, action: pick(AI_ACTIONS[t.proc] ?? ['Parameter tuning']) }
    t.alarm = a
    t.state = 'alarm'
    t.reason = text
    t.history.unshift(a)
    this.alarmLog.unshift(a)
    if (this.alarmLog.length > 80) this.alarmLog.pop()
  }

  clear(t: Tool, by: string) {
    if (!t.alarm) return
    t.alarm.cleared = this.clock
    t.alarm.by = by
    t.alarm = null
    t.nextAlarm = rand(500, 2600)
    t.state = 'idle'
    t.reason = 'Recovering'
    if (t.aux) {
      t.state = 'run'
      t.reason = 'Cycle running'
    }
    if (t.tech) {
      const w = t.tech
      t.tech = null
      w.tool = null
      // remote reset while someone walks there: they drop the job
      if (w.task === 'repair' || w.task === 'reset') this.abort(w)
    }
  }

  /** Operator action from the UI. */
  remoteReset(id: string) {
    const t = this.toolById.get(id)
    if (t?.alarm?.soft) this.clear(t, 'Remote reset (war room)')
  }

  forceAlarm(id: string) {
    const t = this.toolById.get(id)
    if (t && !t.alarm) this.raise(t)
  }

  // ------------------------------------------------------------------ routing
  private rowOf(p: P2): 'north' | 'south' | null {
    if (p[1] < -4) return 'north'
    if (p[1] > 4) return 'south'
    return null
  }

  /** Manhattan route through aisles, cross-aisles and the corridor (avoids the war room). */
  route(a: P2, b: P2, laneN = -1.4, laneS = -1.4): P2[] {
    const pts: P2[] = [a]
    const push = (p: P2) => {
      const l = pts[pts.length - 1]
      if (Math.abs(l[0] - p[0]) > 0.01 || Math.abs(l[1] - p[1]) > 0.01) pts.push(p)
    }
    const ra = this.rowOf(a)
    const rb = this.rowOf(b)
    const aisle = (r: 'north' | 'south') => (r === 'north' ? AISLE_N : AISLE_S)
    const lane = (r: 'north' | 'south' | null, p: P2) => (r === 'north' || (!r && p[1] < 0) ? laneN : laneS)
    const nearest = (r: 'north' | 'south', x: number) =>
      this.L.crossX[r].reduce((m, c) => (Math.abs(c - x) < Math.abs(m - x) ? c : m), this.L.crossX[r][0])
    if (ra && ra === rb) {
      push([a[0], aisle(ra)])
      push([b[0], aisle(ra)])
      push(b)
      return pts
    }
    let cur: P2
    const la = lane(ra, a)
    if (ra) {
      const gx = nearest(ra, a[0])
      push([a[0], aisle(ra)])
      push([gx, aisle(ra)])
      push([gx, la])
      cur = [gx, la]
    } else {
      push([a[0], la])
      cur = [a[0], la]
    }
    const lb = lane(rb, b)
    const gxb = rb ? nearest(rb, b[0]) : b[0]
    if (la !== lb) {
      const wr = this.L.warRoom
      const xc = gxb > wr.x0 - 1.5 && gxb < wr.x1 + 1.5 ? wr.x0 - 3 : gxb
      push([xc, cur[1]])
      push([xc, lb])
    }
    push([gxb, lb])
    if (rb) {
      push([gxb, aisle(rb)])
      push([b[0], aisle(rb)])
    }
    push(b)
    return pts
  }

  // ------------------------------------------------------------------ dispatch
  private portFor(s: Stocker, mode: Mode): Vec3 {
    if (mode === 'ARV') {
      const conv = this.L.loops.CONV
      return s.ports.reduce((m, p) => (project(conv, [p[0], p[2]]).dist > project(conv, [m[0], m[2]]).dist ? p : m))
    }
    const loop = this.L.loops[mode]
    return s.ports.reduce((m, p) => (project(loop, [p[0], p[2]]).dist < project(loop, [m[0], m[2]]).dist ? p : m))
  }

  private dispatch() {
    for (const t of this.tools) {
      if (t.aux) continue
      const stage = this.stageOf(t.proc)
      const p = PROCESSES[stage]
      // load
      if (!t.next && !t.inbound && t.state !== 'alarm' && (!t.lot || t.progress > 0.3)) {
        const s = this.stockers[stage]
        if (s.lots.length > 0) {
          const lot = s.lots.shift()!
          const job: Job = {
            id: this.jobSeq++, mode: p.mode, lot, created: this.t,
            from: { kind: 'stocker', id: s.id, port: this.portFor(s, p.mode) },
            to: { kind: 'tool', id: t.id, port: t.inPort },
          }
          t.inbound = job
          this.jobs.push(job)
          this.startJob(job)
        }
      }
      // unload
      if (t.out && !t.outbound) {
        const s = this.stockers[stage + 1]
        if (s.lots.length + s.reserved < s.capacity) {
          const lot = t.out
          const port = t.outPort
          const job: Job = {
            id: this.jobSeq++, mode: p.mode, lot, created: this.t,
            from: { kind: 'tool', id: t.id, port },
            to: { kind: 'stocker', id: s.id, port: this.portFor(s, p.mode) },
          }
          s.reserved++
          t.outbound = job
          this.jobs.push(job)
          this.startJob(job)
        }
      }
    }
  }

  private startJob(job: Job) {
    if (job.mode === 'CONV') {
      const loop = this.L.loops.CONV
      const s0 = project(loop, [job.from.port[0], job.from.port[2]]).s
      const s1 = project(loop, [job.to.port[0], job.to.port[2]]).s
      job.started = this.t
      this.conv.push({ id: this.convSeq++, job, phase: 'up', s: s0, sTo: s1, y: job.from.port[1], fromPort: job.from.port, toPort: job.to.port })
      this.onPicked(job)
    }
    // OHT and ARV jobs wait in the queue for a vehicle
  }

  /** Material has left its source. */
  private onPicked(job: Job) {
    if (job.from.kind === 'tool') {
      const t = this.toolById.get(job.from.id)!
      t.out = null
      t.outbound = null
    } else {
      const s = this.stockers.find(x => x.id === job.from.id)!
      s.moves++
      s.crane.tx = Math.random()
      s.crane.ty = 0.05
    }
  }

  private onDelivered(job: Job) {
    job.vehicle = undefined
    this.done[job.mode]++
    this.doneLog.push({ t: this.t, mode: job.mode, dur: this.t - job.created })
    this.jobs = this.jobs.filter(j => j !== job)
    if (job.to.kind === 'tool') {
      const t = this.toolById.get(job.to.id)!
      t.inbound = null
      t.next = job.lot
    } else {
      const s = this.stockers.find(x => x.id === job.to.id)!
      s.reserved = Math.max(0, s.reserved - 1)
      s.lots.push(job.lot)
      s.moves++
      s.crane.tx = Math.random()
      s.crane.ty = Math.random()
    }
  }

  // ------------------------------------------------------------------ step
  step(dtReal: number) {
    const dt = Math.min(dtReal, 0.1) * this.speed
    this.t += dt
    this.clock += dt * 1000
    this.dispatch()
    this.stepTools(dt)
    this.stepStockers(dt)
    this.stepOht(dt)
    this.stepConv(dt)
    this.stepArv(dt)
    this.stepWorkers(dt)
    this.version++
  }

  private sampleAcc = 0
  private releaseAcc = 0

  /** Lot hand-over inside a tool: finished → output port, staged → process. Sets state + reason. */
  private advanceTool(t: Tool) {
    const stage = this.stageOf(t.proc)
    if (t.lot && t.progress >= 1 && !t.out) {
      const nxt = PROCESSES[stage + 1]
      t.out = { ...t.lot, stage: stage + 1, carrier: nxt ? nxt.carrier : 'reelBox' }
      t.lot = null
    }
    if (!t.lot && t.next) {
      t.lot = t.next
      t.next = null
      t.progress = 0
    }
    const running = !!t.lot && t.progress < 1
    t.state = running ? 'run' : 'idle'
    if (running) t.reason = 'Processing'
    else if (t.lot) t.reason = 'Blocked – output port full'
    else if (t.inbound) t.reason = `Waiting for material (${t.inbound.mode} in transit)`
    else if (!this.stockers[stage].lots.length) t.reason = 'Starved – upstream stocker empty'
    else t.reason = 'Waiting for material'
  }
  private stepTools(dt: number) {
    this.sampleAcc += dt
    const sample = this.sampleAcc >= 5
    if (sample) this.sampleAcc = 0
    let tnrRate = 0
    for (const t of this.tools) {
      if (!t.aux && t.state !== 'alarm') this.advanceTool(t)
      if (t.state === 'run') {
        t.activeT += dt
        t.runS += dt
        t.unitsToday += (t.uph * t.perf * dt) / 3600
        if (t.proc === 'tnr' && !t.aux) tnrRate += t.uph * t.perf
        if (!t.aux && t.lot) {
          t.progress += dt / t.pt
          if (t.progress >= 1) t.progress = 1
        }
        t.nextAlarm -= dt
        if (t.nextAlarm <= 0) this.raise(t)
      } else if (t.state === 'idle') {
        t.idleS += dt
        if (t.aux && Math.random() < dt / 40) {
          t.state = 'run'
          t.reason = 'Cycle running'
        }
      } else {
        t.alarmS += dt
        const ai = t.alarm?.ai
        if (ai && ai.stage < 4) {
          ai.t += dt
          if (ai.t >= AI_STAGE_S[ai.stage]) {
            ai.t = 0
            ai.stage++
            if (ai.stage === 4) this.clear(t, `AI auto recovery · ${ai.action}`)
          }
        }
      }
      if (t.aux && t.state === 'run' && Math.random() < dt / 300) {
        t.state = 'idle'
        t.reason = 'Standby – waiting batch'
      }
      // drift live parameters
      for (const p of t.params) {
        const target = t.state === 'alarm' && Math.random() < 0.3 ? p.nominal + p.tol * 1.6 : p.nominal
        p.value += (target - p.value) * 0.05 + (Math.random() - 0.5) * p.tol * 0.12
      }
      if (sample) {
        t.timeline.push(t.state)
        if (t.timeline.length > 72) t.timeline.shift()
        t.uphHist.push(t.state === 'run' ? t.uph * t.perf * rand(0.95, 1.03) : t.state === 'idle' ? t.uph * rand(0.2, 0.5) : 0)
        if (t.uphHist.length > 24) t.uphHist.shift()
      }
    }
    const add = (tnrRate * dt) / 3600
    this.unitsToday += add
    const hour = new Date(this.clock).getHours()
    const last = this.hourly[this.hourly.length - 1]
    if (last.h !== hour) {
      this.hourly.push({ h: hour, units: 0, plan: Math.round(DAILY_TARGET / 24) })
      if (this.hourly.length > 12) this.hourly.shift()
    }
    this.hourly[this.hourly.length - 1].units += add
    // incoming wafers and finished goods shipping
    const s0 = this.stockers[0]
    this.releaseAcc += dt
    if (this.releaseAcc >= TAKT) {
      this.releaseAcc = 0
      if (s0.lots.length < 40) s0.lots.push(this.newLot(0))
    }
    const fg = this.stockers[11]
    if (fg.lots.length > 40) fg.lots.splice(0, 20)
    this.doneLog = this.doneLog.filter(d => this.t - d.t < 600)
  }

  private stepStockers(dt: number) {
    for (const s of this.stockers) {
      const c = s.crane
      const dx = c.tx - c.x
      const dy = c.ty - c.y
      if (Math.abs(dx) + Math.abs(dy) > 0.005) {
        c.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 0.35)
        c.y += Math.sign(dy) * Math.min(Math.abs(dy), dt * 0.5)
        s.activeT += dt
      } else if (Math.random() < dt / 6) {
        c.tx = Math.random()
        c.ty = Math.random()
      }
    }
  }

  // ------------------------------------------------------------------ OHT
  private stepOht(dt: number) {
    const loop = this.L.loops.OHT
    const L = loop.length
    const queue = this.jobs.filter(j => j.mode === 'OHT' && !j.vehicle)
    for (const job of queue) {
      const sPick = project(loop, [job.from.port[0], job.from.port[2]]).s
      let best: Oht | null = null
      let bestD = Infinity
      for (const v of this.oht) {
        if (v.phase !== 'free') continue
        const d = ahead(loop, v.s, sPick)
        if (d < bestD) {
          bestD = d
          best = v
        }
      }
      if (!best) break
      best.job = job
      best.phase = 'toPick'
      job.vehicle = best.id
      job.started = this.t
    }
    const sorted = [...this.oht].sort((a, b) => a.s - b.s)
    for (const v of this.oht) {
      const idx = sorted.indexOf(v)
      const next = sorted[(idx + 1) % sorted.length]
      const gap = next === v ? Infinity : ahead(loop, v.s, next.s)
      const moving = v.phase === 'free' || v.phase === 'toPick' || v.phase === 'toDrop'
      let vmax = v.phase === 'free' ? 2.2 : 4.5
      let stopAt = Infinity
      if (v.phase === 'toPick' || v.phase === 'toDrop') {
        const port = v.phase === 'toPick' ? v.job!.from.port : v.job!.to.port
        const target = project(loop, [port[0], port[2]]).s
        stopAt = ahead(loop, v.s, target)
        if (stopAt > L - 0.05) stopAt = 0
      }
      if (moving) {
        const brake = Math.min(stopAt, gap - 1.6)
        vmax = Math.min(vmax, Math.sqrt(Math.max(0, 2 * 1.2 * brake)))
        v.v += Math.max(-3, Math.min(1.2, (vmax - v.v) / Math.max(dt, 1e-3))) * dt
        v.v = Math.max(0, v.v)
        const ds = Math.min(v.v * dt, Math.max(0, gap - 1.5))
        v.s = (v.s + ds) % L
        if (v.v > 0.05) v.activeT += dt
        if (stopAt !== Infinity && stopAt - ds < 0.04 && v.v < 0.4) {
          v.v = 0
          const port = v.phase === 'toPick' ? v.job!.from.port : v.job!.to.port
          const ch = carrierH(v.job!.lot.carrier)
          v.hoistTarget = Math.max(0.1, OHT_Y - 0.8 - (port[1] + ch))
          v.phase = v.phase === 'toPick' ? 'down' : 'downDrop'
        }
      } else {
        v.v = 0
        if (v.phase === 'down' || v.phase === 'downDrop') {
          v.hoist = Math.min(v.hoistTarget, v.hoist + dt * 1.2)
          if (v.hoist >= v.hoistTarget) {
            v.timer += dt
            if (v.timer > 0.8) {
              v.timer = 0
              if (v.phase === 'down') {
                v.carry = v.job!.lot
                this.onPicked(v.job!)
                v.phase = 'up'
              } else {
                v.carry = null
                this.onDelivered(v.job!)
                v.phase = 'upDrop'
              }
            }
          }
        } else if (v.phase === 'up' || v.phase === 'upDrop') {
          v.hoist = Math.max(0, v.hoist - dt * 1.2)
          if (v.hoist <= 0) {
            if (v.phase === 'up') v.phase = 'toDrop'
            else {
              v.phase = 'free'
              v.job = null
              v.moves++
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ conveyor
  private stepConv(dt: number) {
    const loop = this.L.loops.CONV
    const top = CONV_Y + 0.06
    for (const c of this.conv) {
      if (c.phase === 'up') {
        c.y = Math.min(top, c.y + dt * 0.7)
        // merge onto the belt only into a free gap
        const clear = !this.conv.some(o => o !== c && o.phase === 'move' && Math.min(ahead(loop, o.s, c.s), ahead(loop, c.s, o.s)) < 0.55)
        if (c.y >= top && clear) c.phase = 'move'
      } else if (c.phase === 'move') {
        const rem = ahead(loop, c.s, c.sTo)
        // accumulate: keep 0.45 m behind the carrier in front
        let gap = Infinity
        for (const o of this.conv) if (o !== c && o.phase === 'move') gap = Math.min(gap, ahead(loop, c.s, o.s) || Infinity)
        const ds = Math.max(0, Math.min(rem, dt * 1.2, gap - 0.45))
        c.s = (c.s + ds) % loop.length
        if (rem - ds < 0.01) {
          c.s = c.sTo
          c.phase = 'down'
        }
      } else {
        c.y = Math.max(c.toPort[1], c.y - dt * 0.7)
        if (c.y <= c.toPort[1]) {
          this.onDelivered(c.job)
          ;(c as ConvItem & { gone?: boolean }).gone = true
        }
      }
    }
    this.conv = this.conv.filter(c => !(c as ConvItem & { gone?: boolean }).gone)
  }

  // ------------------------------------------------------------------ ARV
  private arvStation(port: Vec3): P2 {
    const aisle = port[2] > 0 ? AISLE_S : AISLE_N
    return [port[0], aisle]
  }

  private stepArv(dt: number) {
    const queue = this.jobs.filter(j => j.mode === 'ARV' && !j.vehicle)
    for (const job of queue) {
      const st = this.arvStation(job.from.port)
      let best: Arv | null = null
      let bestD = Infinity
      for (const a of this.arvs) {
        if (a.job || a.battery < 25) continue
        if (a.phase !== 'parked' && a.phase !== 'toPark' && a.phase !== 'wait') continue
        const d = Math.abs(a.pos[0] - st[0]) + Math.abs(a.pos[1] - st[1])
        if (d < bestD) {
          bestD = d
          best = a
        }
      }
      if (!best) break
      best.job = job
      best.phase = 'toPick'
      best.path = this.keepRight(this.route(best.pos, st, ARV_LANE, ARV_LANE), 0.5)
      job.vehicle = best.id
      job.started = this.t
    }
    for (const a of this.arvs) {
      a.moving = false
      if (a.phase === 'parked') {
        a.battery = Math.min(100, a.battery + dt * 0.25)
        a.lift += (0 - a.lift) * Math.min(1, dt * 3)
        continue
      }
      a.battery = Math.max(5, a.battery - dt * 0.03)
      if (a.phase === 'wait') {
        a.timer -= dt
        if (a.timer <= 0 || a.battery < 30) {
          const c = this.L.chargers[a.charger]
          a.phase = 'toPark'
          a.path = this.route(a.pos, [c.pos[0], c.pos[1]], ARV_LANE, ARV_LANE)
        }
        continue
      }
      if (a.phase === 'toPick' || a.phase === 'toDrop' || a.phase === 'toPark') {
        a.yielding = this.arvBlocked(a)
        if (a.yielding) {
          a.waitT += dt
          continue
        }
        a.waitT = 0
        if (this.followPath(a, dt, 1.5, 2.2)) {
          if (a.phase === 'toPark') {
            a.phase = 'parked'
            a.heading = this.L.chargers[a.charger].rotY
          } else {
            const port = a.phase === 'toPick' ? a.job!.from.port : a.job!.to.port
            a.slidePort = port
            a.liftTarget = Math.min(1, Math.max(0, (port[1] - 0.65) / 0.35))
            a.timer = 0
            a.phase = a.phase === 'toPick' ? 'xferPick' : 'xferDrop'
          }
        }
      } else if (a.phase === 'xferPick' || a.phase === 'xferDrop') {
        a.lift += Math.sign(a.liftTarget - a.lift) * Math.min(Math.abs(a.liftTarget - a.lift), dt * 1.2)
        a.timer += dt
        const T = a.timer
        // 0–0.6 lift, 0.6–1.8 slide out, 1.8–3.0 slide in
        if (a.phase === 'xferPick') {
          a.slide = T < 0.6 ? 0 : T < 1.6 ? (T - 0.6) : T < 2.6 ? 1 - (T - 1.6) : 0
          if (T >= 1.6 && !a.carry) {
            a.carry = a.job!.lot
            this.onPicked(a.job!)
          }
        } else {
          a.slide = T < 0.6 ? 0 : T < 1.6 ? (T - 0.6) : T < 2.6 ? 1 - (T - 1.6) : 0
          if (T >= 1.6 && a.carry) {
            a.carry = null
            this.onDelivered(a.job!)
          }
        }
        if (T >= 2.7) {
          a.slide = 0
          a.liftTarget = 0
          a.lift = 0
          if (a.phase === 'xferPick') {
            a.phase = 'toDrop'
            a.path = this.keepRight(this.route(a.pos, this.arvStation(a.job!.to.port), ARV_LANE, ARV_LANE), 0.5)
          } else {
            a.job = null
            a.moves++
            a.slidePort = null
            a.phase = 'wait'
            a.timer = 25
          }
        }
      }
    }
  }

  /** True when another ARV or a person is in the safety field ahead (people always have priority). */
  private arvBlocked(a: Arv): boolean {
    if (a.waitT > 6) return false // escape hatch: never deadlock for long
    const fx = Math.sin(a.heading)
    const fz = Math.cos(a.heading)
    const ahead2 = (p: P2, reach: number, width: number) => {
      const dx = p[0] - a.pos[0]
      const dz = p[1] - a.pos[1]
      const along = dx * fx + dz * fz
      const lat = Math.abs(dx * fz - dz * fx)
      return along > 0.15 && along < reach && lat < width
    }
    for (const w of this.techs) if (ahead2(w.pos, 1.4, 0.55)) return true
    for (const w of this.operators) if (ahead2(w.pos, 1.4, 0.55)) return true
    const ia = this.arvs.indexOf(a)
    for (const b of this.arvs) {
      if (b === a || !ahead2(b.pos, 1.8, 0.85)) continue
      // both see each other (head-on / crossing): the lower number has right of way
      const bx = Math.sin(b.heading)
      const bz = Math.cos(b.heading)
      const mutual = (a.pos[0] - b.pos[0]) * bx + (a.pos[1] - b.pos[1]) * bz > 0.15
      if (mutual && b.moving && ia < this.arvs.indexOf(b)) continue
      return true
    }
    return false
  }

  /** Offsets an axis-aligned route to the right-hand lane (vehicles keep right, so opposing traffic passes). */
  private keepRight(pts: P2[], off: number): P2[] {
    if (pts.length < 2) return pts
    const nrm = (a: P2, b: P2): P2 => {
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const l = Math.hypot(dx, dz) || 1
      return [-dz / l, dx / l]
    }
    const out: P2[] = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const n1 = nrm(pts[i - 1], pts[i])
      const n2 = i + 1 < pts.length ? nrm(pts[i], pts[i + 1]) : n1
      const same = Math.abs(n1[0] - n2[0]) + Math.abs(n1[1] - n2[1]) < 1e-6
      out.push([pts[i][0] + (n1[0] + (same ? 0 : n2[0])) * off, pts[i][1] + (n1[1] + (same ? 0 : n2[1])) * off])
    }
    return out
  }

  /** Moves along a.path; rotates in place at corners. Returns true when finished. */
  private followPath(a: { pos: P2; heading: number; path: P2[]; moving: boolean }, dt: number, speed: number, turnRate: number) {
    while (a.path.length && Math.hypot(a.path[0][0] - a.pos[0], a.path[0][1] - a.pos[1]) < 0.02) a.path.shift()
    if (!a.path.length) return true
    const tgt = a.path[0]
    const dx = tgt[0] - a.pos[0]
    const dz = tgt[1] - a.pos[1]
    const want = Math.atan2(dx, dz)
    let dh = want - a.heading
    while (dh > Math.PI) dh -= Math.PI * 2
    while (dh < -Math.PI) dh += Math.PI * 2
    if (Math.abs(dh) > 0.05) {
      a.heading += Math.sign(dh) * Math.min(Math.abs(dh), turnRate * dt)
      if (Math.abs(dh) > 0.35) return false
    }
    const d = Math.hypot(dx, dz)
    const step = Math.min(d, speed * dt)
    a.pos[0] += (dx / d) * step
    a.pos[1] += (dz / d) * step
    a.moving = true
    return false
  }

  // ------------------------------------------------------------------ people
  /** Standing spot in the aisle in front of a tool, and the heading that faces it. */
  private spot(t: Tool): { p: P2; face: number } {
    const aisle = t.pos[2] < 0 ? AISLE_N : AISLE_S
    return { p: [t.pos[0] + rand(-0.4, 0.4), aisle + t.side * 1.3], face: t.side === -1 ? Math.PI : 0 }
  }

  private benchFor(w: Worker): { p: P2; face: number } {
    const z = this.L.zones.find(q => q.proc.id === w.zone)
    const x = z ? (z.x0 + z.x1) / 2 : w.pos[0]
    const row = z ? z.row : w.pos[1] < 0 ? 'north' : 'south'
    const b = this.L.benches
      .filter(q => q.row === row)
      .reduce((m, q) => (Math.abs(q.pos[0] - x) < Math.abs(m.pos[0] - x) ? q : m))
    const fx = Math.sin(b.rotY)
    const fz = Math.cos(b.rotY)
    return { p: [b.pos[0] + fx * 0.8, b.pos[1] + fz * 0.8], face: b.rotY + Math.PI }
  }

  private abort(w: Worker) {
    w.plan = []
    w.working = false
    w.carry = null
    w.task = null
    w.path = []
  }

  private claim(w: Worker, t: Tool) {
    if (w.tool && w.tool.tech === w) w.tool.tech = null
    this.abort(w)
    t.tech = w
    w.tool = t
  }

  private planFor(w: Worker) {
    const zoneTools = this.tools.filter(t => t.proc === w.zone)
    if (w.role === 'operator') {
      const soft = zoneTools.find(t => t.alarm?.soft && !t.alarm.ai && !t.tech)
      if (soft) {
        this.claim(w, soft)
        const sp = this.spot(soft)
        w.task = 'reset'
        w.plan = [
          { go: sp.p, face: sp.face, label: `Going to ${soft.id} (${soft.alarm!.code})` },
          { work: rand(5, 9), label: `Clearing ${soft.alarm!.text.toLowerCase()} on ${soft.id}`, done: () => soft.alarm && this.clear(soft, `Reset at tool by ${w.name}`) },
        ]
        return
      }
      const r = Math.random()
      const t = pick(zoneTools.filter(x => !x.aux).length ? zoneTools.filter(x => !x.aux) : zoneTools)
      const sp = this.spot(t)
      const bench = this.benchFor(w)
      if (r < 0.42) {
        w.task = 'attend'
        const what = t.out ? 'unloading finished lot' : t.next ? 'checking staged lot' : t.state === 'run' ? 'monitoring process' : 'preparing next lot'
        w.plan = [
          { go: sp.p, face: sp.face, label: `Walking to ${t.id}` },
          { work: rand(8, 18), label: `${t.id}: ${what}` },
        ]
      } else if (r < 0.68) {
        w.task = 'supply'
        const item = t.model === 'wireBonder' ? 'Cu wire spool + capillary' : t.model === 'tapeReel' ? 'empty reels + cover tape' : t.model === 'dicingSaw' || t.model === 'packageSaw' ? 'saw blades' : 'consumables'
        w.plan = [
          { go: bench.p, face: bench.face, label: `Fetching ${item}` },
          { work: rand(3, 5), label: `Picking ${item} at bench`, carry: 'trayStack' },
          { go: sp.p, face: sp.face, label: `Carrying ${item} to ${t.id}` },
          { work: rand(6, 10), label: `Replenishing ${item} on ${t.id}`, carry: null },
        ]
      } else if (r < 0.9) {
        w.task = 'qa'
        w.plan = [
          { go: sp.p, face: sp.face, label: `Walking to ${t.id} for QA sample` },
          { work: rand(4, 6), label: `Pulling QA sample from ${t.id}`, carry: 'trayStack' },
          { go: bench.p, face: bench.face, label: 'Carrying sample to QA bench' },
          { work: rand(12, 20), label: 'Inspecting sample under microscope', carry: null },
        ]
      } else {
        w.task = 'standby'
        w.plan = [{ work: rand(4, 8), label: 'Standing by – watching line' }]
      }
      return
    }
    // technicians
    const hard = this.tools.find(t => t.alarm && !t.alarm.ai && !t.tech && (!t.alarm.soft || this.clock - t.alarm.at > 45000))
    if (hard) {
      this.claim(w, hard)
      const sp = this.spot(hard)
      w.task = 'repair'
      w.plan = [
        { go: sp.p, face: sp.face, label: `Responding to ${hard.id} (${hard.alarm!.code})` },
        { work: rand(14, 30), label: `Repairing ${hard.id}: ${hard.alarm!.text}`, done: () => hard.alarm && this.clear(hard, `Repaired by ${w.name}`) },
      ]
      return
    }
    if (Math.random() < 0.35) {
      const t = pick(this.tools)
      const sp = this.spot(t)
      w.task = 'pm'
      w.plan = [
        { go: sp.p, face: sp.face, label: `PM round → ${t.id}` },
        { work: rand(15, 28), label: `Preventive check on ${t.id}` },
      ]
    } else {
      w.task = 'standby'
      w.plan = [
        { go: w.home, face: 0, label: 'Returning to maintenance desk' },
        { work: rand(6, 12), label: 'On call at maintenance desk' },
      ]
    }
  }

  private stepWorkers(dt: number) {
    for (const w of [...this.techs, ...this.operators]) {
      w.moving = false
      // urgent work interrupts routine work
      if (w.task === 'pm' || w.task === 'standby' || w.task === 'attend') {
        const urgent =
          w.role === 'tech'
            ? this.tools.some(t => t.alarm && !t.tech && !t.alarm.soft)
            : this.tools.some(t => t.proc === w.zone && t.alarm?.soft && !t.alarm.ai && !t.tech)
        if (urgent) this.abort(w)
      }
      if (!w.plan.length) {
        this.planFor(w)
        if (!w.plan.length) continue
      }
      const st = w.plan[0]
      if ('go' in st) {
        w.label = st.label
        w.working = false
        if (!w.path.length) w.path = this.route(w.pos, st.go)
        if (this.followPath(w, dt, 1.3, 6)) {
          if (st.face !== undefined) w.heading = st.face
          w.plan.shift()
          w.path = []
        }
      } else {
        if (!w.working) {
          w.working = true
          w.timer = st.work
          w.label = st.label
          if (st.carry !== undefined) w.carry = st.carry
        }
        w.timer -= dt
        if (w.timer <= 0) {
          w.working = false
          w.plan.shift()
          st.done?.()
          if (!w.plan.length) {
            w.jobs++
            if (w.tool && w.tool.tech === w && !w.tool.alarm) w.tool.tech = null
            if (!w.tool?.alarm) w.tool = null
            w.task = null
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ KPIs
  kpis() {
    const prod = this.tools.filter(t => !t.aux)
    const run = prod.filter(t => t.state === 'run').length
    const idle = prod.filter(t => t.state === 'idle').length
    const alarm = this.tools.filter(t => t.state === 'alarm').length
    const oee =
      prod.reduce((a, t) => a + (t.runS / (t.runS + t.idleS + t.alarmS)) * t.perf * 0.995, 0) / prod.length
    const wipLots =
      this.stockers.slice(0, 11).reduce((a, s) => a + s.lots.length, 0) + prod.reduce((a, t) => a + (t.lot ? 1 : 0) + (t.next ? 1 : 0) + (t.out ? 1 : 0), 0) + this.jobs.length
    const hourIdx = (new Date(this.clock).getHours() - 7 + new Date(this.clock).getMinutes() / 60) / 24
    const plan = DAILY_TARGET * hourIdx
    const recent = this.doneLog
    const perMode = (m: Mode) => recent.filter(d => d.mode === m)
    const avg = (xs: { dur: number }[]) => (xs.length ? xs.reduce((a, b) => a + b.dur, 0) / xs.length : 0)
    return {
      run, idle, alarm, total: this.tools.length, prodTotal: prod.length,
      oee, wipLots, units: this.unitsToday, plan,
      jobsActive: this.jobs.length,
      ohtBusy: this.oht.filter(v => v.phase !== 'free').length,
      arvBusy: this.arvs.filter(a => a.job).length,
      convItems: this.conv.length,
      deliv: {
        OHT: { n: perMode('OHT').length, avg: avg(perMode('OHT')) },
        CONV: { n: perMode('CONV').length, avg: avg(perMode('CONV')) },
        ARV: { n: perMode('ARV').length, avg: avg(perMode('ARV')) },
      },
      yieldSort: 95.4, yieldAssy: 99.72, yieldFt: 98.86,
    }
  }
}

export function carrierH(c: CarrierKey) {
  return c === 'foup' || c === 'frameCassette' ? 0.34 : c === 'magazine' ? 0.16 : c === 'trayStack' ? 0.13 : 0.12
}

export const world = new World()

if (import.meta.env.DEV) (window as unknown as { __world: World }).__world = world
