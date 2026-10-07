import { tourInfo } from '../scene/Tour'
import { STATUS_HEX } from '../scene/materials'
import { useTick, useUI } from '../store'

/** Overlay during the walking tour: crosshair, location, the machine in view, controls and exit. */
export function TourHud() {
  const tour = useUI(s => s.tour)
  const select = useUI(s => s.select)
  const w = useTick(tour ? 5 : 0.2)
  if (!tour) return null
  const t = tourInfo.lookingId ? w.toolById.get(tourInfo.lookingId) : undefined
  const col = t ? (t.alarm?.ai ? '#fbbf24' : STATUS_HEX[t.state]) : ''
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
      </div>
      <div className="callout absolute left-3 top-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-sky-300">Walking tour</div>
        <div className="text-[15px] font-bold">{tourInfo.place}</div>
      </div>
      {t && (
        <button
          className="callout pointer-events-auto absolute left-1/2 top-[calc(50%+22px)] -translate-x-1/2 text-left"
          style={{ borderColor: col }}
          onClick={() => select({ kind: 'tool', id: t.id })}
          title="Show details"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: col, boxShadow: `0 0 6px ${col}` }} />
            <span className="text-[14px] font-bold">{t.id}</span>
            <span className="text-[11px] text-[var(--ink2)]">{t.name}</span>
          </div>
          <div className="text-[11.5px]" style={{ color: col }}>{t.alarm ? t.alarm.text : t.reason}</div>
          {t.lot && !t.aux && <div className="text-[10.5px] text-[var(--ink3)]">Lot {t.lot.id} · {Math.round(t.progress * 100)}%</div>}
        </button>
      )}
      {!tourInfo.locked && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[140%] rounded-lg border border-sky-400/60 bg-[#06101fee] px-5 py-3 text-center shadow-2xl">
          <div className="num text-[22px] tracking-[0.2em] text-white">CLICK TO PLAY</div>
          <div className="text-[11.5px] text-[var(--ink2)]">mouse look · WASD move · Space jump · click selects · Esc frees the mouse</div>
        </div>
      )}
    </div>
  )
}
