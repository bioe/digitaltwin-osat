import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { AISLE_HALF, FLOOR_Y, MEZZ_Y } from '../layout/layout'
import { liftSpots } from '../layout/lifts'
import { world } from '../sim/world'
import { useUI } from '../store'

const EYE = 1.65
const RADIUS = 0.3
/** Walking speed (m/s); one brisk pace, no separate run mode. */
const WALK = 4
/** War-room stair (see WarRoom Mezzanine): 26 risers × 0.28 m going, top at the east slab edge. */
const STAIR_RUN = 26 * 0.28

interface Box {
  x0: number
  x1: number
  z0: number
  z1: number
  /** 0 = production floor, 1 = war-room mezzanine. */
  level: 0 | 1
}

/** Live info for the tour overlay (read by the DOM HUD). */
export const tourInfo = { place: '', looking: '' as string, lookingId: '' as string, locked: false }

function box(cx: number, cz: number, w: number, d: number, level: 0 | 1 = 0): Box {
  return { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, level }
}

/** Static obstacles: machines, stockers, room partitions (with doors and aisle openings), columns, walls. */
function obstacles(): Box[] {
  const L = world.L
  const out: Box[] = []
  for (const t of world.tools) out.push(box(t.pos[0], t.pos[2], t.size[0] + 0.1, t.size[1] + 0.1))
  for (const s of world.stockers) {
    const side = Math.abs(Math.sin(s.rotY)) > 0.5
    out.push(box(s.pos[0], s.pos[2], (side ? s.size[1] : s.size[0]) + 0.1, (side ? s.size[0] : s.size[1]) + 0.1))
  }
  const T = 0.12
  const door = 0.95
  const ah = AISLE_HALF + 0.1
  for (const z of L.zones) {
    const x0 = z.x0 + 0.1
    const x1 = z.x1 - 0.1
    const mx = (x0 + x1) / 2
    const back = z.row === 'north' ? z.z0 : z.z1
    const front = z.row === 'north' ? z.z1 : z.z0
    out.push({ x0, x1, z0: back - T, z1: back + T, level: 0 })
    out.push({ x0, x1: mx - door, z0: front - T, z1: front + T, level: 0 })
    out.push({ x0: mx + door, x1, z0: front - T, z1: front + T, level: 0 })
    for (const x of [x0, x1]) {
      out.push({ x0: x - T, x1: x + T, z0: z.z0, z1: z.aisleZ - ah, level: 0 })
      out.push({ x0: x - T, x1: x + T, z0: z.aisleZ + ah, z1: z.z1, level: 0 })
    }
  }
  const B = L.bounds
  out.push({ x0: B.x0 - 1, x1: B.x1 + 1, z0: B.z0 - 1, z1: B.z0 + 0.15, level: 0 })
  out.push({ x0: B.x0 - 1, x1: B.x1 + 1, z0: B.z1 - 0.15, z1: B.z1 + 1, level: 0 })
  out.push({ x0: B.x0 - 1, x1: B.x0 + 0.15, z0: B.z0, z1: B.z1, level: 0 })
  out.push({ x0: B.x1 - 0.15, x1: B.x1 + 1, z0: B.z0, z1: B.z1, level: 0 })
  // overhead-conveyor drop-lift columns
  for (const l of liftSpots()) out.push(box(l.x, l.z, 0.55, 0.55))
  // mezzanine columns
  const wr = L.warRoom
  const cx = (wr.x0 + wr.x1) / 2
  for (const x of [wr.x0 + 0.4, cx, wr.x1 - 0.4]) for (const z of [-3.3, 3.3]) out.push(box(x, z, 0.4, 0.4))
  // stair stringers (side rails) on the floor level, so you enter the stair from its foot only
  out.push({ x0: wr.x1 + 0.3, x1: wr.x1 + 0.3 + STAIR_RUN, z0: -0.05, z1: 0.1, level: 0 })
  out.push({ x0: wr.x1 + 0.3, x1: wr.x1 + 0.3 + STAIR_RUN, z0: 1.2, z1: 1.35, level: 0 })
  // war-room walls on the mezzanine (east wall has the door at z 0 … 1.3)
  out.push({ x0: wr.x0 - 0.2, x1: wr.x1 + 0.2, z0: wr.z0 - 0.3, z1: wr.z0 + 0.25, level: 1 })
  out.push({ x0: wr.x0 - 0.2, x1: wr.x1 + 0.2, z0: wr.z1 - 0.05, z1: wr.z1 + 0.3, level: 1 })
  out.push({ x0: wr.x0 - 0.3, x1: wr.x0 + 0.25, z0: wr.z0, z1: wr.z1, level: 1 })
  out.push({ x0: wr.x1 - 0.05, x1: wr.x1 + 0.3, z0: wr.z0, z1: 0, level: 1 })
  out.push({ x0: wr.x1 - 0.05, x1: wr.x1 + 0.3, z0: 1.3, z1: wr.z1, level: 1 })
  // consoles and lounge furniture
  for (const x of [cx - 2.55, cx, cx + 2.55]) out.push(box(x, wr.z0 + 3.35, 2.4, 1.0, 1))
  out.push(box(wr.x0 + 2.6, wr.z1 - 1.6, 2.4, 1.8, 1))
  out.push(box(wr.x1 - 2.4, wr.z1 - 1.9, 1.9, 1.5, 1))
  return out
}

