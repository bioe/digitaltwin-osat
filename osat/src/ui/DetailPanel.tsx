import { MODE_LABEL, PROCESSES, PROC_BY_ID, requiredTools } from '../data/processes'
import { MODELS } from '../models'
import { STATUS_HEX } from '../scene/materials'
import type { Tool, World } from '../sim/world'
import { isMoving, useTick, useUI, type Sel } from '../store'
import { Row, Section, Spark, StatusBadge, Tile, Timeline, clockStr, fmt } from './bits'

export function DetailPanel() {
  const w = useTick(4)
  const sel = useUI(s => s.sel)
  const select = useUI(s => s.select)
  return (
    <div className="dock scroll-thin relative h-full overflow-y-auto border-l px-3.5 py-3">
      {sel && isMoving(sel) && (
        <div className="absolute right-9 top-3 flex items-center gap-1 rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
          <span className="dot animate-pulse" style={{ background: '#38bdf8' }} /> Following
        </div>
      )}
      {sel && (
        <button className="absolute right-2.5 top-2.5 text-[var(--ink3)] hover:text-white" onClick={() => select(null)} aria-label="Close">
          ✕
        </button>
      )}
      <Body w={w} sel={sel} />
    </div>
  )
}

function Body({ w, sel }: { w: World; sel: Sel }) {
  if (!sel) return <Overview w={w} />
  if (sel.kind === 'tool') {
    const t = w.toolById.get(sel.id)
    return t ? <ToolView w={w} t={t} /> : null
  }
  if (sel.kind === 'stocker') return <StockerView w={w} id={sel.id} />
  if (sel.kind === 'oht') return <OhtView w={w} id={sel.id} />
  if (sel.kind === 'arv') return <ArvView w={w} id={sel.id} />
  if (sel.kind === 'tech') return <TechView w={w} id={sel.id} />
  return <ZoneView w={w} id={sel.id} />
}

function Header({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="pr-6">
      <div className="hud-title">{kicker}</div>
      <div className="num text-[24px] leading-tight">{title}</div>
      {sub && <div className="text-[12px] text-[var(--ink2)]">{sub}</div>}
    </div>
  )
}

