import { useEffect, useRef } from 'react'
import { pathAt } from '../layout/path'
import { MODE_TINT } from '../scene/Building'
import { STATUS_HEX } from '../scene/materials'
import { world } from '../sim/world'
import { useUI } from '../store'

const W = 232
const H = 96

/** Top-down radar with live tools and vehicles. Click to move the camera. */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null)
  const flyTo = useUI(s => s.flyTo)
  const B = world.L.bounds
  const sx = (W - 8) / (B.x1 - B.x0)
  const sz = (H - 8) / (B.z1 - B.z0)
  const X = (x: number) => 4 + (x - B.x0) * sx
  const Z = (z: number) => 4 + (z - B.z0) * sz
  useEffect(() => {
    let raf = 0
    const draw = () => {
      const c = ref.current
      if (c) {
        const g = c.getContext('2d')!
        g.setTransform(2, 0, 0, 2, 0, 0)
        g.clearRect(0, 0, W, H)
        g.fillStyle = '#0d1828'
        g.fillRect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * sx, (B.z1 - B.z0) * sz)
        for (const z of world.L.zones) {
          g.fillStyle = `${MODE_TINT[z.proc.mode]}22`
          g.fillRect(X(z.x0), Z(z.z0), (z.x1 - z.x0) * sx, (z.z1 - z.z0) * sz)
        }
        const wr = world.L.warRoom
        g.strokeStyle = '#f43f5e'
        g.strokeRect(X(wr.x0), Z(wr.z0), (wr.x1 - wr.x0) * sx, (wr.z1 - wr.z0) * sz)
        for (const t of world.tools) {
          g.fillStyle = STATUS_HEX[t.state]
          g.fillRect(X(t.pos[0]) - 1.2, Z(t.pos[2]) - 1.2, 2.4, 2.4)
        }
        for (const s of world.stockers) {
          g.fillStyle = '#94a3b8'
          g.fillRect(X(s.pos[0]) - 2, Z(s.pos[2]) - 1.5, 4, 3)
        }
        g.fillStyle = '#60a5fa'
        for (const v of world.oht) {
          const p = pathAt(world.L.loops.OHT, v.s).p
          g.fillRect(X(p[0]) - 1, Z(p[1]) - 1, 2, 2)
        }
        g.fillStyle = '#2dd4bf'
        for (const a of world.arvs) g.fillRect(X(a.pos[0]) - 1, Z(a.pos[1]) - 1, 2, 2)
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  })
  return (
    <div className="border-t border-[var(--line)] p-2">
      <div className="hud-title mb-1">Floor radar · {(B.x1 - B.x0).toFixed(0)} × {(B.z1 - B.z0).toFixed(0)} m</div>
      <canvas
        ref={ref}
        width={W * 2}
        height={H * 2}
        style={{ width: W, height: H, cursor: 'crosshair' }}
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = B.x0 + (e.clientX - r.left - 4) / sx
          const z = B.z0 + (e.clientY - r.top - 4) / sz
          flyTo([x, 0, z], 0.5)
        }}
      />
    </div>
  )
}
