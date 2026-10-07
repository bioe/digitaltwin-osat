import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { world } from '../sim/world'
import { decal } from './decal'
import { Instanced } from './Instanced'

const q = new THREE.Quaternion()
const up = new THREE.Vector3(0, 1, 0)
function pose(x: number, z: number, rot: number, s = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.clone().setFromAxisAngle(up, rot), new THREE.Vector3(s, s, s))
}

function flat(w: number, d: number, x: number, z: number, y: number) {
  const g = new THREE.PlaneGeometry(w, d)
  g.rotateX(-Math.PI / 2)
  g.translate(x, y, z)
  return g
}

/** Calm site: lawn, paved apron, one access road with a small car park, a tree line. */
export function Landscape() {
  const B = world.L.bounds
  const cx = (B.x0 + B.x1) / 2
  const APRON = 6

  const routes = world.truckRoutes
  const site = useMemo(() => {
    const pz = B.z1 + APRON + 6 // car park north edge
    const park = { x0: cx - 22, x1: cx + 22, z0: pz, z1: pz + 13 }
    const apron = flat(B.x1 - B.x0 + APRON * 2, B.z1 - B.z0 + APRON * 2, cx, (B.z0 + B.z1) / 2, 0.004)
    const road = mergeGeometries([
      flat(park.x1 - park.x0, park.z1 - park.z0, cx, (park.z0 + park.z1) / 2, 0.008),
      flat(7, 6, cx, B.z1 + APRON + 3, 0.008),
      flat(7, 140, park.x1 + 3.5, park.z1 + 70 - 6.5, 0.008),
      // service road along the back (north) and down the west side to the freight-lift truck yard
      flat(B.x1 + 220 - (B.x0 - 23.5), 7, (B.x0 - 23.5 + B.x1 + 220) / 2, routes.zr, 0.008),
      flat(7, routes.liftZ + 16 - routes.zr, routes.xr, (routes.zr + routes.liftZ + 16) / 2, 0.008),
      flat(routes.liftX - 1.6 - routes.xr, 12, (routes.xr + routes.liftX - 1.6) / 2, routes.liftZ, 0.008),
    ])!
    const marks: THREE.BufferGeometry[] = []
    const stalls: { x: number; z: number; rot: number }[] = []
    for (const [z, rot] of [[park.z0 + 2.5, Math.PI], [park.z1 - 2.5, 0]] as const) {
      for (let x = park.x0 + 1.5; x < park.x1 - 1; x += 2.6) {
        marks.push(flat(0.12, 5, x - 1.3, z, 0.012))
        stalls.push({ x, z, rot })
      }
    }
    return { park, apron, road, marks: mergeGeometries(marks)!, stalls }
  }, [B, cx, routes])

  const items = useMemo(() => {
    const trees: THREE.Matrix4[] = []
    const shrubs: THREE.Matrix4[] = []
    // one clean row of rain trees north and south of the building, wide spacing
    for (let x = B.x0 + 6; x <= B.x1 - 6; x += 22) {
      trees.push(pose(x, B.z0 - 28, x, 0.85)) // north of the service road
      if (x < site.park.x0 - 8 || x > site.park.x1 + 8) trees.push(pose(x, B.z1 + APRON + 9, x, 0.85))
    }
    // low planting along the south apron edge
    for (let x = B.x0; x <= B.x1; x += 6) if (Math.abs(x - cx) > 6) shrubs.push(pose(x, B.z1 + APRON + 1.2, x, 0.9))
    // cars: about half the stalls
    const cars: THREE.Matrix4[][] = [[], []]
    site.stalls.forEach((s, i) => {
      if (i % 3 === 1) return
      cars[i % 4 === 0 ? 1 : 0].push(pose(s.x, s.z, s.rot))
    })
    return { trees, shrubs, cars }
  }, [B, cx, site])

  const inst = (model: string, list: THREE.Matrix4[]) => (
    <Instanced key={model} model={model} capacity={list.length} fill={(i, x) => x.m.copy(list[i])} />
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, 0]} receiveShadow>
        <circleGeometry args={[900, 64]} />
        <meshStandardMaterial color="#c4dbb0" roughness={1} />
      </mesh>
      <mesh geometry={site.apron} receiveShadow>
        <meshStandardMaterial color="#e6e8eb" roughness={0.9} {...decal(1)} />
      </mesh>
      <mesh geometry={site.road} receiveShadow>
        <meshStandardMaterial color="#8a9099" roughness={0.95} {...decal(2)} />
      </mesh>
      <mesh geometry={site.marks}>
        <meshBasicMaterial color="#ffffff" {...decal(3)} />
      </mesh>
      {inst('rainTree', items.trees)}
      {inst('shrub', items.shrubs)}
      {inst('carWhite', items.cars[0])}
      {inst('carGrey', items.cars[1])}
    </group>
  )
}
