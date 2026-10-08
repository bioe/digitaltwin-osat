import { useEffect, useRef } from 'react'
import { PROCESSES } from '../data/processes'
import { MEZZ_Y, OHT_Y } from '../layout/layout'
import { pathAt } from '../layout/path'
import { MODE_TINT } from '../scene/Building'
import { STATUS_HEX } from '../scene/materials'
import type { World } from '../sim/world'
import { useTick, useUI } from '../store'
import { AiRecovery } from './AiRecovery'
import { AlertQueue } from './AlertQueue'
import { clockStr, fmt } from './bits'
import { BRAND, BRAND_SUB } from './brand'
import { EquipmentStatus } from './EquipmentStatus'
import { Performance } from './Performance'

const AI = '#fbbf24'

/**
 * War room page, built from the live dashboard components: brand strip with headline KPIs,
 * equipment + AI recovery (left), a live 2D floor map (centre), performance + alerts (right).
 * Picking anything closes the page and flies the 3D view there.
 */
export function WarRoomOverlay() {
  const open = useUI(s => s.warRoom)
  const setOpen = useUI(s => s.setWarRoom)
  const flyTo = useUI(s => s.flyTo)
  const sel = useUI(s => s.sel)
  const w = useTick(open ? 2 : 0.2)
  const selAtOpen = useRef(sel)

  useEffect(() => {
    if (!open) return
    selAtOpen.current = useUI.getState().sel
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])
  // a pick on this page (tool, zone, alert) goes to the 3D view
  useEffect(() => {
    if (open && sel && sel !== selAtOpen.current) setOpen(false)
  }, [open, sel, setOpen])

  if (!open) return null
  const wr = w.L.warRoom
  const k = w.kpis()
  const att = k.units / Math.max(1, k.plan)
  return (
    <div className="cc-root fixed inset-0 z-50 flex flex-col bg-[#05080d]" role="dialog" aria-label="War room">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-2">
        <div className="hud-title !text-rose-400">◉ War room</div>
        <div className="text-[12px] text-[var(--ink3)]">Live dashboards · click a tool, zone or alert to go there in 3D · Esc to close</div>
        <button
          className="btn ml-auto"
          onClick={() => {
            setOpen(false)
            flyTo([(wr.x0 + wr.x1) / 2, MEZZ_Y + 1, wr.z1 - 2], 0.3)
          }}
        >
          View room in 3D
        </button>
        <button className="btn !px-4" onClick={() => setOpen(false)}>✕ Close</button>
      </div>
      {/* brand strip + headline KPIs */}
      <div className="flex items-center gap-6 px-5 py-2">
        <div>
          <div className="num text-[24px] leading-none">{clockStr(w.clock)}</div>
          <div className="mt-1 text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink3)]">{w.staffed ? '☀ Day shift' : '☾ Night · lights-out'}</div>
        </div>
        <div className="flex-1 text-center">
          <div className="cc-brand">{BRAND}</div>
          <div className="cc-sub mt-1">{BRAND_SUB}</div>
        </div>
        <div className="flex gap-2">
          <Headline label="Output today" value={`${fmt(k.units / 1000)} K`} sub={`${(att * 100).toFixed(1)}% of plan`} good={att >= 0.97} />
          <Headline label="OEE" value={`${(k.oee * 100).toFixed(1)}%`} sub="line average" good={k.oee >= 0.8} />
          <Headline label="Alarms" value={String(k.alarm)} sub={`${w.tools.filter(t => t.alarm?.ai).length} with AI`} good={k.alarm < 5} />
          <Headline label="Shipped" value={`${w.shipping.trucks} trucks`} sub={`${fmt(w.shipping.units / 1000)} K units`} good />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.9fr) minmax(0, 1fr)' }}>
        <div className="grid min-h-0 gap-2.5" style={{ gridTemplateRows: 'minmax(0, 1.45fr) minmax(0, 1fr)' }}>
          <EquipmentStatus />
          <AiRecovery />
        </div>
        <FloorMapPanel w={w} />
        <div className="grid min-h-0 gap-2.5" style={{ gridTemplateRows: 'minmax(0, 1.25fr) minmax(0, 1fr)' }}>
          <Performance />
          <AlertQueue />
        </div>
      </div>
    </div>
  )
}

