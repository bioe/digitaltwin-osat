import type { ModelDef } from './dsl'

/**
 * Rigid box truck (~8.6 m), cab at +Z. u[0] = rear door opening 0..1.
 * Cargo floor at 1.25 m; cargo box inner length ~5.9 m from z = -4.2 to +1.7.
 */
export const truck: ModelDef = {
  key: 'truck',
  name: 'Box truck',
  size: [2.5, 8.6, 3.7],
  build(b) {
    // chassis + wheels
    b.boxB('dark', [2.0, 0.35, 8.2], [0, 0.55, -0.1])
    for (const z of [2.9, -2.4, -3.6]) {
      for (const x of [-1.05, 1.05]) {
        b.cyl('rubber', 0.5, 0.36, [x, 0.5, z], { rot: [0, 0, Math.PI / 2], seg: 16 })
        b.cyl('steel', 0.26, 0.38, [x, 0.5, z], { rot: [0, 0, Math.PI / 2], seg: 12 })
      }
    }
    // cab
    b.boxB('white', [2.45, 1.7, 2.2], [0, 0.85, 3.15], { r: 0.18 })
    b.boxB('white', [2.4, 0.95, 1.9], [0, 2.5, 3.0], { r: 0.25 })
    b.box('glass', [2.2, 0.85, 0.06], [0, 2.95, 4.08], { rot: [-0.18, 0, 0] })
    for (const x of [-1.22, 1.22]) b.box('glass', [0.04, 0.7, 1.0], [x, 2.85, 3.15])
    b.box('black', [1.9, 0.5, 0.05], [0, 1.25, 4.26]) // grille
    for (const x of [-0.95, 0.95]) b.box('emissiveWhite', [0.32, 0.18, 0.05], [x, 1.25, 4.27])
    b.box('dark', [2.5, 0.28, 0.25], [0, 0.75, 4.3], { r: 0.06 }) // bumper
    for (const x of [-1.38, 1.38]) {
      b.box('black', [0.06, 0.45, 0.22], [x, 2.75, 3.95])
      b.cyl('steel', 0.015, 0.4, [x * 0.92, 2.75, 3.95], { rot: [0, 0, Math.PI / 2] })
    }
    // cargo box with brand stripe
    b.boxB('body', [2.5, 2.55, 6.0], [0, 1.1, -1.25], { r: 0.04 })
    for (const x of [-1.255, 1.255]) {
      b.box('accent', [0.02, 0.5, 5.6], [x, 2.85, -1.25])
      b.box('accent2', [0.02, 0.12, 5.6], [x, 2.5, -1.25])
    }
    b.box('dark', [2.4, 0.1, 0.1], [0, 1.15, -4.27]) // rear sill
    b.box('red', [0.25, 0.12, 0.04], [-1.0, 1.0, -4.28])
    b.box('red', [0.25, 0.12, 0.04], [1.0, 1.0, -4.28])
    // rear barn doors, hinged at the outer edges, swing open to the sides
    for (const side of [-1, 1]) {
      b.anim(
        `door${side}`,
        [side * 1.24, 1.15, -4.26],
        (s, o) => {
          o.rotation.y = side * (s.u[0] ?? 0) * 1.6
        },
        d => {
          d.box('bodyAlt', [1.22, 2.45, 0.05], [-side * 0.61, 1.22, 0])
          d.box('steel', [0.04, 2.2, 0.04], [-side * 0.9, 1.22, -0.04])
        },
      )
    }
  },
}

/** Carton slot on a pallet (local): 2 × 2 per layer, 3 layers. Shared by the pallet model and the build animation. */
export function cartonSlot(i: number): [number, number, number] {
  const layer = Math.floor(i / 4)
  const j = i % 2
  const k = Math.floor(i / 2) % 2
  return [-0.25 + j * 0.5, 0.15 + layer * 0.37, -0.29 + k * 0.6]
}

/** Sealed shipping carton of reel boxes (0.48 × 0.58 × 0.36 m). */
export const carton: ModelDef = {
  key: 'carton',
  name: 'Shipping carton',
  size: [0.48, 0.58, 0.36],
  build(b) {
    b.boxB('wood', [0.48, 0.36, 0.58], [0, 0, 0], { r: 0.02 })
    b.box('tape', [0.06, 0.005, 0.58], [0, 0.362, 0])
    b.box('white', [0.16, 0.1, 0.005], [0.1, 0.2, 0.292])
  },
}

/** Empty pallet deck (cartons are stacked on it at the build position). */
export const palletBase: ModelDef = {
  key: 'palletBase',
  name: 'Pallet',
  size: [1.0, 1.2, 0.14],
  build(b) {
    b.boxB('oak', [1.0, 0.14, 1.2], [0, 0, 0])
    for (const x of [-0.42, 0, 0.42]) b.boxB('black', [0.1, 0.06, 1.2], [x, 0.0, 0])
  },
}

