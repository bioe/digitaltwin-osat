import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { pathAt } from '../layout/path'
import { FLOOR_Y, OHT_Y } from '../layout/layout'
import { world } from '../sim/world'
import { isMoving, positionOf, useUI, worldPos } from '../store'
import { Building } from './Building'
import { Landscape } from './Landscape'
import { LowerFloors } from './LowerFloors'
import { Overlays } from './Overlays'
import { LabelProjector } from './labels'
import { Equipment } from './Equipment'
import { People } from './People'
import { Transport } from './Transport'
import { WarRoom } from './WarRoom'

function SimDriver() {
  useFrame((_, dt) => world.step(dt))
  return null
}

function CameraRig() {
  const fly = useUI(s => s.fly)
  const controls = useThree(s => s.controls) as unknown as OrbitControlsImpl | null
  const camera = useThree(s => s.camera)
  const anim = useRef<{ fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3; k: number } | null>(null)
  useEffect(() => {
    if (!fly || !controls) return
    const toT = new THREE.Vector3(...fly.target)
    anim.current = {
      fromT: controls.target.clone(),
      toT,
      fromP: camera.position.clone(),
      toP: toT.clone().add(new THREE.Vector3(...fly.offset)),
      k: 0,
    }
  }, [fly, controls, camera])
  const sel = useUI(s => s.sel)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const a = anim.current
    if (!controls) return
    // follow a moving selection: shift target + camera by the object's motion
    if (sel && isMoving(sel)) {
      const p = worldPos(sel)
      if (p) {
        if (a) {
          // still flying in: keep aiming at the moving object
          a.toT.set(...p)
          a.toP.copy(a.toT).add(tmp.set(...(useUI.getState().fly?.offset ?? [6, 9.5, 10])))
        } else {
          tmp.set(...p).sub(controls.target).multiplyScalar(Math.min(1, dt * 8))
          controls.target.add(tmp)
          camera.position.add(tmp)
        }
      }
    }
    if (!a) return
    a.k = Math.min(1, a.k + dt / 1.2)
    const e = a.k < 0.5 ? 4 * a.k ** 3 : 1 - (-2 * a.k + 2) ** 3 / 2
    controls.target.lerpVectors(a.fromT, a.toT, e)
    camera.position.lerpVectors(a.fromP, a.toP, e)
    controls.update()
    if (a.k >= 1) anim.current = null
  })
  return null
}

/** Animated orbit steps from the HUD buttons and Q/E/R/F keys. */
function OrbitRig() {
  const req = useUI(s => s.orbitReq)
  const controls = useThree(s => s.controls) as unknown as OrbitControlsImpl | null
  const camera = useThree(s => s.camera)
  const left = useRef({ az: 0, pol: 0 })
  useEffect(() => {
    if (req) {
      left.current.az += req.az
      left.current.pol += req.pol
    }
  }, [req])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const o = useUI.getState().orbit
      const k = e.key.toLowerCase()
      if (k === 'q') o(Math.PI / 4)
      else if (k === 'e') o(-Math.PI / 4)
      else if (k === 'r') o(0, -0.2)
      else if (k === 'f') o(0, 0.2)
      else if (k === ' ') useUI.getState().toggleSpin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useFrame((_, dt) => {
    if (!controls) return
    const l = left.current
    if (Math.abs(l.az) < 1e-4 && Math.abs(l.pol) < 1e-4) return
    const k = Math.min(1, dt * 6)
    const da = l.az * k
    const dp = l.pol * k
    l.az -= da
    l.pol -= dp
    const off = camera.position.clone().sub(controls.target)
    const sph = new THREE.Spherical().setFromVector3(off)
    sph.theta += da
    sph.phi = Math.min(Math.PI / 2.15, Math.max(0.12, sph.phi + dp))
    camera.position.copy(controls.target).add(off.setFromSpherical(sph))
    camera.lookAt(controls.target)
  })
  return null
}