/**
 * First-person (FPS-style) tour: click to capture the mouse, mouse to look, WASD / arrows to walk,
 * Space to jump, click to select the machine under the crosshair, Esc frees the mouse / leaves. Machines, stockers, room walls and columns block you; the stair leads up
 * into the war room. Esc leaves the tour and restores the previous view.
 */
export function TourControls() {
  const tour = useUI(s => s.tour)
  const { camera, gl, setEvents } = useThree()
  const controls = useThree(s => s.controls) as unknown as OrbitControlsImpl | null
  const boxes = useMemo(obstacles, [])
  const keys = useRef(new Set<string>())
  const look = useRef({ yaw: -Math.PI / 2, pitch: -0.05 })
  const pos = useRef(new THREE.Vector3())
  /** Vertical jump offset (m) and speed (m/s). */
  const jump = useRef({ y: 0, v: 0 })
  const floor = useRef(0)
  const saved = useRef<{ p: THREE.Vector3; t: THREE.Vector3 } | null>(null)
  const wr = world.L.warRoom

  useEffect(() => {
    if (!tour) return
    // enter: remember the orbit view, start in the war room behind the consoles, facing the video wall
    saved.current = { p: camera.position.clone(), t: controls ? controls.target.clone() : new THREE.Vector3() }
    if (controls) controls.enabled = false
    // walking close to walls needs a short near plane; the orbit view uses a longer one for depth precision
    const persp = camera as THREE.PerspectiveCamera
    const savedNear = persp.near
    persp.near = 0.08
    persp.updateProjectionMatrix()
    pos.current.set((wr.x0 + wr.x1) / 2 + 1.2, 0, wr.z1 - 3.0)
    floor.current = MEZZ_Y
    look.current = { yaw: 0, pitch: 0.04 }
    const el = gl.domElement
    const locked = () => document.pointerLockElement === el
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      // first Esc frees the mouse (the browser does that itself); Esc with a free mouse leaves the tour
      if (e.key === 'Escape' && !locked()) useUI.getState().setTour(false)
      if (e.key === ' ') e.preventDefault()
      keys.current.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    // FPS mouse look: click to capture the mouse, then raw mouse movement turns the view
    const pm = (e: PointerEvent) => {
      if (!locked()) return
      look.current.yaw -= e.movementX * 0.0022
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - e.movementY * 0.0022, -1.45, 1.45)
    }
    const click = () => {
      if (!locked()) {
        el.requestPointerLock?.()
        return
      }
      // fire: select whatever machine is under the crosshair
      if (tourInfo.lookingId) useUI.getState().select({ kind: 'tool', id: tourInfo.lookingId })
    }
    const lockChange = () => {
      tourInfo.locked = locked()
      keys.current.clear()
    }
    const blur = () => keys.current.clear()
    // r3f pointer picking is off while touring: the crosshair picks instead
    setEvents({ enabled: false })
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('pointermove', pm)
    document.addEventListener('pointerlockchange', lockChange)
    el.addEventListener('click', click)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('pointermove', pm)
      document.removeEventListener('pointerlockchange', lockChange)
      el.removeEventListener('click', click)
      if (document.pointerLockElement) document.exitPointerLock()
      tourInfo.locked = false
      setEvents({ enabled: true })
      keys.current.clear()
      persp.near = savedNear
      persp.updateProjectionMatrix()
      // leave: back to the orbit view
      if (saved.current) {
        camera.position.copy(saved.current.p)
        if (controls) {
          controls.target.copy(saved.current.t)
          controls.enabled = true
          controls.update()
        }
      }
    }
  }, [tour, camera, controls, gl, wr, setEvents])

  /** Floor height under (x, z): stair slope, mezzanine when already up there, else the production floor. */
  const groundAt = (x: number, z: number, current: number) => {
    const sx0 = wr.x1 + 0.3
    if (x >= sx0 && x <= sx0 + STAIR_RUN && z >= 0.1 && z <= 1.2) return MEZZ_Y * (1 - (x - sx0) / STAIR_RUN)
    const onMezz = x > wr.x0 - 0.3 && x < sx0 + 0.05 && z > wr.z0 - 0.3 && z < wr.z1 + 0.3
    if (onMezz && current > MEZZ_Y - 0.6) return MEZZ_Y
    return 0
  }
  const blocked = (x: number, z: number, level: 0 | 1) =>
    boxes.some(b => b.level === level && x + RADIUS > b.x0 && x - RADIUS < b.x1 && z + RADIUS > b.z0 && z - RADIUS < b.z1)

  useFrame((_, dt) => {
    if (!tour) return
    const k = keys.current
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
    const s = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    const { yaw, pitch } = look.current
    const speed = WALK * Math.min(dt, 0.05)
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    let dx = (fx * f + -fz * s) * speed
    let dz = (fz * f + fx * s) * speed
    const len = Math.hypot(dx, dz)
    if (len > speed) {
      dx *= speed / len
      dz *= speed / len
    }
    const p = pos.current
    const level: 0 | 1 = floor.current > MEZZ_Y - 0.6 ? 1 : 0
    // slide along walls: resolve x and z separately
    if (dx && !blocked(p.x + dx, p.z, level)) p.x += dx
    if (dz && !blocked(p.x, p.z + dz, level)) p.z += dz
    const g = groundAt(p.x, p.z, floor.current)
    floor.current += (g - floor.current) * Math.min(1, dt * 12)
    // Space jumps (simple ballistic hop)
    const j = jump.current
    if (k.has(' ') && j.y === 0 && j.v === 0) j.v = 3.6
    if (j.v !== 0 || j.y > 0) {
      j.v -= 9.81 * Math.min(dt, 0.05)
      j.y = Math.max(0, j.y + j.v * Math.min(dt, 0.05))
      if (j.y === 0) j.v = 0
    }
    const bob = len > 0.0005 && j.y === 0 ? Math.sin(performance.now() / 115) * 0.025 : 0
    camera.position.set(p.x, FLOOR_Y + floor.current + EYE + j.y + bob, p.z)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')

    // HUD info: where am I, what am I looking at
    const zone = world.L.zones.find(z => p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1)
    tourInfo.place = level === 1 ? 'War room · central control' : zone ? `${zone.proc.name} room` : Math.abs(p.z) < 4 ? 'Central corridor' : 'Stocker bay'
    let best: { id: string; d: number } | null = null
    for (const t of world.tools) {
      const vx = t.pos[0] - p.x
      const vz = t.pos[2] - p.z
      const d = Math.hypot(vx, vz)
      if (d > 6 || d < 0.1) continue
      const cos = (vx * fx + vz * fz) / d
      if (cos < 0.93) continue
      if (!best || d < best.d) best = { id: t.id, d }
    }
    tourInfo.lookingId = best?.id ?? ''
  })

  return null
}