function Headline({ label, value, sub, good }: { label: string; value: string; sub: string; good: boolean }) {
  return (
    <div className="cc-card min-w-[120px] px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink2)]">{label}</div>
      <div className="num text-[22px] leading-tight text-white">{value}</div>
      <div className="text-[10.5px]" style={{ color: good ? '#34d399' : '#38bdf8' }}>{sub}</div>
    </div>
  )
}

/** Centre: zone tabs, a live SVG map of the floor (in metres), and a legend. */
function FloorMapPanel({ w }: { w: World }) {
  const select = useUI(s => s.select)
  const B = w.L.bounds
  const r = w.truckRoutes
  const x0 = r.liftX - 3
  const vbW = B.x1 + 2 - x0
  const vbH = B.z1 - B.z0 + 7
  const vb = `${x0} ${B.z0 - 3.5} ${vbW} ${vbH}`
  const ohtLoop = w.L.loops.OHT
  const ship = w.shipUnits()
  const shipWorst = ship.some(u => u.state === 'alarm') ? 'alarm' : ship.some(u => u.state === 'idle') ? 'idle' : 'run'
  return (
    <section className="cc-panel flex min-h-0 min-w-0 flex-col p-2.5">
      <div className="mb-2 flex items-center gap-3">
        <div className="cc-title">Digital twin · floor map</div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {PROCESSES.map(p => {
            const tools = w.tools.filter(t => t.proc === p.id && !t.aux)
            const worst = tools.some(t => t.state === 'alarm') ? 'alarm' : tools.some(t => t.state === 'idle') ? 'idle' : 'run'
            return (
              <button key={p.id} className="cc-tab flex shrink-0 items-center gap-1.5 rounded border border-sky-400/15 bg-sky-950/40 px-2 py-1 hover:bg-sky-400/10" onClick={() => select({ kind: 'zone', id: p.id }, true)}>
                <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: STATUS_HEX[worst], boxShadow: `0 0 6px ${STATUS_HEX[worst]}` }} />
                {p.short}
              </button>
            )
          })}
          <button className="cc-tab flex shrink-0 items-center gap-1.5 rounded border border-sky-400/15 bg-sky-950/40 px-2 py-1 hover:bg-sky-400/10" onClick={() => select({ kind: 'tool', id: 'PACK-01' }, true)}>
            <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: STATUS_HEX[shipWorst], boxShadow: `0 0 6px ${STATUS_HEX[shipWorst]}` }} />
            SHIP
          </button>
        </div>
      </div>
      <div className="relative w-full shrink-0 rounded border border-sky-400/15 bg-[#081426]" style={{ aspectRatio: `${vbW} / ${vbH}` }}>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
          <rect x={B.x0} y={B.z0} width={B.x1 - B.x0} height={B.z1 - B.z0} fill="#0d1d33" stroke="#1e3a5f" strokeWidth={0.3} />
          {/* zones */}
          {w.L.zones.map(z => {
            const tools = w.tools.filter(t => t.proc === z.proc.id && !t.aux)
            const pct = Math.round((tools.filter(t => t.state === 'run').length / tools.length) * 100)
            // labels sit just outside the room, on the outer wall side
            const ly = z.row === 'north' ? z.z0 - 0.9 : z.z1 + 2.1
            return (
              <g key={z.proc.id} className="cursor-pointer" onClick={() => select({ kind: 'zone', id: z.proc.id }, true)}>
                <rect x={z.x0} y={z.z0} width={z.x1 - z.x0} height={z.z1 - z.z0} fill={MODE_TINT[z.proc.mode]} fillOpacity={0.12} stroke={MODE_TINT[z.proc.mode]} strokeOpacity={0.7} strokeWidth={0.2} />
                <text x={(z.x0 + z.x1) / 2} y={ly} textAnchor="middle" fontSize={1.5} fontWeight={700} fill="#e6f0ff" fontFamily="Rajdhani, sans-serif">
                  {z.proc.short}
                  <tspan fontWeight={600} fill={pct >= 80 ? STATUS_HEX.run : STATUS_HEX.idle}> · {pct}%</tspan>
                  <tspan fontWeight={500} fill="#bae6fd"> · MMR {w.mmr(z.proc.id).label}</tspan>
                </text>
              </g>
            )
          })}
          {/* transport */}
          {([[w.L.loops.OHT, '#60a5fa'], [w.L.loops.CONV, '#c084fc']] as const).map(([loop, c], i) => (
            <polygon key={i} points={loop.pts.map(p => p.join(',')).join(' ')} fill="none" stroke={c} strokeOpacity={0.8} strokeWidth={0.22} />
          ))}
          {/* packing line, buffer and lift */}
          <line x1={B.x0 - 0.2} y1={r.liftZ} x2={r.buildX + 0.8} y2={r.liftZ} stroke="#64748b" strokeWidth={1.1} />
          <rect x={r.liftX - 1.5} y={r.liftZ - 1.5} width={3} height={3} fill="none" stroke="#94a3b8" strokeWidth={0.25} />
          <text x={r.liftX} y={r.liftZ + 2.9} textAnchor="middle" fontSize={1} fill="#94a3b8" fontFamily="Rajdhani, sans-serif">LIFT</text>
          {/* stockers */}
          {w.stockers.map(s => (
            <g key={s.id} className="cursor-pointer" onClick={() => select({ kind: 'stocker', id: s.id }, true)}>
              <rect x={s.pos[0] - s.size[0] / 2} y={s.pos[2] - s.size[1] / 2} width={s.size[0]} height={s.size[1]} fill="#94a3b8" fillOpacity={0.85} />
              <text x={s.pos[0]} y={s.pos[2] + 0.35} textAnchor="middle" fontSize={0.9} fontWeight={700} fill="#0b1526" fontFamily="JetBrains Mono, monospace">{s.id}</text>
            </g>
          ))}
          {/* tools */}
          {w.tools.map(t => {
            const c = t.alarm?.ai ? AI : STATUS_HEX[t.state]
            const sw = t.rotY % Math.PI ? t.size[1] : t.size[0]
            const sd = t.rotY % Math.PI ? t.size[0] : t.size[1]
            return (
              <rect key={t.id} x={t.pos[0] - sw * 0.45} y={t.pos[2] - sd * 0.45} width={sw * 0.9} height={sd * 0.9} rx={0.15} fill={c} className="cursor-pointer" onClick={() => select({ kind: 'tool', id: t.id }, true)}>
                <title>{`${t.id} · ${t.alarm ? t.alarm.text : t.reason}`}</title>
              </rect>
            )
          })}
          {/* alarm rings */}
          {w.tools.filter(t => t.alarm).map(t => (
            <circle key={t.id} cx={t.pos[0]} cy={t.pos[2]} r={1.6} fill="none" stroke={t.alarm!.ai ? AI : STATUS_HEX.alarm} strokeWidth={0.3} pointerEvents="none">
              <animate attributeName="r" values="1.2;2.4;1.2" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
            </circle>
          ))}
          {/* war room */}
          <rect x={w.L.warRoom.x0} y={w.L.warRoom.z0} width={w.L.warRoom.x1 - w.L.warRoom.x0} height={w.L.warRoom.z1 - w.L.warRoom.z0} fill="#f43f5e" fillOpacity={0.08} stroke="#f43f5e" strokeWidth={0.3} />
          <text x={(w.L.warRoom.x0 + w.L.warRoom.x1) / 2} y={(w.L.warRoom.z0 + w.L.warRoom.z1) / 2 + 0.5} textAnchor="middle" fontSize={1.3} fontWeight={700} fill="#fda4af" fontFamily="Rajdhani, sans-serif">WAR ROOM</text>
          {/* vehicles + people */}
          {w.oht.map(v => {
            const p = pathAt(ohtLoop, v.s).p
            return <rect key={v.id} x={p[0] - 0.45} y={p[1] - 0.35} width={0.9} height={0.7} fill="#93c5fd" stroke="#1d4ed8" strokeWidth={0.12} pointerEvents="none" />
          })}
          {w.arvs.map(a => (
            <circle key={a.id} cx={a.pos[0]} cy={a.pos[1]} r={0.55} fill="#2dd4bf" stroke="#0f766e" strokeWidth={0.12} className="cursor-pointer" onClick={() => select({ kind: 'arv', id: a.id }, true)} />
          ))}
          {[...w.techs, ...w.operators].map(p => (
            <circle key={p.id} cx={p.pos[0]} cy={p.pos[1]} r={0.32} fill={p.role === 'tech' ? '#fde68a' : '#f8fafc'} pointerEvents="none" opacity={w.staffed || (p.onCall && p.eta <= 0) ? 1 : 0} />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--ink2)]">
        {(
          [
            ['Running', STATUS_HEX.run],
            ['Idle', STATUS_HEX.idle],
            ['Down', STATUS_HEX.alarm],
            ['AI recovery', AI],
          ] as const
        ).map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="inline-block h-[2px] w-4" style={{ background: '#60a5fa' }} />OHT rail ({w.oht.length} at {OHT_Y} m)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-[2px] w-4" style={{ background: '#c084fc' }} />Conveyor</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#2dd4bf' }} />ARV ({w.arvs.length})</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: '#fde68a' }} />Technician</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-slate-100" />Operator</span>
      </div>
      <ZoneBoard w={w} />
    </section>
  )
}

