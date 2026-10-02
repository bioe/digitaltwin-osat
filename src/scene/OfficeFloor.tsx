import { Edges, Instance, Instances } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import {
  BOARD_FLOOR,
  BOARD_QUAD,
  BOARD_SCREEN_LOCAL,
  DESKS_PER_ZONE,
  DESK_SIZE,
  QUAD_SIZE,
  deskLocal,
  meetingRoomLocal,
  quadLocal,
} from '../layout/office'
import type { Kpis, OfficeZone } from '../sim/model'
import { useFactory, type Overlay } from '../store/store'
import { ALARM, ARCH, OK, heatColor } from '../theme'

const pointer = (on: boolean) => (e: ThreeEvent<PointerEvent>) => {
  e.stopPropagation()
  document.body.style.cursor = on ? 'pointer' : 'auto'
}

/** Fixed pseudo-random seat order so the same desks stay occupied between ticks. */
const SEAT_ORDER = Array.from({ length: DESKS_PER_ZONE }, (_, i) => i).sort(
  (a, b) => ((a * 7919) % 53) - ((b * 7919) % 53),
)
const SEAT_RANK = SEAT_ORDER.reduce<number[]>((acc, desk, rank) => ((acc[desk] = rank), acc), [])

function zoneHeat(overlay: Overlay, z: OfficeZone): number | null {
  if (overlay === 'energy') return z.kw / 120
  if (overlay === 'officeTemp') return (z.tempC - 21) / 5
  return null
}

function Zone({ zone, overlay }: { zone: OfficeZone; overlay: Overlay }) {
  const select = useFactory(s => s.select)
  const [x, z] = quadLocal(zone.quad)
  const heat = zoneHeat(overlay, zone)
  return (
    <mesh
      position={[x, 0.04, z]}
      onClick={e => {
        e.stopPropagation()
        select({ kind: 'zone', id: zone.id })
      }}
      onPointerOver={pointer(true)}
      onPointerOut={pointer(false)}
    >
      <boxGeometry args={[QUAD_SIZE - 1, 0.08, QUAD_SIZE - 1]} />
      <meshStandardMaterial color={heat === null ? '#f8fafc' : heatColor(heat)} />
      <Edges color={ARCH.edge} />
    </mesh>
  )
}

function Desks({ zones, overlay }: { zones: OfficeZone[]; overlay: Overlay }) {
  const deskZones = zones.filter(z => z.kind === 'desks')
  const desks = useMemo(
    () => deskZones.flatMap(z => Array.from({ length: DESKS_PER_ZONE }, (_, i) => ({ zone: z, i }))),
    [deskZones],
  )
  return (
    <Instances limit={Math.max(1, desks.length)}>
      <boxGeometry args={DESK_SIZE} />
      <meshStandardMaterial />
      {desks.map(({ zone, i }) => {
        const [x, z] = deskLocal(zone.quad, i)
        const used = SEAT_RANK[i] < zone.occupied
        const color = overlay === 'occupancy' ? (used ? OK : '#cbd5e1') : '#e2e8f0'
        return <Instance key={`${zone.id}-${i}`} position={[x, 0.08 + DESK_SIZE[1] / 2, z]} color={color} />
      })}
    </Instances>
  )
}

function MeetingRooms({ zone, overlay }: { zone: OfficeZone; overlay: Overlay }) {
  const busy = Math.round((zone.occupied / zone.capacity) * 4)
  return (
    <group>
      {[0, 1, 2, 3].map(r => {
        const [x, z] = meetingRoomLocal(zone.quad, r)
        const used = r < busy
        return (
          <group key={r} position={[x, 0, z]}>
            <mesh position={[0, 1.4, 0]}>
              <boxGeometry args={[17, 2.6, 17]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.25} depthWrite={false} />
              <Edges color={ARCH.edge} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[8, 0.8, 3]} />
              <meshStandardMaterial color={overlay === 'occupancy' && used ? OK : '#e2e8f0'} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Draw the board screen onto a canvas used as the screen texture. */
function drawBoard(ctx: CanvasRenderingContext2D, kpi: Kpis, alarms: number) {
  const { width: w, height: h } = ctx.canvas
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 34px Inter, system-ui, sans-serif'
  ctx.fillText('SITE KPI BOARD', 40, 64)
  const cells: [string, string, string?][] = [
    ['Output', `${kpi.wafersOutPerHour.toFixed(0)} wfr/h`],
    ['Line yield', `${kpi.yield.toFixed(1)}%`],
    ['Fab OEE', `${kpi.oee.toFixed(1)}%`],
    ['Energy', `${kpi.energyMw.toFixed(1)} MW`],
    ['Occupancy', `${kpi.officeOccupancy.toFixed(0)}%`],
    ['Alarms', String(alarms), alarms ? ALARM : undefined],
  ]
  cells.forEach(([label, value, color], i) => {
    const x = 40 + (i % 3) * 330
    const y = 150 + Math.floor(i / 3) * 170
    ctx.fillStyle = '#94a3b8'
    ctx.font = '400 30px Inter, system-ui, sans-serif'
    ctx.fillText(label, x, y)
    ctx.fillStyle = color ?? '#ffffff'
    ctx.font = '600 58px Inter, system-ui, sans-serif'
    ctx.fillText(value, x, y + 66)
  })
}

function KpiBoard() {
  const kpi = useFactory(s => s.sim.kpi)
  const alarms = useFactory(s => s.alarms.length)
  const select = useFactory(s => s.select)
  const [bx, bz] = quadLocal(BOARD_QUAD)
  const [sx, sz] = BOARD_SCREEN_LOCAL
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => {
    drawBoard((texture.image as HTMLCanvasElement).getContext('2d')!, kpi, alarms)
    texture.needsUpdate = true
  }, [texture, kpi, alarms])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <group>
      <mesh position={[bx - 2, 0.5, bz]}>
        <boxGeometry args={[18, 0.8, 6]} />
        <meshStandardMaterial color="#e2e8f0" />
        <Edges color={ARCH.edge} />
      </mesh>
      <mesh
        position={[sx, 3, sz]}
        onClick={e => {
          e.stopPropagation()
          select({ kind: 'kpiBoard' })
        }}
        onPointerOver={pointer(true)}
        onPointerOut={pointer(false)}
      >
        <boxGeometry args={[0.4, 6, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[sx - 0.21, 3, sz]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[11.6, 5.8]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function OfficeFloor({ floor }: { floor: number }) {
  const allZones = useFactory(s => s.sim.office)
  const overlay = useFactory(s => s.view.overlay)
  const zones = useMemo(() => allZones.filter(z => z.floor === floor), [allZones, floor])
  return (
    <group>
      {zones.map(z => (
        <Zone key={z.id} zone={z} overlay={overlay} />
      ))}
      <Desks zones={zones} overlay={overlay} />
      {zones
        .filter(z => z.kind === 'meeting')
        .map(z => (
          <MeetingRooms key={z.id} zone={z} overlay={overlay} />
        ))}
      {floor === BOARD_FLOOR && <KpiBoard />}
    </group>
  )
}
