import { useState } from 'react'
import { PROCESSES } from '../data/processes'
import type { Alarm, Severity } from '../sim/world'
import { useTick, useUI } from '../store'
import { clockStr } from './bits'

const SEV: Record<Severity, string> = { High: '#ff4d5e', Medium: '#fbbf24', Low: '#38bdf8' }

type Status = 'Open' | 'In progress' | 'Resolved'

/** Right panel: every alarm with severity and handling status, filterable. */
export function AlertQueue() {
  const w = useTick(2)
  const select = useUI(s => s.select)
  const [sev, setSev] = useState<'All' | Severity>('All')
  const [proc, setProc] = useState('All')
  const [stat, setStat] = useState<'All' | 'Unresolved' | Status>('Unresolved')
  const statusOf = (a: Alarm): Status => {
    if (a.cleared) return 'Resolved'
    const t = w.toolById.get(a.tool)
    if (a.ai || t?.tech?.working) return 'In progress'
    return 'Open'
  }
  const rows = w.alarmLog
    .filter(a => sev === 'All' || a.severity === sev)
    .filter(a => proc === 'All' || a.proc === proc)
    .filter(a => {
      const s = statusOf(a)
      return stat === 'All' || (stat === 'Unresolved' ? s !== 'Resolved' : s === stat)
    })
    .slice(0, 30)
  const pill = (s: Status) =>
    s === 'Resolved' ? { c: '#34d399', bg: '#34d39922' } : s === 'In progress' ? { c: '#38bdf8', bg: '#38bdf822' } : { c: '#cbd5e1', bg: 'transparent' }
  return (
    <section className="cc-panel flex min-h-0 flex-col p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <div className="cc-title mr-auto whitespace-nowrap">Alert queue</div>
        <select className="cc-select w-[74px]" value={sev} onChange={e => setSev(e.target.value as typeof sev)} aria-label="Severity">
          <option value="All">Severity</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <select className="cc-select w-[84px]" value={proc} onChange={e => setProc(e.target.value)} aria-label="Equipment">
          <option value="All">Equipment</option>
          {PROCESSES.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="cc-select w-[84px]" value={stat} onChange={e => setStat(e.target.value as typeof stat)} aria-label="Status">
          <option value="Unresolved">Unresolved</option>
          <option value="All">All</option>
          <option>Open</option>
          <option>In progress</option>
          <option>Resolved</option>
        </select>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0a1a30]">
            <tr>
              <th className="cc-th">#</th>
              <th className="cc-th">Time</th>
              <th className="cc-th">Equipment</th>
              <th className="cc-th">Description</th>
              <th className="cc-th">Severity</th>
              <th className="cc-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => {
              const s = statusOf(a)
              const p = pill(s)
              return (
                <tr key={`${a.tool}-${a.at}`} className="cursor-pointer border-t border-white/5 hover:bg-white/5" onClick={() => select({ kind: 'tool', id: a.tool }, true)}>
                  <td className="mono py-[3px] pr-1 text-[var(--ink3)]">{String(i + 1).padStart(3, '0')}</td>
                  <td className="pr-1">{clockStr(a.at, false)}</td>
                  <td className="mono pr-1">{a.tool}</td>
                  <td className="max-w-[150px] truncate pr-1" title={a.text}>{a.text}</td>
                  <td className="pr-1">
                    <span className="mr-1 inline-block h-[7px] w-[7px] rounded-full" style={{ background: SEV[a.severity], boxShadow: `0 0 5px ${SEV[a.severity]}` }} />
                    <span style={{ color: SEV[a.severity] }}>{a.severity}</span>
                  </td>
                  <td>
                    <span className="cc-pill" style={{ color: p.c, borderColor: `${p.c}88`, background: p.bg }}>{s}</span>
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="py-3 text-center text-[var(--ink3)]">No alerts match the filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