/** Under the map: one card per zone (state, WIP, MMR) and the transport fleets. */
function ZoneBoard({ w }: { w: World }) {
  const select = useUI(s => s.select)
  const queued = (m: string) => w.jobs.filter(j => j.mode === m && !j.vehicle).length
  const fleets = [
    { name: 'OHT', color: '#60a5fa', busy: w.oht.filter(v => v.phase !== 'free').length, n: w.oht.length, q: queued('OHT') },
    { name: 'ARV', color: '#2dd4bf', busy: w.arvs.filter(a => a.job).length, n: w.arvs.length, q: queued('ARV') },
    { name: 'Conveyor', color: '#c084fc', busy: w.conv.length, n: 0, q: 0 },
  ]
  return (
    <div className="scroll-thin mt-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      {PROCESSES.map((p, i) => {
        const tools = w.tools.filter(t => t.proc === p.id && !t.aux)
        const run = tools.filter(t => t.state === 'run').length
        const down = tools.filter(t => t.state === 'alarm').length
        const pct = run / tools.length
        return (
          <button key={p.id} className="cc-card px-2 py-1.5 text-left hover:bg-white/5" onClick={() => select({ kind: 'zone', id: p.id }, true)}>
            <div className="flex items-baseline justify-between gap-1">
              <span className="truncate text-[12px] font-semibold text-white">{p.name}</span>
              <span className="num text-[12px]" style={{ color: down ? STATUS_HEX.alarm : pct >= 0.8 ? STATUS_HEX.run : STATUS_HEX.idle }}>{run}/{tools.length}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
              <div className="h-full" style={{ width: `${pct * 100}%`, background: down ? STATUS_HEX.alarm : STATUS_HEX.run }} />
            </div>
            <div className="mt-1 flex justify-between text-[10.5px] text-[var(--ink3)]">
              <span>WIP {w.stockers[i].lots.length}</span>
              <span style={{ color: MODE_TINT[p.mode] }}>{p.mode}</span>
              <span className="text-sky-200">MMR {w.mmr(p.id).label}</span>
            </div>
          </button>
        )
      })}
      {fleets.map(f => (
        <div key={f.name} className="cc-card px-2 py-1.5">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-[12px] font-semibold" style={{ color: f.color }}>{f.name}</span>
            <span className="num text-[12px] text-white">{f.n ? `${f.busy}/${f.n} busy` : `${f.busy} carriers`}</span>
          </div>
          {f.n > 0 && (
            <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
              <div className="h-full" style={{ width: `${(f.busy / f.n) * 100}%`, background: f.color }} />
            </div>
          )}
          <div className="mt-1 text-[10.5px] text-[var(--ink3)]">{f.n ? `${f.q} moves waiting · ${w.done[f.name as 'OHT' | 'ARV']} done` : `${w.done.CONV} moves done`}</div>
        </div>
      ))}
    </div>
  )
}
