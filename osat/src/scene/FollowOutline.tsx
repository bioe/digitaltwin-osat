import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FLOOR_Y, OHT_Y } from '../layout/layout'
import { pathAt } from '../layout/path'
import { bake, type AnimState } from '../models/dsl'
import { MODELS } from '../models'
import { world } from '../sim/world'
import { isMoving, useUI } from '../store'

const CYAN = '#22d3ee'

/** Stencil mask: marks the object's own silhouette so the outline only draws around it. */
const maskMat = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthTest: false,
  depthWrite: false,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
})

function ringMat(opacity: number, additive: boolean) {
  return new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
  })
}

const lineMat = ringMat(0.95, false)
const glowMat = ringMat(0.35, true)
/** Outline thickness (m) for the crisp line and the soft glow. */
const RINGS = [0.03, 0.09]

function modelOf(kind: string) {
  if (kind === 'oht') return 'ohtVehicle'
  if (kind === 'arv') return 'arv'
  if (kind === 'truck') return 'truck'
  return 'operator'
}

interface Part {
  anim: number // -1 = static body
  geo: THREE.BufferGeometry
  /** Per ring: local "grow around own centre" matrix. */
  grow: THREE.Matrix4[]
}

function partsOf(model: string): { parts: Part[]; baked: ReturnType<typeof bake> } {
  const baked = bake(MODELS[model])
  const nodes: { anim: number; geos: THREE.BufferGeometry[] }[] = [{ anim: -1, geos: [...baked.byMat.values()] }]
  baked.anims.forEach((a, i) => nodes.push({ anim: i, geos: [...a.byMat.values()] }))
  const parts = nodes
    .filter(n => n.geos.length)
    .map(n => {
      const geo = mergeGeometries(n.geos.map(g => g.clone()))!
      geo.computeBoundingBox()
      const c = geo.boundingBox!.getCenter(new THREE.Vector3())
      const s = geo.boundingBox!.getSize(new THREE.Vector3())
      const grow = RINGS.map(t => {
        const k = new THREE.Vector3(1 + (2 * t) / Math.max(s.x, 0.02), 1 + (2 * t) / Math.max(s.y, 0.02), 1 + (2 * t) / Math.max(s.z, 0.02))
        return new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).scale(k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z))
      })
      return { anim: n.anim, geo, grow }
    })
  return { parts, baked }
}

const tmpObj = new THREE.Object3D()

/**
 * Cyan glow outline around the followed vehicle / person, posed with the same animation
 * as the model (walking legs, swinging arms, hoist, lift). Drawn on top of everything,
 * so the silhouette stays visible when machines, walls or rails block the view.
 */
export function FollowOutline() {
  const sel = useUI(s => s.sel)
  const group = useRef<THREE.Group>(null)
  const kind = sel && isMoving(sel) ? sel.kind : null
  const model = kind ? modelOf(kind) : null
  const data = useMemo(() => (model ? partsOf(model) : null), [model])
  const mask = useRef<(THREE.Mesh | null)[]>([])
  const line = useRef<(THREE.Mesh | null)[]>([])
  const glow = useRef<(THREE.Mesh | null)[]>([])
  const animWorld = useMemo(() => (data ? data.baked.anims.map(() => new THREE.Matrix4()) : []), [data])
  const state = useMemo<AnimState>(() => ({ t: 0, T: 0, phase: 0, state: 'run', u: [] }), [])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g || !sel || !data) return
    state.T = clock.elapsedTime
    state.t = world.t
    if (sel.kind === 'truck') {
      const t = world.shipping.truck
      if (!t) return
      g.position.set(t.pos[0], -FLOOR_Y, t.pos[1]) // ground level, inside the level-3 group
      g.rotation.set(0, t.heading, 0)
      state.u = [t.doors]
      state.state = 'run'
    } else if (sel.kind === 'oht') {
      const i = world.oht.findIndex(x => x.id === sel.id)
      const v = world.oht[i]
      if (!v) return
      const { p, d } = pathAt(world.L.loops.OHT, v.s)
      g.position.set(p[0], OHT_Y, p[1])
      g.rotation.set(0, Math.atan2(d[0], d[1]), 0)
      state.t = v.activeT
      state.phase = i * 0.21
      state.state = v.phase === 'free' ? 'idle' : 'run'
      state.u = [v.hoist]
    } else if (sel.kind === 'arv') {
      const i = world.arvs.findIndex(x => x.id === sel.id)
      const a = world.arvs[i]
      if (!a) return
      g.position.set(a.pos[0], 0, a.pos[1])
      g.rotation.set(0, a.heading, 0)
      state.phase = i * 0.3
      state.state = a.moving || a.job ? 'run' : 'idle'
      state.u = [a.lift]
    } else {
      const people = [...world.techs, ...world.operators]
      const i = people.findIndex(x => x.id === sel.id)
      const k = people[i]
      if (!k) return
      g.position.set(k.pos[0], 0, k.pos[1])
      g.rotation.set(0, k.heading, 0)
      // same inputs as the People renderer, so the outline walks / works / carries in sync
      state.phase = i * 0.17
      state.state = 'run'
      state.u = [k.moving ? 1 : 0, k.working && !k.carry ? 1 : 0, k.carry ? 1 : 0]
      g.visible = world.staffed || (k.onCall && k.eta <= 0)
    }
    data.baked.anims.forEach((a, n) => {
      tmpObj.position.set(0, 0, 0)
      tmpObj.rotation.set(0, 0, 0)
      tmpObj.scale.set(1, 1, 1)
      a.fn(state, tmpObj)
      tmpObj.updateMatrix()
      animWorld[n].copy(a.pivot).multiply(tmpObj.matrix)
      if (a.parent >= 0) animWorld[n].premultiply(animWorld[a.parent])
    })
    data.parts.forEach((p, i) => {
      const base = p.anim < 0 ? null : animWorld[p.anim]
      const set = (m: THREE.Mesh | null, grow?: THREE.Matrix4) => {
        if (!m) return
        if (base) m.matrix.copy(base)
        else m.matrix.identity()
        if (grow) m.matrix.multiply(grow)
      }
      set(mask.current[i])
      set(line.current[i], p.grow[0])
      set(glow.current[i], p.grow[1])
    })
    glowMat.opacity = 0.25 + 0.2 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4))
  })

  if (!data) return null
  return (
    <group ref={group}>
      {data.parts.map((p, i) => (
        <group key={i}>
          <mesh ref={el => { mask.current[i] = el }} geometry={p.geo} material={maskMat} renderOrder={997} matrixAutoUpdate={false} raycast={() => null} />
          <mesh ref={el => { line.current[i] = el }} geometry={p.geo} material={lineMat} renderOrder={998} matrixAutoUpdate={false} raycast={() => null} />
          <mesh ref={el => { glow.current[i] = el }} geometry={p.geo} material={glowMat} renderOrder={999} matrixAutoUpdate={false} raycast={() => null} />
        </group>
      ))}
    </group>
  )
}
