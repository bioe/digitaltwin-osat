import type { ReactNode } from 'react'
import { PROCESSES } from '../data/processes'
import { MODE_TINT } from '../scene/Building'
import { STATUS_HEX } from '../scene/materials'
import { useTick, useUI, type Layers } from '../store'

/** Colour-coded toggles in the bottom bar: [layer, label, colour, line style]. */
const GROUPS: { title: string; items: [keyof Layers, string, string, ('dot' | 'line' | 'dash')?][] }[] = [
  {
    title: 'Status',
    items: [
      ['run', 'Running', STATUS_HEX.run],
      ['idle', 'Idle', STATUS_HEX.idle],
      ['down', 'Down', STATUS_HEX.alarm],
      ['ai', 'AI recovery', '#fbbf24'],
    ],
  },
  {
    title: 'Transport',
    items: [
      ['oht', 'OHT', MODE_TINT.OHT],
      ['conv', 'Conveyor', MODE_TINT.CONV],
      ['arv', 'ARV', MODE_TINT.ARV],
      ['flow', 'Material flow', '#22d3ee', 'line'],
      ['route', 'Product route', '#4ade80', 'dash'],
    ],
  },
  {
    title: 'Show',
    items: [
      ['people', 'People', '#e2e8f0'],
      ['callouts', 'Callouts', '#38bdf8'],
      ['labels', 'Labels', '#94a3b8'],
      ['walls', 'Room walls', '#cbd5e1'],
      ['floors', 'Levels 1–2', '#64748b'],
      ['site', 'Site', '#86b862'],
    ],
  },
]

function Swatch({ color, kind = 'dot', on }: { color: string; kind?: 'dot' | 'line' | 'dash'; on: boolean }) {
  const glow = on ? `0 0 6px ${color}` : 'none'
  if (kind === 'dot') return <span className="inline-block h-[9px] w-[9px] rounded-full" style={{ background: on ? color : 'transparent', border: `1.5px solid ${color}`, boxShadow: glow }} />
  return (
    <span
      className="inline-block h-[3px] w-[16px] rounded"
      style={{
        background: kind === 'line' ? color : `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`,
        opacity: on ? 1 : 0.35,
        boxShadow: glow,
      }}
    />
  )
}

/** Centre panel: "Digital twin" header with process tabs, the 3D view, and the toggle bar. */
export function TwinPanel({ children }: { children: ReactNode }) {
  const w = useTick(2)
  const layers = useUI(s => s.layers)
  const toggle = useUI(s => s.toggle)
  const flyTo = useUI(s => s.flyTo)
  const select = useUI(s => s.select)
  const sel = useUI(s => s.sel)
  const dayMode = useUI(s => s.dayMode)
  const setDayMode = useUI(s => s.setDayMode)
  const focus = useUI(s => s.focus)
  const toggleFocus = useUI(s => s.toggleFocus)
  const tour = useUI(s => s.tour)
  const setTour = useUI(s => s.setTour)
  return (
    <section className="cc-panel flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-2.5 pt-2">
        <div className="cc-title">Digital twin</div>
        <div className="scroll-thin flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1">
          {PROCESSES.map(p => {
            const tools = w.tools.filter(t => t.proc === p.id && !t.aux)
            const worst = tools.some(t => t.state === 'alarm') ? 'alarm' : tools.some(t => t.state === 'idle') ? 'idle' : 'run'
            const z = w.L.zones.find(q => q.proc.id === p.id)!
            const active = sel?.kind === 'zone' && sel.id === p.id
            return (
              <button
                key={p.id}
                className={`cc-tab flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 ${active ? 'border-sky-400 bg-sky-400/20' : 'border-sky-400/15 bg-sky-950/40 hover:bg-sky-400/10'}`}
                onClick={() => {
                  select({ kind: 'zone', id: p.id })
                  flyTo([(z.x0 + z.x1) / 2, 0, z.aisleZ], 0.55)
                }}
              >
                <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: STATUS_HEX[worst], boxShadow: `0 0 6px ${STATUS_HEX[worst]}` }} />
                {p.short}
              </button>
            )
          })}
          {(() => {
            const ship = w.shipUnits()
            const st = ship.some(u => u.state === 'alarm') ? 'alarm' : ship.some(u => u.state === 'idle') ? 'idle' : 'run'
            const active = sel?.kind === 'ship' || (sel?.kind === 'tool' && (sel.id === 'PACK-01' || sel.id === 'WRAP-01'))
            return (
              <button
                className={`cc-tab flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 ${active ? 'border-sky-400 bg-sky-400/20' : 'border-sky-400/15 bg-sky-950/40 hover:bg-sky-400/10'}`}
                onClick={() => {
                  select({ kind: 'tool', id: 'PACK-01' })
                  flyTo(ship[0].pos, 0.45)
                }}
              >
                <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: STATUS_HEX[st], boxShadow: `0 0 6px ${STATUS_HEX[st]}` }} />
                SHIP
              </button>
            )
          })()}
        </div>
        {tour && (
          <button className="btn on shrink-0 !px-2.5" title="Leave the walking tour (Esc)" onClick={() => setTour(false)}>
            ✕ Exit tour
          </button>
        )}
        {focus && !tour && (
          <button className="btn on shrink-0 !px-2.5" title="Exit fullscreen (F / Esc)" onClick={toggleFocus}>
            ⤡ Exit fullscreen
          </button>
        )}
      </div>
      <div className="relative m-2 mt-1 min-h-0 flex-1 overflow-hidden rounded border border-sky-400/20">{children}</div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-sky-400/15 px-3 py-1.5">
        {GROUPS.map(g => (
          <div key={g.title} className="flex items-center gap-1">
            <span className="mr-1 text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink3)]">{g.title}</span>
            {g.items.map(([k, label, color, kind]) => (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] transition ${layers[k] ? 'text-white hover:bg-white/5' : 'text-[var(--ink3)] line-through decoration-white/30 hover:bg-white/5'}`}
                title={`${layers[k] ? 'Hide' : 'Show'} ${label}`}
              >
                <Swatch color={color} kind={kind} on={layers[k]} />
                {label}
              </button>
            ))}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink3)]">Light</span>
          <div className="flex overflow-hidden rounded border border-sky-400/40">
            {([['day', '☀ Day'], ['night', '☾ Night'], ['auto', '◐ Auto']] as const).map(([m, label]) => (
              <button
                key={m}
                className={`px-2.5 py-0.5 text-[11px] font-semibold ${dayMode === m ? 'bg-sky-400/30 text-white' : 'text-[var(--ink2)] hover:bg-white/5'}`}
                title={m === 'auto' ? 'Compressed day/night cycle (2 min)' : m === 'night' ? 'Lights-out night shift: no people, only machine glows' : 'Day shift'}
                onClick={() => setDayMode(m)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
