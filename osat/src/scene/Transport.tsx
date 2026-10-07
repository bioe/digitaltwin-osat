import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CarrierKey } from '../data/processes'
import { AISLE_N, AISLE_S, CONV_Y, OHT_Y } from '../layout/layout'
import { pathAt, project, type P2, type Path } from '../layout/path'
import { carrierH, world } from '../sim/world'
import { useUI } from '../store'
import { Instanced, setPose } from './Instanced'
import { MATERIALS } from './materials'

const CEIL = 6.6

/** Boxes along a polyline (offset sideways by `off`). */
function along(path: Path, off: number, y: number, w: number, h: number) {
  const geos: THREE.BufferGeometry[] = []
  const pts = offsetPts(path.pts, off)
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 1e-3) continue
    const g = new THREE.BoxGeometry(w, h, len + 0.02)
    g.rotateY(Math.atan2(b[0] - a[0], b[1] - a[1]))
    g.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2)
    geos.push(g)
  }
  return geos
}

function offsetPts(pts: P2[], off: number): P2[] {
  if (!off) return pts
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const l = Math.hypot(dx, dz) || 1
    return [p[0] + (dz / l) * off, p[1] - (dx / l) * off]
  })
}

/** Vertical hanger rods every `step` metres. */
function hangers(path: Path, y0: number, offs: number[], step: number) {
  const geos: THREE.BufferGeometry[] = []
  for (let s = 0; s < path.length; s += step) {
    const { p, d } = pathAt(path, s)
    for (const o of offs) {
      const g = new THREE.CylinderGeometry(0.012, 0.012, CEIL - y0, 6)
      g.translate(p[0] + d[1] * o, (CEIL + y0) / 2, p[1] - d[0] * o)
      geos.push(g)
    }
    const bar = new THREE.BoxGeometry(Math.abs(offs[0] - offs[offs.length - 1]) + 0.12, 0.04, 0.04)
    bar.rotateY(Math.atan2(d[0], d[1]) + Math.PI / 2)
    bar.translate(p[0], y0, p[1])
    geos.push(bar)
  }
  return geos
}

function OhtTrack() {
  const geo = useMemo(() => {
    const loop = world.L.loops.OHT
    const g = [
      ...along(loop, 0, OHT_Y + 0.09, 0.07, 0.18), // web
      ...along(loop, 0, OHT_Y + 0.01, 0.2, 0.025), // running flange
      ...along(loop, 0, OHT_Y + 0.19, 0.16, 0.02), // top flange
      ...hangers(loop, OHT_Y + 0.2, [-0.08, 0.08], 3),
      ...along(loop, 0, CEIL, 0.3, 0.08), // ceiling unistrut
    ]
    return mergeGeometries(g)!
  }, [])
  const feeder = useMemo(() => mergeGeometries(along(world.L.loops.OHT, 0.13, OHT_Y + 0.12, 0.03, 0.05))!, [])
  return (
    <group>
      <mesh geometry={geo} material={MATERIALS.steel} castShadow />
      <mesh geometry={feeder}>
        <meshStandardMaterial color="#f59e0b" roughness={0.5} />
      </mesh>
    </group>
  )
}

