import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { bake, type AnimState, type MatKey } from '../models/dsl'
import { MODELS } from '../models'
import { DYNAMIC_MATS, MATERIALS, dynColor } from './materials'

export interface Inst {
  /** Base world matrix of the instance. */
  m: THREE.Matrix4
  state: 'run' | 'idle' | 'alarm'
  /** Active time (freezes when not running). */
  t: number
  phase: number
  u: number[]
  visible: boolean
}

interface Props {
  model: string
  /** Max number of instances. */
  capacity: number
  /** Current number of instances (defaults to capacity). */
  count?: () => number
  fill: (i: number, inst: Inst) => void
  onPick?: (i: number) => void
  shadows?: boolean
  dynamic?: boolean
}

interface Mesh {
  anim: number
  mat: MatKey
  geo: THREE.BufferGeometry
}

const tmpObj = new THREE.Object3D()
const tmpM = new THREE.Matrix4()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

/** Renders every instance of one model with one InstancedMesh per (animated part, material). */
export function Instanced({ model, capacity, count, fill, onPick, shadows = true, dynamic = false }: Props) {
  const baked = useMemo(() => bake(MODELS[model]), [model])
  const meshes = useMemo(() => {
    const list: Mesh[] = []
    for (const [mat, geo] of baked.byMat) list.push({ anim: -1, mat, geo })
    baked.anims.forEach((a, i) => {
      for (const [mat, geo] of a.byMat) list.push({ anim: i, mat, geo })
    })
    return list
  }, [baked])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const inst = useMemo<Inst>(() => ({ m: new THREE.Matrix4(), state: 'run', t: 0, phase: 0, u: [], visible: true }), [])
  const animWorld = useMemo(() => baked.anims.map(() => new THREE.Matrix4()), [baked])
  const state = useMemo<AnimState>(() => ({ t: 0, T: 0, phase: 0, state: 'run', u: [] }), [])
  const frame = useRef(0)

  useFrame(({ clock }) => {
    const T = clock.elapsedTime
    const n = Math.min(capacity, count ? count() : capacity)
    frame.current++
    for (let i = 0; i < n; i++) {
      inst.u = []
      inst.visible = true
      fill(i, inst)
      state.t = inst.t
      state.T = T
      state.phase = inst.phase
      state.state = inst.state
      state.u = inst.u
      // resolve animated pivots (parents always precede children)
      baked.anims.forEach((a, k) => {
        tmpObj.position.set(0, 0, 0)
        tmpObj.rotation.set(0, 0, 0)
        tmpObj.scale.set(1, 1, 1)
        a.fn(state, tmpObj)
        tmpObj.updateMatrix()
        const parent = a.parent < 0 ? null : animWorld[a.parent]
        animWorld[k].copy(a.pivot).multiply(tmpObj.matrix)
        if (parent) animWorld[k].premultiply(parent)
      })
      for (let j = 0; j < meshes.length; j++) {
        const mesh = refs.current[j]
        if (!mesh) continue
        const ms = meshes[j]
        if (!inst.visible) mesh.setMatrixAt(i, ZERO)
        else if (ms.anim < 0) mesh.setMatrixAt(i, inst.m)
        else mesh.setMatrixAt(i, tmpM.copy(inst.m).multiply(animWorld[ms.anim]))
        if (DYNAMIC_MATS.has(ms.mat)) mesh.setColorAt(i, dynColor(ms.mat, inst.state, T, inst.phase))
      }
    }
    for (const mesh of refs.current) {
      if (!mesh) continue
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      if (dynamic ? frame.current % 20 === 0 : frame.current === 2) mesh.boundingSphere = null
    }
  })

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick || e.instanceId === undefined || e.delta > 5) return
    e.stopPropagation()
    onPick(e.instanceId)
  }

  return (
    <group>
      {meshes.map((ms, j) => (
        <instancedMesh
          key={`${ms.anim}-${ms.mat}`}
          ref={el => {
            refs.current[j] = el
            if (el && DYNAMIC_MATS.has(ms.mat) && !el.instanceColor) {
              el.setColorAt(0, new THREE.Color('#fff'))
            }
          }}
          args={[ms.geo, MATERIALS[ms.mat], capacity]}
          frustumCulled={false}
          castShadow={shadows && ms.mat !== 'glass'}
          receiveShadow={shadows}
          onClick={onPick ? click : undefined}
          onPointerOver={onPick ? (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
          onPointerOut={onPick ? () => { document.body.style.cursor = '' } : undefined}
        />
      ))}
    </group>
  )
}

/** Compose a base matrix from position + yaw. */
export function setPose(m: THREE.Matrix4, x: number, y: number, z: number, rotY: number) {
  tmpObj.position.set(x, y, z)
  tmpObj.rotation.set(0, rotY, 0)
  tmpObj.scale.set(1, 1, 1)
  tmpObj.updateMatrix()
  return m.copy(tmpObj.matrix)
}
