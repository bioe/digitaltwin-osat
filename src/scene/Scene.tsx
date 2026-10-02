import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { BLOCK_IDS, type BlockId } from '../layout/site'
import { useFactory } from '../store/store'
import { ARCH } from '../theme'
import { Building, type BuildingMode } from './Building'
import { CameraRig } from './CameraRig'
import { LabelProjector } from './labels'
import { FabCleanroom, FabUtilityFloor } from './FabFloors'
import { OfficeFloor } from './OfficeFloor'
import { SITE_GOAL } from './positions'
import { SelectionMarker } from './SelectionMarker'
import { Site } from './Site'
import { WarehouseFloor } from './WarehouseFloor'

function Interior({ block, floor }: { block: BlockId; floor: number }) {
  if (block === 'fab') return floor === 2 ? <FabCleanroom /> : <FabUtilityFloor floor={floor as 1 | 3} />
  if (block === 'warehouse') return <WarehouseFloor floor={floor} />
  return <OfficeFloor floor={floor} />
}

function Block({ id }: { id: BlockId }) {
  const view = useFactory(s => s.view)
  const openBlock = useFactory(s => s.openBlock)
  const openFloor = useFactory(s => s.openFloor)
  const focused = view.block === id
  const mode: BuildingMode =
    view.level === 'site' ? 'solid' : !focused ? 'ghost' : view.level === 'block' ? 'stack' : 'cutaway'
  return (
    <Building
      id={id}
      mode={mode}
      activeFloor={focused ? (view.floor ?? undefined) : undefined}
      onBlockClick={() => openBlock(id)}
      onFloorClick={f => openFloor(id, f)}
    >
      {mode === 'cutaway' && view.floor && <Interior block={id} floor={view.floor} />}
    </Building>
  )
}

export function Scene() {
  const select = useFactory(s => s.select)
  return (
    <Canvas
      camera={{ position: SITE_GOAL.pos, fov: 35, near: 1, far: 6000 }}
      dpr={[1, 2]}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={[ARCH.background]} />
      <hemisphereLight args={['#ffffff', '#c3ccd6', 1.6]} />
      <directionalLight position={[300, 600, 250]} intensity={1.6} />
      <directionalLight position={[-400, 300, -200]} intensity={0.5} />
      <Site />
      {BLOCK_IDS.map(id => (
        <Block key={id} id={id} />
      ))}
      <SelectionMarker />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.15} minDistance={12} maxDistance={1800} />
      <CameraRig />
      <LabelProjector />
    </Canvas>
  )
}