function ConvTrack() {
  const loop = world.L.loops.CONV
  const geo = useMemo(() => {
    const g = [
      ...along(loop, 0.2, CONV_Y - 0.02, 0.04, 0.14),
      ...along(loop, -0.2, CONV_Y - 0.02, 0.04, 0.14),
      ...along(loop, 0, CONV_Y - 0.12, 0.42, 0.03),
      ...hangers(loop, CONV_Y - 0.1, [-0.22, 0.22], 2.5),
      ...along(loop, 0, CEIL, 0.5, 0.08),
    ]
    return mergeGeometries(g)!
  }, [loop])
  const rollers = useRef<THREE.InstancedMesh>(null)
  const n = Math.floor(loop.length / 0.25)
  const rgeo = useMemo(() => new THREE.CylinderGeometry(0.025, 0.025, 0.38, 10).rotateZ(Math.PI / 2), [])
  useLayoutEffect(() => {
    const m = rollers.current
    if (!m) return
    const o = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      const { p, d } = pathAt(loop, i * 0.25)
      o.position.set(p[0], CONV_Y, p[1])
      o.rotation.set(0, Math.atan2(d[0], d[1]), 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [loop, n])
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color="#6d5aa8" roughness={0.45} metalness={0.4} />
      </mesh>
      <instancedMesh ref={rollers} args={[rgeo, MATERIALS.chrome, n]} frustumCulled={false} />
    </group>
  )
}

// ----------------------------------------------------------------- carriers

interface CarrierPos { x: number; y: number; z: number; r: number }
const CARRIERS: CarrierKey[] = ['foup', 'frameCassette', 'magazine', 'trayStack', 'reelBox']
let carrierCache = { v: -1, map: new Map<CarrierKey, CarrierPos[]>() }

function collectCarriers() {
  if (carrierCache.v === world.version) return carrierCache.map
  const map = new Map<CarrierKey, CarrierPos[]>(CARRIERS.map(k => [k, []]))
  const put = (k: CarrierKey, x: number, y: number, z: number, r: number) => map.get(k)!.push({ x, y, z, r })
  // lots waiting on tool load ports
  for (const t of world.tools) {
    if (t.aux) continue
    const staged = t.next ?? t.lot
    if (staged) put(staged.carrier, t.inPort[0], t.inPort[1], t.inPort[2], t.rotY)
    const same = Math.abs(t.inPort[0] - t.outPort[0]) + Math.abs(t.inPort[2] - t.outPort[2]) < 0.05
    if (t.out && !same && t.proc !== 'tnr') put(t.out.carrier, t.outPort[0], t.outPort[1], t.outPort[2], t.rotY)
  }
  // OHT
  const ohtLoop = world.L.loops.OHT
  for (const v of world.oht) {
    if (!v.carry) continue
    const { p, d } = pathAt(ohtLoop, v.s)
    put(v.carry.carrier, p[0], OHT_Y - 0.8 - v.hoist - carrierH(v.carry.carrier), p[1], Math.atan2(d[0], d[1]))
  }
  // conveyor
  const conv = world.L.loops.CONV
  for (const c of world.conv) {
    const k = c.job.lot.carrier
    if (c.phase === 'move') {
      const { p, d } = pathAt(conv, c.s)
      put(k, p[0], CONV_Y + 0.03, p[1], Math.atan2(d[0], d[1]))
    } else {
      const port = c.phase === 'up' ? c.fromPort : c.toPort
      put(k, port[0], c.y, port[2], 0)
    }
  }
  // ARV
  for (const a of world.arvs) {
    if (!a.carry) continue
    const deck = 0.65 + 0.35 * a.lift
    let x = a.pos[0]
    let z = a.pos[1]
    let y = deck
    if (a.slidePort && a.slide > 0) {
      const k = Math.min(1, a.slide)
      x += (a.slidePort[0] - x) * k
      z += (a.slidePort[2] - z) * k
      y += (a.slidePort[1] - y) * k
    }
    put(a.carry.carrier, x, y, z, a.heading)
  }
  carrierCache = { v: world.version, map }
  return map
}

function Carriers() {
  return (
    <group>
      {CARRIERS.map(k => (
        <Instanced
          key={k}
          model={k}
          capacity={260}
          dynamic
          count={() => collectCarriers().get(k)!.length}
          fill={(i, inst) => {
            const c = collectCarriers().get(k)![i]
            setPose(inst.m, c.x, c.y, c.z, c.r)
            inst.state = 'run'
          }}
        />
      ))}
    </group>
  )
}

// ----------------------------------------------------------------- vehicles

function OhtVehicles() {
  const select = useUI(s => s.select)
  const loop = world.L.loops.OHT
  return (
    <Instanced
      model="ohtVehicle"
      capacity={world.oht.length}
      dynamic
      fill={(i, inst) => {
        const v = world.oht[i]
        const { p, d } = pathAt(loop, v.s)
        setPose(inst.m, p[0], OHT_Y, p[1], Math.atan2(d[0], d[1]))
        inst.state = v.phase === 'free' ? 'idle' : 'run'
        inst.t = v.activeT
        inst.phase = i * 0.21
        inst.u = [v.hoist]
      }}
      onPick={i => select({ kind: 'oht', id: world.oht[i].id })}
    />
  )
}

function Arvs() {
  const select = useUI(s => s.select)
  return (
    <group>
      <Instanced
        model="arv"
        capacity={world.arvs.length}
        dynamic
        fill={(i, inst) => {
          const a = world.arvs[i]
          setPose(inst.m, a.pos[0], 0, a.pos[1], a.heading)
          inst.state = a.battery < 20 ? 'alarm' : a.yielding ? 'idle' : a.moving || a.job ? 'run' : 'idle'
          inst.t = world.t
          inst.phase = i * 0.3
          inst.u = [a.lift]
        }}
        onPick={i => select({ kind: 'arv', id: world.arvs[i].id })}
      />
      <Chargers />
    </group>
  )
}

function Chargers() {
  const geo = useMemo(() => {
    const g: THREE.BufferGeometry[] = []
    for (const c of world.L.chargers) {
      const b = new THREE.BoxGeometry(0.5, 0.45, 0.18)
      b.translate(c.pos[0], 0.225, c.pos[1] + 0.68)
      g.push(b)
      const plate = new THREE.BoxGeometry(0.9, 0.02, 1.3)
      plate.translate(c.pos[0], 0.01, c.pos[1])
      g.push(plate)
    }
    return mergeGeometries(g)!
  }, [])
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <meshStandardMaterial color="#2c5b63" roughness={0.6} />
    </mesh>
  )
}

