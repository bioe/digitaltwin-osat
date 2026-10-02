import { Edges } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState, type ReactNode } from 'react'
import { BLOCKS, floorBase, type BlockId } from '../layout/site'
import { ARCH } from '../theme'
import { Label } from './labels'
import { SLAB, explodeGap } from './positions'

export type BuildingMode = 'solid' | 'stack' | 'cutaway' | 'ghost'

interface Props {
  id: BlockId
  mode: BuildingMode
  activeFloor?: number
  onBlockClick?: () => void
  onFloorClick?: (floor: number) => void
  /** Interior of the active floor, in block-local coords with y = 0 at the floor surface. */
  children?: ReactNode
}

const hoverOn = (e: ThreeEvent<PointerEvent>) => {
  e.stopPropagation()
  document.body.style.cursor = 'pointer'
}
const hoverOff = () => {
  document.body.style.cursor = 'auto'
}

function Shell({ w, d, h, opacity, highlight }: { w: number; d: number; h: number; opacity: number; highlight?: boolean }) {
  const transparent = opacity < 1
  const bandH = Math.min(1.8, h * 0.3)
  return (
    <group>
      <mesh position={[0, SLAB + (h - SLAB) / 2, 0]}>
        <boxGeometry args={[w - 0.4, h - SLAB, d - 0.4]} />
        <meshStandardMaterial
          color={highlight ? '#dbe7ff' : ARCH.shell}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
        />
        <Edges color={ARCH.edge} threshold={20} />
      </mesh>
      <mesh position={[0, h * 0.55, 0]}>
        <boxGeometry args={[w, bandH, d]} />
        <meshStandardMaterial color={ARCH.band} transparent={transparent} opacity={opacity} depthWrite={!transparent} />
      </mesh>
    </group>
  )
}

function Parapet({ w, d }: { w: number; d: number }) {
  const h = 1.2
  const t = 0.4
  const walls: [number, number, number, number][] = [
    [0, -d / 2, w, t],
    [0, d / 2, w, t],
    [-w / 2, 0, t, d],
    [w / 2, 0, t, d],
  ]
  return (
    <group>
      {walls.map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, SLAB + h / 2, z]}>
          <boxGeometry args={[sx, h, sz]} />
          <meshStandardMaterial color={ARCH.shell} />
        </mesh>
      ))}
    </group>
  )
}

function Roof({ id, w, d, y }: { id: BlockId; w: number; d: number; y: number }) {
  const units: [number, number][] = []
  const nx = Math.max(2, Math.floor(w / 40))
  const nz = Math.max(2, Math.floor(d / 40))
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) units.push([(i - (nx - 1) / 2) * (w / nx), (j - (nz - 1) / 2) * (d / nz)])
  const unit = id === 'fab' ? [14, 3, 8] : [6, 2, 5]
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[w + 0.6, 0.5, d + 0.6]} />
        <meshStandardMaterial color={ARCH.slab} />
        <Edges color={ARCH.edge} threshold={20} />
      </mesh>
      {units.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5 + unit[1] / 2, z]}>
          <boxGeometry args={unit as [number, number, number]} />
          <meshStandardMaterial color={ARCH.equipment} />
          <Edges color={ARCH.edge} threshold={20} />
        </mesh>
      ))}
    </group>
  )
}

export function Building({ id, mode, activeFloor, onBlockClick, onFloorClick, children }: Props) {
  const def = BLOCKS[id]
  const [w, d] = def.size
  const [hovered, setHovered] = useState<number | null>(null)
  const totalH = def.floorHeights.reduce((a, b) => a + b, 0)
  const clickable = mode === 'solid' || mode === 'ghost'

  return (
    <group position={[def.center[0], 0, def.center[1]]}>
      <group
        onClick={
          clickable
            ? e => {
                e.stopPropagation()
                onBlockClick?.()
              }
            : undefined
        }
        onPointerOver={clickable ? hoverOn : undefined}
        onPointerOut={clickable ? hoverOff : undefined}
      >
        {def.floorHeights.map((h, i) => {
          const f = i + 1
          if (mode === 'cutaway' && activeFloor && f > activeFloor) return null
          const base = floorBase(id, f) + (mode === 'stack' ? (f - 1) * explodeGap(id) : 0)
          const active = mode === 'cutaway' && f === activeFloor
          const opacity = mode === 'ghost' ? 0.16 : mode === 'stack' ? (hovered === f ? 0.85 : 0.5) : 1
          return (
            <group key={f} position={[0, base, 0]}>
              <mesh position={[0, SLAB / 2, 0]}>
                <boxGeometry args={[w + 0.4, SLAB, d + 0.4]} />
                <meshStandardMaterial
                  color={active ? ARCH.floor : ARCH.slab}
                  transparent={mode === 'ghost'}
                  opacity={mode === 'ghost' ? 0.3 : 1}
                />
              </mesh>
              {active ? (
                <Parapet w={w} d={d} />
              ) : (
                <group
                  onClick={
                    mode === 'stack'
                      ? e => {
                          e.stopPropagation()
                          onFloorClick?.(f)
                        }
                      : undefined
                  }
                  onPointerOver={
                    mode === 'stack'
                      ? e => {
                          hoverOn(e)
                          setHovered(f)
                        }
                      : undefined
                  }
                  onPointerOut={
                    mode === 'stack'
                      ? () => {
                          hoverOff()
                          setHovered(null)
                        }
                      : undefined
                  }
                >
                  <Shell w={w} d={d} h={h} opacity={opacity} highlight={mode === 'stack' && hovered === f} />
                </group>
              )}
              {mode === 'stack' && (
                <Label
                  id={`floor-${id}-${f}`}
                  text={`L${f} · ${def.floorNames[i]}`}
                  pos={[def.center[0] + w / 2 + 6, base + h / 2, def.center[1] + d / 2]}
                  variant={hovered === f ? 'button-active' : 'button'}
                  onClick={() => onFloorClick?.(f)}
                  onHover={on => setHovered(on ? f : null)}
                />
              )}
            </group>
          )
        })}
        {mode === 'solid' && <Roof id={id} w={w} d={d} y={totalH} />}
      </group>
      {mode === 'cutaway' && activeFloor && (
        <group position={[0, floorBase(id, activeFloor) + SLAB, 0]}>{children}</group>
      )}
    </group>
  )
}
