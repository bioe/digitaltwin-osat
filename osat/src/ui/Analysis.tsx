import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DAILY_TARGET } from '../data/processes'
import type { LivePoint, LiveTick, RunRequest, RunResult, WorkerOut } from '../sim/analysis.worker'
import { STATUS_HEX } from '../scene/materials'
import { BASE_CONFIG, world, type SimConfig } from '../sim/world'
import { useUI } from '../store'
import { fmt } from './bits'

// ------------------------------------------------------------------ what-if runs
/** Warm-up and measured steps per run (0.2 sim-s each: 15 min warm-up from lean WIP, 20 min measured). */
const WARM = 4500
const STEPS = 6000
const SEED = 7
const PLAN_UPH = DAILY_TARGET / 24

type Key = keyof SimConfig
type Metric = Exclude<keyof RunResult, 'id'>

interface Sweep {
  key: Key
  title: string
  what: string
  values: number[]
  /** Shown on the x axis (release is shown as lots per hour, the setting is s per lot). */
  x: (v: number) => number
  xLabel: string
  side: { metric: Metric; label: string; unit: string; color: string }
}

const SWEEPS: Sweep[] = [
  {
    key: 'arv', title: 'AMR fleet (ARV)', what: 'Robots for Package Saw → Test → Inspection → T&R → packing',
    values: [4, 5, 6, 8, 10, 12, 14], x: v => v, xLabel: 'ARVs',
    side: { metric: 'arvUtil', label: 'ARV busy', unit: '%', color: '#2dd4bf' },
  },
  {
    key: 'oht', title: 'OHT carriers', what: 'Overhead hoist vehicles for Sort → Grind → Saw → Die Attach',
    values: [5, 6, 8, 10, 12, 14, 16], x: v => v, xLabel: 'OHT vehicles',
    side: { metric: 'ohtUtil', label: 'OHT busy', unit: '%', color: '#60a5fa' },
  },
  {
    key: 'techs', title: 'Technicians', what: 'Repair hard alarms and PM',
    values: [2, 3, 4, 6, 8, 10], x: v => v, xLabel: 'technicians',
    side: { metric: 'down', label: 'Tools down', unit: '%', color: '#f87171' },
  },
  {
    key: 'operators', title: 'Operators', what: 'Reset soft alarms the AI does not handle, attend tools',
    values: [6, 9, 12, 17, 21, 25], x: v => v, xLabel: 'operators',
    side: { metric: 'down', label: 'Tools down', unit: '%', color: '#f87171' },
  },
  {
    key: 'takt', title: 'Production release', what: 'Wafer lots started per hour',
    values: [72, 54, 45, 40, 36, 32, 29], x: v => Math.round(3600 / v), xLabel: 'lots / h',
    side: { metric: 'wip', label: 'WIP', unit: ' lots', color: '#c084fc' },
  },
]

const idOf = (c: SimConfig) => `${c.oht}/${c.arv}/${c.operators}/${c.techs}/${c.takt}`

/** Results survive closing the page; a small worker pool fills them in. */
const store = {
  results: new Map<string, RunResult>(),
  pending: new Set<string>(),
  queue: [] as RunRequest[],
  listeners: new Set<() => void>(),
  workers: [] as { w: Worker; busy: boolean }[],
}
function emit() {
  store.listeners.forEach(f => f())
}
function pump() {
  if (!store.workers.length) {
    const n = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 2))
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('../sim/analysis.worker.ts', import.meta.url), { type: 'module' })
      const slot = { w, busy: false }
      w.onmessage = (e: MessageEvent<WorkerOut>) => {
        if (e.data.type !== 'result') return
        const res = e.data.result
        store.results.set(res.id, res)
        store.pending.delete(res.id)
        slot.busy = false
        emit()
        pump()
      }
      store.workers.push(slot)
    }
  }
  for (const slot of store.workers) {
    if (slot.busy || !store.queue.length) continue
    slot.busy = true
    slot.w.postMessage(store.queue.shift()!)
  }
}
function request(cfg: SimConfig, front = false) {
  const id = idOf(cfg)
  if (store.results.has(id) || store.pending.has(id)) return id
  store.pending.add(id)
  const req = { id, cfg, seed: SEED, warm: WARM, steps: STEPS }
  if (front) store.queue.unshift(req)
  else store.queue.push(req)
  emit()
  pump()
  return id
}
function clearAll() {
  store.results.clear()
  emit()
}

