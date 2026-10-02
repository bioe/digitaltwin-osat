import { envCellName } from '../../layout/fab'
import { BAY_NAMES, ROUTE, TOOL_TYPES } from '../../sim/model'
import { wipByBay } from '../../sim/tick'
import { useFactory } from '../../store/store'
import { STATUS_LABEL } from '../../theme'
import { AlarmList, FillBar, Section, Stat, StatGrid, StatusBadge, clock, fmt } from '../bits'
import { TrendChart } from '../TrendChart'

function CleanroomSummary() {
  const tools = useFactory(s => s.sim.tools)
  const lots = useFactory(s => s.sim.lots)
  const env = useFactory(s => s.sim.env)
  const kpi = useFactory(s => s.sim.kpi)
  const history = useFactory(s => s.history)
  const select = useFactory(s => s.select)

  const running = tools.filter(t => t.status === 'run').length
  const worst = env.reduce((w, c, i) => (c.particles > env[w].particles ? i : w), 0)
  const maxP = env[worst].particles
  const wip = wipByBay(lots)
  const down = tools.filter(t => t.status === 'down')

  return (
    <>
      <StatGrid>
        <Stat label="Tools running" value={`${running} / ${tools.length}`} />
        <Stat label="WIP" value={fmt(kpi.wip)} unit="lots" />
        <Stat label="Line yield" value={fmt(kpi.yield, 1)} unit="%" />
        <Stat
          label={`Particles (worst ${envCellName(worst)})`}
          value={maxP > 100 ? 'Over ISO 4' : 'ISO 4 OK'}
          tone={maxP > 100 ? 'alarm' : undefined}
        />
        <Stat label="Fab OEE" value={fmt(kpi.oee, 1)} unit="%" />
        <Stat label="Cycle time" value={fmt(kpi.cycleTimeDays, 1)} unit="days" />
      </StatGrid>
      <Section title="Output" aside="wafers/h · last 10 min">
        <TrendChart ring={history.site.wafersOutPerHour} unit="wfr/h" digits={0} />
      </Section>
      <Section title="Bays">
        <table className="w-full text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-0.5 text-left font-normal">Bay</th>
              <th className="text-right font-normal">Up</th>
              <th className="text-right font-normal">WIP</th>
              <th className="text-right font-normal">OEE</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-700">
            {TOOL_TYPES.map((type, b) => {
              const bay = tools.filter(t => t.bay === b)
              const up = bay.filter(t => t.status === 'run' || t.status === 'idle').length
              const oee = bay.reduce((a, t) => a + t.oee, 0) / bay.length
              return (
                <tr key={type} className="border-t border-slate-100">
                  <td className="py-0.5">{BAY_NAMES[type]}</td>
                  <td className={`text-right ${up < bay.length - 2 ? 'font-medium text-red-600' : ''}`}>
                    {up}/{bay.length}
                  </td>
                  <td className="text-right">{wip[b]}</td>
                  <td className="text-right">{fmt(oee, 1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>
      {down.length > 0 && (
        <Section title="Tools down">
          <div className="flex flex-wrap gap-1">
            {down.map(t => (
              <button
                key={t.id}
                onClick={() => select({ kind: 'tool', id: t.id })}
                className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
              >
                {t.id}
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

function SubfabSummary() {
  const u = useFactory(s => s.sim.utility)
  const history = useFactory(s => s.history)
  return (
    <>
      <StatGrid>
        <Stat label="Sub-fab load" value={fmt(u.subfabKw / 1000, 1)} unit="MW" />
        <Stat label="Chilled water supply" value={fmt(u.chwSupplyC, 1)} unit="°C" />
        <Stat label="Exhaust pressure" value={fmt(u.exhaustPa)} unit="Pa" />
        <Stat label="Vacuum pumps" value="640" unit="online" />
      </StatGrid>
      <Section title="Fab power" aside="kW · last 10 min">
        <TrendChart ring={history.site.fabKw} unit="kW" digits={0} />
      </Section>
    </>
  )
}

function FanDeckSummary() {
  const u = useFactory(s => s.sim.utility)
  const history = useFactory(s => s.history)
  return (
    <>
      <StatGrid>
        <Stat label="Fan deck load" value={fmt(u.fanDeckKw / 1000, 1)} unit="MW" />
        <Stat label="FFUs running" value={`${fmt(u.ffuRunning)} / ${fmt(u.ffuTotal)}`} />
        <Stat label="Air changes" value="480" unit="/h" />
        <Stat label="Make-up air" value="21.0" unit="°C" />
      </StatGrid>
      <Section title="Fab power" aside="kW · last 10 min">
        <TrendChart ring={history.site.fabKw} unit="kW" digits={0} />
      </Section>
    </>
  )
}

export function FabFloorPanel({ floor }: { floor: number }) {
  const alarms = useFactory(s => s.alarms).filter(a => a.block === 'fab')
  return (
    <div>
      {floor === 2 ? <CleanroomSummary /> : floor === 1 ? <SubfabSummary /> : <FanDeckSummary />}
      <Section title="Fab alarms">
        <AlarmList alarms={alarms} />
      </Section>
    </div>
  )
}

export function ToolPanel({ id }: { id: string }) {
  const tool = useFactory(s => s.sim.tools.find(t => t.id === id))
  const t = useFactory(s => s.sim.t)
  const ring = useFactory(s => s.history.tools.get(id))
  const alarms = useFactory(s => s.alarms).filter(a => a.source === id)
  if (!tool) return null
  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">{tool.id}</h2>
        <StatusBadge status={tool.status} />
      </div>
      <p className="text-xs text-slate-500">
        Bay {tool.bay + 1} · {BAY_NAMES[tool.type]} · Fab L2 · {STATUS_LABEL[tool.status]} for{' '}
        {fmt(Math.max(0, t - tool.statusSince))} s
      </p>
      <Section title="Performance">
        <StatGrid cols={3}>
          <Stat label="OEE" value={fmt(tool.oee, 1)} unit="%" tone={tool.oee < 60 ? 'alarm' : undefined} />
          <Stat label="Uptime" value={fmt(tool.uptime, 1)} unit="%" />
          <Stat label="Queue" value={fmt(tool.queue)} unit="lots" tone={tool.queue > 12 ? 'warn' : undefined} />
        </StatGrid>
      </Section>
      <Section title="OEE" aside="% · last 10 min">
        <TrendChart ring={ring} unit="%" />
      </Section>
      <Section title="Alarms">
        <AlarmList alarms={alarms.map(a => ({ ...a, message: `${a.since !== undefined ? clock(a.since) + ' ' : ''}${a.message}` }))} />
      </Section>
    </div>
  )
}

export function FoupPanel({ index }: { index: number }) {
  const foup = useFactory(s => s.sim.foups[index])
  const lot = useFactory(s => (foup ? s.sim.lots[foup.lotIndex] : undefined))
  if (!foup || !lot) return null
  const type = ROUTE[lot.step]
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">FOUP {String(index + 1).padStart(3, '0')}</h2>
      <p className="text-xs text-slate-500">On AMHS overhead track · Fab L2</p>
      <Section title="Lot">
        <StatGrid>
          <Stat label="Lot ID" value={lot.id} />
          <Stat label="Product" value={lot.product} />
          <Stat label="Current step" value={`${lot.step + 1} / ${ROUTE.length}`} />
          <Stat label="Process" value={BAY_NAMES[type]} />
        </StatGrid>
      </Section>
      <Section title="Route progress" aside={`${fmt(((lot.step + lot.progress) / ROUTE.length) * 100)}%`}>
        <FillBar value={lot.step + lot.progress} max={ROUTE.length} />
      </Section>
      <Section title="Step progress" aside={`${fmt(lot.progress * 100)}%`}>
        <FillBar value={lot.progress} max={1} />
      </Section>
    </div>
  )
}