function ToolView({ w, t }: { w: World; t: Tool }) {
  const select = useUI(s => s.select)
  const p = PROC_BY_ID[t.proc]
  const total = t.runS + t.idleS + t.alarmS
  const avail = (t.runS + t.idleS) / total
  const perf = (t.runS / total / avail) * t.perf
  const oee = (t.runS / total) * t.perf * 0.995
  const mtba = t.runS / Math.max(1, t.history.length + 6) / 60
  return (
    <div>
      <Header kicker={`${p.name}${t.aux ? ' · auxiliary' : ''}`} title={t.id} sub={MODELS[t.model].name} />
      <div className="mt-2 flex items-center gap-2">
        <StatusBadge state={t.state} />
        <span className="truncate text-[12px] text-[var(--ink2)]">{t.reason}</span>
      </div>

      {t.alarm && (
        <div className="mt-3 rounded-md border border-rose-500/50 bg-rose-500/10 p-2.5">
          <div className="flex items-center justify-between">
            <span className="mono text-[12px] text-rose-300">{t.alarm.code}</span>
            <span className="text-[11px] text-rose-200/80">since {clockStr(t.alarm.at)}</span>
          </div>
          <div className="mt-0.5 text-[13px] font-medium">{t.alarm.text}</div>
          <div className="mt-1 text-[11px] text-[var(--ink2)]">
            {t.tech
              ? t.tech.working
                ? `${t.tech.name} working at tool · ~${Math.ceil(t.tech.timer)} s`
                : `${t.tech.name} (${t.tech.role}) en route`
              : t.alarm.soft
                ? 'Soft alarm – remote reset allowed'
                : 'Waiting for technician'}
          </div>
          <div className="mt-2 flex gap-2">
            {t.alarm.soft && <button className="btn" onClick={() => w.remoteReset(t.id)}>Remote reset</button>}
            {t.tech && <button className="btn" onClick={() => select({ kind: 'tech', id: t.tech!.id }, true)}>Follow {t.tech.role}</button>}
          </div>
        </div>
      )}

      {!t.aux && (
        <Section title="Current lot">
          {t.lot ? (
            <>
              <Row k="Lot" v={<span className="mono">{t.lot.id}</span>} />
              <Row k="Product" v={t.lot.product} />
              <Row k="Recipe" v={<span className="mono text-[11px]">{t.recipe}</span>} />
              <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-white/10">
                <div className="h-full" style={{ width: `${t.progress * 100}%`, background: STATUS_HEX[t.state] }} />
              </div>
              <div className="mt-0.5 text-right text-[10px] text-[var(--ink3)]">{(t.progress * 100).toFixed(0)}% complete</div>
            </>
          ) : (
            <div className="text-[12px] text-[var(--ink3)]">{t.inbound ? `Lot ${t.inbound.lot.id} arriving by ${t.inbound.mode}` : 'No lot loaded'}</div>
          )}
        </Section>
      )}

      <Section title="Performance · today">
        <div className="grid grid-cols-3 gap-1.5">
          <Tile label="OEE" value={`${(oee * 100).toFixed(1)}%`} tone={oee > 0.8 ? STATUS_HEX.run : STATUS_HEX.idle} />
          <Tile label="Avail." value={`${(avail * 100).toFixed(0)}%`} />
          <Tile label="Perf." value={`${(Math.min(1, perf) * 100).toFixed(0)}%`} />
          {!t.aux && <Tile label="UPH plan" value={fmt(t.uph)} />}
          {!t.aux && <Tile label="Units" value={fmt(t.unitsToday)} />}
          <Tile label="MTBA" value={`${mtba.toFixed(0)} m`} />
        </div>
      </Section>

      <Section title="State history" right={<span className="text-[10px] text-[var(--ink3)]">6 min</span>}>
        <Timeline states={t.timeline} />
      </Section>

      {!t.aux && (
        <Section title="Throughput (UPH)">
          <Spark data={t.uphHist} unit="UPH" />
        </Section>
      )}

      <Section title="Live parameters">
        {t.params.map(pr => {
          const out = Math.abs(pr.value - pr.nominal) > pr.tol && pr.tol > 0
          return (
            <Row
              key={pr.label}
              k={pr.label}
              v={
                <span className="num text-[14px]" style={{ color: out ? STATUS_HEX.alarm : undefined }}>
                  {pr.value.toFixed(pr.dec)} <span className="text-[11px] text-[var(--ink3)]">{pr.unit}</span>
                  {out && ' ▲'}
                </span>
              }
            />
          )
        })}
      </Section>

      <Section title="Alarm history">
        {t.history.length === 0 && <div className="text-[12px] text-[var(--ink3)]">No alarms this shift</div>}
        {t.history.slice(0, 6).map((a, i) => (
          <div key={i} className="border-b border-white/5 py-1 text-[11.5px]">
            <div className="flex justify-between">
              <span className="mono text-rose-300">{a.code}</span>
              <span className="text-[var(--ink3)]">{clockStr(a.at)}</span>
            </div>
            <div>{a.text}</div>
            <div className="text-[10.5px] text-[var(--ink3)]">{a.cleared ? `${a.by} · ${Math.round((a.cleared - a.at) / 1000)} s` : 'active'}</div>
          </div>
        ))}
      </Section>

      <div className="mt-3 flex gap-2">
        {!t.alarm && <button className="btn danger" onClick={() => w.forceAlarm(t.id)}>Inject fault (demo)</button>}
      </div>
    </div>
  )
}

function StockerView({ w, id }: { w: World; id: string }) {
  const s = w.stockers.find(x => x.id === id)!
  const fill = (s.lots.length + s.reserved) / s.capacity
  const up = s.idx > 0 ? PROCESSES[s.idx - 1] : null
  const down = s.idx < PROCESSES.length ? PROCESSES[s.idx] : null
  return (
    <div>
      <Header kicker="Stocker" title={s.id} sub={s.name} />
      <div className="mt-1 text-[12px] text-[var(--ink2)]">{MODELS[s.model].name}</div>
      <Section title="Inventory">
        <div className="grid grid-cols-3 gap-1.5">
          <Tile label="Lots" value={s.lots.length} />
          <Tile label="Reserved" value={s.reserved} />
          <Tile label="Fill" value={`${(fill * 100).toFixed(0)}%`} tone={fill > 0.9 ? STATUS_HEX.alarm : fill > 0.7 ? STATUS_HEX.idle : STATUS_HEX.run} />
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-white/10">
          <div className="h-full bg-sky-400" style={{ width: `${fill * 100}%` }} />
        </div>
        <div className="mt-0.5 text-right text-[10px] text-[var(--ink3)]">capacity {s.capacity} shelves</div>
      </Section>
      <Section title="Flow">
        <Row k="Fed by" v={up ? `${up.name} · ${up.mode}` : 'Receiving dock'} />
        <Row k="Feeds" v={down ? `${down.name} · ${down.mode}` : 'Shipping'} />
        <Row k="Crane moves" v={fmt(s.moves + 340)} />
      </Section>
      <Section title="Lots on shelf">
        <div className="grid grid-cols-2 gap-x-2">
          {s.lots.slice(0, 14).map(l => (
            <div key={l.id} className="mono truncate border-b border-white/5 py-0.5 text-[11px]">
              {l.id} <span className="text-[var(--ink3)]">{l.product.split(' ')[0]}</span>
            </div>
          ))}
        </div>
        {s.lots.length > 14 && <div className="mt-1 text-[11px] text-[var(--ink3)]">+{s.lots.length - 14} more</div>}
      </Section>
    </div>
  )
}

