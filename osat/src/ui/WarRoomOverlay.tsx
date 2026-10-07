import { useEffect, useRef } from 'react'
import { MEZZ_Y } from '../layout/layout'
import { SCREENS } from '../scene/wallPanels'
import { useTick, useUI } from '../store'

/** Full-screen copy of the war room video wall: brand strip + left / centre / right screens. */
export function WarRoomOverlay() {
  const open = useUI(s => s.warRoom)
  const setOpen = useUI(s => s.setWarRoom)
  const select = useUI(s => s.select)
  const flyTo = useUI(s => s.flyTo)
  const w = useTick(open ? 1 : 0.2)
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({})

  useEffect(() => {
    if (!open) return
    const draw = () => {
      for (const s of SCREENS) {
        const c = refs.current[s.key]
        if (c) s.draw(c.getContext('2d')!)
      }
    }
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
  const local = (e: React.MouseEvent<HTMLCanvasElement>, W: number, H: number) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
  }
  /** Centre screen: click a tool on the floor map. */
  const onCenter = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const [px, py] = local(e, 1792, 1152)
    const B = w.L.bounds
    const x = B.x0 + (px - 40) / ((1792 - 80) / (B.x1 - B.x0))
    const z = B.z0 + (py - 90) / ((1152 - 190) / (B.z1 - B.z0))
    const t = w.tools.reduce((m, t) => (Math.hypot(t.pos[0] - x, t.pos[2] - z) < Math.hypot(m.pos[0] - x, m.pos[2] - z) ? t : m))
    if (Math.hypot(t.pos[0] - x, t.pos[2] - z) < 4) go(t.id)
  }
  /** Right screen: click an alert row. */
  const onRight = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const [, py] = local(e, 1024, 1152)
    const row = Math.floor((py - (666 + 86)) / 28)
    const a = w.alarmLog[row]
    if (row >= 0 && row < 13 && a) go(a.tool)
  }
  const canvas = (key: string, W: number, H: number, onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void, className = '') => (
    <canvas
      ref={el => {
        refs.current[key] = el
      }}
      width={W}
      height={H}
      onClick={onClick}
      className={`block h-auto min-w-0 ${className || 'w-full'}`}
      style={{ aspectRatio: `${W} / ${H}`, cursor: onClick ? 'pointer' : 'default' }}
    />
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#05080d]" role="dialog" aria-label="War room video wall">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-2">
        <div className="hud-title !text-rose-400">◉ War room · video wall</div>
        <div className="text-[12px] text-[var(--ink3)]">Same screens as the wall in the control room · click a tool on the map or an alert to go there · Esc to close</div>
        <button
          className="btn ml-auto"
          onClick={() => {
            setOpen(false)
            flyTo([(wr.x0 + wr.x1) / 2, MEZZ_Y + 1, wr.z1 - 2], 0.3)
          }}
        >
          View room in 3D
        </button>
        <button className="btn !px-4" onClick={() => setOpen(false)}>✕ Close</button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3" style={{ width: 'min(100%, calc((100vh - 150px) * 3840 / 1440))' }}>
          {canvas('title', 2048, 256, undefined, 'w-[48%]')}
          <div className="grid w-full gap-[6px] rounded-md bg-[#0b0d10] p-[6px]" style={{ gridTemplateColumns: 'minmax(0, 1024fr) minmax(0, 1792fr) minmax(0, 1024fr)' }}>
            {canvas('left', 1024, 1152)}
            {canvas('center', 1792, 1152, onCenter)}
            {canvas('right', 1024, 1152, onRight)}
          </div>
        </div>
      </div>
    </div>
  )
}
