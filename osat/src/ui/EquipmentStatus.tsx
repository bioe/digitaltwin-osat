import { useMemo } from 'react'
import { PROCESSES } from '../data/processes'
import { STATUS_HEX } from '../scene/materials'
import type { Tool } from '../sim/world'
import { useTick, useUI } from '../store'
import { thumbnail } from './thumbs'

const RANK = { alarm: 0, idle: 1, run: 2 } as const

function toolStateLabel(t: Tool): { text: string; color: string } {
  if (t.alarm?.ai) return { text: 'AI recovery', color: '#fbbf24' }
  if (t.state === 'alarm') return { text: 'Down', color: STATUS_HEX.alarm }
  if (t.state === 'idle') return { text: 'Idle', color: STATUS_HEX.idle }
  return { text: 'Running', color: STATUS_HEX.run }
}

/** Left panel: one card per process with a machine thumbnail and live tool states. */
export function EquipmentStatus() {
  const w = useTick(2)
  const select = useUI(s => s.select)
  const flyTo = useUI(s => s.flyTo)
  const thumbs = useMemo(() => Object.fromEntries(PROCESSES.map(p => [p.id, thumbnail(p.model)])), [])
  return (
    <section className="cc-panel flex min-h-0 flex-col p-2.5">
      <div className="cc-title mb-2">Equipment status</div>
      <div className="scroll-thin grid min-h-0 flex-1 grid-cols-2 content-start gap-1.5 overflow-y-auto pr-0.5">
        {PROCESSES.map(p => {
          const tools = w.tools.filter(t => t.proc === p.id && !t.aux)
          const run = tools.filter(t => t.state === 'run').length
          const shown = [...tools].sort((a, b) => RANK[a.state] - RANK[b.state]).slice(0, 4)
          const z = w.L.zones.find(q => q.proc.id === p.id)!
          return (
            <div key={p.id} className="cc-card flex gap-2 p-1.5">
              <button
                className="shrink-0 overflow-hidden rounded-[3px] border border-sky-400/20"
                title={`Go to ${p.name}`}
                onClick={() => {
                  select({ kind: 'zone', id: p.id })
                  flyTo([(z.x0 + z.x1) / 2, 0, z.aisleZ], 0.55)
                }}
              >
                <img src={thumbs[p.id]} alt={p.toolName} className="block h-[50px] w-[66px] object-cover" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[12px] font-semibold text-white">{p.name}</span>
                  <span className="num shrink-0 text-[11px]" style={{ color: STATUS_HEX.run }}>
                    {run}/{tools.length}
                  </span>
                </div>
                {shown.map(t => {
                  const st = toolStateLabel(t)
                  return (
                    <button key={t.id} className="flex w-full items-center gap-1.5 text-left text-[10.5px] leading-[15px] hover:bg-white/5" onClick={() => select({ kind: 'tool', id: t.id }, true)}>
                      <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: st.color, boxShadow: `0 0 5px ${st.color}` }} />
                      <span className="mono w-[54px] text-[var(--ink2)]">{t.id}</span>
                      <span style={{ color: st.color }}>{st.text}</span>
                    </button>
                  )
                })}
                {tools.length > 4 && <div className="text-[10px] text-[var(--ink3)]">+{tools.length - 4} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
