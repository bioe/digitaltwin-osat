import { PROCESSES } from '../data/processes'
import { MODE_TINT } from '../scene/Building'
import { STATUS_HEX } from '../scene/materials'
import { useTick, useUI } from '../store'

/** Left rail: process route with live state counts and stocker WIP between steps. */
export function FlowBar() {
  const w = useTick(2)
  const select = useUI(s => s.select)
  const flyTo = useUI(s => s.flyTo)
  const sel = useUI(s => s.sel)
  const zoneOf = (id: string) => w.L.zones.find(z => z.proc.id === id)!
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
      <div className="hud-title mb-1.5 px-1">Process route</div>
      {PROCESSES.map((p, i) => {
        const tools = w.tools.filter(t => t.proc === p.id && !t.aux)
        const r = tools.filter(t => t.state === 'run').length
        const y = tools.filter(t => t.state === 'idle').length
        const a = tools.filter(t => t.state === 'alarm').length
        const s = w.stockers[i]
        const active = sel?.kind === 'zone' && sel.id === p.id
        return (
          <div key={p.id}>
            <button
              className="flex w-full items-center gap-1.5 px-1 py-[1px] text-left text-[10px] text-[var(--ink3)] hover:text-[var(--ink)]"
              onClick={() => select({ kind: 'stocker', id: s.id }, true)}
            >
              <span className="mono">{s.id}</span>
              <span className="h-px flex-1 bg-white/10" />
              <span className="mono">{s.lots.length} lots</span>
            </button>
            <button
              className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left transition ${active ? 'border-sky-400/70 bg-sky-400/15' : 'border-transparent hover:bg-white/5'}`}
              onClick={() => {
                const z = zoneOf(p.id)
                select({ kind: 'zone', id: p.id })
                flyTo([(z.x0 + z.x1) / 2, 0, z.aisleZ], 0.55)
              }}
            >
              <span className="w-1 self-stretch rounded" style={{ background: MODE_TINT[p.mode] }} title={p.mode} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium">{p.name}</div>
                <div className="mt-0.5 flex h-1.5 overflow-hidden rounded-sm bg-white/5">
                  <div style={{ width: `${(r / tools.length) * 100}%`, background: STATUS_HEX.run }} />
                  <div style={{ width: `${(y / tools.length) * 100}%`, background: STATUS_HEX.idle }} />
                  <div style={{ width: `${(a / tools.length) * 100}%`, background: STATUS_HEX.alarm }} />
                </div>
              </div>
              <div className="num w-[52px] text-right text-[12px] leading-tight">
                <span style={{ color: STATUS_HEX.run }}>{r}</span>
                <span className="text-[var(--ink3)]">/{tools.length}</span>
                {a > 0 && <div style={{ color: STATUS_HEX.alarm }}>▲{a}</div>}
              </div>
            </button>
          </div>
        )
      })}
      <button
        className="flex w-full items-center gap-1.5 px-1 py-[1px] text-left text-[10px] text-[var(--ink3)] hover:text-[var(--ink)]"
        onClick={() => select({ kind: 'stocker', id: 'S11' }, true)}
      >
        <span className="mono">S11</span>
        <span className="h-px flex-1 bg-white/10" />
        <span className="mono">FG {w.stockers[11].lots.length} lots</span>
      </button>
    </div>
  )
}
