import { OFFICE_TEMP_LIMIT } from '../../sim/alarms'
import { useFactory } from '../../store/store'
import { AlarmList, FillBar, Section, Stat, StatGrid, fmt } from '../bits'
import { TrendChart } from '../TrendChart'

export function OfficeFloorPanel({ floor }: { floor: number | null }) {
  const all = useFactory(s => s.sim.office)
  const history = useFactory(s => s.history)
  const alarms = useFactory(s => s.alarms).filter(a => a.block === 'office')
  const select = useFactory(s => s.select)

  const zones = floor ? all.filter(z => z.floor === floor) : all
  const occ = zones.reduce((a, z) => a + z.occupied, 0)
  const cap = zones.reduce((a, z) => a + z.capacity, 0)
  const kw = zones.reduce((a, z) => a + z.kw, 0)
  const temp = zones.reduce((a, z) => a + z.tempC, 0) / zones.length

  return (
    <div>
      <StatGrid>
        <Stat label="Occupancy" value={fmt((occ / cap) * 100)} unit={`% · ${occ}/${cap}`} />
        <Stat label="Avg temp" value={fmt(temp, 1)} unit="°C" tone={temp > OFFICE_TEMP_LIMIT ? 'warn' : undefined} />
        <Stat label="Load" value={fmt(kw)} unit="kW" />
        <Stat label="Zones" value={String(zones.length)} />
      </StatGrid>

      <Section title="Office load" aside="kW · all floors · last 10 min">
        <TrendChart ring={history.site.officeKw} unit="kW" digits={0} />
      </Section>

      <Section title="Zones">
        <div className="space-y-1.5">
          {zones.map(z => (
            <button
              key={z.id}
              onClick={() => select({ kind: 'zone', id: z.id })}
              className="block w-full rounded border border-slate-200 px-2 py-1 text-left text-xs hover:border-blue-400"
            >
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">
                  {floor ? '' : `L${z.floor} · `}
                  {z.name}
                </span>
                <span className={`tabular-nums ${z.tempC > OFFICE_TEMP_LIMIT ? 'font-medium text-amber-600' : 'text-slate-500'}`}>
                  {fmt(z.tempC, 1)} °C · {fmt(z.kw)} kW
                </span>
              </div>
              <div className="mt-1">
                <FillBar value={z.occupied} max={z.capacity} />
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Office alarms">
        <AlarmList alarms={alarms} />
      </Section>
    </div>
  )
}

export function ZonePanel({ id }: { id: string }) {
  const zone = useFactory(s => s.sim.office.find(z => z.id === id))
  const ring = useFactory(s => s.history.zones.get(id))
  if (!zone) return null
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{zone.name}</h2>
      <p className="text-xs text-slate-500">
        Office L{zone.floor} · {zone.id}
      </p>
      <Section title="Now">
        <StatGrid cols={3}>
          <Stat label="Occupied" value={`${zone.occupied}/${zone.capacity}`} />
          <Stat
            label="Temp"
            value={fmt(zone.tempC, 1)}
            unit="°C"
            tone={zone.tempC > OFFICE_TEMP_LIMIT ? 'warn' : undefined}
          />
          <Stat label="Load" value={fmt(zone.kw)} unit="kW" />
        </StatGrid>
      </Section>
      <Section title="Occupancy" aside={`${fmt((zone.occupied / zone.capacity) * 100)}%`}>
        <FillBar value={zone.occupied} max={zone.capacity} />
      </Section>
      <Section title="Load" aside="kW · last 10 min">
        <TrendChart ring={ring} unit="kW" digits={0} />
      </Section>
    </div>
  )
}
