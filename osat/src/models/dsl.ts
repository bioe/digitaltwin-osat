import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Tiny modelling DSL. A model is built once from primitives, then baked into
 * one merged geometry per material and rendered with instancing.
 *
 * Conventions: 1 unit = 1 m. Origin = floor centre of the footprint, +Y up.
 * The FRONT of a machine (operator side / load port side) faces +Z.
 */

export type Vec3 = [number, number, number]

export type MatKey =
  | 'body' // off-white painted steel (main equipment skin)
  | 'bodyAlt' // light grey painted steel
  | 'panel' // mid grey panels / covers
  | 'dark' // dark grey (frames, bases)
  | 'black' // near black (rubber, deep openings)
  | 'steel' // brushed stainless
  | 'chrome' // polished metal (spindles, rods)
  | 'glass' // transparent tinted window
  | 'accent' // brand blue stripe
  | 'accent2' // teal accent
  | 'yellow' // safety yellow
  | 'orange' // orange (warning, cables)
  | 'red' // emergency stop red
  | 'screen' // lit HMI screen (emissive blue-grey)
  | 'status' // glows with the live status colour (green/yellow/red)
  | 'lampR' // signal tower red lamp
  | 'lampY' // signal tower amber lamp
  | 'lampG' // signal tower green lamp
  | 'rubber' // black rubber / tyres
  | 'copper' // copper / gold-ish metal (leadframes, wire spools)
  | 'wafer' // silicon wafer (iridescent)
  | 'tape' // translucent blue dicing tape
  | 'white' // pure white (cleanroom suit, ceiling)
  | 'skin' // face skin tone
  | 'fabric' // chair fabric, dark blue
  | 'wood' // desk top
  | 'emissiveWhite' // light panels
  | 'leaf' // tree foliage
  | 'leaf2' // lighter foliage / shrubs
  | 'bark' // tree trunk
  | 'paint' // vehicle body paint (white)
  | 'paint2' // vehicle body paint (dark grey)
  | 'leather' // cognac leather
  | 'oak' // light oak
  | 'warmLight' // warm lamp glow
  | 'terracotta' // plant pots

export interface PartOpts {
  /** Euler rotation in radians (XYZ). */
  rot?: Vec3
  /** Corner radius for boxes (rounded). */
  r?: number
  /** Radial segments for round primitives. */
  seg?: number
}

export interface CylOpts extends PartOpts {
  /** Top radius when it differs from the bottom radius (cone / frustum). */
  rTop?: number
  /** Open ended tube. */
  open?: boolean
  /** Partial cylinder: theta length in radians. */
  arc?: number
}

/** Input to every animation function. */
export interface AnimState {
  /** Active time in seconds. Only advances while this instance is running, so motion freezes when idle/alarm. */
  t: number
  /** Global wall-clock time in seconds (always advances). Use for blinking etc. */
  T: number
  /** Random 0..1 per instance; use to de-sync identical machines. */
  phase: number
  state: 'run' | 'idle' | 'alarm'
  /** Model specific inputs (see each model's doc comment). Missing values are 0. */
  u: number[]
}

/** Sets o.position / o.rotation / o.scale relative to the pivot rest pose. o is reset before each call. */
export type AnimFn = (s: AnimState, o: THREE.Object3D) => void

interface RawPart {
  geo: THREE.BufferGeometry
  mat: MatKey
}

export interface AnimNode {
  name: string
  parent: number // index into anims, -1 = model root
  pivot: THREE.Matrix4 // rest transform of pivot in parent space
  fn: AnimFn
  parts: RawPart[]
}

