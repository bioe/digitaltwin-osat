import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { bake } from '../models/dsl'
import { MODELS } from '../models'
import { world } from '../sim/world'
import { STATUS } from './materials'

/** Soft radial falloff used for every glow halo. */
function radialTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Height of each lamp above the tower base (green, amber, red), see Builder.tower. */
const LAMP_Y = { run: 0.235, idle: 0.31, alarm: 0.385 } as const
const AI = new THREE.Color('#fbbf24')

interface Emitter {
  pos: THREE.Vector3
  rotY: number
  tower: THREE.Vector3 | null
  state: () => 'run' | 'idle' | 'alarm'
  ai: () => boolean
  phase: number
}

function local(model: string) {
  const b = bake(MODELS[model])
  const tower = b.towers[0] ? new THREE.Vector3(...b.towers[0]) : null
  return { tower }
}

/**
 * Signal towers light their surroundings softly: additive halos in the lit lamp's colour.
 * Faint by day, stronger in the lights-out night. (Screens glow by themselves, see DayNight.)
 */
export function Glows() {
  const tex = useMemo(radialTexture, [])
  const emitters = useMemo<Emitter[]>(() => {
    const cache = new Map<string, ReturnType<typeof local>>()
    const of = (m: string) => {
      if (!cache.has(m)) cache.set(m, local(m))
      return cache.get(m)!
    }
    const list: Emitter[] = []
    for (const t of world.tools) {
      const l = of(t.model)
      list.push({ pos: new THREE.Vector3(...t.pos), rotY: t.rotY, tower: l.tower, state: () => t.state, ai: () => !!t.alarm?.ai, phase: t.phase })
    }
    for (const s of world.stockers) {
      const l = of(s.model)
      list.push({
        pos: new THREE.Vector3(...s.pos), rotY: s.rotY, tower: l.tower,
        state: () => ((s.lots.length + s.reserved) / s.capacity > 0.92 ? 'alarm' : s.lots.length ? 'run' : 'idle'),
        ai: () => false, phase: s.idx * 0.37,
      })
    }
    return list
  }, [])

  const towerGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(emitters.length * 3), 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(emitters.length * 3), 3))
    return g
  }, [emitters])

  const towerMat = useMemo(
    () => new THREE.PointsMaterial({ size: 1.5, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [tex],
  )

  const v = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const c = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const T = clock.elapsedTime
    const pos = towerGeo.getAttribute('position') as THREE.BufferAttribute
    const col = towerGeo.getAttribute('color') as THREE.BufferAttribute
    emitters.forEach((e, i) => {
      if (!e.tower) {
        pos.setXYZ(i, 0, -999, 0)
        return
      }
      const st = e.state()
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, e.rotY)
      v.copy(e.tower).setY(e.tower.y + LAMP_Y[st]).applyQuaternion(q).add(e.pos)
      pos.setXYZ(i, v.x, v.y, v.z)
      c.copy(e.ai() ? AI : STATUS[st])
      if (st === 'alarm' && Math.sin((T + e.phase) * Math.PI * 3) < -0.2) c.multiplyScalar(0.15)
      col.setXYZ(i, c.r, c.g, c.b)
    })
    pos.needsUpdate = true
    col.needsUpdate = true
    // soft by day, stronger at night
    const night = 1 - world.daylight
    towerMat.opacity = 0.4 + 0.55 * night
    towerMat.size = 2.2 + 2.6 * night
  })

  return (
    <group>
      <points geometry={towerGeo} material={towerMat} frustumCulled={false} raycast={() => null} />
    </group>
  )
}