function OhtView({ w, id }: { w: World; id: string }) {
  const v = w.oht.find(x => x.id === id)!
  const label: Record<string, string> = {
    free: 'Circulating – no job', toPick: 'Travelling to pick-up', down: 'Hoisting down (pick)', up: 'Hoisting up',
    toDrop: 'Travelling to drop-off', downDrop: 'Hoisting down (drop)', upDrop: 'Hoisting up',
  }
  return (
    <div>
      <Header kicker="Overhead hoist transport" title={v.id} sub="Daifuku-class OHT vehicle" />
      <div className="mt-2"><StatusBadge state={v.phase === 'free' ? 'idle' : 'run'} /></div>
      <Section title="Now">
        <Row k="Activity" v={label[v.phase]} />
        <Row k="Speed" v={`${v.v.toFixed(1)} m/s`} />
        <Row k="Hoist" v={`${v.hoist.toFixed(2)} m`} />
        {v.job && <Row k="Job" v={`${v.job.from.id} → ${v.job.to.id}`} />}
        {v.carry && <Row k="Carrying" v={<span className="mono">{v.carry.id} ({v.carry.carrier})</span>} />}
        <Row k="Moves today" v={fmt(v.moves)} />
      </Section>
      <Section title="Fleet">
        <Row k="Vehicles" v={w.oht.length} />
        <Row k="Busy" v={w.oht.filter(x => x.phase !== 'free').length} />
        <Row k="Track length" v={`${w.L.loops.OHT.length.toFixed(0)} m`} />
      </Section>
    </div>
  )
}

function ArvView({ w, id }: { w: World; id: string }) {
  const a = w.arvs.find(x => x.id === id)!
  const label: Record<string, string> = {
    parked: 'Charging at dock', wait: 'Waiting for next job', toPick: 'Driving to pick-up', xferPick: 'Transferring (load)', toDrop: 'Driving to drop-off',
    xferDrop: 'Transferring (unload)', toPark: 'Returning to dock',
  }
  return (
    <div>
      <Header kicker="Autonomous robotic vehicle" title={a.id} sub="AMR with lift & roller transfer" />
      <div className="mt-2"><StatusBadge state={a.battery < 20 ? 'alarm' : a.job || a.moving ? 'run' : 'idle'} /></div>
      <Section title="Now">
        <Row k="Activity" v={a.yielding ? <span className="text-amber-300">Giving way – path blocked</span> : label[a.phase]} />
        <Row k="Battery" v={<span style={{ color: a.battery < 25 ? STATUS_HEX.alarm : undefined }}>{a.battery.toFixed(0)}%</span>} />
        {a.job && <Row k="Job" v={`${a.job.from.id} → ${a.job.to.id}`} />}
        {a.carry && <Row k="Carrying" v={<span className="mono">{a.carry.id} ({a.carry.carrier})</span>} />}
        <Row k="Position" v={`x ${a.pos[0].toFixed(1)} · z ${a.pos[1].toFixed(1)}`} />
        <Row k="Moves today" v={fmt(a.moves)} />
      </Section>
    </div>
  )
}

