import type { ModelDef } from './dsl'

/** ESD workbench with stereo microscope, monitor and parts bins. Front (+Z) = operator side. */
export const workbench: ModelDef = {
  key: 'workbench',
  name: 'ESD inspection workbench',
  size: [1.5, 0.75, 1.55],
  build(b) {
    for (const x of [-0.7, 0.7]) for (const z of [-0.32, 0.32]) b.boxB('steel', [0.04, 0.88, 0.04], [x, 0, z])
    b.boxB('bodyAlt', [1.42, 0.03, 0.64], [0, 0.18, 0])
    b.boxB('accent2', [1.5, 0.04, 0.75], [0, 0.88, 0], { r: 0.01 })
    // back panel with louvre bins
    b.boxB('panel', [1.5, 0.62, 0.03], [0, 0.92, -0.36])
    for (let i = 0; i < 6; i++) b.boxB(i % 2 ? 'accent' : 'yellow', [0.16, 0.09, 0.12], [-0.55 + i * 0.22, 1.25, -0.29], { r: 0.01 })
    b.boxB('emissiveWhite', [1.3, 0.02, 0.06], [0, 1.52, -0.3])
    // stereo microscope
    b.boxB('dark', [0.22, 0.03, 0.26], [-0.35, 0.92, 0.05], { r: 0.01 })
    b.cyl('steel', 0.02, 0.4, [-0.35, 1.12, -0.05])
    b.box('dark', [0.1, 0.12, 0.16], [-0.35, 1.25, 0.03], { r: 0.02 })
    b.cyl('black', 0.015, 0.08, [-0.37, 1.33, 0.08], { rot: [-0.5, 0, 0] })
    b.cyl('black', 0.015, 0.08, [-0.33, 1.33, 0.08], { rot: [-0.5, 0, 0] })
    // monitor + keyboard
    b.box('dark', [0.5, 0.32, 0.03], [0.35, 1.18, -0.15], { r: 0.01, rot: [-0.1, 0, 0] })
    b.box('screen', [0.46, 0.28, 0.005], [0.35, 1.18, -0.133], { rot: [-0.1, 0, 0] })
    b.cyl('dark', 0.02, 0.16, [0.35, 0.99, -0.17])
    b.box('black', [0.4, 0.015, 0.13], [0.35, 0.93, 0.15])
    // tray on bench
    b.box('black', [0.3, 0.02, 0.14], [0.0, 0.93, 0.12])
  },
}

/** Four-tier WIP rack with magazines and trays. */
export const wipRack: ModelDef = {
  key: 'wipRack',
  name: 'WIP rack',
  size: [1.2, 0.5, 1.8],
  build(b) {
    for (const x of [-0.58, 0.58]) for (const z of [-0.23, 0.23]) b.boxB('steel', [0.03, 1.8, 0.03], [x, 0, z])
    for (let i = 0; i < 4; i++) {
      const y = 0.15 + i * 0.45
      b.boxB('bodyAlt', [1.18, 0.025, 0.48], [0, y, 0])
      for (let k = 0; k < 4; k++) {
        if ((i + k) % 3 === 2) continue
        if (i % 2) b.boxB('black', [0.26, 0.16, 0.08], [-0.42 + k * 0.28, y + 0.025, 0], { r: 0.005 })
        else b.boxB('dark', [0.25, 0.12, 0.3], [-0.42 + k * 0.28, y + 0.025, 0], { r: 0.005 })
      }
    }
    for (const x of [-0.45, 0.45]) for (const z of [-0.18, 0.18]) b.cyl('rubber', 0.04, 0.03, [x, 0.04, z], { rot: [0, 0, Math.PI / 2] })
  },
}

/** Lockable spare-parts / consumables cabinet. */
export const partsCabinet: ModelDef = {
  key: 'partsCabinet',
  name: 'Consumables cabinet',
  size: [0.9, 0.5, 1.95],
  build(b) {
    b.boxB('accent', [0.9, 1.95, 0.5], [0, 0, 0], { r: 0.01 })
    b.box('dark', [0.004, 1.8, 0.002], [0, 0.98, 0.251])
    b.box('glass', [0.36, 0.7, 0.01], [-0.2, 1.4, 0.252])
    b.box('glass', [0.36, 0.7, 0.01], [0.2, 1.4, 0.252])
    b.box('steel', [0.02, 0.18, 0.03], [-0.04, 1.0, 0.26])
    b.box('steel', [0.02, 0.18, 0.03], [0.04, 1.0, 0.26])
    b.box('yellow', [0.3, 0.06, 0.004], [0, 1.85, 0.252])
  },
}