/** Shrink-wrapped pallet of 12 cartons (1.2 × 1.0 m, ~1.3 m tall). */
export const pallet: ModelDef = {
  key: 'pallet',
  name: 'Finished-goods pallet',
  size: [1.0, 1.2, 1.3],
  build(b) {
    b.boxB('oak', [1.0, 0.14, 1.2], [0, 0, 0])
    for (const x of [-0.42, 0, 0.42]) b.boxB('black', [0.1, 0.06, 1.2], [x, 0.0, 0])
    for (let i = 0; i < 12; i++) b.boxB('wood', [0.48, 0.36, 0.58], cartonSlot(i), { r: 0.02 })
    b.boxB('glass', [1.02, 1.12, 1.22], [0, 0.14, 0]) // stretch wrap
    b.box('accent', [0.3, 0.2, 0.01], [0, 0.9, 0.615]) // shipping label
  },
}

/** Automatic box-packing station: carton erector, reel infeed, case sealer. Front = +Z. u: unused. */
export const packStation: ModelDef = {
  key: 'packStation',
  name: 'Box packing station',
  size: [3.4, 1.6, 2.0],
  build(b) {
    b.boxB('dark', [3.4, 0.1, 1.5], [0, 0, 0], { r: 0.02 })
    b.boxB('body', [1.3, 1.6, 1.4], [-1.0, 0.1, 0], { r: 0.04 }) // carton erector
    b.box('glass', [1.1, 0.7, 0.02], [-1.0, 1.25, 0.71])
    for (let i = 0; i < 5; i++) b.boxB('wood', [0.9, 0.04, 0.6], [-1.0, 1.72 + i * 0.05, -0.2]) // flat cartons
    b.boxB('steel', [2.0, 0.08, 0.7], [0.6, 0.85, 0]) // roller table
    for (let x = -0.3; x <= 1.5; x += 0.2) b.cyl('chrome', 0.03, 0.66, [x, 0.95, 0], { rot: [Math.PI / 2, 0, 0], seg: 8 })
    for (const x of [-0.3, 1.5]) for (const z of [-0.3, 0.3]) b.boxB('steel', [0.05, 0.85, 0.05], [x, 0, z])
    b.anim(
      'carton',
      [0, 0.99, 0],
      (s, o) => {
        o.position.x = -0.2 + ((s.t * 0.35) % 1.6)
      },
      c => c.boxB('wood', [0.5, 0.4, 0.45], [0, 0, 0], { r: 0.01 }),
    )
    b.boxB('bodyAlt', [0.6, 0.5, 0.9], [1.2, 1.4, 0], { r: 0.03 }) // case sealer head
    b.box('yellow', [0.62, 0.06, 0.92], [1.2, 1.9, 0])
    b.box('dark', [0.4, 0.3, 0.04], [-0.2, 1.45, 0.75], { r: 0.02 }) // HMI arm
    b.box('screen', [0.36, 0.25, 0.005], [-0.2, 1.45, 0.775])
    b.box('status', [1.2, 0.03, 0.01], [-1.0, 0.25, 0.71])
    b.tower([-1.5, 1.7, -0.5])
  },
}

/**
 * In-line rotary pallet stretch-wrapper: a powered-roller turntable at pallet-line height
 * (rollers top at 0.42 m, pallets run along X), mast with film carriage beside the line (+Z).
 * u[0] = turntable angle (rad); it stops square to the line so pallets roll straight through.
 */
export const stretchWrapper: ModelDef = {
  key: 'stretchWrapper',
  name: 'Pallet stretch-wrapper',
  size: [2.2, 2.6, 2.6],
  build(b) {
    b.cyl('dark', 1.0, 0.3, [0, 0.15, 0], { seg: 32 })
    b.anim(
      'turntable',
      [0, 0.3, 0],
      (s, o) => {
        o.rotation.y = s.u[0] ?? 0
      },
      t => {
        t.cyl('steel', 0.97, 0.04, [0, 0.02, 0], { seg: 32 })
        // roller deck, same pitch and height as the pallet line
        for (const z of [-0.6, 0.6]) t.box('dark', [1.9, 0.08, 0.06], [0, 0.08, z])
        for (let x = -0.85; x <= 0.86; x += 0.25) t.cyl('chrome', 0.035, 1.1, [x, 0.085, 0], { rot: [Math.PI / 2, 0, 0], seg: 8 })
        t.box('yellow', [0.06, 0.02, 1.9], [0.95, 0.05, 0])
      },
    )
    b.boxB('body', [0.35, 2.6, 0.35], [0, 0, 1.3], { r: 0.03 }) // mast, beside the line
    b.box('accent', [0.36, 0.08, 0.36], [0, 2.3, 1.3])
    b.anim(
      'carriage',
      [0, 0.45, 1.08],
      (s, o) => {
        o.position.y = 0.45 + (0.5 - 0.5 * Math.cos(s.t * 0.7)) * 1.1
      },
      c => {
        c.boxB('dark', [0.4, 0.35, 0.25], [0, 0, 0], { r: 0.03 })
        c.cyl('white', 0.09, 0.5, [0, 0.18, -0.2], { seg: 12 }) // film roll
      },
    )
    b.box('dark', [0.5, 0.35, 0.05], [0, 1.3, 1.5], { r: 0.02 })
    b.box('screen', [0.44, 0.28, 0.005], [0, 1.3, 1.53])
    b.box('status', [0.3, 0.03, 0.01], [0, 0.6, 1.48])
    b.tower([0.1, 2.6, 1.3])
  },
}
