import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { AISLE_HALF, ARV_LANE, WALL_H } from '../layout/layout'
import { world } from '../sim/world'
import { useUI } from '../store'
import { Instanced, setPose } from './Instanced'
import { MATERIALS, glassMaterial } from './materials'

const ROOM_GLASS = glassMaterial()

export const MODE_TINT = { OHT: '#3b82f6', CONV: '#a855f7', ARV: '#14b8a6' } as const

function floorTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#c9ced5'
  g.fillRect(0, 0, 256, 256)
  // 4 × 4 perforated raised-floor tiles (0.6 m each)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#cdd2d9' : '#c6ccd3'
      g.fillRect(i * 64 + 1, j * 64 + 1, 62, 62)
      g.fillStyle = 'rgba(80,90,100,0.10)'
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) g.fillRect(i * 64 + 8 + a * 9, j * 64 + 8 + b * 9, 3, 3)
    }
  }
  g.strokeStyle = '#aab1ba'
  g.lineWidth = 2
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke()
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return g
}

function cylX(r: number, len: number, x: number, y: number, z: number) {
  const g = new THREE.CylinderGeometry(r, r, len, 8)
  g.rotateZ(Math.PI / 2)
  g.translate(x, y, z)
  return g
}

interface WallParts {
  solid: THREE.BufferGeometry[]
  glass: THREE.BufferGeometry[]
  frame: THREE.BufferGeometry[]
}

/** Cleanroom partition from a to b (axis-aligned): solid kick panel, glazing, cap rail, posts. */
function wall(parts: WallParts, ax: number, az: number, bx: number, bz: number) {
  const len = Math.hypot(bx - ax, bz - az)
  if (len < 0.05) return
  const alongX = Math.abs(bx - ax) > Math.abs(bz - az)
  const cx = (ax + bx) / 2
  const cz = (az + bz) / 2
  const T = 0.08
  const mk = (h: number, y: number, t = T) => (alongX ? boxAt(len, h, t, cx, y, cz) : boxAt(t, h, len, cx, y, cz))
  parts.solid.push(mk(1.0, 0.5))
  parts.glass.push(mk(WALL_H - 1.1, 1.0 + (WALL_H - 1.1) / 2, 0.03))
  parts.frame.push(mk(0.08, WALL_H - 0.04, 0.12), mk(0.05, 1.02, 0.1))
  const n = Math.max(1, Math.round(len / 1.5))
  for (let i = 0; i <= n; i++) {
    const k = i / n
    const x = ax + (bx - ax) * k
    const z = az + (bz - az) * k
    parts.frame.push(boxAt(0.07, WALL_H, 0.07, x, WALL_H / 2, z))
  }
}

