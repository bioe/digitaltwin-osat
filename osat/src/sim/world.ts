import { DAILY_TARGET, PROCESSES, type CarrierKey, type Mode, type ProcId } from '../data/processes'
import {
  AISLE_N, AISLE_S, ARV_KEEP, ARV_LANE, CONV_Y, FLOOR_Y, OHT_Y, WALK_KEEP, layout,
  type StockerPlace, type ToolPlace,
} from '../layout/layout'
import { ahead, makePath, pathAt, project, roundCorners, type P2, type Path } from '../layout/path'
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
  packStation: ['Carton magazine re-index', 'Label re-print & verify'],
  stretchWrapper: ['Film re-thread & restart', 'Height sensor re-teach'],
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
  /** Packing / palletizing machine of the shipping line (its state follows the shipping flow). */
  ship?: boolean
  /** Extra animation inputs for the model (AnimState.u). */
  anim?: number[]
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
  phase: 'parked' | 'toPick' | 'xferPick' | 'toDrop' | 'xferDrop' | 'toPark'
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
  /** Called in during the lights-out night. */
  onCall: boolean
  /** Seconds until a called-in technician reaches site (0 = on the floor). */
  eta: number
}

export interface Truck {
  id: string
  dest: string
  phase: 'inbound' | 'reversing' | 'loading' | 'closing' | 'leaving'
  /** Distance along the current path segment. */
  s: number
  v: number
  pos: P2
  heading: number
  pallets: number
  units: number
  /** Rear door opening 0..1. */
  doors: number
  timer: number
  /** Pallet currently rolling from the dock into the truck: 0..1, or -1. */
  moving: number
}

export const PALLET_CAP = 6
export const LOTS_PER_PALLET = 2
/** Pallet cycle (shipping.pack 0..1): cartons packed + stacked, roll to the wrapper, wrap, roll to the buffer. */
export const PACK_END = 0.45
export const WRAP_IN = 0.55
export const WRAP_END = 0.9
export const CARTONS_PER_PALLET = 12

export interface ShipUnit {
  id: 'PACK-01' | 'WRAP-01' | 'LIFT-01' | 'TRUCK'
  name: string
  model: string
  state: State
  text: string
  /** A full machine (select as a tool); the lift and the dock are shipping views. */
  tool?: boolean
  /** Position local to the level-3 group (the truck is FLOOR_Y below). */
  pos: [number, number, number]
}
const DESTS = ['Penang Intl. Airport · air freight', 'Port Klang · sea freight', 'Customer DC · Johor', 'Singapore hub', 'Bangkok DC']

