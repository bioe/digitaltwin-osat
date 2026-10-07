import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { AISLE_N, AISLE_S, CONV_Y, OHT_Y } from '../layout/layout'
import { makePath, pathAt, roundCorners, type Path } from '../layout/path'
import { world } from '../sim/world'
import { useUI } from '../store'

const tmp = new THREE.Object3D()

/** Line along a path at height y. */
function PathLine({ path, y, color, opacity = 0.9 }: { path: Path; y: number; color: string; opacity?: number }) {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(path.pts.map(p => new THREE.Vector3(p[0], y, p[1]))), [path, y])
  return (
    <lineSegments geometry={toSegments(geo)}>
      <lineBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </lineSegments>
  )
}

function toSegments(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  const out: number[] = []
  for (let i = 1; i < p.count; i++) out.push(p.getX(i - 1), p.getY(i - 1), p.getZ(i - 1), p.getX(i), p.getY(i), p.getZ(i))
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
}

/** Flat translucent band along a path (reads at any zoom). */
function Ribbon({ path, y, width, color, opacity }: { path: Path; y: number; width: number; color: string; opacity: number }) {
  const geo = useMemo(() => {
    const pos: number[] = []
    for (let i = 1; i < path.pts.length; i++) {
      const a = path.pts[i - 1]
      const b = path.pts[i]
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const l = Math.hypot(dx, dz) || 1
      const nx = (-dz / l) * (width / 2)
      const nz = (dx / l) * (width / 2)
      pos.push(a[0] + nx, y, a[1] + nz, b[0] + nx, y, b[1] + nz, b[0] - nx, y, b[1] - nz)
      pos.push(a[0] + nx, y, a[1] + nz, b[0] - nx, y, b[1] - nz, a[0] - nx, y, a[1] - nz)
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  }, [path, y, width])
  return (
    <mesh geometry={geo} raycast={() => null}>
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

/** Glowing markers that stream along a path. */
function Stream({ path, y, color, spacing, speed, shape }: { path: Path; y: number; color: string; spacing: number; speed: number; shape: 'dot' | 'chevron' }) {
  const n = Math.floor(path.length / spacing)
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => {
    if (shape === 'dot') return new THREE.SphereGeometry(0.09, 8, 6)
    const s = new THREE.Shape()
    s.moveTo(-0.5, -0.35); s.lineTo(0, 0.25); s.lineTo(0.5, -0.35); s.lineTo(0.5, -0.05); s.lineTo(0, 0.55); s.lineTo(-0.5, -0.05); s.closePath()
    const g = new THREE.ShapeGeometry(s)
    g.rotateX(-Math.PI / 2)
    g.rotateY(Math.PI)
    return g
  }, [shape])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const off = (clock.elapsedTime * speed) % spacing
    for (let i = 0; i < n; i++) {
      const { p, d } = pathAt(path, i * spacing + off)
      tmp.position.set(p[0], y, p[1])
      tmp.rotation.set(0, Math.atan2(d[0], d[1]), 0)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[geo, undefined, n]} frustumCulled={false} raycast={() => null}>
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

/** Active ARV routes drawn on the floor. */
function ArvRoutes() {
  const ref = useRef<THREE.LineSegments>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * 400), 3))
    return g
  }, [])
  useFrame(() => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    let k = 0
    for (const a of world.arvs) {
      if (!a.job || !a.path.length) continue
      let prev = a.pos
      for (const p of a.path) {
        if (k >= 400) break
        pos.setXYZ(k * 2, prev[0], 0.06, prev[1])
        pos.setXYZ(k * 2 + 1, p[0], 0.06, p[1])
        prev = p
        k++
      }
    }
    geo.setDrawRange(0, k * 2)
    pos.needsUpdate = true
  })
  return (
    <lineSegments ref={ref} geometry={geo} frustumCulled={false}>
      <lineBasicMaterial color="#22d3ee" toneMapped={false} />
    </lineSegments>
  )
}

export function Overlays() {
  const flow = useUI(s => s.layers.flow)
  const route = useUI(s => s.layers.route)
  const productRoute = useMemo(() => {
    const L = world.L
    const xe = L.xEast + 2.6
    return makePath(
      roundCorners([[L.bounds.x0 + 2, AISLE_N], [xe, AISLE_N], [xe, AISLE_S], [L.bounds.x0 + 3, AISLE_S]], 2, false, 8),
      false,
    )
  }, [])
  return (
    <group>
      {flow && (
        <>
          <PathLine path={world.L.loops.OHT} y={OHT_Y - 0.05} color="#22d3ee" />
          <Stream path={world.L.loops.OHT} y={OHT_Y - 0.12} color="#67e8f9" spacing={2.5} speed={3} shape="dot" />
          <PathLine path={world.L.loops.CONV} y={CONV_Y + 0.25} color="#c084fc" />
          <Stream path={world.L.loops.CONV} y={CONV_Y + 0.3} color="#e9d5ff" spacing={2.5} speed={1.2} shape="dot" />
          <ArvRoutes />
        </>
      )}
      {route && (
        <>
          <Ribbon path={productRoute} y={0.05} width={1.1} color="#22c55e" opacity={0.28} />
          <Stream path={productRoute} y={0.07} color="#4ade80" spacing={3.2} speed={2.2} shape="chevron" />
        </>
      )}
    </group>
  )
}
