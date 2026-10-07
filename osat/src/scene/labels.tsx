import { FLOOR_Y, MEZZ_Y } from '../layout/layout'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../sim/world'
import { useUI } from '../store'
import { MODE_TINT } from './Building'

interface Label {
  id: string
  pos: [number, number, number]
  /** Hide when the camera is farther than this (m). */
  maxDist: number
  kind: 'zone' | 'stocker' | 'hq'
  text: string
  sub?: string
  color: string
  num?: string
}

export function labels(): Label[] {
  const L = world.L
  const out: Label[] = L.zones.map((z, i) => ({
    id: `z-${z.proc.id}`,
    pos: [(z.x0 + z.x1) / 2, 5.2, z.row === 'north' ? z.z0 - 0.5 : z.z1 + 0.5],
    maxDist: 400,
    kind: 'zone',
    text: z.proc.name,
    sub: z.proc.mode === 'CONV' ? 'CONVEYOR' : z.proc.mode,
    color: MODE_TINT[z.proc.mode],
    num: String(i + 1).padStart(2, '0'),
  }))
  for (const s of world.stockers) {
    out.push({ id: `s-${s.id}`, pos: [s.pos[0], s.size[2] + 0.9, s.pos[2]], maxDist: 90, kind: 'stocker', text: s.id, color: '#94a3b8' })
  }
  const wr = L.warRoom
  out.push({ id: 'hq', pos: [(wr.x0 + wr.x1) / 2, MEZZ_Y + 3.9, 0], maxDist: 400, kind: 'hq', text: 'War Room · Central Control', color: '#f43f5e', num: 'HQ' })
  return out
}

const els = new Map<string, HTMLDivElement>()

/** Inside the Canvas: projects each label to screen space every frame. */
export function LabelProjector() {
  const list = useMemo(labels, [])
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const l of list) {
      const el = els.get(l.id)
      if (!el) continue
      v.set(l.pos[0], l.pos[1] + FLOOR_Y, l.pos[2])
      const d = camera.position.distanceTo(v)
      v.project(camera)
      const visible = v.z < 1 && d < l.maxDist && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.display = visible ? '' : 'none'
      if (!visible) continue
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      el.style.zIndex = String(Math.round((1 - v.z) * 1000))
    }
  })
  return null
}

/** Outside the Canvas: the label DOM. */
export function LabelLayer() {
  const show = useUI(s => s.layers.labels)
  const list = useMemo(labels, [])
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ display: show ? '' : 'none' }}>
      {list.map(l => (
        <div
          key={l.id}
          ref={el => {
            if (el) els.set(l.id, el)
            else els.delete(l.id)
          }}
          className="absolute left-0 top-0"
          style={{ display: 'none' }}
        >
          {l.kind === 'stocker' ? (
            <div className="stk-tag">{l.text}</div>
          ) : (
            <div className="zone-tag" style={{ borderColor: l.color }}>
              <span className="zone-num">{l.num}</span>
              <span>{l.text}</span>
              {l.sub && <span className="zone-mode" style={{ color: l.color }}>{l.sub}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
