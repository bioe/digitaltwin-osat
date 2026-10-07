import type { ModelDef } from './dsl'

/** Fiddle-leaf fig in a matte black pot, ~1.9 m. */
export const pottedFig: ModelDef = {
  key: 'pottedFig',
  name: 'Fiddle-leaf fig',
  size: [0.9, 0.9, 1.9],
  build(b) {
    b.cyl('terracotta', 0.26, 0.5, [0, 0.25, 0], { rTop: 0.3, seg: 16 })
    b.cyl('bark', 0.03, 0.9, [0, 0.9, 0], { seg: 6 })
    const leaves: [number, number, number, number][] = [
      [0, 1.55, 0, 0.42], [0.22, 1.3, 0.1, 0.32], [-0.2, 1.35, -0.12, 0.34], [0.05, 1.12, -0.22, 0.28], [-0.1, 1.75, 0.12, 0.3],
    ]
    leaves.forEach(([x, y, z, r], i) => b.sphere(i % 2 ? 'leaf' : 'leaf2', r, [x, y, z], { seg: 8 }))
  },
}

/** Monstera in a low planter, ~1 m. */
export const pottedMonstera: ModelDef = {
  key: 'pottedMonstera',
  name: 'Monstera',
  size: [1.2, 1.2, 1.05],
  build(b) {
    b.cyl('terracotta', 0.3, 0.38, [0, 0.19, 0], { rTop: 0.32, seg: 16 })
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2
      b.group([0, 0.4, 0], [0, a, 0], g => {
        g.cyl('leaf', 0.012, 0.45, [0, 0.2, 0.12], { rot: [0.5, 0, 0], seg: 4 })
        g.cyl(k % 2 ? 'leaf' : 'leaf2', 0.2, 0.02, [0, 0.42 + (k % 3) * 0.08, 0.32], { rot: [0.5, 0, 0], seg: 12 })
      })
    }
  },
}

/** Three-seat leather sofa with black steel legs. Front (seat side) = +Z. */
export const sofa: ModelDef = {
  key: 'sofa',
  name: 'Leather sofa',
  size: [2.2, 0.9, 0.82],
  build(b) {
    for (const x of [-1.0, 1.0]) for (const z of [-0.35, 0.35]) b.boxB('black', [0.04, 0.12, 0.04], [x, 0, z])
    b.boxB('leather', [2.2, 0.22, 0.88], [0, 0.12, 0], { r: 0.06 })
    for (const x of [-0.68, 0, 0.68]) b.boxB('leather', [0.66, 0.12, 0.66], [x, 0.34, 0.08], { r: 0.05 })
    b.boxB('leather', [2.2, 0.42, 0.2], [0, 0.34, -0.34], { r: 0.08 })
    for (const x of [-1.03, 1.03]) b.boxB('leather', [0.16, 0.26, 0.86], [x, 0.34, 0], { r: 0.06 })
  },
}

/** Oak slab coffee table on black hairpin legs. */
export const coffeeTable: ModelDef = {
  key: 'coffeeTable',
  name: 'Coffee table',
  size: [1.2, 0.6, 0.42],
  build(b) {
    for (const x of [-0.5, 0.5]) for (const z of [-0.22, 0.22]) b.cyl('black', 0.012, 0.38, [x, 0.19, z], { seg: 6 })
    b.boxB('oak', [1.2, 0.05, 0.6], [0, 0.38, 0], { r: 0.015 })
    b.boxB('dark', [0.25, 0.04, 0.18], [0.25, 0.43, 0.05], { r: 0.01 })
    b.cyl('white', 0.04, 0.09, [-0.3, 0.475, -0.05], { seg: 10 })
  },
}

/** Rug (flat, woven). */
export const rug: ModelDef = {
  key: 'rug',
  name: 'Rug',
  size: [3, 2, 0.01],
  build(b) {
    b.boxB('fabric', [3, 0.01, 2], [0, 0, 0])
    b.boxB('bodyAlt', [2.6, 0.012, 0.06], [0, 0, 0.8])
    b.boxB('bodyAlt', [2.6, 0.012, 0.06], [0, 0, -0.8])
  },
}

/** Edison pendant: black cone shade on a long cord. Origin = ceiling point. */
export const pendantLamp: ModelDef = {
  key: 'pendantLamp',
  name: 'Pendant lamp',
  size: [0.4, 0.4, 1.4],
  build(b) {
    b.cyl('black', 0.006, 1.1, [0, -0.55, 0], { seg: 4 })
    b.cyl('black', 0.05, 0.08, [0, -1.12, 0], { seg: 10 })
    b.cyl('black', 0.2, 0.22, [0, -1.27, 0], { rTop: 0.05, open: true, seg: 20 })
    b.sphere('warmLight', 0.065, [0, -1.33, 0], { seg: 10 })
  },
}

/** Stand-up meeting table (oak top, black steel frame) with two bar stools. */
export const highTable: ModelDef = {
  key: 'highTable',
  name: 'Stand-up table',
  size: [1.8, 1.4, 1.05],
  build(b) {
    for (const x of [-0.75, 0.75]) {
      b.boxB('black', [0.05, 1.0, 0.05], [x, 0, 0])
      b.boxB('black', [0.05, 0.05, 0.6], [x, 0, 0])
    }
    b.boxB('black', [1.5, 0.05, 0.05], [0, 0.3, 0])
    b.boxB('oak', [1.8, 0.05, 0.8], [0, 1.0, 0], { r: 0.015 })
    b.box('dark', [0.32, 0.01, 0.22], [-0.3, 1.06, 0.1])
    for (const z of [-0.6, 0.6]) {
      b.cyl('black', 0.015, 0.72, [0.3, 0.36, z], { seg: 6 })
      b.cyl('black', 0.18, 0.02, [0.3, 0.02, z], { seg: 12 })
      b.cyl('leather', 0.18, 0.06, [0.3, 0.75, z], { seg: 14 })
    }
  },
}
