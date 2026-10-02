import { Edges, Instance, Instances } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { AGV_SPEED, DOOR_COUNT, RACK_SIZE, agvRoute, doorLocal, rackLocal } from '../layout/warehouse'
import { REORDER_FRACTION, type Agv } from '../sim/model'
import { factoryStore, useFactory } from '../store/store'
import { ARCH, WARN, heatColor } from '../theme'

const pointer = (on: boolean) => (e: ThreeEvent<PointerEvent>) => {
  e.stopPropagation()
  document.body.style.cursor = on ? 'pointer' : 'auto'
}

function Racks({ floor }: { floor: number }) {
  const racks = useFactory(s => s.sim.racks)
  const select = useFactory(s => s.select)
  const onFloor = racks.filter(r => r.floor === floor)
  return (
    <Instances limit={onFloor.length}>
      <boxGeometry args={RACK_SIZE} />
      <meshStandardMaterial />
      {onFloor.map(r => {
        const [x, z] = rackLocal(r.row, r.col)
        const fill = r.stock / r.capacity
        return (
          <Instance
            key={r.id}
            position={[x, RACK_SIZE[1] / 2, z]}
            color={fill < REORDER_FRACTION ? WARN : heatColor(fill)}
            onClick={e => {
              e.stopPropagation()
              select({ kind: 'rack', id: r.id })
            }}
            onPointerOver={pointer(true)}
            onPointerOut={pointer(false)}
          />
        )
      })}
    </Instances>
  )
}

function Docks() {
  return (
    <group>
      {Array.from({ length: DOOR_COUNT }, (_, i) => {
        const [x, z] = doorLocal(i)
        return (
          <mesh key={i} position={[x - 0.3, 2.2, z]}>
            <boxGeometry args={[0.6, 4.4, 8]} />
            <meshStandardMaterial color={ARCH.band} />
            <Edges color={ARCH.edge} />
          </mesh>
        )
      })}
    </group>
  )
}

function AgvMesh({ agv }: { agv: Agv }) {
  const ref = useRef<Group>(null)
  const select = useFactory(s => s.select)

  useFrame(() => {
    const g = ref.current
    if (!g) return
    const { sim, lastTickAt } = factoryStore.getState()
    const v = sim.agvs[agv.index]
    const elapsed = Math.min(1.2, (performance.now() - lastTickAt) / 1000)
    const route = agvRoute(v.index, v.row, v.col)
    const s = v.charging ? v.s : v.s + v.dir * AGV_SPEED * elapsed
    const [x, z] = route.at(s)
    const [dx, dz] = route.dirAt(s)
    g.position.set(x, 0.6, z)
    g.rotation.y = Math.atan2(dx * v.dir, dz * v.dir)
  })

  return (
    <group
      ref={ref}
      onClick={e => {
        e.stopPropagation()
        select({ kind: 'agv', id: agv.id })
      }}
      onPointerOver={pointer(true)}
      onPointerOut={pointer(false)}
    >
      <mesh>
        <boxGeometry args={[2.2, 1.2, 3.2]} />
        <meshStandardMaterial color={agv.charging ? WARN : '#f8fafc'} />
        <Edges color="#334155" />
      </mesh>
      <mesh position={[0, 0.9, 0.6]}>
        <boxGeometry args={[1.6, 0.6, 1.4]} />
        <meshStandardMaterial color={ARCH.accent} />
      </mesh>
    </group>
  )
}

export function WarehouseFloor({ floor }: { floor: number }) {
  const agvs = useFactory(s => s.sim.agvs)
  return (
    <group>
      <Racks floor={floor} />
      {floor === 1 && (
        <>
          <Docks />
          {/* Staging lane */}
          <mesh position={[47, 0.03, 0]}>
            <boxGeometry args={[18, 0.04, 140]} />
            <meshStandardMaterial color="#e5e9ee" />
          </mesh>
          {agvs.map(v => (
            <AgvMesh key={v.id} agv={v} />
          ))}
        </>
      )}
    </group>
  )
}
