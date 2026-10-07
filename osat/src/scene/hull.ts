import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bake } from '../models/dsl'
import { MODELS } from '../models'

const cache = new Map<string, THREE.BufferGeometry>()

/** Whole-model silhouette: static parts plus animated parts in their rest pose, merged. */
export function hullOf(model: string): THREE.BufferGeometry {
  let g = cache.get(model)
  if (g) return g
  const b = bake(MODELS[model])
  const parts = [...b.byMat.values()].map(x => x.clone())
  const rest = b.anims.map(() => new THREE.Matrix4())
  b.anims.forEach((a, i) => {
    rest[i].copy(a.pivot)
    if (a.parent >= 0) rest[i].premultiply(rest[a.parent])
    for (const geo of a.byMat.values()) parts.push(geo.clone().applyMatrix4(rest[i]))
  })
  g = mergeGeometries(parts)!
  g.computeBoundingBox()
  cache.set(model, g)
  return g
}
