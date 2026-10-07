import type { ModelDef } from './dsl'

/**
 * 300 mm FOUP. Origin = bottom centre. Door faces +Z.
 * Robotic (OHT) flange top at exactly y = 0.34.
 */
export const foup: ModelDef = {
  key: 'foup',
  name: 'FOUP (300 mm, 25 wafers)',
  size: [0.39, 0.33, 0.34],
  build(b) {
    b.boxB('dark', [0.33, 0.012, 0.28], [0, 0, -0.01], { r: 0.004 }) // kinematic base plate
    b.boxB('bodyAlt', [0.37, 0.27, 0.3], [0, 0.012, -0.01], { r: 0.05 }) // shell
    // translucent side windows showing wafers
    for (const x of [-0.186, 0.186]) b.box('glass', [0.004, 0.17, 0.2], [x, 0.15, -0.03], { r: 0.002 })
    for (let i = 0; i < 6; i++) b.cyl('wafer', 0.14, 0.002, [0, 0.07 + i * 0.03, -0.02])
    // front door + latch keys
    b.box('panel', [0.36, 0.26, 0.022], [0, 0.145, 0.15], { r: 0.012 })
    b.box('bodyAlt', [0.3, 0.2, 0.004], [0, 0.145, 0.162], { r: 0.008 })
    for (const x of [-0.09, 0.09]) b.cyl('dark', 0.018, 0.006, [x, 0.145, 0.164], { rot: [Math.PI / 2, 0, 0] })
    // side handles
    for (const sgn of [-1, 1]) {
      b.box('dark', [0.02, 0.025, 0.16], [sgn * 0.195, 0.22, -0.02], { r: 0.006 })
      for (const z of [-0.08, 0.04]) b.box('dark', [0.02, 0.03, 0.02], [sgn * 0.19, 0.205, z])
    }
    // top robotic flange
    b.boxB('dark', [0.08, 0.035, 0.08], [0, 0.282, -0.01], { r: 0.008 })
    b.boxB('bodyAlt', [0.2, 0.023, 0.2], [0, 0.317, -0.01], { r: 0.008 })
  },
}

/**
 * Wafer frame cassette (taped frames). Open frame, origin = bottom centre,
 * opening faces +Z. Total height 0.34 including top handle flange.
 */
export const frameCassette: ModelDef = {
  key: 'frameCassette',
  name: 'Wafer frame cassette',
  size: [0.4, 0.36, 0.34],
  build(b) {
    b.boxB('dark', [0.4, 0.015, 0.36], [0, 0, 0], { r: 0.004 })
    b.boxB('dark', [0.4, 0.015, 0.36], [0, 0.27, 0], { r: 0.004 })
    // slotted side walls
    for (const x of [-0.19, 0.19]) {
      b.boxB('steel', [0.02, 0.255, 0.34], [x, 0.015, 0])
      for (let i = 0; i < 9; i++) b.box('dark', [0.022, 0.004, 0.32], [x, 0.04 + i * 0.026, 0])
    }
    // rear posts
    for (const x of [-0.1, 0.1]) b.boxB('steel', [0.02, 0.255, 0.02], [x, 0.015, -0.17])
    // frames with taped wafers
    for (let i = 0; i < 6; i++) {
      const y = 0.045 + i * 0.039
      b.box('steel', [0.36, 0.004, 0.32], [0, y, 0])
      b.box('tape', [0.3, 0.002, 0.28], [0, y + 0.003, 0])
      b.cyl('wafer', 0.1, 0.002, [0, y + 0.005, 0])
    }
    // top handle flange
    b.boxB('dark', [0.06, 0.035, 0.06], [0, 0.285, 0])
    b.boxB('bodyAlt', [0.16, 0.02, 0.16], [0, 0.32, 0], { r: 0.006 })
  },
}

/** Lead-frame strip magazine 0.26 L (X) × 0.08 W (Z) × 0.16 H. Origin = bottom centre. Open ends at ±X. */
export const magazine: ModelDef = {
  key: 'magazine',
  name: 'Lead-frame strip magazine',
  size: [0.26, 0.08, 0.16],
  build(b) {
    b.boxB('dark', [0.26, 0.008, 0.08], [0, 0, 0])
    b.boxB('dark', [0.26, 0.008, 0.08], [0, 0.152, 0])
    for (const z of [-0.036, 0.036]) {
      // side walls as frames with long cut-outs
      for (const y of [0.008, 0.144]) b.boxB('dark', [0.26, 0.008, 0.008], [0, y, z])
      for (const x of [-0.125, -0.04, 0.04, 0.125]) b.boxB('dark', [0.01, 0.136, 0.008], [x, 0.016, z])
      for (let i = 0; i < 8; i++) b.box('black', [0.25, 0.003, 0.009], [0, 0.026 + i * 0.016, z]) // slot ribs
    }
    for (let i = 0; i < 8; i++) b.box('copper', [0.25, 0.003, 0.064], [0, 0.03 + i * 0.016, 0])
    b.box('white', [0.06, 0.03, 0.002], [0.08, 0.08, 0.041]) // barcode label
  },
}

/** Strapped JEDEC tray stack 0.32 × 0.14 × 0.13 H. Origin = bottom centre. */
export const trayStack: ModelDef = {
  key: 'trayStack',
  name: 'JEDEC tray stack (strapped)',
  size: [0.32, 0.14, 0.13],
  build(b) {
    const n = 16
    const h = 0.13 / n
    for (let i = 0; i < n; i++) b.boxB(i % 2 ? 'dark' : 'black', [0.318, h - 0.0008, 0.136], [0, i * h, 0], { r: 0.002 })
    for (let i = 0; i < 6; i++) b.box('dark', [0.04, 0.002, 0.04], [-0.125 + i * 0.05, 0.13, 0])
    for (const x of [-0.1, 0.1]) {
      b.boxB('white', [0.018, 0.132, 0.142], [x, -0.001, 0])
      b.box('white', [0.018, 0.002, 0.142], [x, 0.131, 0])
    }
    b.box('white', [0.05, 0.03, 0.002], [0, 0.06, 0.069])
  },
}

/** Stack of 13-inch reel pizza boxes 0.36 × 0.36 × 0.12 H. Origin = bottom centre. */
export const reelBox: ModelDef = {
  key: 'reelBox',
  name: '13-inch reel box stack',
  size: [0.36, 0.36, 0.12],
  build(b) {
    for (let i = 0; i < 3; i++) {
      b.boxB(i === 1 ? 'bodyAlt' : 'white', [0.36, 0.038, 0.36], [0, i * 0.04, 0], { r: 0.004 })
      b.box('panel', [0.362, 0.003, 0.362], [0, i * 0.04 + 0.03, 0]) // lid seam
      b.box('white', [0.08, 0.025, 0.002], [0.1, i * 0.04 + 0.018, 0.181]) // label
      b.box('dark', [0.05, 0.006, 0.002], [0.1, i * 0.04 + 0.02, 0.1825])
    }
    b.box('yellow', [0.03, 0.002, 0.362], [0, 0.12, 0]) // strap
    b.box('yellow', [0.03, 0.12, 0.002], [0, 0.06, 0.181])
  },
}
