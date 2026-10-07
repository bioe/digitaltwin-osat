import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FLOOR_Y } from '../layout/layout'
import { cartonSlot } from '../models/logistics'
import { CARTONS_PER_PALLET, PACK_END, PALLET_CAP, WRAP_END, WRAP_IN, world } from '../sim/world'
import { useUI } from '../store'
import { Instanced, setPose } from './Instanced'
import { glassMaterial, MATERIALS } from './materials'

/** Dock height at the lift (truck cargo floor). */
const DOCK_Y = 1.25
const LIFT_GLASS = glassMaterial('#dbeaf3')

function boxAt(list: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  list.push(g)
}

/** Pallet slots inside the truck (local): two columns × three rows, loaded front first. */
function slot(i: number): THREE.Vector3 {
  const col = i % 2
  const row = Math.floor(i / 2)
  return new THREE.Vector3(col ? 0.55 : -0.55, DOCK_Y, 1.0 - row * 1.3)
}

/** Pallet pose: position + yaw, and whether it is wrapped. */
interface PalletPose { x: number; y: number; z: number; r: number }

/**
 * Final step, in 3D (all on the west end of level 3, then down the exterior lift):
 *   ARV → packing-station infeed · cartons ride a belt to the pallet build position, a gantry
 *   picker stacks them · the pallet rolls into the in-line stretch-wrapper · then onto the buffer
 *   conveyor · the head pallet rolls into the lift car · down to the truck at dock height.
 */
