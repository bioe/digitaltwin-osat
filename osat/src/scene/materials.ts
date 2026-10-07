import * as THREE from 'three'
import type { MatKey } from '../models/dsl'

export const STATUS = {
  run: new THREE.Color('#1fd67a'),
  idle: new THREE.Color('#ffc534'),
  alarm: new THREE.Color('#ff3045'),
}
export const STATUS_HEX = { run: '#1fd67a', idle: '#ffc534', alarm: '#ff3045' } as const
export const STATUS_LABEL = { run: 'Production', idle: 'Idle', alarm: 'Alarm / stopped' } as const

const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o })

/**
 * Clear float glass: transparent with Fresnel-ish specular and env reflections.
 * (No physical transmission: that costs a full extra scene render every frame.)
 */
export function glassMaterial(tint = '#d6ecef') {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0.1,
    roughness: 0.03,
    transparent: true,
    opacity: 0.26,
    specularIntensity: 1,
    specularColor: new THREE.Color('#ffffff'),
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.4,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

const glow = () => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })

export const MATERIALS: Record<MatKey, THREE.Material> = {
  body: std('#eceff2', { roughness: 0.42 }),
  bodyAlt: std('#cdd4dc', { roughness: 0.45 }),
  panel: std('#9aa5b1', { roughness: 0.5 }),
  dark: std('#3a414b', { roughness: 0.6 }),
  black: std('#16191e', { roughness: 0.7 }),
  steel: std('#b9c1ca', { metalness: 0.75, roughness: 0.32 }),
  chrome: std('#e4e8ec', { metalness: 0.95, roughness: 0.12 }),
  glass: glassMaterial(),
  accent: std('#2563eb', { roughness: 0.4 }),
  accent2: std('#0ea5a4', { roughness: 0.4 }),
  yellow: std('#f5c400', { roughness: 0.5 }),
  orange: std('#f97316', { roughness: 0.5 }),
  red: std('#dc2626', { roughness: 0.4 }),
  screen: std('#0b1f3a', { emissive: new THREE.Color('#3b8cff'), emissiveIntensity: 0.75, roughness: 0.25 }),
  status: glow(),
  lampR: glow(),
  lampY: glow(),
  lampG: glow(),
  rubber: std('#22252a', { roughness: 0.9 }),
  copper: std('#c98a4b', { metalness: 0.8, roughness: 0.3 }),
  wafer: std('#5b5aa6', { metalness: 0.9, roughness: 0.15 }),
  tape: new THREE.MeshStandardMaterial({ color: '#68b4ff', transparent: true, opacity: 0.6, roughness: 0.3 }),
  white: std('#f7f8fa', { roughness: 0.7 }),
  skin: std('#e0b394', { roughness: 0.8 }),
  fabric: std('#1e2a44', { roughness: 0.95 }),
  wood: std('#a5774e', { roughness: 0.6 }),
  emissiveWhite: new THREE.MeshBasicMaterial({ color: '#f2f7ff', toneMapped: false }),
  leaf: std('#5f9a4a', { roughness: 0.9 }),
  leaf2: std('#86b862', { roughness: 0.9 }),
  bark: std('#6b5040', { roughness: 0.95 }),
  paint: std('#f1f3f5', { roughness: 0.25, metalness: 0.3 }),
  paint2: std('#4b5563', { roughness: 0.25, metalness: 0.4 }),
  leather: std('#8a4f2c', { roughness: 0.5 }),
  oak: std('#c49a6c', { roughness: 0.55 }),
  warmLight: new THREE.MeshBasicMaterial({ color: '#ffd08a', toneMapped: false }),
  terracotta: std('#2b2b2b', { roughness: 0.6 }),
}

/** Materials whose per-instance colour reflects live state. */
export const DYNAMIC_MATS = new Set<MatKey>(['status', 'lampR', 'lampY', 'lampG'])

const DIM = {
  lampR: new THREE.Color('#3a1418'),
  lampY: new THREE.Color('#3a3214'),
  lampG: new THREE.Color('#123222'),
}
const LIT = {
  lampR: new THREE.Color('#ff2a3d'),
  lampY: new THREE.Color('#ffc21a'),
  lampG: new THREE.Color('#1cff8a'),
}

const tmp = new THREE.Color()
/** Colour for a dynamic material given state and time. */
export function dynColor(mat: MatKey, state: 'run' | 'idle' | 'alarm', T: number, phase: number): THREE.Color {
  const blink = Math.sin((T + phase) * Math.PI * 3) > -0.2
  if (mat === 'status') {
    tmp.copy(STATUS[state])
    if (state === 'alarm' && !blink) tmp.multiplyScalar(0.25)
    return tmp
  }
  const on =
    (mat === 'lampG' && state === 'run') ||
    (mat === 'lampY' && state === 'idle') ||
    (mat === 'lampR' && state === 'alarm' && blink)
  const k = mat as 'lampR' | 'lampY' | 'lampG'
  return tmp.copy(on ? LIT[k] : DIM[k])
}
