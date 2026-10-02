import { Edges, Instance, Instances } from '@react-three/drei'
import { useMemo } from 'react'
import { BLOCKS, BRIDGE_Y, SITE_SIZE } from '../layout/site'
import { ARCH } from '../theme'

const HALF = SITE_SIZE / 2

function Box({ pos, size, color, edges }: { pos: [number, number, number]; size: [number, number, number]; color: string; edges?: boolean }) {
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
      {edges && <Edges color={ARCH.edge} threshold={20} />}
    </mesh>
  )
}

function Roads() {
  const w = 12
  const r = HALF - 6
  const y = 0.03
  return (
    <group>
      <Box pos={[0, y, -r]} size={[2 * r + w, 0.06, w]} color={ARCH.road} />
      <Box pos={[0, y, r]} size={[2 * r + w, 0.06, w]} color={ARCH.road} />
      <Box pos={[-r, y, 0]} size={[w, 0.06, 2 * r]} color={ARCH.road} />
      <Box pos={[r, y, 0]} size={[w, 0.06, 2 * r]} color={ARCH.road} />
      {/* Front access road along the south of the blocks */}
      <Box pos={[0, y, 135]} size={[2 * r, 0.06, 10]} color={ARCH.road} />
      {/* Truck apron at the warehouse docks */}
      <Box pos={[BLOCKS.warehouse.center[0] + 67, y, 0]} size={[14, 0.06, 160]} color={ARCH.road} />
    </group>
  )
}

function Parking() {
  const [x0, z0] = [-230, -175]
  const stalls = useMemo(() => {
    const out: [number, number][] = []
    for (let row = 0; row < 4; row++) for (let i = 0; i < 24; i++) out.push([x0 - 55 + i * 4.8, z0 - 24 + row * 16])
    return out
  }, [x0, z0])
  return (
    <group>
      <Box pos={[x0, 0.02, z0]} size={[124, 0.04, 70]} color="#d3d8de" />
      <Instances limit={stalls.length}>
        <boxGeometry args={[0.2, 0.06, 5]} />
        <meshStandardMaterial color="#ffffff" />
        {stalls.map(([x, z], i) => (
          <Instance key={i} position={[x, 0.06, z]} />
        ))}
      </Instances>
    </group>
  )
}

function UtilityYard() {
  const tanks: [number, number][] = [
    [-80, -170],
    [-60, -170],
    [-40, -170],
    [-20, -170],
  ]
  return (
    <group>
      <Box pos={[20, 0.02, -175]} size={[220, 0.04, 60]} color="#d6dbd2" />
      {tanks.map(([x, z], i) => (
        <mesh key={i} position={[x, 7, z]}>
          <cylinderGeometry args={[6, 6, 14, 24]} />
          <meshStandardMaterial color={ARCH.shell} />
          <Edges color={ARCH.edge} threshold={30} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map(i => (
        <Box key={i} pos={[20 + i * 22, 5, -175]} size={[18, 10, 18]} color={ARCH.equipment} edges />
      ))}
      <Box pos={[115, 4, -175]} size={[24, 8, 30]} color={ARCH.band} edges />
    </group>
  )
}

function Bridges() {
  const { office, fab, warehouse } = BLOCKS
  const spans: [number, number][] = [
    [office.center[0] + office.size[0] / 2, fab.center[0] - fab.size[0] / 2],
    [fab.center[0] + fab.size[0] / 2, warehouse.center[0] - warehouse.size[0] / 2],
  ]
  return (
    <group>
      {spans.map(([a, b], i) => (
        <Box key={i} pos={[(a + b) / 2, BRIDGE_Y + 2, 0]} size={[b - a, 4, 8]} color={ARCH.shell} edges />
      ))}
    </group>
  )
}

function Trees() {
  const trees = useMemo(() => {
    const out: [number, number, number][] = []
    const r = HALF - 32
    for (let i = -r; i <= r; i += 22) {
      out.push([i, 0, -r], [i, 0, r], [-r, 0, i], [r, 0, i])
    }
    for (let x = -250; x <= 250; x += 25) out.push([x, 0, 150])
    const clear = ([x, , z]: [number, number, number]) =>
      Object.values(BLOCKS).every(
        b => Math.abs(x - b.center[0]) > b.size[0] / 2 + 12 || Math.abs(z - b.center[1]) > b.size[1] / 2 + 12,
      )
    return out.filter(clear).map(([x, , z], i) => [x, 3 + ((i * 37) % 7) * 0.3, z] as [number, number, number])
  }, [])
  return (
    <Instances limit={trees.length}>
      <sphereGeometry args={[4, 12, 10]} />
      <meshStandardMaterial color={ARCH.tree} />
      {trees.map((p, i) => (
        <Instance key={i} position={[p[0], p[1] + 2, p[2]]} />
      ))}
    </Instances>
  )
}

export function Site() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color={ARCH.groundOuter} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[SITE_SIZE, SITE_SIZE]} />
        <meshStandardMaterial color={ARCH.ground} />
      </mesh>
      <Roads />
      <Parking />
      <UtilityYard />
      <Bridges />
      <Trees />
    </group>
  )
}
