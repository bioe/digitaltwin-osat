/**
 * Depth bias for flat floor decals (zone tints, lines, rings, road paint). Each step pulls the
 * layer a little closer in depth, so stacked coplanar layers never z-fight at any distance.
 */
export function decal(step: number) {
  return { polygonOffset: true, polygonOffsetFactor: -step, polygonOffsetUnits: -step * 4 }
}