export class Builder {
  readonly parts: RawPart[] = []
  readonly anims: AnimNode[]
  readonly ports: Vec3[] = []
  towers: Vec3[] = []
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()]
  private readonly animIndex: number

  constructor(anims?: AnimNode[], animIndex = -1) {
    this.anims = anims ?? []
    this.animIndex = animIndex
  }

  private get top() {
    return this.stack[this.stack.length - 1]
  }

  private add(geo: THREE.BufferGeometry, mat: MatKey, pos: Vec3, rot?: Vec3) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))),
      new THREE.Vector3(1, 1, 1),
    )
    geo.applyMatrix4(this.top.clone().multiply(m))
    this.parts.push({ geo, mat })
  }

  /** Box centred at pos. size = [w (x), h (y), d (z)]. */
  box(mat: MatKey, size: Vec3, pos: Vec3, o: PartOpts = {}) {
    const [w, h, d] = size
    const r = Math.min(o.r ?? 0, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)
    const geo = r > 0.001 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d)
    this.add(geo, mat, pos, o.rot)
  }

  /** Box whose bottom sits at pos[1] (handy for stacking on the floor). */
  boxB(mat: MatKey, size: Vec3, pos: Vec3, o: PartOpts = {}) {
    this.box(mat, size, [pos[0], pos[1] + size[1] / 2, pos[2]], o)
  }

  /** Cylinder along Y, centred at pos. */
  cyl(mat: MatKey, r: number, h: number, pos: Vec3, o: CylOpts = {}) {
    const geo = new THREE.CylinderGeometry(o.rTop ?? r, r, h, o.seg ?? 20, 1, o.open ?? false, 0, o.arc ?? Math.PI * 2)
    this.add(geo, mat, pos, o.rot)
  }

  sphere(mat: MatKey, r: number, pos: Vec3, o: PartOpts = {}) {
    this.add(new THREE.SphereGeometry(r, o.seg ?? 16, Math.max(8, (o.seg ?? 16) / 2)), mat, pos, o.rot)
  }

  /** Torus in the XY plane (rotate to taste). */
  torus(mat: MatKey, R: number, tube: number, pos: Vec3, o: PartOpts & { arc?: number } = {}) {
    this.add(new THREE.TorusGeometry(R, tube, 8, o.seg ?? 24, o.arc ?? Math.PI * 2), mat, pos, o.rot)
  }

  /** Flat 2D shape extruded along +Z by depth (shape in XY plane). */
  extrude(mat: MatKey, shape: THREE.Shape, depth: number, pos: Vec3, o: PartOpts = {}) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 })
    this.add(geo, mat, pos, o.rot)
  }

  /** Lathe: profile points (x = radius, y = height) revolved around Y. */
  lathe(mat: MatKey, pts: [number, number][], pos: Vec3, o: PartOpts = {}) {
    const geo = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), o.seg ?? 24)
    this.add(geo, mat, pos, o.rot)
  }

  /** Static sub-transform. Everything built inside fn is offset by pos/rot. */
  group(pos: Vec3, rot: Vec3 | undefined, fn: (b: Builder) => void) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))),
      new THREE.Vector3(1, 1, 1),
    )
    this.stack.push(this.top.clone().multiply(m))
    fn(this)
    this.stack.pop()
  }

  /**
   * Animated part. pivot is in the current space. Parts built inside `build`
   * are relative to the pivot. fn moves the pivot each frame. Nesting works.
   */
  anim(name: string, pivot: Vec3, fn: AnimFn, build: (b: Builder) => void) {
    const node: AnimNode = {
      name,
      parent: this.animIndex,
      pivot: this.top.clone().multiply(new THREE.Matrix4().makeTranslation(...pivot)),
      fn,
      parts: [],
    }
    this.anims.push(node)
    const child = new Builder(this.anims, this.anims.length - 1)
    build(child)
    node.parts = child.parts
    this.ports.push(...child.ports)
    this.towers.push(...child.towers)
  }

  /** Load/unload port: point on top of the port where a carrier sits (world-ish, in current static space). */
  port(pos: Vec3) {
    const v = new THREE.Vector3(...pos).applyMatrix4(this.top)
    this.ports.push([v.x, v.y, v.z])
  }

  /** Standard signal tower (andon stack): pole base at pos. Total height ~0.42 m. */
  tower(pos: Vec3) {
    const [x, y, z] = pos
    this.cyl('dark', 0.025, 0.04, [x, y + 0.02, z])
    this.cyl('steel', 0.012, 0.16, [x, y + 0.12, z])
    this.cyl('lampG', 0.032, 0.07, [x, y + 0.235, z])
    this.cyl('lampY', 0.032, 0.07, [x, y + 0.31, z])
    this.cyl('lampR', 0.032, 0.07, [x, y + 0.385, z])
    this.cyl('dark', 0.034, 0.02, [x, y + 0.43, z])
    const v = new THREE.Vector3(x, y, z).applyMatrix4(this.top)
    this.towers.push([v.x, v.y, v.z])
  }
}

export interface ModelDef {
  key: string
  /** Human readable, e.g. "Ball bonder (K&S RAPID class)". */
  name: string
  /** Real footprint [w (x), d (z), h (y)] in metres. */
  size: Vec3
  build(b: Builder): void
}

export interface BakedAnim {
  parent: number
  pivot: THREE.Matrix4
  fn: AnimFn
  byMat: Map<MatKey, THREE.BufferGeometry>
}

export interface BakedModel {
  def: ModelDef
  byMat: Map<MatKey, THREE.BufferGeometry>
  anims: BakedAnim[]
  ports: Vec3[]
  towers: Vec3[]
}

function clean(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', n.getAttribute('position'))
  if (!n.getAttribute('normal')) n.computeVertexNormals()
  out.setAttribute('normal', n.getAttribute('normal'))
  return out
}

function mergeByMat(parts: RawPart[]) {
  const groups = new Map<MatKey, THREE.BufferGeometry[]>()
  for (const p of parts) {
    if (!groups.has(p.mat)) groups.set(p.mat, [])
    groups.get(p.mat)!.push(clean(p.geo))
  }
  const out = new Map<MatKey, THREE.BufferGeometry>()
  for (const [k, list] of groups) {
    const g = mergeGeometries(list, false)
    if (g) {
      g.computeBoundingSphere()
      out.set(k, g)
    }
  }
  return out
}

const cache = new Map<string, BakedModel>()

export function bake(def: ModelDef): BakedModel {
  const hit = cache.get(def.key)
  if (hit) return hit
  const b = new Builder()
  def.build(b)
  const baked: BakedModel = {
    def,
    byMat: mergeByMat(b.parts),
    anims: b.anims.map(a => ({ parent: a.parent, pivot: a.pivot, fn: a.fn, byMat: mergeByMat(a.parts) })),
    ports: b.ports,
    towers: b.towers,
  }
  cache.set(def.key, baked)
  return baked
}

/** Helpers for animation functions. */
export const ease = {
  /** Smooth 0→1→0 triangle-ish wave, period p seconds. */
  pingpong(t: number, p: number) {
    const x = (t / p) % 1
    return 0.5 - 0.5 * Math.cos(x * Math.PI * 2)
  },
  /** Saw 0→1 over period p. */
  saw(t: number, p: number) {
    return (t / p) % 1
  },
  smooth(x: number) {
    const k = Math.min(1, Math.max(0, x))
    return k * k * (3 - 2 * k)
  },
}