function TechView({ w, id }: { w: World; id: string }) {
  const select = useUI(s => s.select)
  const k = [...w.techs, ...w.operators].find(x => x.id === id)
  if (!k) return null
  const zone = k.zone ? PROC_BY_ID[k.zone].name : 'All zones'
  return (
    <div>
      <Header kicker={k.role === 'tech' ? 'Maintenance technician' : `Operator · ${zone}`} title={k.name} sub={k.id} />
      <div className="mt-2 rounded-md border border-sky-400/20 bg-sky-400/5 px-2.5 py-2 text-[13px]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--ink3)]">{k.working ? 'Working' : k.moving ? 'Walking' : 'Now'}</div>
        {k.label}
        {k.working && <div className="mt-1 text-[11px] text-[var(--ink3)]">~{Math.ceil(k.timer)} s left</div>}
      </div>
      <Section title="Details">
        <Row k="Role" v={k.role === 'tech' ? 'Equipment technician' : 'Production operator'} />
        <Row k="Area" v={zone} />
        {k.carry && <Row k="Carrying" v={k.task === 'qa' ? 'QA sample tray' : 'Consumables'} />}
        {k.tool && <Row k="Assigned tool" v={<button className="underline" onClick={() => select({ kind: 'tool', id: k.tool!.id }, true)}>{k.tool.id}</button>} />}
        <Row k="Jobs this shift" v={k.jobs} />
        <Row k="Next steps" v={k.plan.length} />
      </Section>
    </div>
  )
}

function ZoneView({ w, id }: { w: World; id: string }) {
  const select = useUI(s => s.select)
  const p = PROC_BY_ID[id as keyof typeof PROC_BY_ID]
  const tools = w.tools.filter(t => t.proc === p.id)
  const prod = tools.filter(t => !t.aux)
  const running = prod.filter(t => t.state === 'run')
  const rate = running.reduce((a, t) => a + t.uph * t.perf, 0)
  return (
    <div>
      <Header kicker={`Zone · ${MODE_LABEL[p.mode]}`} title={p.name} sub={`${p.count} × ${p.toolName}`} />
      <Section title="Capacity sizing">
        <div className="grid grid-cols-3 gap-1.5">
          <Tile label="UPH / tool" value={fmt(p.uph)} />
          <Tile label="Required" value={requiredTools(p).toFixed(1)} />
          <Tile label="Installed" value={p.count} />
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-[var(--ink2)]">{p.basis}</p>
      </Section>
      <Section title="Live">
        <Row k="Zone rate now" v={<span className="num text-[15px]">{fmt(rate)} UPH</span>} />
        <Row k="Upstream stocker" v={`${w.stockers[PROCESSES.indexOf(p)].lots.length} lots`} />
        <Row k="Carrier" v={p.carrier} />
      </Section>
      <Section title="Equipment">
        {tools.map(t => (
          <button key={t.id} className="flex w-full items-center gap-2 border-b border-white/5 py-1 text-left text-[12px] hover:bg-white/5" onClick={() => select({ kind: 'tool', id: t.id }, true)}>
            <span className="dot" style={{ background: STATUS_HEX[t.state] }} />
            <span className="mono w-[78px]">{t.id}</span>
            <span className="flex-1 truncate text-[var(--ink2)]">{t.reason}</span>
          </button>
        ))}
      </Section>
    </div>
  )
}

function Overview({ w }: { w: World }) {
  const select = useUI(s => s.select)
  const active = w.tools.filter(t => t.alarm)
  return (
    <div>
      <div className="hud-title">Alarm console</div>
      <div className="num text-[22px]">
        {active.length} active <span className="text-[13px] text-[var(--ink3)]">· click a row to fly to the tool</span>
      </div>
      <div className="mt-2">
        {active.map(t => (
          <button key={t.id} className="mb-1 block w-full rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-left hover:bg-rose-500/20" onClick={() => select({ kind: 'tool', id: t.id }, true)}>
            <div className="flex justify-between text-[11px]">
              <span className="mono text-rose-300">{t.alarm!.code} · {t.id}</span>
              <span className="text-[var(--ink3)]">{clockStr(t.alarm!.at)}</span>
            </div>
            <div className="text-[12.5px]">{t.alarm!.text}</div>
            <div className="text-[10.5px] text-[var(--ink3)]">{t.tech ? `${t.tech.name} ${t.tech.working ? 'at tool' : 'en route'}` : t.alarm!.soft ? 'soft – remote reset' : 'awaiting technician'}</div>
          </button>
        ))}
      </div>
      <div className="hud-title mt-4">Recently cleared</div>
      {w.alarmLog.filter(a => a.cleared).slice(0, 8).map((a, i) => (
        <div key={i} className="border-b border-white/5 py-1 text-[11.5px]">
          <div className="flex justify-between">
            <span className="mono text-[var(--ink2)]">{a.code} · {a.tool}</span>
            <span className="text-[var(--ink3)]">{clockStr(a.cleared!)}</span>
          </div>
          <div className="text-[var(--ink3)]">{a.by}</div>
        </div>
      ))}
    </div>
  )
}
