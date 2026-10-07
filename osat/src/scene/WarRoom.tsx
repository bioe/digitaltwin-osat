import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MEZZ_Y } from '../layout/layout'
import { world } from '../sim/world'
import { useUI } from '../store'
import { Instanced, setPose } from './Instanced'
import { glassMaterial } from './materials'
import { useScreens } from './wallPanels'

const H = 3.4 // clear height of the loft room
const WR_GLASS = glassMaterial('#e3f1ff')

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rx: number, ry: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Exposed red brick (running bond). */
function brickTex(rx: number, ry: number) {
  return canvasTex(256, 256, g => {
    g.fillStyle = '#d9d2c8'
    g.fillRect(0, 0, 256, 256)
    const bw = 64
    const bh = 21
    for (let r = 0; r < 256 / bh + 1; r++) {
      for (let k = -1; k < 5; k++) {
        const x = k * bw + (r % 2) * (bw / 2)
        const tone = 120 + ((r * 7 + k * 13) % 5) * 9
        g.fillStyle = `rgb(${tone + 40}, ${tone - 40}, ${tone - 62})`
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4)
      }
    }
  }, rx, ry)
}

/** Wide-plank light oak floor. */
function oakTex(rx: number, ry: number) {
  return canvasTex(256, 256, g => {
    for (let i = 0; i < 8; i++) {
      const tone = 176 + ((i * 37) % 5) * 7
      g.fillStyle = `rgb(${tone + 22}, ${tone - 8}, ${tone - 52})`
      g.fillRect(0, i * 32, 256, 32)
      g.fillStyle = 'rgba(90,60,30,0.10)'
      for (let k = 0; k < 6; k++) g.fillRect(0, i * 32 + 4 + k * 5, 256, 1)
      g.fillStyle = 'rgba(60,40,20,0.35)'
      g.fillRect(0, i * 32, 256, 1.5)
      g.fillRect(((i * 97) % 200) + 20, i * 32, 1.5, 32)
    }
  }, rx, ry)
}

function boxAt(list: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number) {
  const b = new THREE.BoxGeometry(w, h, d)
  b.translate(x, y, z)
  list.push(b)
}

