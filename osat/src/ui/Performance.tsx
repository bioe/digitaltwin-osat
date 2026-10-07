import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useTick } from '../store'
import { fmt } from './bits'

const AXIS = { fill: '#7f9bbf', fontSize: 10 }

function Kpi({ label, value, delta, good }: { label: string; value: string; delta: string; good: boolean }) {
  return (
    <div className="cc-card px-2 py-1.5">
      <div className="text-[10px] text-[var(--ink2)]">{label}</div>
      <div className="num text-[22px] leading-tight text-white">{value}</div>
      <div className="text-[10.5px]" style={{ color: good ? '#34d399' : '#38bdf8' }}>{delta}</div>
    </div>
  )
}

function Ring({ value }: { value: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 90 90" className="h-[88px] w-[88px]">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#12304f" strokeWidth="8" />
      <circle
        cx="45" cy="45" r={r} fill="none" stroke="#22e07a" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 45 45)"
        style={{ filter: 'drop-shadow(0 0 4px #22e07a)' }}
      />
      <text x="45" y="40" textAnchor="middle" fill="#9fb3cc" fontSize="10" fontFamily="Rajdhani">OEE</text>
      <text x="45" y="57" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700" fontFamily="Rajdhani">{(value * 100).toFixed(1)}%</text>
    </svg>
  )
}

/** Right panel: line KPIs, hourly throughput against plan, OEE breakdown. */
export function Performance() {
  const w = useTick(1)
  const k = w.kpis()
  const prod = w.tools.filter(t => !t.aux)
  const sum = (f: (t: (typeof prod)[number]) => number) => prod.reduce((a, t) => a + f(t), 0) / prod.length
  const A = sum(t => (t.runS + t.idleS) / (t.runS + t.idleS + t.alarmS))
  const P = sum(t => (t.runS / (t.runS + t.idleS)) * t.perf)
  const Q = 0.9952
  const att = k.units / Math.max(1, k.plan)
  const outRate = w.tools.filter(t => t.proc === 'tnr' && !t.aux && t.state === 'run').reduce((a, t) => a + t.uph * t.perf, 0)
  const cycleH = (k.wipLots * 11520) / Math.max(1, outRate || 50_000)
  const aiOpen = w.tools.filter(t => t.alarm?.ai).length
  const data = w.hourly.map(h => ({ hour: `${String(h.h).padStart(2, '0')}:00`, actual: Math.round(h.units), plan: h.plan }))
  return (
    <section className="cc-panel flex min-h-0 flex-col p-2.5">
      <div className="cc-title mb-2">Production performance</div>
      <div className="grid grid-cols-4 gap-1.5">
        <Kpi label="Total output" value={`${fmt(k.units / 1000)} K`} delta={`${att >= 1 ? '▲' : '▼'} ${((att - 1) * 100).toFixed(1)}% vs plan`} good={att >= 0.97} />
        <Kpi label="Plan achievement" value={`${(att * 100).toFixed(1)}%`} delta={`plan ${fmt(k.plan / 1000)} K`} good={att >= 0.97} />
        <Kpi label="Cycle time (avg)" value={`${cycleH.toFixed(1)} h`} delta="wafer in → reel out" good />
        <Kpi label="Active alarms" value={String(k.alarm)} delta={`${aiOpen} handled by AI`} good={k.alarm < 5} />
      </div>
      <div className="mt-2 flex min-h-0 flex-1 gap-2">
        <div className="cc-card flex min-w-0 flex-1 flex-col p-1.5">
          <div className="flex items-center justify-between px-1 text-[10.5px] text-[var(--ink2)]">
            <span>Throughput (units / hour)</span>
            <span className="flex gap-2">
              <span><span className="dot mr-1" style={{ background: '#3b82f6' }} />Actual</span>
              <span><span className="dot mr-1" style={{ background: '#fbbf24' }} />Plan</span>
            </span>
          </div>
          <div className="min-h-[110px] flex-1">
            <ResponsiveContainer>
              <ComposedChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="hour" tick={AXIS} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}K`} width={40} />
                <Tooltip cursor={{ fill: '#ffffff08' }} contentStyle={{ background: '#0b1526', border: '1px solid #38bdf833', fontSize: 11 }} formatter={(v, n) => [fmt(Number(v)), n === 'actual' ? 'Actual' : 'Plan']} />
                <Bar dataKey="actual" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line dataKey="plan" stroke="#fbbf24" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="cc-card flex w-[118px] shrink-0 flex-col items-center justify-center p-1.5">
          <Ring value={A * P * Q} />
          <div className="mt-1 w-full space-y-0.5 text-[10.5px]">
            {([['Availability', A], ['Performance', P], ['Quality', Q]] as const).map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-[var(--ink2)]">{l}</span>
                <span className="num text-[12px] text-white">{(v * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
