import { AI_STAGES } from '../sim/world'
import { useTick, useUI } from '../store'
import { clockStr } from './bits'

const ICONS = [
  // detect anomaly: target
  <g key="d"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></g>,
  // AI diagnosis: chip
  <g key="a"><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></g>,
  // plan: list
  <g key="p"><path d="M8 6h11M8 12h11M8 18h11" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></g>,
  // execute & validate: play + check
  <g key="e"><path d="M5 4l10 8-10 8z" /><path d="M14 17l3 3 5-6" /></g>,
  // resolved
  <g key="r"><circle cx="12" cy="12" r="9" /><path d="M7.5 12.5l3 3 6-6" /></g>,
]

/** Left panel: the AI virtual operator's recovery pipeline and its recent actions. */
export function AiRecovery() {
  const w = useTick(2)
  const select = useUI(s => s.select)
  const active = w.tools.filter(t => t.alarm?.ai)
  const counts = AI_STAGES.map((_, i) => active.filter(t => t.alarm!.ai!.stage === i).length)
  counts[4] = w.alarmLog.filter(a => a.ai && a.cleared && w.clock - a.cleared < 15000).length
  const log = w.alarmLog.filter(a => a.ai).slice(0, 6)
  const resolvedToday = 37 + w.alarmLog.filter(a => a.ai && a.cleared).length
  return (
    <section className="cc-panel flex min-h-0 flex-col p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="cc-title">AI auto recovery</div>
        <div className="text-[10.5px] text-[var(--ink3)]">
          <span className="num text-[13px] text-emerald-300">{resolvedToday}</span> auto-resolved today
        </div>
      </div>
      <div className="flex items-start justify-between px-1">
        {AI_STAGES.map((label, i) => {
          const on = counts[i] > 0
          const col = i === 4 ? '#34d399' : '#38bdf8'
          return (
            <div key={label} className="flex items-start">
              <div className="flex w-[58px] flex-col items-center text-center">
                <div
                  className="relative flex h-9 w-9 items-center justify-center rounded-md border"
                  style={{ borderColor: col, background: on ? `${col}33` : `${col}10`, boxShadow: on ? `0 0 12px ${col}` : 'none' }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {ICONS[i]}
                  </svg>
                  {on && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-amber-400 px-1 text-[9px] font-bold text-black">{counts[i]}</span>}
                </div>
                <div className="mt-1 text-[9.5px] leading-tight text-[var(--ink2)]">{label}</div>
              </div>
              {i < 4 && <div className="mt-4 text-[var(--cyan)]">→</div>}
            </div>
          )
        })}
      </div>
      <div className="scroll-thin mt-2 min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-[10.5px]">
          <thead>
            <tr>
              <th className="cc-th">Time</th>
              <th className="cc-th">Equipment</th>
              <th className="cc-th">Issue</th>
              <th className="cc-th">AI action</th>
              <th className="cc-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {log.map((a, i) => {
              const done = !!a.cleared
              return (
                <tr key={i} className="cursor-pointer border-t border-white/5 hover:bg-white/5" onClick={() => select({ kind: 'tool', id: a.tool }, true)}>
                  <td className="py-[3px] pr-1">
                    <span className="mr-1 inline-block h-[6px] w-[6px] rounded-full" style={{ background: done ? '#34d399' : '#fbbf24' }} />
                    {clockStr(a.at, false)}
                  </td>
                  <td className="mono pr-1">{a.tool}</td>
                  <td className="max-w-[90px] truncate pr-1 text-[var(--ink2)]" title={a.text}>{a.text}</td>
                  <td className="max-w-[90px] truncate pr-1" title={a.ai!.action}>{a.ai!.action}</td>
                  <td style={{ color: done ? '#34d399' : '#fbbf24' }}>{done ? 'Resolved' : AI_STAGES[a.ai!.stage].split(' ')[0] + '…'}</td>
                </tr>
              )
            })}
            {!log.length && (
              <tr>
                <td colSpan={5} className="py-2 text-[var(--ink3)]">Watching 86 tools – no anomalies yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
