import { useTick, useUI } from '../store'
import { clockStr } from './bits'
import { BRAND, BRAND_SUB } from './brand'


export function TopBar() {
  const w = useTick(2)
  const setWarRoom = useUI(s => s.setWarRoom)
  return (
    <header className="relative flex h-[76px] items-center px-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="num text-[22px] leading-none">{clockStr(w.clock)}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink3)]">
            <span className="dot animate-pulse" style={{ background: 'var(--run)' }} /> Live · Shift B · Line A
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="cc-brand">{BRAND}</div>
        <div className="cc-sub mt-1">{BRAND_SUB}</div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right text-[10.5px] uppercase leading-tight tracking-[0.14em] text-[var(--ink3)]">
          QFN 5×5 · 300 mm
          <br />
          1.2 M units / day
        </div>
        <button className="btn !border-rose-400/60 !bg-rose-500/15 !px-3 !py-2 !text-[14px]" onClick={() => setWarRoom(true)}>
          ◉ WAR ROOM
        </button>
      </div>
    </header>
  )
}
