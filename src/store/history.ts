import type { FactoryState, Kpis } from '../sim/model'

/** 10 minutes at 1 sample per second. */
export const HISTORY_LEN = 600

/** Fixed-size ring buffer of numbers. */
export class Ring {
  private buf: Float32Array
  private head = 0
  private n = 0

  constructor(readonly size = HISTORY_LEN) {
    this.buf = new Float32Array(size)
  }

  push(v: number) {
    this.buf[this.head] = v
    this.head = (this.head + 1) % this.size
    this.n = Math.min(this.n + 1, this.size)
  }

  get length() {
    return this.n
  }

  /** Values oldest → newest. */
  values(): number[] {
    const out = new Array<number>(this.n)
    const start = (this.head - this.n + this.size) % this.size
    for (let i = 0; i < this.n; i++) out[i] = this.buf[(start + i) % this.size]
    return out
  }
}

export const SITE_SERIES = [
  'oee',
  'yield',
  'wafersOutPerHour',
  'energyMw',
  'fabKw',
  'warehouseKw',
  'officeKw',
  'officeOccupancy',
  'stockFill',
] as const satisfies readonly (keyof Kpis)[]
export type SiteSeries = (typeof SITE_SERIES)[number]

function ringMap<T>(items: T[], key: (item: T) => string, value: (item: T) => number, map: Map<string, Ring>) {
  for (const item of items) {
    const k = key(item)
    let ring = map.get(k)
    if (!ring) map.set(k, (ring = new Ring()))
    ring.push(value(item))
  }
}

/** Rolling history for site KPIs and per-asset series shown in panel charts. */
export class History {
  readonly t = new Ring()
  readonly site = Object.fromEntries(SITE_SERIES.map(k => [k, new Ring()])) as Record<SiteSeries, Ring>
  /** Tool OEE */
  readonly tools = new Map<string, Ring>()
  /** AGV battery */
  readonly agvs = new Map<string, Ring>()
  /** Rack stock */
  readonly racks = new Map<string, Ring>()
  /** Office zone kW */
  readonly zones = new Map<string, Ring>()

  record(s: FactoryState) {
    this.t.push(s.t)
    for (const k of SITE_SERIES) this.site[k].push(s.kpi[k])
    ringMap(s.tools, t => t.id, t => t.oee, this.tools)
    ringMap(s.agvs, v => v.id, v => v.battery, this.agvs)
    ringMap(s.racks, r => r.id, r => r.stock, this.racks)
    ringMap(s.office, z => z.id, z => z.kw, this.zones)
  }
}
