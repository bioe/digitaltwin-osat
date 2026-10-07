import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { world } from '../sim/world'
import { useUI } from '../store'
import { MATERIALS } from './materials'

/** Seconds for one full day → night → day loop in Auto mode. */
const CYCLE_S = 120

const DAY_BG = new THREE.Color('#ffffff')
const NIGHT_BG = new THREE.Color('#03060c')
const SUN_DAY = new THREE.Color('#ffffff')
const SUN_DUSK = new THREE.Color('#ffb36b')

/** Daylight 0 (night) … 1 (day) for Auto mode: long day, long night, short dusk/dawn. */
function autoDaylight(t: number) {
  const c = Math.cos(((t % CYCLE_S) / CYCLE_S) * Math.PI * 2)
  return THREE.MathUtils.clamp(0.5 + c * 1.6, 0, 1)
}

/**
 * Sun, sky and building lights driven by daylight (0 = night, 1 = day).
 * At night the hall goes dark (lights-out), so only self-lit machine glows remain:
 * status rings, signal towers, HMI screens, alarm halos and the war-room wall.
 */
export function DayNight({ cx }: { cx: number }) {
  const mode = useUI(s => s.dayMode)
  const { scene } = useThree()
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  const k = useRef(1)
  const base = useMemo(
    () => ({
      warm: (MATERIALS.warmLight as THREE.MeshBasicMaterial).color.clone(),
      panel: (MATERIALS.emissiveWhite as THREE.MeshBasicMaterial).color.clone(),
    }),
    [],
  )
  const tmp = useMemo(() => new THREE.Color(), [])

  const gl = useThree(s => s.gl)
  const shadowAcc = useRef(0)
  useFrame(({ clock }, dt) => {
    // shadows are mostly static: refresh the shadow map ~3 times a second, not every frame
    gl.shadowMap.autoUpdate = false
    shadowAcc.current += dt
    if (shadowAcc.current > 0.33) {
      shadowAcc.current = 0
      gl.shadowMap.needsUpdate = true
    }
    const target = mode === 'day' ? 1 : mode === 'night' ? 0 : autoDaylight(clock.elapsedTime)
    // smooth fade (≈3 s) when switching modes by hand
    k.current += (target - k.current) * Math.min(1, dt * (mode === 'auto' ? 6 : 1.4))
    const d = k.current
    world.setDaylight(d)
    const bg = scene.background as THREE.Color | null
    if (bg) bg.lerpColors(NIGHT_BG, DAY_BG, d)
    if (scene.fog) (scene.fog as THREE.Fog).color.lerpColors(NIGHT_BG, DAY_BG, d)
    scene.environmentIntensity = 0.03 + 0.52 * d
    if (hemi.current) hemi.current.intensity = 0.04 + 0.76 * d
    if (sun.current) {
      sun.current.intensity = 2.1 * d
      // warm low sun around dusk / dawn
      sun.current.color.lerpColors(SUN_DUSK, SUN_DAY, THREE.MathUtils.smoothstep(d, 0.2, 0.8))
    }
    if (fill.current) fill.current.intensity = 0.45 * d
    // HMI screens are self-lit: they glow brighter as the hall goes dark
    ;(MATERIALS.screen as THREE.MeshStandardMaterial).emissiveIntensity = 0.75 + 1.6 * (1 - d)
    // building lights off at night
    const on = THREE.MathUtils.smoothstep(d, 0.25, 0.6)
    ;(MATERIALS.warmLight as THREE.MeshBasicMaterial).color.copy(tmp.copy(base.warm).multiplyScalar(0.05 + 0.95 * on))
    ;(MATERIALS.emissiveWhite as THREE.MeshBasicMaterial).color.copy(tmp.copy(base.panel).multiplyScalar(0.04 + 0.96 * on))
  })

  return (
    <>
      <color attach="background" args={['#ffffff']} />
      <fog attach="fog" args={['#ffffff', 220, 560]} />
      <hemisphereLight ref={hemi} args={['#eaf2ff', '#3b4656', 0.8]} />
      <directionalLight
        ref={sun}
        position={[cx + 60, 110, 70]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={6}
        shadow-camera-left={-125}
        shadow-camera-right={125}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={300}
        shadow-bias={-0.0008}
        shadow-normalBias={0.03}
      >
        <object3D attach="target" position={[cx, 0, 0]} />
      </directionalLight>
      <directionalLight ref={fill} position={[cx - 80, 60, -60]} intensity={0.45} />
    </>
  )
}
