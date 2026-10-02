import type { ReactNode } from 'react'
import type { Alarm } from '../sim/alarms'
import type { ToolStatus } from '../sim/model'
import { ALARM, STATUS_COLOR, STATUS_LABEL, WARN } from '../theme'

export const fmt = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Sim clock: the demo day starts at 08:00:00. */
export function clock(t: number): string {
  const s = Math.floor(8 * 3600 + t) % 86400
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'warn' | 'alarm' }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1">
        {tone && (
          <span
            aria-hidden
            className="mr-0.5 inline-block h-2 w-2 translate-y-[-2px] rounded-full"
            style={{ background: tone === 'alarm' ? ALARM : WARN }}
          />
        )}
        <span className="text-lg font-semibold tabular-nums text-slate-900">{value}</span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  )
}

export function StatGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{children}</div>
}

export function StatusBadge({ status }: { status: ToolStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ background: STATUS_COLOR[status] }}
    >
      {status === 'down' ? '⚠' : '●'} {STATUS_LABEL[status]}
    </span>
  )
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {aside && <span className="text-[11px] text-slate-400">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

/** Horizontal fill bar with an optional reorder/limit marker. */
export function FillBar({ value, max, marker, low }: { value: number; max: number; marker?: number; low?: boolean }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="relative h-2.5 w-full rounded-full bg-slate-100">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: low ? WARN : '#2563eb' }}
      />
      {marker !== undefined && (
        <div
          className="absolute -top-0.5 h-3.5 w-0.5 bg-slate-700"
          style={{ left: `${(marker / max) * 100}%` }}
          title="Reorder level"
        />
      )}
    </div>
  )
}

export function AlarmList({ alarms, empty = 'No active alarms' }: { alarms: Alarm[]; empty?: string }) {
  if (!alarms.length) return <div className="text-xs text-slate-400">{empty}</div>
  return (
    <ul className="space-y-1">
      {alarms.map(a => (
        <li key={a.key} className="flex items-start gap-2 text-xs text-slate-700">
          <span className="mt-0.5 font-bold" style={{ color: a.severity === 'alarm' ? ALARM : WARN }}>
            {a.severity === 'alarm' ? '⚠' : '!'}
          </span>
          <span>
            <span className="font-medium">{a.severity === 'alarm' ? 'Alarm' : 'Warning'}:</span> {a.message}
          </span>
        </li>
      ))}
    </ul>
  )
}
