import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { factoryStore, useFactory } from '../store/store'
import { ARCH } from '../theme'
import { selectionWorldPos } from './positions'

/** Pulsing ring and pointer that follow the selected asset. */
export function SelectionMarker() {
  const selection = useFactory(s => s.view.selection)
  const ref = useRef<Group>(null)
  const ring = useRef<Group>(null)

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const { view, sim, lastTickAt } = factoryStore.getState()
    const sel = view.selection
    const p = sel && selectionWorldPos(sel, sim, Math.min(1.2, (performance.now() - lastTickAt) / 1000))
    g.visible = !!p
    if (!p) return
    g.position.set(p[0], p[1], p[2])
    const t = clock.getElapsedTime()
    g.children[1].position.y = 6 + Math.sin(t * 3) * 0.6
    ring.current?.scale.setScalar(1 + 0.15 * Math.sin(t * 4))
  })

  // The KPI board is a screen; a ring over it hides the numbers.
  if (!selection || selection.kind === 'kpiBoard') return null
  const r = selection.kind === 'zone' ? 18 : selection.kind === 'rack' ? 11 : 5

  return (
    <group ref={ref}>
      <group ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[r, r + 0.8, 48]} />
          <meshBasicMaterial color={ARCH.accent} transparent opacity={0.85} depthTest={false} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI, 0, 0]} renderOrder={10}>
        <coneGeometry args={[1.2, 2.6, 4]} />
        <meshBasicMaterial color={ARCH.accent} depthTest={false} />
      </mesh>
    </group>
  )
}
