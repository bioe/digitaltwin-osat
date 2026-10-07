import type { ReactNode } from 'react'
import { STATUS_HEX, STATUS_LABEL } from '../scene/materials'
import type { State } from '../sim/world'

export const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

export function StatusBadge({ state }: { state: State }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${state === 'alarm' ? 'pulse' : ''}`}
      style={{ background: `${STATUS_HEX[state]}22`, color: STATUS_HEX[state], border: `1px solid ${STATUS_HEX[state]}66` }}
    >
      <span className="dot" style={{ background: STATUS_HEX[state] }} />
      {STATUS_LABEL[state]}
    </span>
  )
}

export function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-md border border-sky-400/10 bg-sky-950/30 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink3)]">{label}</div>
      <div className="num text-lg leading-tight" style={{ color: tone ?? 'var(--ink)' }}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--ink3)]">{sub}</div>}
    </div>
  )
}

/** State history strip (oldest → newest). */
export function Timeline({ states }: { states: State[] }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-sm" title="Last 6 minutes, 5 s per segment">
      {states.map((s, i) => (
        <div key={i} className="h-full flex-1" style={{ background: STATUS_HEX[s], marginRight: 1, opacity: 0.9 }} />
      ))}
    </div>
  )
}

/** Single-series sparkline with a hover readout. */
export function Spark({ data, color = '#38bdf8', height = 46, unit = '' }: { data: number[]; color?: string; height?: number; unit?: string }) {
  const w = 300
  const max = Math.max(1, ...data) * 1.1
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, height - (v / max) * height] as const)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const last = data[data.length - 1] ?? 0
  return (
    <div className="group relative">
      <svg viewBox={`0 0 ${w} ${height}`} className="h-[46px] w-full" preserveAspectRatio="none">
        <path d={`${d} L${w},${height} L0,${height} Z`} fill={color} opacity={0.12} />
        <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute right-0 top-0 text-[10px] text-[var(--ink2)]">
        now <span className="num text-[12px] text-[var(--ink)]">{fmt(last)}</span> {unit}
      </div>
    </div>
  )
}

export function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1 text-[12px]">
      <span className="text-[var(--ink2)]">{k}</span>
      <span className="text-right text-[var(--ink)]">{v}</span>
    </div>
  )
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="hud-title">{title}</div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function clockStr(ms: number, sec = true) {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return sec ? `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : `${p(d.getHours())}:${p(d.getMinutes())}`
}
