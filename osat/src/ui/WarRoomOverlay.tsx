import { useEffect, useRef } from 'react'
import { MEZZ_Y } from '../layout/layout'
import { PANELS, PH, PW } from '../scene/wallPanels'
import { useTick, useUI } from '../store'
import { clockStr } from './bits'

/** Full-screen copy of the war room video wall (same six screens as the 3D wall). Click the map or an alarm to go there. */
export function WarRoomOverlay() {
  const open = useUI(s => s.warRoom)
  const setOpen = useUI(s => s.setWarRoom)
  const select = useUI(s => s.select)
  const flyTo = useUI(s => s.flyTo)
  const w = useTick(open ? 1 : 0.2)
  const refs = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    const draw = () =>
      refs.current.forEach((c, i) => {
        if (c) PANELS[i](c.getContext('2d')!)
      })
    draw()
    const id = setInterval(draw, 1000)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  if (!open) return null
  const wr = w.L.warRoom
  const go = (id: string) => {
    setOpen(false)
    select({ kind: 'tool', id }, true)
  }

  /** Map a click on a screen back to the thing drawn there. */
  const onPanelClick = (i: number, e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * PW
    const py = ((e.clientY - r.top) / r.height) * PH
    if (i === 0) {
      const B = w.L.bounds
      const x = B.x0 + (px - 40) / ((PW - 80) / (B.x1 - B.x0))
      const z = B.z0 + (py - 90) / ((PH - 120) / (B.z1 - B.z0))
      const t = w.tools.reduce((m, t) => (Math.hypot(t.pos[0] - x, t.pos[2] - z) < Math.hypot(m.pos[0] - x, m.pos[2] - z) ? t : m))
      if (Math.hypot(t.pos[0] - x, t.pos[2] - z) < 4) go(t.id)
    } else if (i === 4) {
      const act = w.tools.filter(t => t.alarm).sort((a, b) => a.alarm!.at - b.alarm!.at)
      const row = Math.floor((py - 100) / 46)
      if (row >= 0 && row < Math.min(10, act.length)) go(act[row].id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#05080d]" role="dialog" aria-label="War room video wall">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-2.5">
        <div className="hud-title !text-rose-400">◉ War room · video wall</div>
        <div className="text-[12px] text-[var(--ink3)]">Same screens as the wall in the control room · click the floor map or an alarm to go there</div>
        <div className="num ml-auto text-[22px] leading-none">{clockStr(w.clock)}</div>
        <button
          className="btn"
          onClick={() => {
            setOpen(false)
            flyTo([(wr.x0 + wr.x1) / 2, MEZZ_Y + 1, wr.z1 - 2], 0.3)
          }}
        >
          View room in 3D
        </button>
        <button className="btn !px-4" onClick={() => setOpen(false)}>✕ Close</button>
      </div>
      {/* 3 × 2 wall, 16:9 screens with thin bezels, sized to fit the window */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div
          className="grid gap-[6px] rounded-md bg-[#0b0d10] p-[6px] shadow-2xl"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)', width: 'min(100%, calc((100vh - 110px) * 16 * 3 / (9 * 2)))' }}
        >
          {PANELS.map((_, i) => (
            <canvas
              key={i}
              ref={el => {
                refs.current[i] = el
              }}
              width={PW}
              height={PH}
              onClick={e => onPanelClick(i, e)}
              className="block w-full"
              style={{ aspectRatio: '16 / 9', cursor: i === 0 || i === 4 ? 'pointer' : 'default' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
