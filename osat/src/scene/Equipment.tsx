import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { world, type Tool } from '../sim/world'
import { useUI } from '../store'
import { Instanced, setPose } from './Instanced'
import { STATUS } from './materials'
import { decal } from './decal'
import { hullOf } from './hull'

const AI_COLOR = new THREE.Color('#fbbf24')

function ToolGroup({ model, tools }: { model: string; tools: Tool[] }) {
  const select = useUI(s => s.select)
  const mats = useMemo(() => tools.map(t => setPose(new THREE.Matrix4(), t.pos[0], 0, t.pos[2], t.rotY)), [tools])
  return (
    <Instanced
      model={model}
      capacity={tools.length}
      fill={(i, inst) => {
        const t = tools[i]
        inst.m.copy(mats[i])
        inst.state = t.state
        inst.t = t.activeT
        inst.phase = t.phase
        if (t.anim) inst.u = t.anim
      }}
      onPick={i => select({ kind: 'tool', id: tools[i].id })}
    />
  )
}

/** Glowing footprint outline + soft fill under every tool, coloured by state. */
function StatusPads({ tools }: { tools: Tool[] }) {
  const ring = useRef<THREE.InstancedMesh>(null)
  const fill = useRef<THREE.InstancedMesh>(null)
  const ringGeo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.lineTo(-0.5, 0.5); s.closePath()
    const h = new THREE.Path()
    const k = 0.47
    h.moveTo(-k, -k); h.lineTo(-k, k); h.lineTo(k, k); h.lineTo(k, -k); h.closePath()
    s.holes.push(h)
    const g = new THREE.ShapeGeometry(s)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const fillGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  const obj = useMemo(() => new THREE.Object3D(), [])
  const c = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const T = clock.elapsedTime
    const L = useUI.getState().layers
    tools.forEach((t, i) => {
      const ai = !!t.alarm?.ai
      const show = ai ? L.ai : t.state === 'run' ? L.run : t.state === 'idle' ? L.idle : L.down
      obj.position.set(t.pos[0], 0.025, t.pos[2])
      obj.rotation.set(0, t.rotY, 0)
      obj.scale.set(show ? t.size[0] + 0.5 : 0, 1, show ? t.size[1] + 0.5 : 0)
      obj.updateMatrix()
      ring.current?.setMatrixAt(i, obj.matrix)
      fill.current?.setMatrixAt(i, obj.matrix)
      c.copy(ai ? AI_COLOR : STATUS[t.state])
      if (t.state === 'alarm') c.multiplyScalar(0.55 + 0.45 * Math.abs(Math.sin(T * 4)))
      ring.current?.setColorAt(i, c)
      fill.current?.setColorAt(i, c)
    })
    for (const m of [ring.current, fill.current]) {
      if (!m) continue
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })
  return (
    <group>
      <instancedMesh ref={ring} args={[ringGeo, undefined, tools.length]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} {...decal(4)} />
      </instancedMesh>
      <instancedMesh ref={fill} args={[fillGeo, undefined, tools.length]} frustumCulled={false} raycast={() => null}>
        <meshBasicMaterial transparent opacity={0.16} depthWrite={false} toneMapped={false} {...decal(3)} />
      </instancedMesh>
    </group>
  )
}

export function Equipment() {
  const groups = useMemo(() => {
    const m = new Map<string, Tool[]>()
    for (const t of world.tools) {
      if (!m.has(t.model)) m.set(t.model, [])
      m.get(t.model)!.push(t)
    }
    return [...m.entries()]
  }, [])
  return (
    <group>
      {groups.map(([model, tools]) => (
        <ToolGroup key={model} model={model} tools={tools} />
      ))}
      <StatusPads tools={world.tools} />
      {groups.map(([model, tools]) => (
        <AlarmHalo key={`halo-${model}`} model={model} tools={tools} />
      ))}
      <Stockers />
    </group>
  )
}

function Stockers() {
  const select = useUI(s => s.select)
  const groups = useMemo(() => {
    const m = new Map<string, typeof world.stockers>()
    for (const s of world.stockers) {
      if (!m.has(s.model)) m.set(s.model, [])
      m.get(s.model)!.push(s)
    }
    return [...m.entries()]
  }, [])
  return (
    <group>
      {groups.map(([model, list]) => {
        const mats = list.map(s => setPose(new THREE.Matrix4(), s.pos[0], 0, s.pos[2], s.rotY))
        return (
          <Instanced
            key={model}
            model={model}
            capacity={list.length}
            fill={(i, inst) => {
              const s = list[i]
              inst.m.copy(mats[i])
              const fullness = (s.lots.length + s.reserved) / s.capacity
              inst.state = fullness > 0.92 ? 'alarm' : s.lots.length === 0 ? 'idle' : 'run'
              inst.t = s.activeT
              inst.phase = i * 0.37
              inst.u = [s.crane.x, s.crane.y]
            }}
            onPick={i => select({ kind: 'stocker', id: list[i].id })}
          />
        )
      })}
    </group>
  )
}

/** Inverted-hull outline + pulsing glow shell around every machine that is in alarm (red) or AI recovery (amber). */
function AlarmHalo({ model, tools }: { model: string; tools: Tool[] }) {
  const hull = useMemo(() => hullOf(model), [model])
  const line = useRef<THREE.InstancedMesh>(null)
  const glow = useRef<THREE.InstancedMesh>(null)
  const obj = useMemo(() => new THREE.Object3D(), [])
  const red = useMemo(() => new THREE.Color('#ff2a3d'), [])
  const amber = useMemo(() => new THREE.Color('#fbbf24'), [])
  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5)
    let n = 0
    for (const t of tools) {
      if (!t.alarm) continue
      const c = t.alarm.ai ? amber : red
      for (const [ref, th] of [[line, 0.035], [glow, 0.16 + pulse * 0.08]] as const) {
        const m = ref.current
        if (!m) continue
        obj.position.set(t.pos[0], -th * 0.5, t.pos[2])
        obj.rotation.set(0, t.rotY, 0)
        obj.scale.set(1 + (2 * th) / t.size[0], 1 + th / t.size[2], 1 + (2 * th) / t.size[1])
        obj.updateMatrix()
        m.setMatrixAt(n, obj.matrix)
        m.setColorAt(n, c)
      }
      n++
    }
    for (const m of [line.current, glow.current]) {
      if (!m) continue
      m.count = n
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + pulse * 0.22
  })
  return (
    <group>
      <instancedMesh ref={line} args={[hull, undefined, tools.length]} frustumCulled={false} raycast={() => null}>
        <meshBasicMaterial side={THREE.BackSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glow} args={[hull, undefined, tools.length]} frustumCulled={false} raycast={() => null}>
        <meshBasicMaterial side={THREE.BackSide} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