/** Loft-style control room on the mezzanine: brick wall + video wall, oak floor, black steel glazing, plants. */
export function WarRoom() {
  const wr = world.L.warRoom
  const cx = (wr.x0 + wr.x1) / 2
  const W = wr.x1 - wr.x0
  const D = wr.z1 - wr.z0
  const screens = useScreens()
  const acc = useRef(10)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 1) return
    acc.current = 0
    for (const s of screens) {
      s.draw(s.c.getContext('2d')!)
      s.tex.needsUpdate = true
    }
  })
  const brick = useMemo(() => brickTex(W / 2.6, H / 1.3), [W])
  const oak = useMemo(() => oakTex(W / 2.4, D / 2.4), [W, D])

  // black steel: crittall glazing grid, roof beams, door frame
  const steel = useMemo(() => {
    const g: THREE.BufferGeometry[] = []
    const glass: THREE.BufferGeometry[] = []
    const pane = (len: number, x: number, z: number, alongX: boolean, h = H, y = H / 2) => {
      const b = alongX ? new THREE.BoxGeometry(len, h, 0.03) : new THREE.BoxGeometry(0.03, h, len)
      b.translate(x, y, z)
      glass.push(b)
    }
    // south glass wall
    pane(W, cx, wr.z1, true)
    for (let x = wr.x0; x <= wr.x1 + 0.01; x += 1.0) boxAt(g, 0.05, H, 0.07, x, H / 2, wr.z1)
    for (const y of [0.05, 1.1, 2.4, H]) boxAt(g, W, 0.06, 0.08, cx, y, wr.z1)
    // east glass wall; door (z 0.0–1.3) has its own glass leaf and a glass transom above
    pane(-wr.z0, wr.x1, wr.z0 / 2, false)
    pane(wr.z1 - 1.3, wr.x1, (1.3 + wr.z1) / 2, false)
    pane(1.3, wr.x1, 0.65, false, H - 2.3, 2.3 + (H - 2.3) / 2) // transom
    pane(1.2, wr.x1 - 0.06, 0.65, false, 2.25, 1.125) // door leaf (set back a little)
    boxAt(g, 0.04, 0.04, 0.5, wr.x1 - 0.12, 1.1, 0.9) // pull handle
    for (let z = wr.z0; z <= wr.z1 + 0.01; z += 1.0) if (z < -0.05 || z > 1.35) boxAt(g, 0.07, H, 0.05, wr.x1, H / 2, z)
    for (const z of [0, 1.3]) boxAt(g, 0.1, H, 0.1, wr.x1, H / 2, z)
    boxAt(g, 0.1, 0.1, 1.4, wr.x1, 2.3, 0.65)
    // door leaf frame
    for (const z of [0.06, 1.24]) boxAt(g, 0.05, 2.25, 0.05, wr.x1 - 0.06, 1.125, z)
    for (const y of [0.03, 2.22]) boxAt(g, 0.05, 0.05, 1.2, wr.x1 - 0.06, y, 0.65)
    for (const y of [0.05, 2.4, H]) {
      boxAt(g, 0.08, 0.06, -wr.z0, wr.x1, y, wr.z0 / 2)
      boxAt(g, 0.08, 0.06, wr.z1 - 1.3, wr.x1, y, (1.3 + wr.z1) / 2)
    }
    // exposed roof structure: I-beams across, purlins along
    for (let x = wr.x0; x <= wr.x1 + 0.01; x += 2) boxAt(g, 0.14, 0.32, D, x, H + 0.16, 0)
    for (const z of [wr.z0 + 0.1, 0, wr.z1 - 0.1]) boxAt(g, W, 0.12, 0.1, cx, H + 0.38, z)
    return { steel: mergeGeometries(g)!, glass: mergeGeometries(glass)! }
  }, [W, D, cx, wr])

  // vertical garden on the west wall
  const garden = useMemo(() => {
    const a: THREE.BufferGeometry[] = []
    const b: THREE.BufferGeometry[] = []
    let seed = 3
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 260; i++) {
      const s = new THREE.SphereGeometry(0.1 + r() * 0.12, 6, 5)
      s.scale(0.6, 1, 1)
      s.translate(wr.x0 + 0.2, 0.35 + r() * (H - 0.6), wr.z0 + 0.4 + r() * (D - 0.8))
      ;(i % 3 ? a : b).push(s)
    }
    return { a: mergeGeometries(a)!, b: mergeGeometries(b)! }
  }, [wr, D])

  const P = useMemo(() => {
    const m = (x: number, y: number, z: number, r = 0) => setPose(new THREE.Matrix4(), x, y, z, r)
    const deskZ = wr.z0 + 3.2
    const desks = [
      { x: cx - 2.55, r: 0.2 },
      { x: cx, r: 0 },
      { x: cx + 2.55, r: -0.2 },
    ]
    const dz = (r: number) => deskZ + Math.abs(r) * 1.2
    return {
      desks: desks.map(d => m(d.x, 0, dz(d.r), d.r)),
      seats: desks.map(d => m(d.x + Math.sin(d.r) * 1.0, 0, dz(d.r) + Math.cos(d.r) * 1.0, d.r + Math.PI)),
      sofa: [m(wr.x0 + 2.6, 0, wr.z1 - 1.0, Math.PI)],
      rug: [m(wr.x0 + 2.6, 0.005, wr.z1 - 1.9)],
      table: [m(wr.x0 + 2.6, 0, wr.z1 - 2.2)],
      high: [m(wr.x1 - 2.4, 0, wr.z1 - 1.9)],
      standing: [m(wr.x1 - 2.4, 0, wr.z1 - 1.0, Math.PI), m(wr.x1 - 3.5, 0, wr.z1 - 1.9, Math.PI / 2)],
      figs: [m(wr.x0 + 0.9, 0, wr.z0 + 0.7), m(wr.x1 - 0.6, 0, wr.z0 + 0.7), m(wr.x1 - 0.6, 0, wr.z1 - 0.6)],
      monsteras: [m(wr.x0 + 0.9, 0, wr.z1 - 0.7), m(wr.x0 + 4.6, 0, wr.z1 - 0.7)],
      pendants: [
        ...desks.map(d => m(d.x, H, dz(d.r) + 0.3)),
        m(wr.x1 - 2.8, H, wr.z1 - 1.9),
        m(wr.x1 - 2.0, H, wr.z1 - 1.9),
        m(wr.x0 + 2.6, H, wr.z1 - 2.2),
      ],
    }
  }, [cx, wr])

  const select = useUI(s => s.select)
  const open = (e: { delta: number; stopPropagation: () => void }) => {
    if (e.delta > 5) return
    e.stopPropagation()
    useUI.getState().setWarRoom(true)
  }
  // screens: 1.9 m tall; side screens turned 12° toward the room
  const wall = useMemo(() => {
    const h = 1.9
    const y = 0.9 + h / 2
    const z = wr.z0 + 0.1
    const by = (k: string) => screens.find(q => q.key === k)!
    const cw = (h * 1792) / 1152
    const sw = (h * 1024) / 1152
    const ry = 0.21
    const edge = cw / 2 + 0.05
    return [
      { s: by('title'), x: cx, y: 3.08, z: wr.z0 + 0.02, ry: 0, w: 3.6, h: 0.45 },
      { s: by('left'), x: cx - edge - (sw / 2) * Math.cos(ry), y, z: z + (sw / 2) * Math.sin(ry), ry, w: sw, h },
      { s: by('center'), x: cx, y, z, ry: 0, w: cw, h },
      { s: by('right'), x: cx + edge + (sw / 2) * Math.cos(ry), y, z: z + (sw / 2) * Math.sin(ry), ry: -ry, w: sw, h },
    ]
  }, [screens, cx, wr])
  const inst = (model: string, list: THREE.Matrix4[], person = false) => (
    <Instanced
      model={model}
      capacity={list.length}
      fill={(i, x) => {
        x.m.copy(list[i])
        if (person) {
          x.t = world.t
          x.phase = i * 0.37
          x.u = [0]
        }
      }}
      onPick={person ? () => select(null) : undefined}
    />
  )

  return (
    <group>
      <Mezzanine />
      <group position={[0, MEZZ_Y, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, 0]} receiveShadow>
          <planeGeometry args={[W, D]} />
          <meshStandardMaterial map={oak} roughness={0.55} />
        </mesh>
        {/* exposed brick wall carrying the video wall */}
        <mesh position={[cx, H / 2, wr.z0 - 0.12]} castShadow receiveShadow onClick={open}>
          <boxGeometry args={[W, H, 0.24]} />
          <meshStandardMaterial map={brick} roughness={0.9} />
        </mesh>
        {/* vertical garden */}
        <mesh position={[wr.x0 + 0.05, H / 2, 0]} receiveShadow>
          <boxGeometry args={[0.1, H, D]} />
          <meshStandardMaterial color="#2f5d2a" roughness={1} />
        </mesh>
        <mesh geometry={garden.a}>
          <meshStandardMaterial color="#4f9a3f" roughness={0.9} />
        </mesh>
        <mesh geometry={garden.b}>
          <meshStandardMaterial color="#7bbf54" roughness={0.9} />
        </mesh>
        <mesh geometry={steel.glass} material={WR_GLASS} onClick={open} />
        <mesh geometry={steel.steel} castShadow>
          <meshStandardMaterial color="#1c1f24" roughness={0.45} metalness={0.6} />
        </mesh>
        {/* command-centre video wall: brand strip + left / centre / right screens (slightly wrapped) */}
        {wall.map(({ s, x, z, ry, w, h, y }) => (
          <group key={s.key} position={[x, y, z]} rotation={[0, ry, 0]}>
            {s.key !== 'title' && (
              <mesh position={[0, 0, -0.03]} castShadow>
                <boxGeometry args={[w + 0.06, h + 0.06, 0.05]} />
                <meshStandardMaterial color="#0b0d10" roughness={0.4} />
              </mesh>
            )}
            <mesh onClick={open}>
              <planeGeometry args={[w, h]} />
              <meshBasicMaterial map={s.tex} toneMapped={false} transparent={s.key === 'title'} />
            </mesh>
          </group>
        ))}
        {inst('consoleDesk', P.desks)}
        {inst('chair', P.seats)}
        {inst('seatedWorker', P.seats, true)}
        {inst('rug', P.rug)}
        {inst('sofa', P.sofa)}
        {inst('coffeeTable', P.table)}
        {inst('highTable', P.high)}
        {inst('officeWorker', P.standing, true)}
        {inst('pottedFig', P.figs)}
        {inst('pottedMonstera', P.monsteras)}
        {inst('pendantLamp', P.pendants)}
      </group>
    </group>
  )
}

