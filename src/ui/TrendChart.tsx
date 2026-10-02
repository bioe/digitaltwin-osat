import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import type { Ring } from '../store/history'
import { useFactory } from '../store/store'
import { SERIES } from '../theme'
import { clock, fmt } from './bits'

interface Props {
  ring: Ring | undefined
  unit: string
  digits?: number
  /** Fixed y domain; defaults to the data range with padding. */
  domain?: [number, number]
}

/** Single-series 10-minute trend with crosshair tooltip. */
export function TrendChart({ ring, unit, digits = 1, domain }: Props) {
  useFactory(s => s.historyVersion)
  const times = useFactory(s => s.history.t)
  if (!ring || ring.length < 2) return <div className="h-28 text-xs text-slate-400">Collecting data…</div>

  const values = ring.values()
  const t = times.values().slice(-values.length)
  const data = values.map((v, i) => ({ t: t[i], v }))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = Math.max((hi - lo) * 0.2, Math.abs(hi) * 0.01, 0.5)

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <YAxis
            domain={domain ?? [lo - pad, hi + pad]}
            tickCount={3}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => fmt(v, digits > 1 ? 1 : 0)}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
            formatter={(v: unknown) => [`${fmt(Number(v), digits)} ${unit}`, '']}
            labelFormatter={(_, p) => (p?.[0] ? clock(Number(p[0].payload.t)) : '')}
            contentStyle={{ fontSize: 11, borderRadius: 6, padding: '4px 8px' }}
            separator=""
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={SERIES}
            strokeWidth={2}
            fill="url(#trend-fill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