/** Transport fleet sizes, right-sized to measured peak demand (vehicles are expensive). */
export const OHT_FLEET = 10

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
  /** Moves delivered tool → tool, skipping the stocker. */
  direct = 0
  doneLog: { t: number; mode: Mode; dur: number }[] = []
  /** 0 = night, 1 = day (driven by the lighting). */
  daylight = 1
  /** People are on the floor only in daylight; night is a lights-out shift. */
  staffed = true

  setDaylight(d: number) {
    this.daylight = d
    const staffed = d > 0.35
    if (staffed === this.staffed) return
    this.staffed = staffed
    for (const w of [...this.techs, ...this.operators]) {
      if (w.tool && w.tool.tech === w) w.tool.tech = null
      w.tool = null
      w.plan = []
      w.path = []
      w.working = false
      w.carry = null
      w.task = null
      w.moving = false
      // night: everyone leaves; morning: the shift starts at its home spots
      w.pos = [...w.home] as P2
      w.onCall = false
      w.eta = 0
      w.label = staffed ? 'Starting shift' : 'Off shift (lights-out night)'
    }
  }

  /**
   * Finished-goods shipping (final step):
   * FG stocker S11 → box packing + palletizing (level 3) → pallet buffer conveyor →
   * exterior freight elevator (west façade) → truck reversed up to the lift → leaves.
   */
  shipping = {
    truck: null as Truck | null,
    nextIn: 6,
    trucks: 0,
    units: 0,
    seq: 1,
    /** Pallet cycle progress 0..1 (see PACK_END / WRAP_IN / WRAP_END), or -1 when idle. */
    pack: -1,
    /** FG lots delivered by ARV to the packing station infeed. */
    packIn: [] as Lot[],
    /** Pallets wrapped and waiting on the buffer conveyor at the lift (level 3). */
    buffer: 2,
    /** Freight lift car: y 0 = dock height (ground), 1 = level 3. */
    lift: { y: 1, phase: 'top' as 'top' | 'load' | 'down' | 'unload' | 'up', carrying: false, roll: 0 },
  }
  static readonly BUFFER_CAP = 4

  /** Truck routes (ground level): service road along the back and the west side, reverse up to the lift. */
  private routes = (() => {
    const B = layout().bounds
    const liftZ = 9.5 // freight lift on the west façade, beside the packing area
    const liftX = B.x0 - 1.7
    const truckX = liftX - 1.7 - 4.35 // truck centre when its rear is at the lift door
    const zr = B.z0 - 18 // north service road
    const xr = B.x0 - 20 // west service road
    const bez = (p0: P2, p1: P2, p2: P2, n = 24): P2[] =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n
        const u = 1 - t
        return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]] as P2
      })
    return {
      liftX,
      liftZ,
      truckX,
      packX: B.x0 + 14, // box packing station (level 3), south of the aisle, infeed on the aisle side
      packZ: liftZ + 1.9,
      buildX: B.x0 + 10.6, // pallet build position on the pallet line, fed by the carton conveyor
      wrapX: B.x0 + 8.5, // in-line stretch-wrapper on the pallet line (z = liftZ)
      zr,
      xr,
      inbound: makePath(roundCorners([[B.x1 + 170, zr], [xr, zr], [xr, liftZ + 10]], 8, false, 10), false),
      reverse: makePath(bez([xr, liftZ + 10], [xr, liftZ], [truckX, liftZ]), false),
      leave: makePath(
        [...bez([truckX, liftZ], [xr, liftZ], [xr, liftZ - 10]), ...roundCorners([[xr, liftZ - 10], [xr, zr], [B.x1 + 190, zr]], 8, false, 10).slice(1)],
        false,
      ),
    }
  })()

  get truckRoutes() {
    return this.routes
  }

  /** Simulation speed (fixed; the UI has no speed control). */
  speed = 2
  version = 0

  constructor() {
    const now = new Date()
    now.setHours(14, 12, 0, 0)
    this.clock = now.getTime()
    const dayFrac = (14 * 60 + 12 - 7 * 60) / (24 * 60) // day starts 07:00
    this.unitsToday = Math.round(DAILY_TARGET * dayFrac * 0.97)
    // trucks already gone today: most of the output so far, in full truck loads
    this.shipping.trucks = Math.floor((this.unitsToday * 0.9) / (PALLET_CAP * LOTS_PER_PALLET * 11_520))
    this.shipping.units = this.shipping.trucks * PALLET_CAP * LOTS_PER_PALLET * 11_520
    for (let h = 7; h < 14; h++) {
      this.hourly.push({ h, units: Math.round((DAILY_TARGET / 24) * rand(0.88, 1.05)), plan: Math.round(DAILY_TARGET / 24) })
    }
    this.hourly.push({ h: 14, units: Math.round((DAILY_TARGET / 24) * 0.2 * 0.97), plan: Math.round(DAILY_TARGET / 24) })

    for (const tp of this.L.tools) this.addTool(tp)
    this.addShipTools()
    for (const sp of this.L.stockers) {
      const s: Stocker = { ...sp, lots: [], reserved: 0, crane: { x: 0.5, y: 0.2, tx: 0.5, ty: 0.2 }, activeT: 0, moves: 0 }
      const n = sp.idx === 0 ? 24 : sp.idx === 11 ? 18 : Math.round(rand(4, 12))
      for (let i = 0; i < n; i++) s.lots.push(this.newLot(sp.idx))
      this.stockers.push(s)
    }
    // a pallet's worth of FG lots already at the packing station
    this.shipping.packIn.push(...this.stockers[11].lots.splice(0, LOTS_PER_PALLET))
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
    for (let i = 0; i < OHT_FLEET; i++) {
      this.oht.push({
        id: `OHT-${String(i + 1).padStart(2, '0')}`, s: (ohtLoop.length / OHT_FLEET) * i, v: 1.5, job: null,
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
      label: 'Standing by', task: null, working: false, timer: rand(0, 4), carry: null, tool: null, home, jobs: Math.round(rand(8, 30)), onCall: false, eta: 0,
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

  /** Box packing station + stretch-wrapper: real machines with status, alarms and stats. */
  private addShipTools() {
    const r = this.routes
    const place = (id: string, model: string, name: string, x: number, z: number, rotY: number, size: Vec3, port: Vec3): ToolPlace => {
      const pos: Vec3 = [x, 0, z]
      return { id, proc: 'tnr', aux: true, model, name, pos, rotY, ports: [port], side: -1, size, inPort: port, outPort: port }
    }
    for (const tp of [
      // rotated so the carton exit faces west (towards the pallet line); ARVs drop reels at the erector end
      place('PACK-01', 'packStation', 'Box packing station', r.packX, r.packZ, Math.PI, [3.4, 1.6, 2.0], [r.packX + 1.0, 0.9, r.packZ - 0.95]),
      place('WRAP-01', 'stretchWrapper', 'Pallet stretch-wrapper', r.wrapX, r.liftZ, 0, [2.2, 2.6, 2.6], [r.wrapX, 0.9, r.liftZ]),
    ]) {
      this.addTool(tp)
      const t = this.toolById.get(tp.id)!
      t.ship = true
      t.uph = 52_000
      t.unitsToday = Math.round((t.runS * t.uph * t.perf) / 3600)
      t.uphHist = t.uphHist.map(() => t.uph * rand(0.75, 1.0))
      t.state = 'idle'
    }
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
    if (soft && Math.random() < 0.65) a.ai = { stage: 0, t: 0, action: pick(AI_ACTIONS[t.ship ? t.model : t.proc] ?? ['Parameter tuning']) }
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
      // remote reset while someone walks there: they drop the job (a call-out then just leaves)
      if ((w.task === 'repair' || w.task === 'reset') && !w.working) {
        this.abort(w)
        if (w.onCall) w.plan = [{ go: w.home, label: 'Not needed any more · leaving site' }]
      }
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
      if (t.id === 'PACK-01') this.feedPacker(t)
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
      // unload: straight to a ready downstream tool on the same transport mode (saves the stocker
      // round trip: one move instead of two), else to the downstream stocker
      if (t.out && !t.outbound) {
        const d = this.directTarget(t, stage)
        if (d) {
          const job: Job = {
            id: this.jobSeq++, mode: p.mode, lot: t.out, created: this.t,
            from: { kind: 'tool', id: t.id, port: t.outPort },
            to: { kind: 'tool', id: d.id, port: d.inPort },
          }
          t.outbound = job
          d.inbound = job
          this.jobs.push(job)
          this.startJob(job)
          this.direct++
          continue
        }
      }
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

  /** A downstream tool that can take this tool's finished lot right now, on the same transport mode. */
  private directTarget(t: Tool, stage: number): Tool | null {
    const nxt = PROCESSES[stage + 1]
    if (!nxt || nxt.mode !== PROCESSES[stage].mode) return null
    let best: Tool | null = null
    let bestScore = Infinity
    for (const d of this.tools) {
      if (d.proc !== nxt.id || d.aux || d.state === 'alarm' || d.next || d.inbound) continue
      // empty tools first, then the nearest
      const score = (d.lot ? 1000 : 0) + Math.abs(d.pos[0] - t.pos[0]) + Math.abs(d.pos[2] - t.pos[2])
      if (score < bestScore) {
        bestScore = score
        best = d
      }
    }
    return best
  }

  /** Urgent move: the tool runs dry (nothing staged or running) or is blocked by a full output port. */
  private urgent(job: Job) {
    const to = job.to.kind === 'tool' ? this.toolById.get(job.to.id) : null
    if (to && !to.lot) return true
    const from = job.from.kind === 'tool' ? this.toolById.get(job.from.id) : null
    return !!from && !!from.lot && from.progress >= 1
  }

  /** One ARV move at a time: an FG lot from S11 to the packing-station infeed, until a pallet's worth is there. */
  private feedPacker(t: Tool) {
    const s = this.stockers[11]
    if (t.inbound || t.state === 'alarm' || this.shipping.packIn.length >= LOTS_PER_PALLET || !s.lots.length) return
    const job: Job = {
      id: this.jobSeq++, mode: 'ARV', lot: s.lots.shift()!, created: this.t,
      from: { kind: 'stocker', id: s.id, port: this.portFor(s, 'ARV') },
      to: { kind: 'tool', id: t.id, port: t.inPort },
    }
    t.inbound = job
    this.jobs.push(job)
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
      if (t.ship) this.shipping.packIn.push(job.lot)
      else t.next = job.lot
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
    this.stepShipping(dt)
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
        if (t.aux && !t.ship && Math.random() < dt / 40) {
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
      if (t.aux && !t.ship && t.state === 'run' && Math.random() < dt / 300) {
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
    if (fg.lots.length > 120) fg.lots.splice(0, 20) // overflow guard; trucks normally empty the FG stocker
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
    // pair free vehicles with waiting jobs, shortest empty run first (urgent jobs count as half a loop closer)
    const queue = this.jobs.filter(j => j.mode === 'OHT' && !j.vehicle).map(j => ({ j, s: project(loop, [j.from.port[0], j.from.port[2]]).s, u: this.urgent(j) }))
    const free = this.oht.filter(v => v.phase === 'free')
    while (queue.length && free.length) {
      let bi = 0
      let bv = 0
      let bc = Infinity
      queue.forEach((q, i) => free.forEach((v, k) => {
        const c = ahead(loop, v.s, q.s) - (q.u ? L / 2 : 0)
        if (c < bc) {
          bc = c
          bi = i
          bv = k
        }
      }))
      const [{ j }] = queue.splice(bi, 1)
      const [v] = free.splice(bv, 1)
      v.job = j
      v.phase = 'toPick'
      j.vehicle = v.id
      j.started = this.t
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
    // pair available ARVs with waiting jobs, shortest empty run first (urgent jobs get a 60 m head start)
    const queue = this.jobs.filter(j => j.mode === 'ARV' && !j.vehicle).map(j => ({ j, st: this.arvStation(j.from.port), u: this.urgent(j) }))
    const avail = this.arvs.filter(a => !a.job && a.battery >= 15 && (a.phase === 'parked' || a.phase === 'toPark'))
    while (queue.length && avail.length) {
      let bi = 0
      let ba = 0
      let bc = Infinity
      queue.forEach((q, i) => avail.forEach((a, k) => {
        const c = Math.abs(a.pos[0] - q.st[0]) + Math.abs(a.pos[1] - q.st[1]) - (q.u ? 60 : 0)
        if (c < bc) {
          bc = c
          bi = i
          ba = k
        }
      }))
      const [{ j, st }] = queue.splice(bi, 1)
      const [best] = avail.splice(ba, 1)
      best.job = j
      best.phase = 'toPick'
      best.path = this.keepRight(this.route(best.pos, st, ARV_LANE, ARV_LANE), ARV_KEEP)
      j.vehicle = best.id
      j.started = this.t
    }
    for (const a of this.arvs) {
      a.moving = false
      if (a.phase === 'parked') {
        a.battery = Math.min(100, a.battery + dt * 0.25)
        a.lift += (0 - a.lift) * Math.min(1, dt * 3)
        continue
      }
      a.battery = Math.max(5, a.battery - dt * 0.03)
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
        // opportunity charging: contacts at every transfer port
        a.battery = Math.min(100, a.battery + dt * 0.25)
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
            a.path = this.keepRight(this.route(a.pos, this.arvStation(a.job!.to.port), ARV_LANE, ARV_LANE), ARV_KEEP)
          } else {
            a.job = null
            a.moves++
            a.slidePort = null
            // never idle in a lane: head back to the dock (a new job can still grab it on the way)
            const c = this.L.chargers[a.charger]
            a.phase = 'toPark'
            a.path = this.keepRight(this.route(a.pos, [c.pos[0], c.pos[1]], ARV_LANE, ARV_LANE), ARV_KEEP)
          }
        }
      }
    }
  }

  /** True when another ARV (or, as an emergency stop, a person) is in the safety field ahead. */
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
    // people give way to vehicles; the ARV only makes an emergency stop for someone right in front
    for (const w of this.techs) if (ahead2(w.pos, 1.0, 0.45)) return true
    for (const w of this.operators) if (ahead2(w.pos, 1.0, 0.45)) return true
    const ia = this.arvs.indexOf(a)
    for (const b of this.arvs) {
      if (b === a || !ahead2(b.pos, 1.7, 0.75)) continue
      // both see each other (head-on / crossing): the lower number has right of way
      const bx = Math.sin(b.heading)
      const bz = Math.cos(b.heading)
      const mutual = (a.pos[0] - b.pos[0]) * bx + (a.pos[1] - b.pos[1]) * bz > 0.15
      if (mutual && ia < this.arvs.indexOf(b)) continue
      return true
    }
    return false
  }

  /**
   * People give way to transport: a walking person stops when the next step would take them
   * into the path of an ARV within 3 m. Someone already standing in the path keeps walking to clear it.
   */
  private mustGiveWay(w: Worker): boolean {
    const next = w.path[0]
    if (!next) return false
    const dx = next[0] - w.pos[0]
    const dz = next[1] - w.pos[1]
    const l = Math.hypot(dx, dz) || 1
    const step: P2 = [w.pos[0] + (dx / l) * 0.5, w.pos[1] + (dz / l) * 0.5]
    for (const a of this.arvs) {
      if (!a.moving && !a.yielding) continue
      const fx = Math.sin(a.heading)
      const fz = Math.cos(a.heading)
      const lat = (p: P2) => Math.abs((p[0] - a.pos[0]) * fz - (p[1] - a.pos[1]) * fx)
      const along = (p: P2) => (p[0] - a.pos[0]) * fx + (p[1] - a.pos[1]) * fz
      const inPathNow = lat(w.pos) < 0.65 && along(w.pos) > -0.6 && along(w.pos) < 3
      const inPathNext = lat(step) < 0.65 && along(step) > -0.6 && along(step) < 3
      if (inPathNext && !inPathNow) return true
    }
    return false
  }

  /** Offsets an axis-aligned route to the right-hand lane (vehicles keep right, so opposing traffic passes). */
  private keepRight(pts: P2[], off: number | ((a: P2, b: P2) => number), keepEnd = false): P2[] {
    if (pts.length < 2) return pts
    const o = (i: number) => (typeof off === 'number' ? off : off(pts[i - 1], pts[i]))
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
      const o1 = o(i)
      const o2 = i + 1 < pts.length ? o(i + 1) : o1
      out.push([pts[i][0] + n1[0] * o1 + (same ? 0 : n2[0] * o2), pts[i][1] + n1[1] * o1 + (same ? 0 : n2[1] * o2)])
    }
    // people go to an exact standing spot; vehicles stay in their lane
    if (keepEnd) out[out.length - 1] = pts[pts.length - 1]
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
    // packing area: stand behind the machine (aisle side), facing it
    if (t.ship) return { p: [t.pos[0] + (t.id === 'PACK-01' ? -1.0 : 0) + rand(-0.3, 0.3), t.pos[2] - t.size[1] / 2 - 0.6], face: 0 }
    const aisle = t.pos[2] < 0 ? AISLE_N : AISLE_S
    // conveyor rooms have drop-lift columns at 0.75–1.25 m from the aisle centre: stand inside them
    const off = this.inConveyorAisle([t.pos[0], aisle]) ? 0.45 : 1.3
    return { p: [t.pos[0] + rand(-0.4, 0.4), aisle + t.side * off], face: t.side === -1 ? Math.PI : 0 }
  }

  /** True inside the aisle of a conveyor-served room (Wire Bond, Molding, Marking). */
  private inConveyorAisle(p: P2) {
    return this.L.zones.some(z => z.proc.mode === 'CONV' && p[0] > z.x0 - 0.5 && p[0] < z.x1 + 0.5 && Math.abs(p[1] - z.aisleZ) < 2.5)
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

  /**
   * Night call-out: an off-shift technician travels in (ETA), walks to the tool,
   * repairs it and leaves. Returns false when nobody can be called.
   */
  callTech(id: string): boolean {
    const t = this.toolById.get(id)
    if (!t?.alarm || t.tech || this.staffed) return false
    const w = this.techs.find(x => !x.onCall)
    if (!w) return false
    this.claim(w, t)
    w.onCall = true
    w.eta = rand(18, 30)
    w.pos = [...w.home] as P2
    w.task = 'repair'
    const sp = this.spot(t)
    w.plan = [
      { go: sp.p, face: sp.face, label: `Called in · walking to ${t.id}` },
      { work: rand(14, 24), label: `Night call-out repair on ${t.id}`, done: () => t.alarm && this.clear(t, `Night call-out · ${w.name}`) },
      { go: w.home, label: 'Repair done · leaving site' },
    ]
    w.label = 'On the way to site'
    return true
  }

  private stepWorkers(dt: number) {
    for (const w of [...this.techs, ...this.operators]) {
      if (!this.staffed) {
        // lights-out night: only called-in technicians are active
        if (!w.onCall) continue
        if (w.eta > 0) {
          w.eta = Math.max(0, w.eta - dt)
          w.label = `On the way to site · ETA ${Math.ceil(w.eta)} s`
          continue
        }
        if (!w.plan.length) {
          w.onCall = false
          w.label = 'Off shift (lights-out night)'
          continue
        }
      }
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
        if (!this.staffed) continue
        this.planFor(w)
        if (!w.plan.length) continue
      }
      const st = w.plan[0]
      if ('go' in st) {
        w.label = st.label
        w.working = false
        if (!w.path.length) {
          // walk at the aisle edge, except in conveyor rooms where the drop lifts stand there: walk the centre
          const lane = (a: P2, b: P2) => (this.inConveyorAisle([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) ? 0.3 : WALK_KEEP)
          w.path = this.keepRight(this.route(w.pos, st.go), lane, true)
        }
        if (this.mustGiveWay(w)) continue
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
          w.plan.shift()
          st.done?.()
          w.working = false
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

  // ------------------------------------------------------------------ shipping
  private stepShipping(dt: number) {
    const sh = this.shipping
    const r = this.routes
    // 1. ARV-fed packing station → carton conveyor → pallet build → in-line wrapper → buffer (~16 s a pallet)
    const packT = this.toolById.get('PACK-01')!
    const wrapT = this.toolById.get('WRAP-01')!
    if (sh.pack < 0 && packT.state !== 'alarm' && sh.buffer < World.BUFFER_CAP && sh.packIn.length >= LOTS_PER_PALLET) {
      sh.packIn.splice(0, LOTS_PER_PALLET)
      sh.pack = 0
    }
    // packing needs the packing station, wrapping needs the wrapper; the roller moves between them always run
    const busy = sh.pack < 0 ? null : sh.pack < PACK_END ? packT : sh.pack >= WRAP_IN && sh.pack < WRAP_END ? wrapT : undefined
    if (busy === undefined || (busy && busy.state !== 'alarm')) {
      sh.pack += dt / 16
      if (sh.pack >= 1) {
        sh.pack = -1
        sh.buffer++
      }
    }
    if (packT.state !== 'alarm') {
      const on = sh.pack >= 0 && sh.pack < PACK_END
      packT.state = on ? 'run' : 'idle'
      if (on) packT.reason = 'Packing reels into cartons'
      else if (sh.buffer >= World.BUFFER_CAP) packT.reason = 'Blocked – lift buffer full'
      else if (sh.pack >= 0) packT.reason = 'Pallet leaving for the wrapper'
      else if (packT.inbound) packT.reason = `Waiting for FG lots (ARV in transit, ${sh.packIn.length}/${LOTS_PER_PALLET} here)`
      else packT.reason = 'Starved – FG stocker empty'
    }
    // 6 turns per wrap, ending square to the line so the pallet rolls straight out
    wrapT.anim = [Math.min(1, Math.max(0, (sh.pack - WRAP_IN) / (WRAP_END - WRAP_IN))) * Math.PI * 12]
    if (wrapT.state !== 'alarm') {
      const on = sh.pack >= WRAP_IN && sh.pack < WRAP_END
      wrapT.state = on ? 'run' : 'idle'
      if (on) wrapT.reason = 'Stretch-wrapping pallet'
      else if (sh.pack >= WRAP_END) wrapT.reason = 'Pallet rolling to the lift buffer'
      else if (sh.pack >= PACK_END) wrapT.reason = 'Pallet rolling in'
      else wrapT.reason = 'Waiting for packed pallet'
    }
    // 2. truck arrival
    if (!sh.truck) {
      sh.nextIn -= dt
      if (sh.nextIn <= 0) {
        sh.truck = {
          id: `TRK-${String(sh.seq++).padStart(3, '0')}`, dest: pick(DESTS), phase: 'inbound', s: 0, v: 10,
          pos: [...r.inbound.pts[0]] as P2, heading: -Math.PI / 2, pallets: 0, units: 0, doors: 0, timer: 0, moving: -1,
        }
      }
    }
    const t = sh.truck
    // 3. freight lift: carry one pallet down per trip while a truck is open at the dock
    const lift = sh.lift
    const truckReady = !!t && t.phase === 'loading' && t.doors >= 1 && t.pallets < PALLET_CAP
    switch (lift.phase) {
      case 'top':
        if (truckReady && sh.buffer > 0) {
          sh.buffer--
          lift.roll = 0
          lift.phase = 'load'
        }
        break
      case 'load':
        // the head pallet rolls off the buffer conveyor into the car
        lift.roll = Math.min(1, lift.roll + dt / 1.8)
        if (lift.roll >= 1) {
          lift.carrying = true
          lift.phase = 'down'
        }
        break
      case 'down':
        lift.y = Math.max(0, lift.y - dt / 5)
        if (lift.y <= 0) {
          lift.phase = 'unload'
          if (t) t.moving = 0
        }
        break
      case 'unload':
        if (!t || t.moving < 0) {
          lift.carrying = false
          lift.phase = 'up'
        }
        break
      case 'up':
        lift.y = Math.min(1, lift.y + dt / 4)
        if (lift.y >= 1) lift.phase = 'top'
        break
    }
    if (!t) return
    const drive = (path: Path, vmax: number, reverse: boolean) => {
      const remain = path.length - t.s
      t.v += (Math.min(vmax, Math.sqrt(2 * 1.5 * Math.max(0, remain))) - t.v) * Math.min(1, dt * 1.5)
      t.s = Math.min(path.length, t.s + Math.max(0.3, t.v) * dt)
      const { p, d } = pathAt(path, t.s)
      t.pos = [p[0], p[1]]
      t.heading = Math.atan2(d[0], d[1]) + (reverse ? Math.PI : 0)
      return t.s >= path.length - 0.01
    }
    switch (t.phase) {
      case 'inbound':
        if (drive(r.inbound, 9, false)) {
          t.phase = 'reversing'
          t.s = 0
          t.v = 0
        }
        break
      case 'reversing':
        if (drive(r.reverse, 1.6, true)) {
          t.phase = 'loading'
          t.timer = 0
        }
        break
      case 'loading':
        t.doors = Math.min(1, t.doors + dt * 0.6)
        if (t.moving >= 0) {
          // pallet rolls from the lift car into the truck
          t.moving += dt / 2.4
          if (t.moving >= 1) {
            t.moving = -1
            t.pallets++
            // the sim runs lots faster than the clock: never ship more than the line has made
            t.units += Math.min(LOTS_PER_PALLET * 11_520, Math.max(0, Math.round(this.unitsToday * 0.98 - sh.units - t.units)))
            t.timer = 0
          }
          break
        }
        t.timer += dt
        if (
          t.pallets >= PALLET_CAP ||
          (t.pallets > 0 && t.timer > 30 && sh.buffer === 0 && sh.pack < 0 && lift.phase === 'top')
        ) {
          t.phase = 'closing'
        }
        break
      case 'closing':
        t.doors = Math.max(0, t.doors - dt * 0.6)
        if (t.doors <= 0) {
          t.phase = 'leaving'
          t.s = 0
          t.v = 0
        }
        break
      case 'leaving':
        if (drive(r.leave, 11, false)) {
          sh.trucks++
          sh.units += t.units
          sh.truck = null
          sh.nextIn = 14
        }
        break
    }
  }

  /** Man-to-machine ratio for a zone: assigned operators vs machines (production + auxiliary). */
  mmr(proc: ProcId): { ops: number; machines: number; label: string } {
    const ops = this.operators.filter(o => o.zone === proc).length
    const machines = this.tools.filter(t => t.proc === proc && !t.ship).length
    const per = ops ? machines / ops : 0
    return { ops, machines, label: ops ? `1 : ${per % 1 ? per.toFixed(1) : per}` : '—' }
  }

  // ------------------------------------------------------------------ KPIs
  /** Packing + shipping equipment, for the dashboards. */
  shipUnits(): ShipUnit[] {
    const sh = this.shipping
    const r = this.routes
    const t = sh.truck
    const truckText = { inbound: 'Arriving', reversing: 'Reversing to lift', loading: `Loading ${t?.pallets ?? 0}/${PALLET_CAP}`, closing: 'Closing doors', leaving: 'Departing' }
    const liftText = { top: 'At level 3', load: 'Loading pallet', down: 'Descending', unload: 'Unloading', up: 'Returning' }
    const mach = (id: 'PACK-01' | 'WRAP-01'): ShipUnit => {
      const m = this.toolById.get(id)!
      return { id, name: m.name, model: m.model, state: m.state, text: m.alarm?.ai ? 'AI recovery' : m.reason, pos: [m.pos[0], 1, m.pos[2]], tool: true }
    }
    return [
      mach('PACK-01'),
      mach('WRAP-01'),
      { id: 'LIFT-01', name: 'Freight lift', model: 'pallet', state: sh.lift.phase === 'top' ? 'idle' : 'run', text: liftText[sh.lift.phase], pos: [r.liftX, 1, r.liftZ] },
      { id: 'TRUCK', name: 'Truck dock', model: 'truck', state: t ? 'run' : 'idle', text: t ? truckText[t.phase] : `Next truck in ${Math.ceil(sh.nextIn)} s`, pos: [r.truckX, 1.8 - FLOOR_Y, r.liftZ] },
    ]
  }

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