/** Black steel mezzanine: slab, columns, open-riser stair with oak treads. */
function Mezzanine() {
  const wr = world.L.warRoom
  const geo = useMemo(() => {
    const steel: THREE.BufferGeometry[] = []
    const slab: THREE.BufferGeometry[] = []
    const treads: THREE.BufferGeometry[] = []
    const W = wr.x1 - wr.x0 + 0.6
    const D = wr.z1 - wr.z0 + 0.6
    const cx = (wr.x0 + wr.x1) / 2
    boxAt(slab, W, 0.25, D, cx, MEZZ_Y - 0.125, 0)
    for (const z of [wr.z0 - 0.15, wr.z1 + 0.15]) boxAt(steel, W, 0.45, 0.25, cx, MEZZ_Y - 0.48, z)
    for (const x of [wr.x0 + 0.4, cx, wr.x1 - 0.4]) {
      for (const z of [-3.3, 3.3]) boxAt(steel, 0.3, MEZZ_Y - 0.25, 0.3, x, (MEZZ_Y - 0.25) / 2, z)
      boxAt(steel, 0.25, 0.45, D, x, MEZZ_Y - 0.48, 0)
    }
    // stair: 26 risers of 0.18 m, 0.28 m going; top meets the slab edge at the east door
    const n = 26
    const rise = MEZZ_Y / n
    const go = 0.28
    const x0 = wr.x1 + 0.3
    const run = n * go
    for (let i = 0; i < n; i++) boxAt(treads, go + 0.02, 0.05, 1.1, x0 + run - (i + 0.5) * go, rise * (i + 1) - 0.025, 0.65)
    const len = Math.hypot(run, MEZZ_Y)
    const ang = -Math.atan2(MEZZ_Y, run)
    const sloped = (h: number, t: number, z: number, lift: number) => {
      const g = new THREE.BoxGeometry(len, h, t)
      g.rotateZ(ang)
      g.translate(x0 + run / 2, MEZZ_Y / 2 + lift, z)
      steel.push(g)
    }
    for (const z of [0.08, 1.22]) {
      sloped(0.28, 0.06, z, -0.1)
      sloped(0.04, 0.04, z, 1.0)
      for (let k = 0; k <= 7; k++) {
        const x = x0 + (run * k) / 7
        const y = MEZZ_Y * (1 - k / 7)
        boxAt(steel, 0.03, 1.0, 0.03, x, y + 0.5, z)
      }
    }
    return { steel: mergeGeometries(steel)!, slab: mergeGeometries(slab)!, treads: mergeGeometries(treads)! }
  }, [wr])
  return (
    <group>
      <mesh geometry={geo.slab} castShadow receiveShadow>
        <meshStandardMaterial color="#6b7280" roughness={0.8} />
      </mesh>
      <mesh geometry={geo.steel} castShadow>
        <meshStandardMaterial color="#1c1f24" roughness={0.45} metalness={0.6} />
      </mesh>
      <mesh geometry={geo.treads} castShadow>
        <meshStandardMaterial color="#c49a6c" roughness={0.55} />
      </mesh>
    </group>
  )
}
