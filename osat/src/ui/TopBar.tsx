import { DAILY_TARGET } from '../data/processes'
import { STATUS_HEX } from '../scene/materials'
import { useTick, useUI } from '../store'
import { clockStr, fmt } from './bits'

export function TopBar() {
  const w = useTick(4)
  const k = w.kpis()
  const setWarRoom = useUI(s => s.setWarRoom)
  const att = k.units / Math.max(1, k.plan)
  return (
    <div className="dock flex items-center gap-4 border-b px-4 py-2">
      <div className="flex items-center gap-2.5 pr-2">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <rect x="3" y="3" width="22" height="22" rx="4" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <rect x="9" y="9" width="10" height="10" rx="1.5" fill="#38bdf8" />
          {[6, 11, 16, 21].map(v => (
            <g key={v} stroke="#38bdf8" strokeWidth="1.5">
              <line x1={v} y1="0" x2={v} y2="3" />
              <line x1={v} y1="25" x2={v} y2="28" />
            </g>
          ))}
        </svg>
        <div>
          <div className="num text-[17px] leading-none tracking-wider">OSAT-7 · ASSEMBLY &amp; TEST</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink3)]">Digital twin · Line A · QFN 5×5</div>
        </div>
      </div>
      <Kpi label="Output today" value={fmt(k.units)} sub={`plan ${fmt(k.plan)} · ${(att * 100).toFixed(1)}%`} tone={att >= 0.97 ? STATUS_HEX.run : STATUS_HEX.idle} />
      <Kpi label="Daily target" value={`${(DAILY_TARGET / 1e6).toFixed(1)} M`} sub="units / day" />
      <Kpi label="Line OEE" value={`${(k.oee * 100).toFixed(1)}%`} sub="plan 85%" />
      <Kpi label="WIP" value={fmt(k.wipLots)} sub="lots" />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-[var(--ink3)]">Equipment</span>
        <div className="num flex gap-3 text-[18px] leading-tight">
          <span style={{ color: STATUS_HEX.run }} title="Production">● {k.run}</span>
          <span style={{ color: STATUS_HEX.idle }} title="Idle">● {k.idle}</span>
          <span style={{ color: STATUS_HEX.alarm }} title="Alarm">● {k.alarm}</span>
        </div>
      </div>
      <Kpi label="AMHS moves" value={fmt(k.jobsActive)} sub={`OHT ${k.ohtBusy}/${w.oht.length} · ARV ${k.arvBusy}/${w.arvs.length}`} />
      <div className="ml-auto flex items-center gap-3">
        <SpeedControl />
        <div className="text-right">
          <div className="num text-[22px] leading-none">{clockStr(w.clock)}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--ink3)]">Shift B · live</div>
        </div>
        <button className="btn !border-rose-400/60 !bg-rose-500/15 !px-3 !py-2 !text-[14px]" onClick={() => setWarRoom(true)}>
          ◉ WAR ROOM
        </button>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="flex flex-col border-l border-white/10 pl-4">
      <span className="text-[10px] uppercase tracking-wider text-[var(--ink3)]">{label}</span>
      <span className="num text-[20px] leading-tight" style={{ color: tone }}>{value}</span>
      {sub && <span className="text-[10px] text-[var(--ink3)]">{sub}</span>}
    </div>
  )
}

function SpeedControl() {
  const w = useTick(2)
  return (
    <div className="flex gap-1" title="Simulation speed">
      {[0, 1, 2, 4].map(s => (
        <button key={s} className={`btn !px-2 ${w.speed === s ? 'on' : ''}`} onClick={() => (w.speed = s)}>
          {s === 0 ? '❚❚' : `${s}×`}
        </button>
      ))}
    </div>
  )
}