function useStore() {
  const [, set] = useState(0)
  useEffect(() => {
    const f = () => set(v => v + 1)
    store.listeners.add(f)
    return () => {
      store.listeners.delete(f)
    }
  }, [])
  return store
}

// ------------------------------------------------------------------ live race: today vs scenario
interface LiveRun {
  cfg: SimConfig
  ticks: LiveTick[]
  result?: RunResult
}
const LIVE_WALL_MS = 16000
const live = {
  runs: null as { today: LiveRun; scen: LiveRun } | null,
  workers: [] as Worker[],
  listeners: new Set<() => void>(),
  raf: 0,
}
function emitLive() {
  if (live.raf) return
  live.raf = requestAnimationFrame(() => {
    live.raf = 0
    live.listeners.forEach(f => f())
  })
}
/** Run today and the scenario side by side in two workers, streaming frames for the maps and charts. */
function startLive(scn: SimConfig) {
  live.workers.forEach(w => w.terminate())
  live.workers = []
  const runs = { today: { cfg: BASE_CONFIG, ticks: [] as LiveTick[] }, scen: { cfg: scn, ticks: [] as LiveTick[] } }
  live.runs = runs
  for (const key of ['today', 'scen'] as const) {
    const run: LiveRun = runs[key]
    const w = new Worker(new URL('../sim/analysis.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      if (live.runs !== runs) return
      if (e.data.type === 'tick') run.ticks.push(e.data.tick)
      else {
        run.result = e.data.result
        store.results.set(e.data.result.id, e.data.result)
        emit()
        w.terminate()
      }
      emitLive()
    }
    w.postMessage({ id: idOf(run.cfg), cfg: run.cfg, seed: SEED, warm: WARM, steps: STEPS, live: { every: 25, wallMs: LIVE_WALL_MS } } satisfies RunRequest)
    live.workers.push(w)
  }
  emitLive()
}
function useLive() {
  const [, set] = useState(0)
  useEffect(() => {
    const f = () => set(v => v + 1)
    live.listeners.add(f)
    return () => {
      live.listeners.delete(f)
    }
  }, [])
  return live.runs
}

/** Smallest setting that reaches 98 % of the best output in the sweep (the knee of the curve). */
function knee(s: Sweep, rs: (RunResult | undefined)[]) {
  const pts = s.values.map((v, i) => ({ v, r: rs[i] })).filter(p => p.r) as { v: number; r: RunResult }[]
  if (pts.length < s.values.length) return null
  const best = Math.max(...pts.map(p => p.r.uph))
  const ok = pts.filter(p => p.r.uph >= best * 0.98)
  // fewest resources; for release, the highest rate that still reaches the plateau is the useful one
  return s.key === 'takt' ? ok.reduce((m, p) => (p.v > m.v ? p : m)) : ok.reduce((m, p) => (p.v < m.v ? p : m))
}

// ------------------------------------------------------------------ page
/** What-if optimisation: one-factor sweeps of fleets, people and release against output, plus a scenario runner. */
export function Analysis() {
  const open = useUI(s => s.analysis)
  const setOpen = useUI(s => s.setAnalysis)
  const st = useStore()
  const [scn, setScn] = useState<SimConfig>(BASE_CONFIG)

  useEffect(() => {
    if (!open) return
    request(BASE_CONFIG, true)
    for (const s of SWEEPS) for (const v of s.values) request({ ...BASE_CONFIG, [s.key]: v })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen, st.results.size])

  const sweeps = SWEEPS.map(s => {
    const rs = s.values.map(v => st.results.get(idOf({ ...BASE_CONFIG, [s.key]: v })))
    return { s, rs, k: knee(s, rs) }
  })
  const total = SWEEPS.reduce((a, s) => a + s.values.length, 1)
  const done = sweeps.reduce((a, x) => a + x.rs.filter(Boolean).length, 0) + (st.results.has(idOf(BASE_CONFIG)) ? 1 : 0)
  const allDone = sweeps.every(x => x.k)
  const rec: SimConfig | null = allDone ? (Object.fromEntries(SWEEPS.map((s, i) => [s.key, sweeps[i].k!.v])) as unknown as SimConfig) : null
  const recId = rec ? idOf(rec) : null
  // the combined recommendation is simulated once the sweeps are in
  useEffect(() => {
    if (open && rec) request(rec)
  }, [open, recId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null
  const base = st.results.get(idOf(BASE_CONFIG))
  const recR = recId ? st.results.get(recId) : undefined

  return (
    <div className="cc-root fixed inset-0 z-50 flex flex-col bg-[#05080d]" role="dialog" aria-label="Analysis">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-2">
        <div className="hud-title !text-sky-300">📈 Analysis · what-if optimisation</div>
        <div className="text-[12px] text-[var(--ink3)]">
          Each curve changes one setting and keeps the others at today&apos;s line ({BASE_CONFIG.oht} OHT · {BASE_CONFIG.arv} ARV · {BASE_CONFIG.techs} technicians · {BASE_CONFIG.operators} operators · {Math.round(3600 / BASE_CONFIG.takt)} lots/h). Lean start, 15 sim-min warm-up + 20 sim-min measured per run, same random seed. Output = line throughput (lot completions per step, in units/h).
        </div>
        <div className="ml-auto flex items-center gap-3">
          {done < total && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--ink2)]">
              Simulating {done}/{total}
              <div className="h-1.5 w-28 overflow-hidden rounded bg-white/10">
                <div className="h-full bg-sky-400 transition-all" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            </div>
          )}
          <button className="btn" onClick={clearAll} title="Run every scenario again">↻ Re-run</button>
          <button className="btn !px-4" onClick={() => setOpen(false)}>✕ Close</button>
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {/* summary: today vs recommended vs own scenario */}
        <div className="mb-3 grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)' }}>
          <section className="cc-panel p-3">
            <div className="cc-title mb-2">Recommended set-up</div>
            <Compare rows={[['Today', BASE_CONFIG, base], ['Recommended', rec, recR]]} />
            <p className="mt-2 text-[11.5px] leading-snug text-[var(--ink2)]">
              For each setting, the smallest value that still reaches 98 % of the best output in its sweep (for release: the lowest rate that reaches the plateau; a higher rate only adds WIP).
              Settings interact, so the combined set-up is simulated again as a check.
            </p>
          </section>
          <section className="cc-panel p-3">
            <div className="cc-title mb-2">Try a scenario</div>
            <div className="grid grid-cols-5 gap-2">
              {SWEEPS.map(s => (
                <label key={s.key} className="text-[11px] text-[var(--ink2)]">
                  <div className="flex justify-between">
                    <span>{s.title.replace(/ \(.*\)/, '')}</span>
                    <span className="num text-[13px] text-white">{s.x(scn[s.key])}</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-sky-400"
                    min={0}
                    max={s.values.length - 1}
                    step={1}
                    value={nearestIdx(s.values, scn[s.key])}
                    onChange={e => setScn({ ...scn, [s.key]: s.values[Number(e.target.value)] })}
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button className="btn on !px-4 !text-[14px]" onClick={() => startLive(scn)}>▶ Simulate</button>
              <button className="btn" onClick={() => setScn(BASE_CONFIG)}>Reset to today</button>
              {rec && <button className="btn" onClick={() => setScn(rec)}>Load recommended</button>}
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-[var(--ink2)]">
              Simulate runs today&apos;s line and your scenario side by side from the same lean start and the same random events. Watch both floors and the charts as they run.
            </p>
          </section>
        </div>
        <LiveRace />
        {/* one row per factor: output curve + its resource curve */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))' }}>
          {sweeps.map(({ s, rs, k }) => (
            <section key={s.key} className="cc-panel p-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="cc-title">{s.title}</div>
                <div className="text-[11px] text-[var(--ink3)]">{s.what}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <SweepChart
                  s={s}
                  rs={rs}
                  metric="uph"
                  label="Output"
                  unit=" UPH"
                  color="#38bdf8"
                  format={v => `${(v / 1000).toFixed(0)}K`}
                  plan={PLAN_UPH}
                  best={k ? s.x(k.v) : null}
                />
                <SweepChart s={s} rs={rs} metric={s.side.metric} label={s.side.label} unit={s.side.unit} color={s.side.color} format={v => v.toFixed(0)} best={k ? s.x(k.v) : null} />
              </div>
              <div className="mt-1.5 text-[11.5px] text-[var(--ink2)]">
                {k ? (
                  <>
                    Best value: <span className="num text-[13px] text-white">{s.x(k.v)} {s.xLabel}</span> → {fmt(k.r.uph / 1000, 1)}K UPH
                    {s.key !== 'takt' && s.x(k.v) < s.x(BASE_CONFIG[s.key]) && <span className="text-emerald-300"> · {s.x(BASE_CONFIG[s.key]) - s.x(k.v)} fewer than today</span>}
                    {s.key !== 'takt' && s.x(k.v) > s.x(BASE_CONFIG[s.key]) && <span className="text-amber-300"> · {s.x(k.v) - s.x(BASE_CONFIG[s.key])} more than today</span>}
                  </>
                ) : (
                  'Simulating…'
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function nearestIdx(values: number[], v: number) {
  return values.reduce((m, x, i) => (Math.abs(x - v) < Math.abs(values[m] - v) ? i : m), 0)
}

/** Settings and results side by side. */
function Compare({ rows }: { rows: [string, SimConfig | null, RunResult | undefined][] }) {
  const cols: [string, (c: SimConfig | null, r?: RunResult) => string][] = [
    ['OHT', c => (c ? String(c.oht) : '–')],
    ['ARV', c => (c ? String(c.arv) : '–')],
    ['Techs', c => (c ? String(c.techs) : '–')],
    ['Operators', c => (c ? String(c.operators) : '–')],
    ['Lots/h', c => (c ? String(Math.round(3600 / c.takt)) : '–')],
    ['Output', (_, r) => (r ? `${(r.uph / 1000).toFixed(1)}K` : '…')],
    ['OHT busy', (_, r) => (r ? `${r.ohtUtil.toFixed(0)}%` : '…')],
    ['ARV busy', (_, r) => (r ? `${r.arvUtil.toFixed(0)}%` : '…')],
    ['Starved', (_, r) => (r ? r.starved.toFixed(1) : '…')],
    ['Down', (_, r) => (r ? `${r.down.toFixed(1)}%` : '…')],
  ]
  return (
    <table className="w-full text-[11.5px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--ink3)]">
          <th className="py-1 font-medium" />
          {cols.map(([h]) => <th key={h} className="py-1 text-right font-medium">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, c, r]) => (
          <tr key={name} className="border-t border-white/5">
            <td className="py-1 text-[var(--ink2)]">{name}</td>
            {cols.map(([h, f]) => <td key={h} className="num py-1 text-right text-[13px] text-white">{f(c, r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const AXIS = { fill: '#7f9bbf', fontSize: 10 }

function SweepChart(props: {
  s: Sweep
  rs: (RunResult | undefined)[]
  metric: Metric
  label: string
  unit: string
  color: string
  format: (v: number) => string
  best: number | null
  plan?: number
}) {
  const { s, rs, metric, label, unit, color, format, best, plan } = props
  const data = s.values
    .map((v, i) => ({ x: s.x(v), y: rs[i]?.[metric] }))
    .filter(d => d.y !== undefined)
    .sort((a, b) => a.x - b.x)
  const now = s.x(BASE_CONFIG[s.key])
  const bestPt = best !== null ? data.find(d => d.x === best) : undefined
  const xs = s.values.map(s.x)
  return (
    <div className="cc-card p-1.5">
      <div className="px-1 text-[10.5px] text-[var(--ink2)]">
        {label} <span className="text-[var(--ink3)]">vs {s.xLabel}</span>
      </div>
      <div className="h-[150px]">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 10, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="x" type="number" domain={[Math.min(...xs), Math.max(...xs)]} ticks={[...xs].sort((a, b) => a - b)} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={format} width={40} domain={metric === 'uph' ? [0, 'auto'] : ['auto', 'auto']} />
            <Tooltip
              cursor={{ stroke: '#ffffff30' }}
              contentStyle={{ background: '#0b1526', border: '1px solid #38bdf833', fontSize: 11 }}
              labelFormatter={v => `${v} ${s.xLabel}`}
              formatter={v => [`${metric === 'uph' ? fmt(Number(v)) : Number(v).toFixed(1)}${unit}`, label]}
            />
            {plan && <ReferenceLine y={plan} stroke="#fbbf24" strokeDasharray="5 4" label={{ value: 'plan', fill: '#fbbf24', fontSize: 10, position: 'insideTopRight' }} />}
            <ReferenceLine x={now} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'today', fill: '#94a3b8', fontSize: 10, position: 'insideTopLeft' }} />
            <Line dataKey="y" stroke={color} strokeWidth={2} dot={{ r: 3.5, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls />
            {bestPt && <ReferenceDot x={bestPt.x} y={bestPt.y} r={6} fill="#ffffff" stroke={color} strokeWidth={2} label={{ value: 'best', fill: '#e6f0ff', fontSize: 10, position: 'top' }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ live race view
const TODAY_C = '#94a3b8'
const SCEN_C = '#38bdf8'
const TOOL_C = [STATUS_HEX.run, STATUS_HEX.idle, STATUS_HEX.alarm, '#fbbf24']

function LiveRace() {
  const runs = useLive()
  if (!runs) return null
  const { today, scen } = runs
  const lt = today.ticks[today.ticks.length - 1]
  const ls = scen.ticks[scen.ticks.length - 1]
  const progress = Math.min(lt?.progress ?? 0, ls?.progress ?? 0)
  const warmMin = (WARM * 0.2) / 60
  const min = ls?.min ?? 0
  const finished = !!(today.result && scen.result)
  const n = Math.max(today.ticks.length, scen.ticks.length)
  const rows = Array.from({ length: n }, (_, i) => ({ min: +(today.ticks[i] ?? scen.ticks[i]).min.toFixed(1), t: today.ticks[i]?.point, s: scen.ticks[i]?.point }))
  const charts: { key: keyof LivePoint; title: string; unit: string; fmt: (v: number) => string }[] = [
    { key: 'uph', title: 'Line throughput', unit: ' UPH', fmt: v => `${(v / 1000).toFixed(0)}K` },
    { key: 'wip', title: 'WIP', unit: ' lots', fmt: v => v.toFixed(0) },
    { key: 'ohtUtil', title: 'OHT busy', unit: '%', fmt: v => v.toFixed(0) },
    { key: 'arvUtil', title: 'ARV busy', unit: '%', fmt: v => v.toFixed(0) },
    { key: 'starved', title: 'Tools waiting for material', unit: '', fmt: v => v.toFixed(0) },
  ]
  return (
    <section className="cc-panel mb-3 p-3">
      <div className="mb-2 flex items-center gap-3">
        <div className="cc-title">Simulation · today vs scenario</div>
        <div className="num text-[15px] text-white">t = {min.toFixed(1)} min</div>
        <div className="text-[11px]" style={{ color: min < warmMin ? '#fbbf24' : '#34d399' }}>
          {finished ? 'done' : min < warmMin ? 'warm-up from lean start' : 'measuring'}
        </div>
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10">
          <div className="h-full bg-sky-400" style={{ width: `${progress * 100}%` }} />
        </div>
        <button className="btn" onClick={() => startLive(scen.cfg)}>↻ Replay</button>
      </div>
      {finished && <Verdict today={today} scen={scen} />}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <RaceFloor name="Today" color={TODAY_C} run={today} tick={lt} other={undefined} />
        <RaceFloor name="Scenario" color={SCEN_C} run={scen} tick={ls} other={lt} />
      </div>
      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {charts.map(c => (
          <div key={c.key} className="cc-card p-1.5">
            <div className="px-1 text-[10.5px] text-[var(--ink2)]">{c.title} <span className="text-[var(--ink3)]">vs sim minutes</span></div>
            <div className="h-[150px]">
              <ResponsiveContainer>
                <LineChart
                  // the rolling throughput needs ~2 sim-min of history before it means anything
                  data={rows.map(r => (c.key === 'uph' && r.min < 2 ? { min: r.min } : { min: r.min, Today: r.t?.[c.key], Scenario: r.s?.[c.key] }))} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="min" type="number" domain={[0, ((WARM + STEPS) * 0.2) / 60]} ticks={[0, 10, 20, 30]} tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={c.fmt} width={38} domain={[0, 'auto']} />
                  <ReferenceArea x1={warmMin} x2={((WARM + STEPS) * 0.2) / 60} fill="#38bdf8" fillOpacity={0.05} />
                  {c.key === 'uph' && <ReferenceLine y={PLAN_UPH} stroke="#fbbf24" strokeDasharray="5 4" />}
                  <Tooltip
                    contentStyle={{ background: '#0b1526', border: '1px solid #38bdf833', fontSize: 11 }}
                    labelFormatter={v => `t = ${v} min`}
                    formatter={(v, name) => [`${c.key === 'uph' ? fmt(Number(v)) : Number(v).toFixed(c.key === 'wip' || c.key === 'starved' ? 0 : 1)}${c.unit}`, name]}
                  />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 10.5, color: '#9fb3cc' }} />
                  <Line dataKey="Today" stroke={TODAY_C} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line dataKey="Scenario" stroke={SCEN_C} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Final comparison over the measured window. */
function Verdict({ today, scen }: { today: LiveRun; scen: LiveRun }) {
  const a = today.result!
  const b = scen.result!
  const d = (b.uph - a.uph) / a.uph
  const vehicles = scen.cfg.oht + scen.cfg.arv - (today.cfg.oht + today.cfg.arv)
  const people = scen.cfg.techs + scen.cfg.operators - (today.cfg.techs + today.cfg.operators)
  const good = d >= -0.02
  const delta = (v: number, unit: string) => (v === 0 ? `same ${unit}` : `${v > 0 ? '+' : '−'}${Math.abs(v)} ${unit}`)
  const tone = Math.abs(d) < 0.005 ? '#9fb3cc' : d > 0 ? '#34d399' : '#f87171'
  return (
    <div className={`mb-3 flex items-center gap-6 rounded-md border px-5 py-3 ${good ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-rose-400/50 bg-rose-500/10'}`}>
      <div className="flex items-baseline gap-2" style={{ color: tone }}>
        <span className="text-[44px] leading-none">{Math.abs(d) < 0.005 ? '■' : d > 0 ? '▲' : '▼'}</span>
        <span className="num text-[72px] font-bold leading-none" style={{ textShadow: `0 0 18px ${tone}66` }}>
          {d >= 0 ? '+' : '−'}
          {Math.abs(d * 100).toFixed(1)}%
        </span>
      </div>
      <div className="min-w-0 text-[13px]">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink3)]">Throughput vs today</div>
        <div className="num mt-0.5 text-[22px] text-white">
          {fmt(b.uph / 1000, 1)}K <span className="text-[14px] text-[var(--ink3)]">UPH vs {fmt(a.uph / 1000, 1)}K today</span>
        </div>
        <div className="mt-1 text-[var(--ink2)]">
          {delta(vehicles, 'vehicles')} · {delta(people, 'people')} · WIP {b.wip.toFixed(0)} vs {a.wip.toFixed(0)} lots
          <span className="text-[var(--ink3)]"> · measured over the last 20 sim-min</span>
        </div>
      </div>
    </div>
  )
}

/** One animated floor: tool states, OHTs, ARVs and people from the run's latest frame, plus live KPI tiles. */
function RaceFloor({ name, color, run, tick, other }: { name: string; color: string; run: LiveRun; tick?: LiveTick; other?: LiveTick }) {
  const B = world.L.bounds
  const x0 = world.truckRoutes.liftX - 2
  const vb = `${x0} ${B.z0 - 1} ${B.x1 + 1 - x0} ${B.z1 - B.z0 + 2}`
  const c = run.cfg
  const p = tick?.point
  const o = other?.point
  const tile = (label: string, v: number | undefined, ov: number | undefined, f: (x: number) => string, higherIsBetter: boolean) => {
    const diff = v !== undefined && ov !== undefined ? v - ov : undefined
    const better = diff === undefined || Math.abs(diff) < 1e-9 ? null : diff > 0 === higherIsBetter
    return (
      <div className="cc-card px-2 py-1">
        <div className="text-[9.5px] uppercase tracking-wider text-[var(--ink3)]">{label}</div>
        <div className="num text-[17px] leading-tight text-white">{v === undefined ? '…' : f(v)}</div>
        {diff !== undefined && (
          <div className="text-[10px]" style={{ color: better === null ? '#9fb3cc' : better ? '#34d399' : '#fbbf24' }}>
            {diff >= 0 ? '▲' : '▼'} {f(Math.abs(diff))}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="cc-card p-2" style={{ borderColor: `${color}66` }}>
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-[13px] font-semibold text-white">{name}</span>
        <span className="num text-[12px] text-[var(--ink2)]">
          {c.oht} OHT · {c.arv} ARV · {c.techs} techs · {c.operators} operators · {Math.round(3600 / c.takt)} lots/h
        </span>
      </div>
      <svg viewBox={vb} className="block w-full rounded bg-[#081426]" style={{ aspectRatio: `${B.x1 + 1 - x0} / ${B.z1 - B.z0 + 2}` }}>
        <rect x={B.x0} y={B.z0} width={B.x1 - B.x0} height={B.z1 - B.z0} fill="#0d1d33" />
        {world.L.zones.map(z => (
          <rect key={z.proc.id} x={z.x0} y={z.z0} width={z.x1 - z.x0} height={z.z1 - z.z0} fill="none" stroke="#1e3a5f" strokeWidth={0.25} />
        ))}
        <polygon points={world.L.loops.OHT.pts.map(q => q.join(',')).join(' ')} fill="none" stroke="#60a5fa" strokeOpacity={0.45} strokeWidth={0.25} />
        <polygon points={world.L.loops.CONV.pts.map(q => q.join(',')).join(' ')} fill="none" stroke="#c084fc" strokeOpacity={0.45} strokeWidth={0.25} />
        {world.stockers.map(s => (
          <rect key={s.id} x={s.pos[0] - s.size[0] / 2} y={s.pos[2] - s.size[1] / 2} width={s.size[0]} height={s.size[1]} fill="#475569" />
        ))}
        {world.tools.map((t, i) => {
          const sw = t.rotY % Math.PI ? t.size[1] : t.size[0]
          const sd = t.rotY % Math.PI ? t.size[0] : t.size[1]
          return <rect key={t.id} x={t.pos[0] - sw * 0.45} y={t.pos[2] - sd * 0.45} width={sw * 0.9} height={sd * 0.9} fill={TOOL_C[tick?.tools[i] ?? 1]} />
        })}
        {tick?.oht.map((q, i) => <rect key={`o${i}`} x={q[0] - 0.6} y={q[1] - 0.45} width={1.2} height={0.9} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth={0.15} />)}
        {tick?.arv.map((q, i) => <circle key={`a${i}`} cx={q[0]} cy={q[1]} r={0.75} fill="#2dd4bf" stroke="#0f766e" strokeWidth={0.15} />)}
        {tick?.people.map((q, i) => <circle key={`p${i}`} cx={q[0]} cy={q[1]} r={0.38} fill="#f8fafc" />)}
      </svg>
      <div className="mt-2 grid grid-cols-6 gap-1.5">
        {tile('Throughput', p?.uph, o?.uph, v => `${(v / 1000).toFixed(1)}K`, true)}
        {tile('WIP lots', p?.wip, o?.wip, v => v.toFixed(0), false)}
        {tile('OHT busy', p?.ohtUtil, o?.ohtUtil, v => `${v.toFixed(0)}%`, true)}
        {tile('ARV busy', p?.arvUtil, o?.arvUtil, v => `${v.toFixed(0)}%`, true)}
        {tile('Starved', p?.starved, o?.starved, v => v.toFixed(0), false)}
        {tile('Down', p?.down, o?.down, v => v.toFixed(0), false)}
      </div>
    </div>
  )
}
