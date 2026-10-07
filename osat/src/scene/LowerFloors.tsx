import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FLOOR_Y } from '../layout/layout'
import { world } from '../sim/world'

const STOREY = FLOOR_Y / 2

function boxAt(list: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number) {
  const b = new THREE.BoxGeometry(w, h, d)
  b.translate(x, y, z)
  list.push(b)
}

/**
 * Dummy levels 1 and 2 under the production floor (massing + façade only).
 * L1: glazed curtain wall, entrance canopy (south), dock doors (north).
 * L2: white metal cladding with louvre bands (sub-fab / utilities).
 */
export function LowerFloors() {
  const B = world.L.bounds
  const geo = useMemo(() => {
    const W = B.x1 - B.x0
    const D = B.z1 - B.z0
    const cx = (B.x0 + B.x1) / 2
    const cz = (B.z0 + B.z1) / 2
    const core: THREE.BufferGeometry[] = []
    const glass: THREE.BufferGeometry[] = []
    const frame: THREE.BufferGeometry[] = []
    const clad: THREE.BufferGeometry[] = []
    const louvre: THREE.BufferGeometry[] = []
    const glass2: THREE.BufferGeometry[] = []
    const dock: THREE.BufferGeometry[] = []
    // building mass (slightly inset so façades sit on its faces)
    boxAt(core, W - 0.4, FLOOR_Y - 0.1, D - 0.4, cx, (FLOOR_Y - 0.1) / 2, cz)
    // slab edges
    for (const y of [STOREY, FLOOR_Y - 0.3]) {
      boxAt(frame, W + 0.2, 0.6, 0.3, cx, y, B.z0)
      boxAt(frame, W + 0.2, 0.6, 0.3, cx, y, B.z1)
      boxAt(frame, 0.3, 0.6, D + 0.2, B.x0, y, cz)
      boxAt(frame, 0.3, 0.6, D + 0.2, B.x1, y, cz)
    }
    // L1 curtain wall on all faces
    const gH = STOREY - 0.6
    boxAt(glass, W, gH, 0.05, cx, gH / 2, B.z1 + 0.05)
    boxAt(glass, 0.05, gH, D, B.x0 - 0.05, gH / 2, cz)
    boxAt(glass, 0.05, gH, D, B.x1 + 0.05, gH / 2, cz)
    for (let x = B.x0; x <= B.x1 + 0.01; x += 3) boxAt(frame, 0.08, gH, 0.15, x, gH / 2, B.z1 + 0.08)
    for (let z = B.z0; z <= B.z1 + 0.01; z += 3) {
      boxAt(frame, 0.15, gH, 0.08, B.x0 - 0.08, gH / 2, z)
      boxAt(frame, 0.15, gH, 0.08, B.x1 + 0.08, gH / 2, z)
    }
    boxAt(frame, W, 0.08, 0.15, cx, 3.2, B.z1 + 0.08)
    // north side: loading docks between glazed bays
    boxAt(glass, W, gH, 0.05, cx, gH / 2, B.z0 - 0.05)
    for (let x = B.x0 + 12; x < B.x1 - 10; x += 14) {
      boxAt(dock, 4.2, 4.6, 0.2, x, 2.3, B.z0 - 0.12)
      boxAt(frame, 4.6, 0.25, 0.4, x, 4.75, B.z0 - 0.2)
      boxAt(clad, 3.4, 1.2, 1.4, x, 1.0, B.z0 - 0.9) // dock leveller bumper block
    }
    // L2 cladding with louvre bands
    const y2 = STOREY + (STOREY - 0.6) / 2 + 0.3
    const h2 = STOREY - 0.9
    // L2: full-height glazing with white vertical fins and a spandrel band at sill level
    boxAt(glass2, W, h2, 0.05, cx, y2, B.z0 - 0.06)
    boxAt(glass2, W, h2, 0.05, cx, y2, B.z1 + 0.06)
    boxAt(glass2, 0.05, h2, D, B.x0 - 0.06, y2, cz)
    boxAt(glass2, 0.05, h2, D, B.x1 + 0.06, y2, cz)
    for (let x = B.x0; x <= B.x1 + 0.01; x += 1.5) {
      boxAt(louvre, 0.08, h2, 0.45, x, y2, B.z0 - 0.25)
      boxAt(louvre, 0.08, h2, 0.45, x, y2, B.z1 + 0.25)
    }
    for (let z = B.z0; z <= B.z1 + 0.01; z += 1.5) {
      boxAt(louvre, 0.45, h2, 0.08, B.x0 - 0.25, y2, z)
      boxAt(louvre, 0.45, h2, 0.08, B.x1 + 0.25, y2, z)
    }
    boxAt(clad, W, 0.5, 0.12, cx, STOREY + 0.55, B.z0 - 0.08)
    boxAt(clad, W, 0.5, 0.12, cx, STOREY + 0.55, B.z1 + 0.08)
    // entrance canopy + doors (south, centre)
    boxAt(frame, 14, 0.35, 5, cx, 4.2, B.z1 + 2.5)
    for (const x of [cx - 6.5, cx + 6.5]) boxAt(frame, 0.3, 4.1, 0.3, x, 2.05, B.z1 + 4.7)
    boxAt(dock, 5, 3, 0.1, cx, 1.5, B.z1 + 0.1)
    return {
      core: mergeGeometries(core)!,
      glass: mergeGeometries(glass)!,
      frame: mergeGeometries(frame)!,
      clad: mergeGeometries(clad)!,
      louvre: mergeGeometries(louvre)!,
      glass2: mergeGeometries(glass2)!,
      dock: mergeGeometries(dock)!,
    }
  }, [B])
  return (
    <group>
      <mesh geometry={geo.core} receiveShadow>
        <meshStandardMaterial color="#d7dce2" roughness={0.8} />
      </mesh>
      {/* L1: mirror-like reflective curtain wall */}
      <mesh geometry={geo.glass} receiveShadow>
        <meshPhysicalMaterial color="#9ec3dd" metalness={0.95} roughness={0.04} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={2.6} />
      </mesh>
      {/* L2: lighter blue-green vision glass */}
      <mesh geometry={geo.glass2} receiveShadow>
        <meshPhysicalMaterial color="#a9d3df" metalness={0.7} roughness={0.06} clearcoat={1} envMapIntensity={2.0} />
      </mesh>
      <mesh geometry={geo.frame} castShadow receiveShadow>
        <meshStandardMaterial color="#3a414b" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh geometry={geo.clad} castShadow receiveShadow>
        <meshStandardMaterial color="#f1f3f5" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh geometry={geo.louvre} castShadow>
        <meshStandardMaterial color="#f4f6f8" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh geometry={geo.dock}>
        <meshStandardMaterial color="#59616b" roughness={0.6} />
      </mesh>
    </group>
  )
}