export function Building() {
  const walls = useUI(s => s.layers.walls)
  const { bounds: B, zones } = world.L
  const W = B.x1 - B.x0
  const D = B.z1 - B.z0
  const cx = (B.x0 + B.x1) / 2
  const cz = (B.z0 + B.z1) / 2
  const tex = useMemo(() => {
    const t = floorTexture()
    t.repeat.set(W / 2.4, D / 2.4)
    return t
  }, [W, D])

  const shell = useMemo(() => {
    const walls: THREE.BufferGeometry[] = []
    const cols: THREE.BufferGeometry[] = []
    const beams: THREE.BufferGeometry[] = []
    walls.push(boxAt(W, 1.4, 0.3, cx, 0.7, B.z0), boxAt(W, 1.4, 0.3, cx, 0.7, B.z1))
    walls.push(boxAt(0.3, 1.4, D, B.x0, 0.7, cz), boxAt(0.3, 1.4, D, B.x1, 0.7, cz))
    // cut-away shell: column stubs only, so the camera can look in from any side
    for (let x = B.x0; x <= B.x1 + 0.1; x += 12) cols.push(boxAt(0.6, 1.8, 0.6, x, 0.9, B.z0), boxAt(0.6, 1.8, 0.6, x, 0.9, B.z1))
    for (const x of [B.x0, B.x1]) for (let z = B.z0 + 10.7; z < B.z1 - 1; z += 10.7) cols.push(boxAt(0.6, 1.8, 0.6, x, 0.9, z))
    beams.push(boxAt(W, 0.12, 0.5, cx, 1.46, B.z0), boxAt(W, 0.12, 0.5, cx, 1.46, B.z1))
    return { walls: mergeGeometries(walls)!, cols: mergeGeometries(cols)!, beams: mergeGeometries(beams)! }
  }, [W, D, cx, cz, B])

  // room partitions + utility piping
  const rooms = useMemo(() => {
    const parts: WallParts = { solid: [], glass: [], frame: [] }
    const pipes: Record<'steel' | 'blue' | 'yellow' | 'tray', THREE.BufferGeometry[]> = { steel: [], blue: [], yellow: [], tray: [] }
    const door = 0.95
    const ah = AISLE_HALF + 0.1
    for (const z of zones) {
      const x0 = z.x0 + 0.1
      const x1 = z.x1 - 0.1
      const mx = (x0 + x1) / 2
      const back = z.row === 'north' ? z.z0 : z.z1
      const front = z.row === 'north' ? z.z1 : z.z0
      wall(parts, x0, back, x1, back)
      wall(parts, x0, front, mx - door, front)
      wall(parts, mx + door, front, x1, front)
      for (const x of [x0, x1]) {
        // end walls with the aisle opening the transport passes through
        wall(parts, x, z.z0, x, z.aisleZ - ah)
        wall(parts, x, z.aisleZ + ah, x, z.z1)
      }
      // utility headers along both long walls, with drops to every tool
      for (const wz of [z.z0, z.z1]) {
        const dz = wz < z.aisleZ ? 0.25 : -0.25
        const len = x1 - x0 - 0.3
        pipes.steel.push(cylX(0.045, len, mx, 2.05, wz + dz))
        pipes.blue.push(cylX(0.04, len, mx, 2.18, wz + dz * 1.4))
        pipes.yellow.push(cylX(0.03, len, mx, 2.3, wz + dz * 1.7))
        pipes.tray.push(boxAt(len, 0.06, 0.32, mx, 2.42, wz + dz * 1.2))
      }
    }
    for (const t of world.tools) {
      const z = zones.find(q => q.proc.id === t.proc)!
      const wz = t.side === -1 ? z.z0 : z.z1
      const dz = t.side === -1 ? 0.25 : -0.25
      for (const [k, dx] of [['steel', -0.25], ['blue', 0.0], ['yellow', 0.2]] as const) {
        const g = new THREE.CylinderGeometry(0.025, 0.025, 2.1 - t.size[2] * 0.6, 6)
        g.translate(t.pos[0] + dx, (2.1 + t.size[2] * 0.6) / 2, wz + dz * (k === 'steel' ? 1 : k === 'blue' ? 1.4 : 1.7))
        pipes[k].push(g)
      }
    }
    return {
      solid: mergeGeometries(parts.solid)!,
      glass: mergeGeometries(parts.glass)!,
      frame: mergeGeometries(parts.frame)!,
      steel: mergeGeometries(pipes.steel)!,
      blue: mergeGeometries(pipes.blue)!,
      yellow: mergeGeometries(pipes.yellow)!,
      tray: mergeGeometries(pipes.tray)!,
    }
  }, [zones])

  const lines = useMemo(() => {
    const yellow: THREE.BufferGeometry[] = []
    const green: THREE.BufferGeometry[] = []
    for (const z of zones) {
      const len = z.x1 - z.x0
      const mx = (z.x0 + z.x1) / 2
      for (const s of [-1, 1]) yellow.push(boxAt(len, 0.012, 0.08, mx, 0.012, z.aisleZ + s * AISLE_HALF))
    }
    // corridor: ARV lanes (yellow dashes) and a green pedestrian walkway
    for (let x = B.x0 + 2; x < B.x1 - 2; x += 2) {
      for (const lz of [ARV_LANE + 0.45, ARV_LANE - 0.45]) yellow.push(boxAt(1.0, 0.012, 0.07, x, 0.012, lz))
    }
    green.push(boxAt(W - 4, 0.01, 1.2, cx, 0.011, -1.4))
    return { yellow: mergeGeometries(yellow)!, green: mergeGeometries(green)! }
  }, [zones, B, W, cx])

  const pick = (id: string) => (e: { delta: number; stopPropagation: () => void }) => {
    if (e.delta > 5) return
    e.stopPropagation()
    useUI.getState().select({ kind: 'zone', id })
  }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
      {zones.map(z => (
        <mesh key={z.proc.id} rotation={[-Math.PI / 2, 0, 0]} position={[(z.x0 + z.x1) / 2, 0.006, (z.z0 + z.z1) / 2]} receiveShadow onClick={pick(z.proc.id)}>
          <planeGeometry args={[z.x1 - z.x0 - 0.2, z.z1 - z.z0]} />
          <meshStandardMaterial color={MODE_TINT[z.proc.mode]} transparent opacity={0.12} roughness={0.9} depthWrite={false} />
        </mesh>
      ))}
      <mesh geometry={lines.yellow}>
        <meshBasicMaterial color="#f5c400" />
      </mesh>
      <mesh geometry={lines.green}>
        <meshBasicMaterial color="#1f9d55" transparent opacity={0.35} />
      </mesh>
      {walls && (
        <group>
      <mesh geometry={rooms.solid} castShadow receiveShadow>
        <meshStandardMaterial color="#e9edf2" roughness={0.6} />
      </mesh>
      <mesh geometry={rooms.glass} raycast={() => null} material={ROOM_GLASS} />
      <mesh geometry={rooms.frame} castShadow>
        <meshStandardMaterial color="#9aa6b4" roughness={0.45} metalness={0.5} />
      </mesh>
      <mesh geometry={rooms.steel} material={MATERIALS.steel} />
      <mesh geometry={rooms.blue}>
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh geometry={rooms.yellow}>
        <meshStandardMaterial color="#eab308" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh geometry={rooms.tray}>
        <meshStandardMaterial color="#4b5563" roughness={0.6} metalness={0.4} />
      </mesh>
        </group>
      )}
      <mesh geometry={shell.walls} castShadow receiveShadow>
        <meshStandardMaterial color="#dfe4ea" roughness={0.7} />
      </mesh>
      <mesh geometry={shell.cols} castShadow>
        <meshStandardMaterial color="#aeb7c2" roughness={0.6} />
      </mesh>
      <mesh geometry={shell.beams}>
        <meshStandardMaterial color="#8d98a6" roughness={0.6} />
      </mesh>
      <Props />
    </group>
  )
}

