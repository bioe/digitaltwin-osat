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
  const thumbs = useMemo(() => Object.fromEntries([...PROCESSES.map(p => [p.id, thumbnail(p.model)]), ['ship', thumbnail('packStation')]]), [])
  const ship = w.shipUnits()
  return (
    <section className="cc-panel flex min-h-0 flex-col p-2.5">
      <div className="cc-title mb-2">Equipment status</div>
      <div className="scroll-thin grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto pr-0.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {PROCESSES.map(p => {
          const tools = w.tools.filter(t => t.proc === p.id && !t.aux)
          const run = tools.filter(t => t.state === 'run').length
          const shown = [...tools].sort((a, b) => RANK[a.state] - RANK[b.state]).slice(0, 4)
          const z = w.L.zones.find(q => q.proc.id === p.id)!
          return (
            <div key={p.id} className="cc-card flex gap-2 p-1.5">
              <button
                className="shrink-0 self-start overflow-hidden rounded-[3px] border border-sky-400/20"
                title={`Go to ${p.name}`}
                onClick={() => {
                  select({ kind: 'zone', id: p.id })
                  flyTo([(z.x0 + z.x1) / 2, 0, z.aisleZ], 0.55)
                }}
              >
                <img src={thumbs[p.id]} alt={p.toolName} className="block h-[46px] w-[58px] object-cover" />
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
                    <button key={t.id} className="flex w-full items-center gap-1.5 whitespace-nowrap text-left text-[10.5px] leading-[15px] hover:bg-white/5" onClick={() => select({ kind: 'tool', id: t.id }, true)}>
                      <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: st.color, boxShadow: `0 0 5px ${st.color}` }} />
                      <span className="mono w-[58px] shrink-0 text-[var(--ink2)]">{t.id}</span>
                      <span className="truncate" style={{ color: st.color }}>{st.text}</span>
                    </button>
                  )
                })}
                <div className="flex justify-between gap-1 whitespace-nowrap text-[10px] text-[var(--ink3)]">
                  <span>{tools.length > 4 ? `+${tools.length - 4} more` : ''}</span>
                  <span className="text-sky-200" title="Man-to-machine ratio (operators : machines)">MMR {w.mmr(p.id).label}</span>
                </div>
              </div>
            </div>
          )
        })}
        {/* final step: packing, palletizing, freight lift, truck dock */}
        <div className="cc-card flex gap-2 p-1.5">
          <button
            className="shrink-0 self-start overflow-hidden rounded-[3px] border border-sky-400/20"
            title="Go to Pack & Ship"
            onClick={() => {
              select({ kind: 'tool', id: 'PACK-01' })
              flyTo(ship[0].pos, 0.45)
            }}
          >
            <img src={thumbs.ship} alt="Box packing station" className="block h-[46px] w-[58px] object-cover" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-1">
              <span className="truncate text-[12px] font-semibold text-white">Pack & Ship</span>
              <span className="num shrink-0 text-[11px]" style={{ color: STATUS_HEX.run }}>
                {ship.filter(u => u.state === 'run').length}/{ship.length}
              </span>
            </div>
            {ship.map(u => (
              <button key={u.id} className="flex w-full items-center gap-1.5 whitespace-nowrap text-left text-[10.5px] leading-[15px] hover:bg-white/5" onClick={() => select(u.tool ? { kind: 'tool', id: u.id } : { kind: 'ship', id: u.id }, true)}>
                <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: STATUS_HEX[u.state], boxShadow: `0 0 5px ${STATUS_HEX[u.state]}` }} />
                <span className="mono w-[58px] shrink-0 text-[var(--ink2)]">{u.id}</span>
                <span className="truncate" style={{ color: STATUS_HEX[u.state] }}>{u.state === 'alarm' ? 'Down' : u.text}</span>
              </button>
            ))}
            <div className="text-right text-[10px] text-sky-200">{w.shipping.trucks} trucks shipped</div>
          </div>
        </div>
      </div>
    </section>
  )
}
