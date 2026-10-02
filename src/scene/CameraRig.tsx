import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { factoryStore, useFactory, type View } from '../store/store'
import { cameraGoal } from './positions'

/** The parts of drei's OrbitControls the rig uses. */
interface Controls {
  target: Vector3
  update(): void
  addEventListener(type: 'start', fn: () => void): void
  removeEventListener(type: 'start', fn: () => void): void
}

const viewKey = (v: View) => JSON.stringify([v.level, v.block, v.floor, v.selection])

/** Eases the camera to a goal whenever the drill level or selection changes. */
export function CameraRig() {
  const view = useFactory(s => s.view)
  const camera = useThree(s => s.camera)
  const controls = useThree(s => s.controls) as unknown as Controls | null
  const goal = useRef<{ pos: Vector3; target: Vector3 } | null>(null)

  const key = viewKey(view)
  useEffect(() => {
    const g = cameraGoal(factoryStore.getState().view, factoryStore.getState().sim)
    goal.current = { pos: new Vector3(...g.pos), target: new Vector3(...g.target) }
  }, [key])

  // The user takes over as soon as they drag.
  useEffect(() => {
    if (!controls) return
    const cancel = () => (goal.current = null)
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [controls])

  useFrame((_, dt) => {
    const g = goal.current
    if (!g || !controls) return
    const k = 1 - Math.exp(-3.5 * dt)
    camera.position.lerp(g.pos, k)
    controls.target.lerp(g.target, k)
    controls.update()
    if (camera.position.distanceTo(g.pos) < 0.3 && controls.target.distanceTo(g.target) < 0.3) goal.current = null
  })

  return null
}
