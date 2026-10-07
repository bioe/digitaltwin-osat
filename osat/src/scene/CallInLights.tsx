import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { world } from '../sim/world'

const POOL = 1

/**
 * Night call-out lighting: motion-sensor style lights switch on around a called-in technician
 * as they walk, and the machine they repair is lit while they work. A fixed pool of lights
 * (intensity faded to 0 when unused) avoids shader recompiles.
 */
export function CallInLights() {
  const walk = useRef<(THREE.PointLight | null)[]>([])
  const work = useRef<(THREE.PointLight | null)[]>([])
  useFrame((_, dt) => {
    const night = 1 - world.daylight
    const active = world.techs.filter(w => w.onCall && w.eta <= 0)
    const k = Math.min(1, dt * 3)
    for (let i = 0; i < POOL; i++) {
      const w = active[i]
      const a = walk.current[i]
      const b = work.current[i]
      if (a) {
        const target = w ? 9 * night : 0
        if (w) a.position.set(w.pos[0], 3.4, w.pos[1])
        a.intensity += (target - a.intensity) * k
      }
      if (b) {
        const t = w?.tool
        const near = t && w && Math.hypot(t.pos[0] - w.pos[0], t.pos[2] - w.pos[1]) < 5
        const target = near ? 16 * night : 0
        if (t) b.position.set(t.pos[0], t.size[2] + 1.8, t.pos[2])
        b.intensity += (target - b.intensity) * k
      }
    }
  })
  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <group key={i}>
          <pointLight ref={el => { walk.current[i] = el }} color="#fff4e0" intensity={0} distance={10} decay={1.6} />
          <pointLight ref={el => { work.current[i] = el }} color="#eaf4ff" intensity={0} distance={7} decay={1.6} />
        </group>
      ))}
    </group>
  )
}
