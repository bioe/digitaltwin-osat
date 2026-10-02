import { BLOCKS, BLOCK_IDS } from '../../layout/site'
import { useFactory } from '../../store/store'
import { AlarmList, Section, Stat, StatGrid, fmt } from '../bits'
import { TrendChart } from '../TrendChart'

export function SitePanel({ title = 'FAB-01 campus' }: { title?: string }) {
  const kpi = useFactory(s => s.sim.kpi)
  const safetyDays = useFactory(s => s.sim.safetyDays)
  const alarms = useFactory(s => s.alarms)
  const history = useFactory(s => s.history)
  const openBlock = useFactory(s => s.openBlock)

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500">100 acres · 3 blocks · 3 storeys</p>

      <Section title="Executive summary">
        <StatGrid cols={3}>
          <Stat label="Output" value={fmt(kpi.wafersOutPerHour)} unit="wfr/h" />
          <Stat label="Line yield" value={fmt(kpi.yield, 1)} unit="%" />
          <Stat label="Fab OEE" value={fmt(kpi.oee, 1)} unit="%" />
          <Stat label="Energy" value={fmt(kpi.energyMw, 1)} unit="MW" />
          <Stat label="Wafer outs today" value={fmt(kpi.waferOutsToday)} />
          <Stat label="Safety" value={fmt(safetyDays)} unit="days" />
        </StatGrid>
      </Section>

      <Section title="Output" aside="wafers/h · last 10 min">
        <TrendChart ring={history.site.wafersOutPerHour} unit="wfr/h" digits={0} />
      </Section>

      <Section title="Blocks">
        <div className="grid grid-cols-3 gap-2">
          {BLOCK_IDS.map(id => {
            const n = alarms.filter(a => a.block === id).length
            return (
              <button
                key={id}
                onClick={() => openBlock(id)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="font-medium text-slate-800">{BLOCKS[id].name}</div>
                <div className={n ? 'font-medium text-red-600' : 'text-slate-400'}>
                  {n ? `${n} alarm${n > 1 ? 's' : ''}` : 'No alarms'}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Active alarms">
        <AlarmList alarms={alarms} />
      </Section>
    </div>
  )
}