/** Bouncing chevron + ring over the current selection. */
function SelectionMarker() {
  const sel = useUI(s => s.sel)
  const g = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!g.current || !sel) return
    let p: [number, number, number] | null = null
    let r = 1.2
    let h = 2.4
    if (sel.kind === 'oht') {
      const v = world.oht.find(x => x.id === sel.id)
      if (v) {
        const q = pathAt(world.L.loops.OHT, v.s).p
        p = [q[0], OHT_Y - 0.4, q[1]]
        h = 4.6
        r = 0.7
      }
    } else if (sel.kind === 'tool') {
      const t = world.toolById.get(sel.id)
      if (t) {
        p = [t.pos[0], 1, t.pos[2]]
        r = Math.max(t.size[0], t.size[1]) * 0.75
        h = t.size[2] + 0.9
      }
    } else if (sel.kind === 'stocker') {
      const s = world.stockers.find(x => x.id === sel.id)
      if (s) {
        p = [s.pos[0], 1, s.pos[2]]
        r = s.size[0] * 0.6
        h = s.size[2] + 1.6
      }
    } else if (sel.kind !== 'zone') {
      p = positionOf(sel)
      r = 0.8
      h = 2.3
    }
    g.current.visible = !!p
    if (!p) return
    g.current.position.set(p[0], 0, p[2])
    const T = clock.elapsedTime
    g.current.children[0].position.y = h + Math.abs(Math.sin(T * 3)) * 0.35
    if (ring.current) {
      ring.current.scale.setScalar(r * (1 + 0.06 * Math.sin(T * 4)))
      ring.current.position.y = sel.kind === 'oht' ? p[1] - 1.6 : 0.05
    }
  })
  const chevron = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.35, 0.35); s.lineTo(0, 0); s.lineTo(0.35, 0.35); s.lineTo(0.35, 0.55); s.lineTo(0, 0.2); s.lineTo(-0.35, 0.55); s.closePath()
    return new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false })
  }, [])
  if (!sel || sel.kind === 'zone') return null
  return (
    <group ref={g}>
      <mesh geometry={chevron} position={[0, 2, -0.04]}>
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1, 48]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

function SiteLayers() {
  const site = useUI(s => s.layers.site)
  const floors = useUI(s => s.layers.floors)
  return (
    <>
      {site && <Landscape />}
      {floors && <LowerFloors />}
    </>
  )
}

/** Left-drag orbits the building, right-drag (or two fingers) pans on the floor, wheel zooms. */
function Controls({ cx }: { cx: number }) {
  const spin = useUI(s => s.spin)
  return (
    <OrbitControls
      makeDefault
      target={[cx, FLOOR_Y, 0]}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      screenSpacePanning={false}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={4}
      maxDistance={420}
      enableDamping
      dampingFactor={0.12}
      autoRotate={spin}
      autoRotateSpeed={0.6}
    />
  )
}

export function Scene() {
  const select = useUI(s => s.select)
  const B = world.L.bounds
  const cx = (B.x0 + B.x1) / 2
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ position: [cx + 36, 84 + FLOOR_Y, 64], fov: 38, near: 0.3, far: 1200 }}
      gl={{ antialias: true }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#ffffff']} />
      <fog attach="fog" args={['#ffffff', 220, 560]} />
      <hemisphereLight args={['#eaf2ff', '#3b4656', 0.8]} />
      {/* procedural fab ceiling (light strips) for reflections in glass and metal */}
      <Environment resolution={256} frames={1} environmentIntensity={0.55}>
        <color attach="background" args={['#1b2433']} />
        {[-60, -36, -12, 12, 36, 60].map(x => (
          <Lightformer key={x} form="rect" intensity={2.2} color="#f4f8ff" position={[x, 12, 0]} rotation-x={Math.PI / 2} scale={[4, 60, 1]} />
        ))}
        <Lightformer form="rect" intensity={0.6} color="#9fc4ff" position={[0, 4, -40]} scale={[200, 8, 1]} />
        <Lightformer form="rect" intensity={0.4} color="#ffffff" position={[0, 4, 40]} rotation-y={Math.PI} scale={[200, 8, 1]} />
      </Environment>
      <directionalLight
        position={[cx + 60, 110, 70]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-125}
        shadow-camera-right={125}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={300}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      >
        <object3D attach="target" position={[cx, 0, 0]} />
      </directionalLight>
      <directionalLight position={[cx - 80, 60, -60]} intensity={0.45} />
      <SimDriver />
      <SiteLayers />
      <group position={[0, FLOOR_Y, 0]}>
        <Building />
        <Equipment />
        <Transport />
        <People />
        <WarRoom />
        <Overlays />
        <SelectionMarker />
      </group>
      <LabelProjector />
      <Controls cx={cx} />
      <CameraRig />
      <OrbitRig />
    </Canvas>
  )
}
