import * as THREE from 'three'
import { bake } from '../models/dsl'
import { MODELS } from '../models'
import { DYNAMIC_MATS, MATERIALS, STATUS } from '../scene/materials'

let renderer: THREE.WebGLRenderer | null = null
const cache = new Map<string, string>()

/** Renders a model once, in its rest pose, to a small PNG data URL (for the equipment cards). */
export function thumbnail(key: string, w = 168, h = 120): string {
  const hit = cache.get(key)
  if (hit) return hit
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
  }
  renderer.setSize(w, h, false)
  renderer.setPixelRatio(2)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#e9eef4')
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a96a6', 2.2))
  const sun = new THREE.DirectionalLight('#ffffff', 2.2)
  sun.position.set(3, 6, 5)
  scene.add(sun)

  const baked = bake(MODELS[key])
  const lit = new THREE.MeshBasicMaterial({ color: STATUS.run })
  const dim = new THREE.MeshBasicMaterial({ color: '#2a2f36' })
  const mat = (k: Parameters<typeof DYNAMIC_MATS.has>[0]) =>
    DYNAMIC_MATS.has(k) ? (k === 'status' || k === 'lampG' ? lit : dim) : k === 'glass' ? GLASS : MATERIALS[k]
  for (const [k, g] of baked.byMat) scene.add(new THREE.Mesh(g, mat(k)))
  // animated parts at rest pose
  const world = baked.anims.map(() => new THREE.Matrix4())
  baked.anims.forEach((a, i) => {
    world[i].copy(a.pivot)
    if (a.parent >= 0) world[i].premultiply(world[a.parent])
    for (const [k, g] of a.byMat) {
      const m = new THREE.Mesh(g, mat(k))
      m.matrixAutoUpdate = false
      m.matrix.copy(world[i])
      scene.add(m)
    }
  })

  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const r = size.length() / 2
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.05, 100)
  const dir = new THREE.Vector3(0.75, 0.55, 1).normalize()
  cam.position.copy(center).addScaledVector(dir, r / Math.sin(THREE.MathUtils.degToRad(14)) * 0.95)
  cam.lookAt(center)
  renderer.render(scene, cam)
  const url = renderer.domElement.toDataURL('image/png')
  cache.set(key, url)
  return url
}

const GLASS = new THREE.MeshStandardMaterial({ color: '#bfe4ff', transparent: true, opacity: 0.25, roughness: 0.05 })
