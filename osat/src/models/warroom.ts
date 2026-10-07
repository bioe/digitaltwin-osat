import type { Builder, ModelDef } from './dsl'

const DESK_Y = 0.75
const SEG_D = 0.7

/** One desk segment: x from x0 to x0 + w (local), centred on z = 0. */
function deskSeg(b: Builder, x0: number, w: number, monitors: number[]) {
  const xc = x0 + w / 2
  b.boxB('wood', [w, 0.03, SEG_D], [xc, DESK_Y - 0.03, 0], { r: 0.006 })
  b.box('dark', [w, 0.035, 0.02], [xc, DESK_Y - 0.017, SEG_D / 2], { r: 0.008 }) // soft front edge
  b.boxB('dark', [w - 0.04, 0.55, 0.02], [xc, 0.12, -SEG_D / 2 + 0.06]) // modesty panel
  b.boxB('bodyAlt', [w - 0.04, 0.06, 0.12], [xc, 0.62, -SEG_D / 2 + 0.12]) // cable tray
  // monitor rail along the back
  b.boxB('steel', [w - 0.02, 0.03, 0.05], [xc, DESK_Y, -SEG_D / 2 + 0.05])
  for (const mx of monitors) {
    const x = x0 + mx
    b.boxB('dark', [0.04, 0.32, 0.04], [x, DESK_Y + 0.03, -SEG_D / 2 + 0.05]) // pole
    b.box('dark', [0.04, 0.04, 0.16], [x, DESK_Y + 0.32, -SEG_D / 2 + 0.12]) // arm
    b.box('dark', [0.58, 0.35, 0.03], [x, DESK_Y + 0.4, -SEG_D / 2 + 0.2], { r: 0.008, rot: [-0.06, 0, 0] })
    b.box('screen', [0.55, 0.31, 0.004], [x, DESK_Y + 0.4, -SEG_D / 2 + 0.217], { rot: [-0.06, 0, 0] })
  }
}

/**
 * Control-room operator console, 3 angled segments wrapping the operator
 * (operator side = +Z). Desk top at 0.75 m. 4 monitors on arms.
 * u: unused.
 */
export const consoleDesk: ModelDef = {
  key: 'consoleDesk',
  name: 'Control-room operator console',
  size: [2.4, 1.0, 1.35],
  build(b) {
    const cw = 0.84
    const ww = 0.72
    const ang = 0.3
    const zc = -0.12
    b.group([0, 0, zc], undefined, g => {
      deskSeg(g, -cw / 2, cw, [0.13, cw - 0.13])
      // end legs of the centre section
      for (const x of [-cw / 2 + 0.03, cw / 2 - 0.03]) g.boxB('dark', [0.04, DESK_Y - 0.03, SEG_D - 0.1], [x, 0, 0])
      // keyboard, mouse, phone
      g.box('dark', [0.44, 0.02, 0.15], [0, DESK_Y + 0.01, 0.17], { r: 0.006 })
      g.box('black', [0.42, 0.008, 0.13], [0, DESK_Y + 0.022, 0.17])
      g.box('black', [0.06, 0.025, 0.1], [0.32, DESK_Y + 0.012, 0.18], { r: 0.02 })
      g.box('dark', [0.18, 0.04, 0.2], [-0.33, DESK_Y + 0.02, 0.08], { r: 0.015, rot: [0.25, 0.3, 0] }) // phone base
      g.box('black', [0.05, 0.035, 0.2], [-0.4, DESK_Y + 0.05, 0.08], { r: 0.015, rot: [0, 0.3, 0] }) // handset
      g.box('screen', [0.07, 0.04, 0.004], [-0.31, DESK_Y + 0.048, 0.13], { rot: [-0.9, 0.3, 0] })
    })
    // wings rotate forward toward the operator
    for (const side of [-1, 1]) {
      b.group([side * (cw / 2), 0, zc], [0, -side * ang, 0], g => {
        deskSeg(g, side > 0 ? 0 : -ww, ww, [ww / 2])
        g.boxB('dark', [0.04, DESK_Y - 0.03, SEG_D - 0.1], [side * (ww - 0.03), 0, 0]) // end leg
        g.boxB('bodyAlt', [0.4, 0.62, 0.5], [side * (ww - 0.3), 0, -0.05], { r: 0.01 }) // drawer pedestal
        g.box('steel', [0.12, 0.015, 0.02], [side * (ww - 0.3), 0.5, 0.21], { r: 0.005 })
        g.box('steel', [0.12, 0.015, 0.02], [side * (ww - 0.3), 0.25, 0.21], { r: 0.005 })
      })
    }
  },
}

