import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FLOOR_Y, MEZZ_Y } from '../layout/layout'
import { world } from '../sim/world'
import { useUI } from '../store'
import { Instanced, setPose } from './Instanced'
import { decal } from './decal'
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

/** Height maps are data, not colour. */
function linear(t: THREE.Texture) {
  t.colorSpace = THREE.NoColorSpace
  return t
}

/** Brick relief: mortar joints recessed, faces slightly rough. */
function brickBump(rx: number, ry: number) {
  return canvasTex(256, 256, g => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, 256, 256)
    const bw = 64
    const bh = 21
    for (let r = 0; r < 256 / bh + 1; r++) {
      for (let k = -1; k < 5; k++) {
        const x = k * bw + (r % 2) * (bw / 2)
        g.fillStyle = '#c8c8c8'
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4)
        // rough face: speckle
        for (let i = 0; i < 18; i++) {
          const v = 170 + Math.floor(Math.random() * 70)
          g.fillStyle = `rgb(${v},${v},${v})`
          g.fillRect(x + 3 + Math.random() * (bw - 8), r * bh + 3 + Math.random() * (bh - 8), 2 + Math.random() * 4, 1 + Math.random() * 2)
        }
      }
    }
  }, rx, ry)
}

/** Oak relief: plank seams and end joints recessed, fine grain. */
function oakBump(rx: number, ry: number) {
  return canvasTex(256, 256, g => {
    g.fillStyle = '#b4b4b4'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 8; i++) {
      for (let k = 0; k < 7; k++) {
        const v = 160 + Math.floor(Math.random() * 50)
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(0, i * 32 + 4 + k * 4, 256, 1)
      }
      g.fillStyle = '#000'
      g.fillRect(0, i * 32, 256, 2)
      g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32)
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
  // redraw one screen at a time (round robin, ≈0.6 s each) and only when the camera is near enough
  // to read it: each redraw is a multi-megapixel canvas upload, so doing all four at once causes a hitch
  const next = useRef(0)
  const first = useRef(true)
  useFrame(({ camera }, dt) => {
    acc.current += dt
    if (acc.current < 0.6 && !first.current) return
    acc.current = 0
    const d = camera.position.distanceTo(new THREE.Vector3(cx, FLOOR_Y + MEZZ_Y + 1.8, wr.z0))
    if (d > 70 && !first.current) return
    const list = first.current ? screens : [screens[next.current++ % screens.length]]
    first.current = false
    for (const s of list) {
      s.draw(s.c.getContext('2d')!)
      s.tex.needsUpdate = true
    }
  })
  const brick = useMemo(() => brickTex(W / 2.6, H / 1.3), [W])
  const oak = useMemo(() => oakTex(W / 2.4, D / 2.4), [W, D])
  const brickB = useMemo(() => linear(brickBump(W / 2.6, H / 1.3)), [W])
  const oakB = useMemo(() => linear(oakBump(W / 2.4, D / 2.4)), [W, D])

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
    // east glass wall; open doorway (z 0.0–1.3) at the top of the stair, glass transom above
    pane(-wr.z0, wr.x1, wr.z0 / 2, false)
    pane(wr.z1 - 1.3, wr.x1, (1.3 + wr.z1) / 2, false)
    pane(1.3, wr.x1, 0.65, false, H - 2.3, 2.3 + (H - 2.3) / 2) // transom
    for (let z = wr.z0; z <= wr.z1 + 0.01; z += 1.0) if (z < -0.05 || z > 1.35) boxAt(g, 0.07, H, 0.05, wr.x1, H / 2, z)
    for (const z of [0, 1.3]) boxAt(g, 0.1, H, 0.1, wr.x1, H / 2, z)
    boxAt(g, 0.1, 0.1, 1.4, wr.x1, 2.3, 0.65)
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
      rug: [m(wr.x0 + 2.6, 0.035, wr.z1 - 1.9)],
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
          x.visible = world.staffed
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
          <meshStandardMaterial map={oak} bumpMap={oakB} bumpScale={1.2} roughness={0.55} {...decal(2)} />
        </mesh>
        {/* exposed brick wall carrying the video wall */}
        <mesh position={[cx, H / 2, wr.z0 - 0.12]} castShadow receiveShadow>
          <boxGeometry args={[W, H, 0.24]} />
          <meshStandardMaterial map={brick} bumpMap={brickB} bumpScale={3.5} roughness={0.9} />
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
        <mesh geometry={steel.glass} material={WR_GLASS} />
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
            {/* only the screens themselves open the full-screen war-room view */}
            <mesh onClick={s.key === 'title' ? undefined : open}>
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
        <RoomLighting />
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

const LED = new THREE.MeshBasicMaterial({ color: '#5eead4', toneMapped: false })
const LINEAR = new THREE.MeshBasicMaterial({ color: '#f5f9ff', toneMapped: false })

/**
 * War-room illumination: warm pools under the pendants, blue-white spill from the video wall,
 * linear LED fixtures between the roof beams and cyan cove strips (glass base, brick top, desk fronts).
 * Stays on at night, so the control room is the one lit space in the lights-out hall.
 */
function RoomLighting() {
  const wr = world.L.warRoom
  const cx = (wr.x0 + wr.x1) / 2
  const W = wr.x1 - wr.x0
  const D = wr.z1 - wr.z0
  const deskZ = wr.z0 + 3.2
  const geo = useMemo(() => {
    const led: THREE.BufferGeometry[] = []
    const lin: THREE.BufferGeometry[] = []
    // cove strip along the base of the south and east glass walls
    boxAt(led, W - 0.2, 0.03, 0.04, cx, 0.05, wr.z1 - 0.08)
    boxAt(led, 0.04, 0.03, D - 0.2, wr.x1 - 0.08, 0.05, 0)
    // up-light strip along the top of the brick wall
    boxAt(led, W - 0.4, 0.03, 0.04, cx, H - 0.06, wr.z0 + 0.02)
    // under-desk glow strips (front edge of each console)
    for (const [x, r] of [[cx - 2.55, 0.2], [cx, 0], [cx + 2.55, -0.2]] as const) {
      const z = deskZ + Math.abs(r) * 1.2
      const g = new THREE.BoxGeometry(2.2, 0.025, 0.03)
      g.rotateY(r)
      g.translate(x + Math.sin(r) * 0.52, 0.1, z + Math.cos(r) * 0.52)
      led.push(g)
    }
    // linear LED fixtures hung between the roof beams
    for (let x = wr.x0 + 1; x < wr.x1 - 0.5; x += 2) {
      for (const z of [wr.z0 + 2.2, wr.z1 - 2.2]) {
        boxAt(lin, 1.4, 0.04, 0.12, x, H - 0.25, z)
        boxAt(led, 0.01, 0.25, 0.01, x - 0.6, H - 0.12, z)
        boxAt(led, 0.01, 0.25, 0.01, x + 0.6, H - 0.12, z)
      }
    }
    return { led: mergeGeometries(led)!, lin: mergeGeometries(lin)! }
  }, [W, D, cx, wr, deskZ])
  return (
    <group>
      <mesh geometry={geo.led} material={LED} raycast={() => null} />
      <mesh geometry={geo.lin} material={LINEAR} raycast={() => null} />
      {/* warm pools under the desk pendants and the stand-up table */}
      {/* one warm pool over the console row (each point light costs on every lit pixel) */}
      <pointLight position={[cx, H - 1.3, deskZ + 0.4]} color="#ffcf8a" intensity={14} distance={9} decay={1.6} />
      {/* soft spill from the video wall and the ceiling fixtures */}
      <pointLight position={[cx, 1.9, wr.z0 + 1.6]} color="#9cc8ff" intensity={6} distance={8} decay={2} />
      <pointLight position={[cx, H - 0.5, wr.z1 - 2.4]} color="#eef5ff" intensity={6} distance={9} decay={2} />
    </group>
  )
}