export function Shipping() {
  const select = useUI(s => s.select)
  const B = world.L.bounds
  const r = world.truckRoutes
  const lx = r.liftX
  const lz = r.liftZ
  const top = FLOOR_Y // level-3 floor
  const wrapX = r.wrapX
  const buildX = r.buildX
  const bufX = (i: number) => B.x0 + 1.6 + i * 1.25
  const LINE_Y = top + 0.42 // pallet-line roller top
  const WRAP_Y = LINE_Y // the wrapper's roller turntable is level with the line
  const BELT_Y = top + 0.95 // carton belt top (same as the packer's roller table)
  // carton belt: packer exit (west end, it is rotated 180°) → west → north to the pallet
  const belt: [number, number][] = [[r.packX - 1.6, r.packZ], [buildX, r.packZ], [buildX, lz + 0.8]]
  const beltLen = Math.abs(belt[0][0] - belt[1][0]) + Math.abs(belt[1][1] - belt[2][1])

  // static: lift shaft, pallet line rollers, carton belt, picker gantry, dock platform
  const geo = useMemo(() => {
    const steel: THREE.BufferGeometry[] = []
    const glass: THREE.BufferGeometry[] = []
    const roll: THREE.BufferGeometry[] = []
    const beltG: THREE.BufferGeometry[] = []
    const H = top + 3.4
    const hw = 1.5
    for (const dx of [-hw, hw]) for (const dz of [-hw, hw]) boxAt(steel, 0.16, H, 0.16, lx + dx, H / 2, lz + dz)
    for (let y = 0.5; y <= H; y += 3) {
      boxAt(steel, 3.0, 0.1, 0.1, lx, y, lz - hw)
      boxAt(steel, 3.0, 0.1, 0.1, lx, y, lz + hw)
      boxAt(steel, 0.1, 0.1, 3.0, lx - hw, y, lz)
    }
    boxAt(steel, 3.3, 0.25, 3.3, lx, H, lz) // machine-room cap
    // glazing on the three outer sides (east side opens into the building, west side to the truck)
    boxAt(glass, 3.0, H - 0.2, 0.03, lx, H / 2, lz - hw)
    boxAt(glass, 3.0, H - 0.2, 0.03, lx, H / 2, lz + hw)
    boxAt(glass, 0.03, top - 4, 3.0, lx - hw, (top + 4 + DOCK_Y) / 2 + 1, lz) // above the truck door
    for (const dz of [-1.2, 1.2]) boxAt(steel, 0.06, H, 0.06, lx + 1.35, H / 2, lz + dz) // guide rails
    // pallet line: buffer section (lift landing → wrapper) and build section (wrapper → build position)
    const rollers = (x0: number, x1: number) => {
      boxAt(steel, x1 - x0, 0.08, 1.15, (x0 + x1) / 2, LINE_Y - 0.12, lz)
      for (let x = x0 + 0.15; x < x1; x += 0.25) {
        const c = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8)
        c.rotateX(Math.PI / 2)
        c.translate(x, LINE_Y - 0.035, lz)
        roll.push(c)
      }
      for (let x = x0 + 0.3; x < x1; x += 1.6) for (const dz of [-0.5, 0.5]) boxAt(steel, 0.06, LINE_Y - top - 0.12, 0.06, x, (top + LINE_Y - 0.12) / 2, lz + dz)
    }
    // sections butt up to the turntable (radius 1.0) so the line is continuous
    rollers(B.x0 - 0.2, wrapX - 1.0)
    rollers(wrapX + 1.0, buildX + 0.8)
    // carton belt (two straight sections) with side rails and legs
    const seg = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az) + 0.6
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az)
      const cx = (ax + bx) / 2
      const cz = (az + bz) / 2
      boxAt(beltG, alongX ? len : 0.6, 0.05, alongX ? 0.6 : len, cx, BELT_Y - 0.025, cz)
      for (const s of [-0.33, 0.33]) boxAt(steel, alongX ? len : 0.04, 0.12, alongX ? 0.04 : len, cx + (alongX ? 0 : s), BELT_Y + 0.02, cz + (alongX ? s : 0))
      const n = Math.max(2, Math.ceil(len / 1.2))
      for (let i = 0; i <= n; i++) {
        const k = i / n
        const x = ax + (bx - ax) * k
        const z = az + (bz - az) * k
        for (const s of [-0.25, 0.25]) boxAt(steel, 0.05, BELT_Y - top - 0.05, 0.05, x + (alongX ? 0 : s), (top + BELT_Y - 0.05) / 2, z + (alongX ? s : 0))
      }
    }
    seg(belt[0][0], belt[0][1], belt[1][0], belt[1][1])
    seg(belt[1][0], belt[1][1], belt[2][0], belt[2][1])
    // picker gantry over the build position: 4 posts + 2 beams + cross rail
    const gx = buildX
    for (const dx of [-0.95, 0.95]) for (const dz of [-0.9, 1.3]) boxAt(steel, 0.1, 2.6, 0.1, gx + dx, top + 1.3, lz + dz)
    for (const dx of [-0.95, 0.95]) boxAt(steel, 0.12, 0.14, 2.3, gx + dx, top + 2.6, lz + 0.2)
    // loading-dock platform + bumpers at ground level, at truck-bed height
    boxAt(steel, 0.6, DOCK_Y, 3.0, lx - hw - 0.3, DOCK_Y / 2, lz)
    for (const dz of [-1.0, 1.0]) boxAt(steel, 0.25, 0.4, 0.3, lx - hw - 0.7, 0.9, lz + dz)
    return { steel: mergeGeometries(steel)!, glass: mergeGeometries(glass)!, roll: mergeGeometries(roll)!, belt: mergeGeometries(beltG)! }
  }, [B, lx, lz, top, wrapX, buildX, LINE_Y, BELT_Y]) // eslint-disable-line react-hooks/exhaustive-deps

  const car = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const tmpT = useMemo(() => new THREE.Matrix4(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  /** Buffer pallets ease forward (accumulating conveyor) instead of jumping. */
  const bufVis = useRef<number[]>([])
  const prevBuf = useRef(world.shipping.buffer)
  if (!bufVis.current.length) for (let i = 0; i < world.shipping.buffer; i++) bufVis.current.push(bufX(i))

  /** Where a carton sits on the pallet at the build position (or on a pallet at x, yaw). */
  const onPallet = (i: number, x: number, y: number, yaw: number) => {
    const [cx, cy, cz] = cartonSlot(i)
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    return { x: x + cx * c + cz * s, y: y + cy, z: lz - cx * s + cz * c, r: yaw }
  }
  const alongBelt = (d: number) => {
    const l1 = Math.abs(belt[0][0] - belt[1][0])
    if (d <= l1) return { x: belt[0][0] - d, z: belt[0][1] }
    return { x: belt[1][0], z: belt[1][1] - (d - l1) }
  }

  useFrame((_, dtReal) => {
    const sh = world.shipping
    if (car.current) car.current.position.y = DOCK_Y + sh.lift.y * (top - DOCK_Y)
    // accumulate the buffer: head leaves into the lift, new pallets join at the tail
    const vis = bufVis.current
    if (sh.buffer < prevBuf.current) vis.splice(0, prevBuf.current - sh.buffer)
    while (vis.length < sh.buffer) vis.push(bufX(vis.length))
    prevBuf.current = sh.buffer
    const step = Math.min(0.1, dtReal) * world.speed * 0.9
    vis.forEach((x, i) => (vis[i] = x - Math.min(step, Math.max(0, x - bufX(i)))))
    // picker head follows the carton it is placing, else parks above the belt end
    if (head.current) {
      const c = placing()
      head.current.position.set(c ? c.x : buildX, c ? c.y + 0.42 : top + 2.0, c ? c.z : lz + 0.95)
    }
  })

  /** Carton being lifted by the picker (belt end → its slot), if any. */
  const placing = () => {
    const u = world.shipping.pack
    if (u < 0 || u >= PACK_END) return null
    for (let j = 0; j < CARTONS_PER_PALLET; j++) {
      const t0 = (j / CARTONS_PER_PALLET) * (PACK_END - 0.1) + 0.07
      if (u >= t0 && u < t0 + 0.03) {
        const k = THREE.MathUtils.smoothstep(u, t0, t0 + 0.03)
        const end = alongBelt(beltLen)
        const dst = onPallet(j, buildX, LINE_Y, Math.PI / 2)
        return { x: end.x + (dst.x - end.x) * k, y: BELT_Y + (dst.y - BELT_Y) * k + Math.sin(k * Math.PI) * 0.6, z: end.z + (dst.z - end.z) * k }
      }
    }
    return null
  }

  /** Everything that moves on the line: wrapped pallets, bare pallets, cartons. */
  const scene = () => {
    const sh = world.shipping
    const wrapped: PalletPose[] = []
    const bases: PalletPose[] = []
    const cartons: PalletPose[] = []
    const u = sh.pack
    const stack = (n: number, x: number, y: number, yaw: number) => {
      bases.push({ x, y, z: lz, r: yaw })
      for (let i = 0; i < n; i++) cartons.push(onPallet(i, x, y, yaw))
    }
    // buffer + the pallet rolling into the lift car
    bufVis.current.forEach(x => wrapped.push({ x, y: LINE_Y, z: lz, r: Math.PI / 2 }))
    const carY = DOCK_Y + sh.lift.y * (top - DOCK_Y)
    if (sh.lift.phase === 'load') {
      const k = THREE.MathUtils.smoothstep(sh.lift.roll, 0, 1)
      wrapped.push({ x: bufX(0) + (lx - bufX(0)) * k, y: LINE_Y + (top + 0.12 - LINE_Y) * k, z: lz, r: Math.PI / 2 })
    }
    // the pallet cycle
    if (u < 0 || u < PACK_END) {
      let n = 0
      if (u >= 0) {
        for (let j = 0; j < CARTONS_PER_PALLET; j++) {
          const t0 = (j / CARTONS_PER_PALLET) * (PACK_END - 0.1)
          if (u >= t0 + 0.1) n++
          else if (u >= t0 && u < t0 + 0.07) {
            const p = alongBelt(((u - t0) / 0.07) * beltLen)
            cartons.push({ x: p.x, y: BELT_Y, z: p.z, r: 0 })
          }
        }
        const c = placing()
        if (c) cartons.push({ ...c, r: Math.PI / 2 })
      }
      stack(n, buildX, LINE_Y, Math.PI / 2)
    } else if (u < WRAP_IN) {
      const k = THREE.MathUtils.smoothstep(u, PACK_END, WRAP_IN)
      stack(CARTONS_PER_PALLET, buildX + (wrapX - buildX) * k, LINE_Y + (WRAP_Y - LINE_Y) * k, Math.PI / 2)
    } else if (u < WRAP_END) {
      // turning with the turntable; the film covers it in the second half of the cycle
      const yaw = Math.PI / 2 + (world.toolById.get('WRAP-01')?.anim?.[0] ?? 0)
      if ((u - WRAP_IN) / (WRAP_END - WRAP_IN) < 0.55) stack(CARTONS_PER_PALLET, wrapX, WRAP_Y, yaw)
      else wrapped.push({ x: wrapX, y: WRAP_Y, z: lz, r: yaw })
    } else {
      const k = THREE.MathUtils.smoothstep(u, WRAP_END, 1)
      const tail = bufX(sh.buffer)
      wrapped.push({ x: wrapX + (tail - wrapX) * k, y: WRAP_Y + (LINE_Y - WRAP_Y) * k, z: lz, r: Math.PI / 2 })
    }
    // an empty pallet waits at the build position once the last one has left it
    if (u >= WRAP_IN) bases.push({ x: buildX, y: LINE_Y, z: lz, r: Math.PI / 2 })
    // lift car + truck
    const t = sh.truck
    if (sh.lift.carrying && !(t && t.moving >= 0)) wrapped.push({ x: lx, y: carY + 0.12, z: lz, r: Math.PI / 2 })
    if (t) {
      setPose(tmpT, t.pos[0], 0, t.pos[1], t.heading)
      for (let i = 0; i < t.pallets; i++) {
        v.copy(slot(i)).applyMatrix4(tmpT)
        wrapped.push({ x: v.x, y: v.y, z: v.z, r: t.heading })
      }
      if (t.moving >= 0) {
        v.copy(slot(t.pallets)).applyMatrix4(tmpT)
        const k = THREE.MathUtils.smoothstep(t.moving, 0, 1)
        wrapped.push({ x: lx + (v.x - lx) * k, y: DOCK_Y + 0.12 + (v.y - DOCK_Y - 0.12) * k, z: lz + (v.z - lz) * k, r: t.heading })
      }
    }
    return { wrapped, bases, cartons }
  }
  let cache = { f: -1, s: { wrapped: [], bases: [], cartons: [] } as ReturnType<typeof scene> }
  const cur = () => {
    if (cache.f !== world.version) cache = { f: world.version, s: scene() }
    return cache.s
  }
  const poses = (key: 'wrapped' | 'bases' | 'cartons', model: string, capacity: number) => (
    <Instanced
      model={model}
      capacity={capacity}
      dynamic
      count={() => cur()[key].length}
      fill={(i, inst) => {
        const p = cur()[key][i]
        setPose(inst.m, p.x, p.y, p.z, p.r)
      }}
    />
  )

  return (
    <group>
      {/* level 3: pallet line, carton belt, picker (the packing station + wrapper are machines, see Equipment) */}
      <mesh geometry={geo.steel} material={MATERIALS.dark} castShadow />
      <mesh geometry={geo.roll} material={MATERIALS.chrome} />
      <mesh geometry={geo.belt} material={MATERIALS.rubber} />
      <mesh geometry={geo.glass} material={LIFT_GLASS} raycast={() => null} />
      <group ref={head}>
        <mesh position={[0, 0.06, 0]} material={MATERIALS.yellow}>
          <boxGeometry args={[0.5, 0.12, 0.6]} />
        </mesh>
        <mesh position={[0, 1.1, 0]} material={MATERIALS.steel}>
          <boxGeometry args={[0.08, 2.0, 0.08]} />
        </mesh>
      </group>
      {/* lift car */}
      <group ref={car} position={[lx, top, lz]} onClick={e => { e.stopPropagation(); if (e.delta <= 5) select({ kind: 'ship', id: 'LIFT-01' }) }}>
        <mesh position={[0, -0.08, 0]} castShadow>
          <boxGeometry args={[2.7, 0.16, 2.7]} />
          <meshStandardMaterial color="#5b6676" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.2, -1.3]}>
          <boxGeometry args={[2.7, 2.4, 0.05]} />
          <meshStandardMaterial color="#c7d0da" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0, 2.45, 0]}>
          <boxGeometry args={[2.7, 0.1, 2.7]} />
          <meshStandardMaterial color="#5b6676" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
      {/* truck + pallets + cartons */}
      <Instanced
        model="truck"
        capacity={1}
        dynamic
        count={() => (world.shipping.truck ? 1 : 0)}
        fill={(_, inst) => {
          const t = world.shipping.truck!
          setPose(inst.m, t.pos[0], 0, t.pos[1], t.heading)
          inst.u = [t.doors]
          inst.state = 'run'
        }}
        onPick={() => {
          const t = world.shipping.truck
          if (t) select({ kind: 'truck', id: t.id })
        }}
      />
      {poses('wrapped', 'pallet', PALLET_CAP + 10)}
      {poses('bases', 'palletBase', 3)}
      {poses('cartons', 'carton', CARTONS_PER_PALLET + 4)}
    </group>
  )
}