/** Ergonomic office chair, 5-star base, faces +Z (back at -Z). Seat top 0.46 m. u: unused. */
export const chair: ModelDef = {
  key: 'chair',
  name: 'Ergonomic office chair',
  size: [0.66, 0.66, 1.2],
  build(b) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const cx = Math.sin(a) * 0.15
      const cz = Math.cos(a) * 0.15
      b.box('dark', [0.05, 0.04, 0.3], [cx, 0.09, cz], { rot: [0, a, 0], r: 0.012 })
      b.cyl('rubber', 0.025, 0.03, [Math.sin(a) * 0.29, 0.025, Math.cos(a) * 0.29], { rot: [0, a, Math.PI / 2] })
      b.cyl('dark', 0.008, 0.04, [Math.sin(a) * 0.29, 0.06, Math.cos(a) * 0.29])
    }
    b.cyl('dark', 0.045, 0.06, [0, 0.1, 0])
    b.cyl('chrome', 0.025, 0.22, [0, 0.23, 0])
    b.box('dark', [0.22, 0.05, 0.22], [0, 0.36, 0], { r: 0.015 }) // mechanism
    b.box('dark', [0.48, 0.03, 0.46], [0, 0.385, 0], { r: 0.012 })
    b.box('fabric', [0.5, 0.07, 0.48], [0, 0.425, 0.01], { r: 0.035 }) // seat cushion
    // backrest on a spine
    b.box('dark', [0.06, 0.3, 0.03], [0, 0.48, -0.26], { rot: [-0.1, 0, 0] })
    b.box('fabric', [0.46, 0.55, 0.06], [0, 0.85, -0.27], { r: 0.03, rot: [-0.12, 0, 0] })
    b.box('dark', [0.4, 0.5, 0.02], [0, 0.85, -0.305], { r: 0.01, rot: [-0.12, 0, 0] })
    b.box('fabric', [0.26, 0.12, 0.06], [0, 1.15, -0.32], { r: 0.03, rot: [-0.2, 0, 0] }) // headrest
    b.box('dark', [0.03, 0.12, 0.02], [0, 1.07, -0.32])
    // armrests
    for (const x of [-0.26, 0.26]) {
      b.box('dark', [0.03, 0.22, 0.04], [x, 0.5, -0.04])
      b.box('black', [0.07, 0.03, 0.24], [x, 0.62, 0.0], { r: 0.012 })
    }
  },
}

/**
 * Vertical lift column for an overhead conveyor drop station. Steel tower
 * frame 0.5 × 0.5, 3.0 m tall. Carriage opens to +Z.
 * u[0] = carriage platform top height in metres, clamped 0.9..2.75
 * (missing value -> 0.9, i.e. bottom / load position).
 */
export const conveyorLift: ModelDef = {
  key: 'conveyorLift',
  name: 'Conveyor drop-station lift',
  size: [0.5, 0.5, 3.0],
  build(b) {
    b.boxB('dark', [0.5, 0.06, 0.5], [0, 0, 0], { r: 0.01 })
    b.box('yellow', [0.502, 0.02, 0.502], [0, 0.05, 0])
    for (const x of [-0.225, 0.225])
      for (const z of [-0.225, 0.225]) b.boxB('steel', [0.05, 2.94, 0.05], [x, 0.06, z])
    // horizontal ties + diagonal braces on sides and back
    for (const y of [0.6, 1.5, 2.4]) {
      b.box('steel', [0.4, 0.03, 0.03], [0, y, -0.225])
      for (const x of [-0.225, 0.225]) b.box('steel', [0.03, 0.03, 0.4], [x, y, 0])
    }
    for (const x of [-0.225, 0.225])
      for (const y0 of [0.6, 1.5]) b.box('steel', [0.02, 0.985, 0.02], [x, y0 + 0.45, 0], { rot: [0.418, 0, 0] })
    // top head with drive motor
    b.boxB('bodyAlt', [0.5, 0.12, 0.5], [0, 2.88, 0], { r: 0.01 })
    b.cyl('dark', 0.06, 0.18, [0.12, 2.82, -0.12], { rot: [0, 0, Math.PI / 2] })
    b.boxB('accent', [0.502, 0.03, 0.502], [0, 2.92, 0])
    // guide rails + lifting belt (back)
    for (const x of [-0.12, 0.12]) b.boxB('chrome', [0.02, 2.75, 0.02], [x, 0.1, -0.19])
    b.boxB('black', [0.04, 2.75, 0.006], [0, 0.1, -0.2])
    // safety mesh on sides (lower part) + floor sensor
    for (const x of [-0.248, 0.248]) b.boxB('glass', [0.004, 1.8, 0.42], [x, 0.06, 0])
    b.box('yellow', [0.3, 0.01, 0.05], [0, 0.065, 0.2])
    // carriage
    b.anim(
      'carriage',
      [0, 0, 0],
      (s, o) => {
        o.position.y = Math.min(2.75, Math.max(0.9, s.u[0] ?? 0))
      },
      c => {
        c.box('dark', [0.32, 0.18, 0.04], [0, -0.06, -0.17], { r: 0.008 })
        c.boxB('bodyAlt', [0.4, 0.04, 0.4], [0, -0.07, 0], { r: 0.008 })
        for (const x of [-0.18, 0.18]) c.boxB('dark', [0.02, 0.05, 0.4], [x, -0.03, 0])
        for (let i = 0; i < 6; i++)
          c.cyl('steel', 0.014, 0.34, [0, -0.014, -0.16 + i * 0.064], { rot: [0, 0, Math.PI / 2] })
        c.box('status', [0.2, 0.015, 0.006], [0, -0.05, 0.201])
      },
    )
  },
}