/** Benches in every stocker bay, WIP racks and consumable cabinets along the corridor. */
function Props() {
  const { benches, crossX, chargers } = world.L
  const benchM = useMemo(() => benches.map(b => setPose(new THREE.Matrix4(), b.pos[0], 0, b.pos[1], b.rotY)), [benches])
  const racks = useMemo(() => {
    const list: THREE.Matrix4[] = []
    const cab: THREE.Matrix4[] = []
    const cx0 = chargers[0].pos[0] - 1.5
    const cx1 = chargers[chargers.length - 1].pos[0] + 1.5
    for (const gx of crossX.north) {
      list.push(setPose(new THREE.Matrix4(), gx - 1.6, 0, -3.25, 0))
      cab.push(setPose(new THREE.Matrix4(), gx + 1.6, 0, -3.25, 0))
    }
    for (const gx of crossX.south) {
      if (gx > cx0 && gx < cx1) continue
      list.push(setPose(new THREE.Matrix4(), gx - 1.6, 0, 3.25, Math.PI))
      cab.push(setPose(new THREE.Matrix4(), gx + 1.6, 0, 3.25, Math.PI))
    }
    return { list, cab }
  }, [crossX, chargers])
  return (
    <group>
      <Instanced model="workbench" capacity={benchM.length} fill={(i, inst) => inst.m.copy(benchM[i])} />
      <Instanced model="wipRack" capacity={racks.list.length} fill={(i, inst) => inst.m.copy(racks.list[i])} />
      <Instanced model="partsCabinet" capacity={racks.cab.length} fill={(i, inst) => inst.m.copy(racks.cab[i])} />
    </group>
  )
}
