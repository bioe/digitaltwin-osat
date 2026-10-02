import { envCellName } from '../layout/fab'
import type { BlockId } from '../layout/site'
import { inventoryByCategory } from './inventory'
import type { FactoryState } from './model'

export type Severity = 'alarm' | 'warning'

export interface Alarm {
  key: string
  block: BlockId
  severity: Severity
  /** Asset or area the alarm belongs to. */
  source: string
  message: string
  /** Sim time when the condition started, if known. */
  since?: number
}

export const OFFICE_TEMP_LIMIT = 25

/** Alarms are derived from state each tick; they are never stored. */
export function deriveAlarms(s: FactoryState): Alarm[] {
  const out: Alarm[] = []
  for (const t of s.tools)
    if (t.status === 'down')
      out.push({
        key: `tool-${t.id}`,
        block: 'fab',
        severity: 'alarm',
        source: t.id,
        message: `${t.id} down: RF generator fault`,
        since: t.statusSince,
      })
  const hot = s.env.map((c, i) => [c, i] as const).filter(([c]) => c.particles > 100)
  if (hot.length)
    out.push({
      key: 'particles',
      block: 'fab',
      severity: 'alarm',
      source: 'Cleanroom',
      message: `Particles over ISO 4 limit in ${hot.map(([, i]) => envCellName(i)).join(', ')}`,
    })
  for (const c of inventoryByCategory(s.racks))
    if (c.low)
      out.push({
        key: `stock-${c.category}`,
        block: 'warehouse',
        severity: 'warning',
        source: c.category,
        message: `${c.category} below reorder level`,
      })
  for (const z of s.office)
    if (z.tempC > OFFICE_TEMP_LIMIT)
      out.push({
        key: `temp-${z.id}`,
        block: 'office',
        severity: 'warning',
        source: z.id,
        message: `${z.id} ${z.name} at ${z.tempC.toFixed(1)} °C`,
      })
  return out
}
