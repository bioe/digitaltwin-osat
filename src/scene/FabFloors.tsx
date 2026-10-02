import { Edges, Instance, Instances, Line } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Matrix4, type InstancedMesh } from 'three'
import {
  BAY_COUNT,
  ENV_CELL,
  FOUP_SPEED,
  TOOL_SIZE,
  TRACK,
  TRACK_HEIGHT,
  envCellLocal,
  toolLocal,
  utilityGrid,
} from '../layout/fab'
import { BAY_NAMES, TOOL_TYPES } from '../sim/model'
import { factoryStore, useFactory, type Overlay } from '../store/store'
import { toWorld } from '../layout/site'
import { ARCH, STATUS_COLOR, heatColor } from '../theme'
import { Label } from './labels'
import { floorY } from './positions'

const m4 = new Matrix4()

const stop = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => {
  e.stopPropagation()
  fn()
}
const pointer = (on: boolean) => (e: ThreeEvent<PointerEvent>) => {
  e.stopPropagation()
  document.body.style.cursor = on ? 'pointer' : 'auto'
}

/** Heat value 0–1 (or > 1 for over-limit) for an env overlay. */
function envHeat(overlay: Overlay, c: { particles: number; tempC: number; humidity: number }): number {
  if (overlay === 'particles') return c.particles / 100
  if (overlay === 'temp') return (c.tempC - 20.5) / 1
  return (c.humidity - 40) / 6
}

function Tools({ overlay }: { overlay: Overlay }) {
  const tools = useFactory(s => s.sim.tools)
  const select = useFactory(s => s.select)
  const neutral = overlay !== 'status'
  return (
    <Instances limit={tools.length}>
      <boxGeometry args={TOOL_SIZE} />
      <meshStandardMaterial />
      {tools.map(t => {
        const [x, z] = toolLocal(t.bay, t.slot)
        return (
          <Instance
            key={t.id}
            position={[x, TOOL_SIZE[1] / 2, z]}
            color={neutral ? '#f1f4f7' : STATUS_COLOR[t.status]}
            onClick={stop(() => select({ kind: 'tool', id: t.id }))}
            onPointerOver={pointer(true)}
            onPointerOut={pointer(false)}
          />
        )
      })}
    </Instances>
  )
}

function Foups() {
  const count = useFactory(s => s.sim.foups.length)
  const select = useFactory(s => s.select)
  const ref = useRef<InstancedMesh>(null)

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const { sim, lastTickAt } = factoryStore.getState()
    const elapsed = Math.min(1.2, (performance.now() - lastTickAt) / 1000)
    sim.foups.forEach((f, i) => {
      const [x, z] = TRACK.at(f.s + FOUP_SPEED * elapsed)
      mesh.setMatrixAt(i, m4.makeTranslation(x, TRACK_HEIGHT - 1, z))
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.instanceId !== undefined) select({ kind: 'foup', index: e.instanceId })
      }}
      onPointerOver={pointer(true)}
      onPointerOut={pointer(false)}
    >
      <boxGeometry args={[2, 1.6, 2]} />
      <meshStandardMaterial color="#475569" />
    </instancedMesh>
  )
}

function Track() {
  const points = useMemo(
    () => [...TRACK.points, TRACK.points[0]].map(([x, z]) => [x, TRACK_HEIGHT, z] as [number, number, number]),
    [],
  )
  return <Line points={points} color="#64748b" lineWidth={2} />
}

function EnvHeatmap({ overlay }: { overlay: Overlay }) {
  const env = useFactory(s => s.sim.env)
  if (overlay === 'status' || overlay === 'none') return null
  return (
    <Instances limit={env.length}>
      <boxGeometry args={[ENV_CELL - 0.6, 0.1, ENV_CELL - 0.6]} />
      <meshBasicMaterial transparent opacity={0.85} />
      {env.map((c, i) => {
        const [x, z] = envCellLocal(i)
        return <Instance key={i} position={[x, 0.06, z]} color={heatColor(envHeat(overlay, c))} />
      })}
    </Instances>
  )
}

function BayLabels() {
  return (
    <group>
      {Array.from({ length: BAY_COUNT }, (_, b) => {
        const [, z] = toolLocal(b, 0)
        return (
          <Label
            key={b}
            id={`bay-${b}`}
            text={BAY_NAMES[TOOL_TYPES[b]]}
            pos={[toWorld('fab', [-136, z])[0], floorY('fab', 2) + 1, toWorld('fab', [-136, z])[1]]}
          />
        )
      })}
    </group>
  )
}

export function FabCleanroom() {
  const overlay = useFactory(s => s.view.overlay)
  return (
    <group>
      <Tools overlay={overlay} />
      <Track />
      <Foups />
      <EnvHeatmap overlay={overlay} />
      <BayLabels />
    </group>
  )
}

/** L1 sub-fab and L3 fan deck: decorative equipment, data lives in the floor panel. */
export function FabUtilityFloor({ floor }: { floor: 1 | 3 }) {
  const grid = useMemo(() => utilityGrid(floor), [floor])
  const size: [number, number, number] = floor === 1 ? [10, 3.5, 12] : [9, 0.8, 9]
  return (
    <group>
      <Instances limit={grid.length}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={floor === 1 ? ARCH.equipment : '#e2e8f0'} />
        {grid.map(([x, z], i) => (
          <Instance key={i} position={[x, size[1] / 2, z]} />
        ))}
      </Instances>
      {floor === 1 && (
        <mesh position={[0, 4.6, 0]}>
          <boxGeometry args={[280, 0.4, 2]} />
          <meshStandardMaterial color={ARCH.band} />
          <Edges color={ARCH.edge} />
        </mesh>
      )}
    </group>
  )
}
