import type { ModelDef } from './dsl'

/** Rain tree (Samanea saman): short trunk, wide umbrella canopy. ~9 m tall, ~12 m crown. */
export const rainTree: ModelDef = {
  key: 'rainTree',
  name: 'Rain tree',
  size: [12, 12, 9],
  build(b) {
    b.cyl('bark', 0.32, 3.4, [0, 1.7, 0], { rTop: 0.24, seg: 10 })
    for (const [a, l] of [[0.4, 2.6], [2.5, 2.4], [4.4, 2.8]] as const) {
      b.cyl('bark', 0.16, l, [Math.cos(a) * 0.8, 4.1, Math.sin(a) * 0.8], { rTop: 0.1, seg: 8, rot: [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55] })
    }
    const blobs: [number, number, number, number][] = [
      [0, 6.6, 0, 3.6], [2.8, 6.0, 1.2, 2.8], [-2.6, 6.1, 0.8, 2.9], [0.6, 6.0, -2.8, 2.8],
      [-1.2, 6.2, 2.7, 2.6], [2.0, 6.4, -1.8, 2.5], [-2.2, 6.3, -2.0, 2.4],
    ]
    blobs.forEach(([x, y, z, r], i) => b.sphere(i % 3 ? 'leaf' : 'leaf2', r, [x, y, z], { seg: 10, rot: [0, i, 0] }))
  },
}

/** Narrow upright tree (e.g. Mempat / Tabebuia shape), ~7 m. */
export const columnTree: ModelDef = {
  key: 'columnTree',
  name: 'Upright tree',
  size: [3.5, 3.5, 7.5],
  build(b) {
    b.cyl('bark', 0.16, 2.4, [0, 1.2, 0], { rTop: 0.12, seg: 8 })
    b.sphere('leaf', 1.6, [0, 3.6, 0], { seg: 10 })
    b.sphere('leaf2', 1.35, [0.3, 5.0, 0.2], { seg: 10 })
    b.sphere('leaf', 0.95, [-0.2, 6.2, -0.1], { seg: 8 })
  },
}

/** Coconut / royal palm with curved trunk and drooping fronds, ~8 m. */
export const palm: ModelDef = {
  key: 'palm',
  name: 'Palm',
  size: [6, 6, 8.5],
  build(b) {
    for (let i = 0; i < 8; i++) {
      const y = 0.5 + i * 0.95
      b.cyl('bark', 0.2 - i * 0.008, 1.0, [Math.sin(i * 0.18) * 0.35, y, 0], { seg: 8, rot: [0, 0, -0.06] })
    }
    const top: [number, number, number] = [0.33, 8.0, 0]
    b.sphere('bark', 0.3, top, { seg: 8 })
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2
      b.group(top, [0, a, 0], g => {
        g.box('leaf', [0.55, 0.05, 2.0], [0, 0.15, 1.0], { rot: [-0.25, 0, 0] })
        g.box('leaf2', [0.4, 0.04, 1.6], [0, -0.35, 2.55], { rot: [0.55, 0, 0] })
      })
    }
  },
}

/** Rounded shrub (bougainvillea / ixora style). */
export const shrub: ModelDef = {
  key: 'shrub',
  name: 'Shrub',
  size: [1.6, 1.6, 1.1],
  build(b) {
    b.sphere('leaf2', 0.6, [0, 0.5, 0], { seg: 10 })
    b.sphere('leaf', 0.45, [0.45, 0.4, 0.2], { seg: 8 })
    b.sphere('leaf', 0.42, [-0.4, 0.38, -0.25], { seg: 8 })
    b.sphere('leaf2', 0.35, [0.1, 0.75, -0.35], { seg: 8 })
  },
}

/** Trimmed hedge segment, 4 m long, in a concrete planter. */
export const hedge: ModelDef = {
  key: 'hedge',
  name: 'Hedge planter',
  size: [4, 1, 1.1],
  build(b) {
    b.boxB('bodyAlt', [4, 0.45, 1.0], [0, 0, 0], { r: 0.04 })
    b.boxB('leaf', [3.8, 0.65, 0.8], [0, 0.45, 0], { r: 0.25 })
  },
}

/** Mid-size sedan (~4.7 × 1.8 m). Front = +Z. u: unused. */
const car = (key: string, paint: 'paint' | 'paint2' | 'accent' | 'red'): ModelDef => ({
  key,
  name: 'Car',
  size: [1.82, 4.7, 1.45],
  build(b) {
    b.boxB(paint, [1.8, 0.62, 4.6], [0, 0.3, 0], { r: 0.2 })
    b.boxB(paint, [1.62, 0.5, 2.4], [0, 0.85, -0.25], { r: 0.25 })
    b.box('glass', [1.56, 0.42, 2.36], [0, 1.1, -0.25], { r: 0.2 })
    b.box('black', [1.5, 0.4, 0.04], [0, 1.08, 0.92], { rot: [-0.55, 0, 0] })
    b.box('black', [1.5, 0.36, 0.04], [0, 1.08, -1.46], { rot: [0.6, 0, 0] })
    for (const x of [-0.82, 0.82]) for (const z of [-1.45, 1.4]) b.cyl('rubber', 0.33, 0.24, [x, 0.33, z], { rot: [0, 0, Math.PI / 2], seg: 14 })
    b.box('emissiveWhite', [0.35, 0.08, 0.04], [-0.6, 0.72, 2.3])
    b.box('emissiveWhite', [0.35, 0.08, 0.04], [0.6, 0.72, 2.3])
    b.box('red', [0.4, 0.08, 0.04], [-0.6, 0.75, -2.3])
    b.box('red', [0.4, 0.08, 0.04], [0.6, 0.75, -2.3])
  },
})
export const carWhite = car('carWhite', 'paint')
export const carGrey = car('carGrey', 'paint2')
export const carBlue = car('carBlue', 'accent')

/** Street light pole, 8 m, arm toward +Z. */
export const streetLight: ModelDef = {
  key: 'streetLight',
  name: 'Street light',
  size: [0.4, 1.6, 8],
  build(b) {
    b.cyl('dark', 0.25, 0.4, [0, 0.2, 0], { seg: 10 })
    b.cyl('steel', 0.08, 7.6, [0, 4.0, 0], { rTop: 0.05, seg: 8 })
    b.box('steel', [0.08, 0.08, 1.4], [0, 7.75, 0.65])
    b.box('dark', [0.3, 0.12, 0.6], [0, 7.7, 1.35], { r: 0.04 })
    b.box('emissiveWhite', [0.24, 0.02, 0.5], [0, 7.63, 1.35])
  },
}