/** Drop-lift columns at every conveyor station. */
function ConvLifts() {
  const stations = useMemo(() => {
    const loop = world.L.loops.CONV
    const list: { x: number; z: number; rot: number; port: [number, number, number] }[] = []
    const seen = new Set<string>()
    const addPort = (p: [number, number, number]) => {
      if (project(loop, [p[0], p[2]]).dist > 0.6) return
      const key = `${p[0].toFixed(2)},${p[2].toFixed(2)}`
      if (seen.has(key)) return
      seen.add(key)
      // column stands on the aisle side of the port, carriage faces the port
      const aisle = p[2] < 0 ? AISLE_N : AISLE_S
      const dir = Math.sign(aisle - p[2]) || 1
      list.push({ x: p[0] + 0.35, z: p[2] + dir * 0.45, rot: dir > 0 ? Math.PI : 0, port: p })
    }
    for (const t of world.tools) if (!t.aux && (t.proc === 'wb' || t.proc === 'mold' || t.proc === 'mark')) t.ports.forEach(addPort)
    for (const s of world.stockers) s.ports.forEach(addPort)
    return list
  }, [])
  const mats = useMemo(() => stations.map(s => setPose(new THREE.Matrix4(), s.x, 0, s.z, s.rot)), [stations])
  return (
    <Instanced
      model="conveyorLift"
      capacity={stations.length}
      fill={(i, inst) => {
        const st = stations[i]
        inst.m.copy(mats[i])
        let h = 2.75
        let busy = false
        for (const c of world.conv) {
          if (c.phase === 'move') continue
          const p = c.phase === 'up' ? c.fromPort : c.toPort
          if (Math.abs(p[0] - st.port[0]) < 0.05 && Math.abs(p[2] - st.port[2]) < 0.05) {
            h = c.y
            busy = true
          }
        }
        inst.state = busy ? 'run' : 'idle'
        inst.u = [Math.max(0.9, h)]
      }}
    />
  )
}

export function Transport() {
  const layers = useUI(s => s.layers)
  return (
    <group>
      {layers.oht && (
        <>
          <OhtTrack />
          <OhtVehicles />
        </>
      )}
      {layers.conv && (
        <>
          <ConvTrack />
          <ConvLifts />
        </>
      )}
      {layers.arv && <Arvs />}
      <Carriers />
    </group>
  )
}
