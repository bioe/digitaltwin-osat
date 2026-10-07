import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FLOOR_Y } from '../layout/layout'
import { world } from '../sim/world'
import { reflectHide } from './reflect'

const STOREY = FLOOR_Y / 2

/** Glass mirror shader: soft 5×5 Gaussian blur of the reflection, faded into a tinted glass body. */
const GlassMirrorShader = {
  name: 'GlassMirrorShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    texel: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
    strength: { value: 0.7 },
    body: { value: new THREE.Color('#5d7a8f') },
    /** Pane size (m): width, height. */
    panel: { value: new THREE.Vector2(1.5, 1.8) },
    /** Plane size (m), so the pane grid starts at a corner. */
    planeSize: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vLocal;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vLocal = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform vec3 body;
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform float strength;
    uniform vec2 panel;
    uniform vec2 planeSize;
    varying vec4 vUv;
    varying vec2 vLocal;
    #include <logdepthbuf_pars_fragment>
    float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
    void main() {
      #include <logdepthbuf_fragment>
      // which pane this fragment is on, and where inside it
      vec2 q = ( vLocal + 0.5 * planeSize ) / panel;
      vec2 cell = floor( q );
      vec2 f = fract( q );
      float h1 = hash( cell );
      float h2 = hash( cell + 17.0 );
      // panes are never perfectly flat: shift each pane's reflection a little
      vec2 uv = vUv.xy / vUv.w + ( vec2( h1, h2 ) - 0.5 ) * 0.02;
      vec3 sum = vec3( 0.0 );
      float wsum = 0.0;
      for ( int x = -2; x <= 2; x++ ) {
        for ( int y = -2; y <= 2; y++ ) {
          float w = exp( -float( x * x + y * y ) / 4.5 );
          sum += texture2D( tDiffuse, uv + vec2( float( x ), float( y ) ) * texel * 1.6 ).rgb * w;
          wsum += w;
        }
      }
      vec3 refl = ( sum / wsum ) * color * 1.6;
      vec3 glass = mix( body, refl, strength ) * ( 0.88 + 0.22 * h1 );
      // dark aluminium joint between panes (≈5 cm)
      vec2 edge = min( f, 1.0 - f ) * panel;
      float joint = 1.0 - smoothstep( 0.02, 0.035, min( edge.x, edge.y ) );
      gl_FragColor = vec4( mix( glass, vec3( 0.06, 0.07, 0.09 ), joint ), 1.0 );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}

/** Seen from inside: see-through tinted glass with the same pane grid and dark joints. */
function insideGlass(planeSize: THREE.Vector2) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      tint: { value: new THREE.Color('#5f8196') },
      panel: { value: new THREE.Vector2(1.5, 1.8) },
      planeSize: { value: planeSize },
    },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 tint;
      uniform vec2 panel;
      uniform vec2 planeSize;
      varying vec2 vLocal;
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      void main() {
        vec2 q = ( vLocal + 0.5 * planeSize ) / panel;
        vec2 cell = floor( q );
        vec2 f = fract( q );
        vec2 edge = min( f, 1.0 - f ) * panel;
        float joint = 1.0 - smoothstep( 0.02, 0.035, min( edge.x, edge.y ) );
        // faint sheen toward the top of each pane, slight pane-to-pane variation
        float sheen = smoothstep( 0.4, 1.0, f.y ) * 0.12;
        vec3 glass = tint * ( 0.9 + 0.2 * hash( cell ) ) + sheen;
        vec3 col = mix( glass, vec3( 0.06, 0.07, 0.09 ), joint );
        gl_FragColor = vec4( col, mix( 0.4, 1.0, joint ) );
        #include <colorspace_fragment>
      }`,
  })
}


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

  // exact planar mirrors, one per façade side (L1 + L2 glass share the plane)
  const group = useRef<THREE.Group>(null)
  const mirrors = useMemo(() => {
    const W = B.x1 - B.x0
    const D = B.z1 - B.z0
    const cx = (B.x0 + B.x1) / 2
    const cz = (B.z0 + B.z1) / 2
    const h = FLOOR_Y - 0.6
    const sides: [number, number, number, number][] = [
      [W, cx, B.z1 + 0.07, 0], // south, faces +z
      [W, cx, B.z0 - 0.07, Math.PI], // north
      [D, B.x1 + 0.07, cz, Math.PI / 2], // east
      [D, B.x0 - 0.07, cz, -Math.PI / 2], // west
    ]
    const dpr = Math.min(2, window.devicePixelRatio)
    const tw = Math.round(window.innerWidth * dpr * 0.35)
    const th = Math.round(window.innerHeight * dpr * 0.35)
    return sides.map(([w, x, z, ry]) => {
      const geo = new THREE.PlaneGeometry(w, h)
      const m = new Reflector(geo, { clipBias: 0.003, textureWidth: tw, textureHeight: th, color: 0xa9c6da, shader: GlassMirrorShader })
      const u = (m.material as THREE.ShaderMaterial).uniforms
      u.texel.value = new THREE.Vector2(1 / tw, 1 / th)
      u.planeSize.value = new THREE.Vector2(w, h)
      u.panel.value = new THREE.Vector2(1.5, 1.8)
      m.position.set(x, h / 2, z)
      m.rotation.y = ry
      // the inner face: see-through tinted glass when looking out from inside
      const inner = new THREE.Mesh(geo, insideGlass(new THREE.Vector2(w, h)))
      inner.raycast = () => {}
      m.add(inner)
      return m
    })
  }, [B])
  // performance guard: if the frame rate stays low, drop the mirrors for plain tinted glass (once, no flip-flop)
  const [mirrorsOn, setMirrorsOn] = useState(true)
  const perf = useRef({ t: 0, ema: 60, low: 0 })
  useFrame((_, dt) => {
    if (!mirrorsOn) return
    const p = perf.current
    p.t += dt
    if (p.t < 5 || dt <= 0 || document.hidden || !document.hasFocus()) return // ignore loading and throttled (unfocused) windows
    p.ema += (1 / Math.min(dt, 0.25) - p.ema) * 0.05
    p.low = p.ema < 35 ? p.low + dt : 0
    if (p.low > 3) {
      setMirrorsOn(false)
      console.info(`[UNYSIS] building reflections off (≈${p.ema.toFixed(0)} fps)`)
    }
  })
  const plainGlass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7f9fb4', metalness: 0.6, roughness: 0.12, envMapIntensity: 1.2 }),
    [],
  )

  // the building never reflects itself: hide it (and the level-3 factory) while a mirror renders
  useEffect(() => {
    for (const m of mirrors) {
      const orig = m.onBeforeRender
      m.onBeforeRender = (...args) => {
        const hidden = [group.current, ...reflectHide].filter((o): o is THREE.Object3D => !!o && o.visible)
        for (const o of hidden) o.visible = false
        orig.apply(m, args)
        for (const o of hidden) o.visible = true
      }
    }
  }, [mirrors])

  return (
    <group>
      {mirrorsOn ? (
        mirrors.map((m, i) => <primitive key={i} object={m} />)
      ) : (
        <>
          <mesh geometry={geo.glass} material={plainGlass} />
          <mesh geometry={geo.glass2} material={plainGlass} />
        </>
      )}
      <group ref={group}>
      <mesh geometry={geo.core} receiveShadow>
        <meshStandardMaterial color="#d7dce2" roughness={0.8} />
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
    </group>
  )
}
