import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { FLOOR_Y, MEZZ_Y } from '../layout/layout'
import { useTick, useUI } from '../store'
import { MODE_TINT } from './Building'
import { STATUS_HEX } from './materials'

/** Every DOM label registers its element and its 3D anchor (factory-local). */
const els = new Map<string, { el: HTMLDivElement; pos: [number, number, number]; maxDist: number }>()

function reg(id: string, pos: [number, number, number], maxDist: number) {
  return (el: HTMLDivElement | null) => {
    if (el) els.set(id, { el, pos, maxDist })
    else els.delete(id)
  }
}

/** Inside the Canvas: projects each label to screen space every frame. */
export function LabelProjector() {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const { el, pos, maxDist } of els.values()) {
      v.set(pos[0], pos[1] + FLOOR_Y, pos[2])
      const d = camera.position.distanceTo(v)
      v.project(camera)
      const visible = v.z < 1 && d < maxDist && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
      el.style.display = visible ? '' : 'none'
      if (!visible) continue
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      el.style.zIndex = String(Math.round((1 - v.z) * 1000))
    }
  })
  return null
}

/** Outside the Canvas: zone callouts, stocker tags, the HQ tag and live alarm callouts. */
export function LabelLayer() {
  const w = useTick(2)
  const layers = useUI(s => s.layers)
  const select = useUI(s => s.select)
  const wr = w.L.warRoom
  const alarms = w.tools.filter(t => t.alarm)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {layers.labels &&
        w.L.zones.map(z => {
          const tools = w.tools.filter(t => t.proc === z.proc.id && !t.aux)
          const run = tools.filter(t => t.state === 'run').length
          const pct = Math.round((run / tools.length) * 100)
          const worst = tools.some(t => t.state === 'alarm') ? 'alarm' : pct < 80 ? 'idle' : 'run'
          return (
            <div key={z.proc.id} ref={reg(`z-${z.proc.id}`, [(z.x0 + z.x1) / 2, 4.6, z.row === 'north' ? z.z0 - 0.3 : z.z1 + 0.3], 420)} className="absolute left-0 top-0" style={{ display: 'none' }}>
              <div className="callout" style={{ borderColor: MODE_TINT[z.proc.mode] }}>
                <div className="text-[13px] font-bold leading-tight">{z.proc.name}</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold leading-tight" style={{ color: STATUS_HEX[worst] }}>
                  <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: STATUS_HEX[worst] }} />
                  Running {pct}% · {run}/{tools.length}
                </div>
              </div>
            </div>
          )
        })}
      {layers.labels &&
        w.stockers.map(s => (
          <div key={s.id} ref={reg(`s-${s.id}`, [s.pos[0], s.size[2] + 0.6, s.pos[2]], 90)} className="absolute left-0 top-0" style={{ display: 'none' }}>
            <div className="stk-tag">{s.id} · {s.lots.length}</div>
          </div>
        ))}
      {layers.labels && (
        <div ref={reg('hq', [(wr.x0 + wr.x1) / 2, MEZZ_Y + 4.3, 0], 420)} className="absolute left-0 top-0" style={{ display: 'none' }}>
          <div className="callout" style={{ borderColor: '#f43f5e' }}>
            <span className="text-[13px] font-bold">War Room · Central Control</span>
          </div>
        </div>
      )}
      {layers.callouts &&
        alarms.map(t => {
          const ai = t.alarm!.ai
          const col = ai ? '#fbbf24' : STATUS_HEX.alarm
          return (
            <div key={`a-${t.id}`} ref={reg(`a-${t.id}`, [t.pos[0], t.size[2] + 0.5, t.pos[2]], 160)} className="absolute left-0 top-0" style={{ display: 'none' }}>
              <button
                className="callout warn pointer-events-auto text-left"
                style={{ borderColor: col, boxShadow: `0 0 14px ${col}88` }}
                onClick={() => select({ kind: 'tool', id: t.id }, true)}
              >
                <div className="text-[12.5px] font-bold leading-tight">{t.id}</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold leading-tight" style={{ color: col }}>
                  <span className="rounded-sm px-1 text-[10px] text-black" style={{ background: col }}>!</span>
                  {ai ? 'AI recovery in progress' : t.tech ? `${t.tech.name} ${t.tech.working ? 'repairing' : 'en route'}` : t.alarm!.text}
                </div>
              </button>
              <div className="mx-auto h-3 w-px" style={{ background: col }} />
            </div>
          )
        })}
    </div>
  )
}
