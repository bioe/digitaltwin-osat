import { ease, type Builder, type ModelDef } from './dsl'

/** Front HMI arm + monitor + keyboard + e-stop. */
function hmi(b: Builder, x: number, y: number, z: number) {
  b.cyl('steel', 0.018, 0.32, [x, y + 0.16, z])
  b.box('dark', [0.34, 0.24, 0.03], [x, y + 0.42, z + 0.02], { r: 0.01, rot: [-0.15, 0, 0] })
  b.box('screen', [0.3, 0.2, 0.004], [x, y + 0.42, z + 0.037], { rot: [-0.15, 0, 0] })
}

function estop(b: Builder, x: number, y: number, z: number) {
  b.cyl('yellow', 0.03, 0.02, [x, y, z], { rot: [Math.PI / 2, 0, 0] })
  b.cyl('red', 0.02, 0.03, [x, y, z + 0.015], { rot: [Math.PI / 2, 0, 0] })
}

/**
 * Package singulation system: dicing saw + vision/sorter
 * (Disco DFD6760 / Hanmi micro SAW class). Strip magazine loader on the left,
 * twin-spindle saw section, then wash/dry, vision and pick & place into
 * JEDEC output trays on the right. ~2.8 × 1.7 m, ~1.9 m tall.
 * u: unused.
 */
export const packageSaw: ModelDef = {
  key: 'packageSaw',
  name: 'Package saw + sorter (Hanmi micro SAW class)',
  size: [2.8, 1.7, 1.9],
  build(b) {
    const D = 1.5
    const fz = D / 2
    // base plinth over the full line
    b.boxB('dark', [2.76, 0.08, D - 0.04], [0, 0, 0], { r: 0.01 })

    // ===== Saw section x -1.4 .. -0.05
    const sx = -0.72
    b.boxB('body', [1.34, 0.82, D], [sx, 0.08, 0], { r: 0.025 })
    b.box('panel', [0.004, 0.68, 0.002], [sx, 0.46, fz + 0.001])
    for (const dx of [-0.3, 0.3]) {
      b.box('steel', [0.1, 0.02, 0.025], [sx + dx * 0.4, 0.78, fz + 0.01], { r: 0.008 })
      b.box('dark', [0.4, 0.06, 0.004], [sx + dx, 0.2, fz + 0.002])
    }
    // deck (stainless, wet area)
    b.boxB('steel', [1.3, 0.04, D - 0.06], [sx, 0.9, 0], { r: 0.008 })
    // enclosure: back, sides, roof, glass front door
    b.box('body', [1.34, 0.8, 0.04], [sx, 1.34, -fz + 0.02])
    b.box('body', [0.04, 0.8, D], [sx - 0.65, 1.34, 0])
    b.boxB('bodyAlt', [1.34, 0.16, D], [sx, 1.74, 0], { r: 0.02 })
    b.box('accent', [1.342, 0.03, D + 0.002], [sx, 1.76, 0])
    b.box('glass', [1.2, 0.74, 0.008], [sx + 0.03, 1.33, fz - 0.01])
    b.box('dark', [1.24, 0.03, 0.03], [sx + 0.03, 0.95, fz - 0.01])
    b.box('steel', [0.02, 0.2, 0.025], [sx + 0.55, 1.33, fz + 0.01], { r: 0.006 })
    // X-axis chuck guide with bellows cover
    b.boxB('dark', [0.95, 0.06, 0.3], [sx + 0.05, 0.94, 0.1], { r: 0.008 })
    b.box('black', [0.95, 0.02, 0.24], [sx + 0.05, 1.01, 0.1])
    // chuck table travelling in X with the strip (jig)
    b.anim(
      'chuck',
      [sx + 0.05, 1.02, 0.1],
      (s, o) => {
        o.position.x = (ease.pingpong(s.t + s.phase * 5, 3.2) - 0.5) * 0.5
      },
      c => {
        c.boxB('steel', [0.32, 0.06, 0.28], [0, 0, 0], { r: 0.01 })
        c.boxB('dark', [0.28, 0.015, 0.1], [0, 0.06, -0.06])
        c.boxB('dark', [0.28, 0.015, 0.1], [0, 0.06, 0.06])
        c.box('black', [0.26, 0.006, 0.08], [0, 0.078, -0.06])
        c.box('black', [0.26, 0.006, 0.08], [0, 0.078, 0.06])
      },
    )
    // Y/Z bridge carrying twin facing spindles
    for (const dx of [-0.32, 0.32]) b.boxB('dark', [0.08, 0.5, 0.1], [sx + 0.05 + dx, 0.92, -0.25], { r: 0.008 })
    b.boxB('dark', [0.72, 0.1, 0.14], [sx + 0.05, 1.42, -0.25], { r: 0.01 })
    for (const side of [-1, 1]) {
      const x = sx + 0.05 + side * 0.08
      // spindle Z carriage
      b.boxB('panel', [0.1, 0.2, 0.12], [x, 1.22, -0.14], { r: 0.008 })
      // spindle body pointing along X toward the centre
      b.cyl('chrome', 0.04, 0.18, [x + side * 0.08, 1.2, -0.02], { rot: [0, 0, Math.PI / 2] })
      b.cyl('steel', 0.045, 0.05, [x + side * 0.18, 1.2, -0.02], { rot: [0, 0, Math.PI / 2] })
      // blade cover + water nozzle
      b.box('dark', [0.04, 0.08, 0.1], [x - side * 0.03, 1.16, 0.1], { r: 0.006 })
      b.cyl('steel', 0.006, 0.12, [x - side * 0.03, 1.14, 0.2], { rot: [Math.PI / 2, 0, 0] })
    }
    // blade (spinning) under one cover
    b.anim(
      'blade',
      [sx + 0.03, 1.15, 0.1],
      (s, o) => {
        o.rotation.x = s.t * 25
      },
      bl => {
        bl.cyl('chrome', 0.03, 0.002, [0, 0, 0], { rot: [0, 0, Math.PI / 2], seg: 24 })
      },
    )
    // input magazine elevator on the left end
    for (const dz of [-0.14, 0.14]) b.boxB('steel', [0.02, 0.6, 0.02], [-1.2, 0.94, 0.45 + dz])
    b.boxB('black', [0.18, 0.24, 0.26], [-1.2, 1.04, 0.45], { r: 0.004 })
    for (let i = 0; i < 6; i++) b.box('copper', [0.16, 0.003, 0.24], [-1.2, 1.08 + i * 0.03, 0.45])
    b.port([-1.2, 1.04, 0.45])
    // coolant / DI water lines at the back
    for (const dx of [-0.3, -0.24]) b.cyl('accent2', 0.012, 0.8, [sx + dx, 0.5, -fz - 0.02])
    hmi(b, sx - 0.35, 0.92, fz + 0.06)
    b.box('dark', [0.4, 0.025, 0.15], [sx + 0.2, 0.86, fz + 0.09], { r: 0.008 })
    b.box('black', [0.34, 0.012, 0.11], [sx + 0.2, 0.88, fz + 0.09])
    estop(b, sx + 0.55, 0.7, fz + 0.01)

    // ===== Sorter section x -0.05 .. 1.4
    const ox = 0.68
    b.boxB('body', [1.42, 0.82, D], [ox, 0.08, 0], { r: 0.025 })
    b.box('panel', [0.004, 0.68, 0.002], [ox, 0.46, fz + 0.001])
    for (const dx of [-0.35, 0.35]) {
      b.box('steel', [0.1, 0.02, 0.025], [ox + dx * 0.3, 0.78, fz + 0.01], { r: 0.008 })
      b.box('dark', [0.4, 0.06, 0.004], [ox + dx, 0.2, fz + 0.002])
    }
    b.box('status', [2.6, 0.025, 0.01], [0, 0.86, fz + 0.003])
    b.boxB('dark', [1.4, 0.04, D - 0.06], [ox, 0.9, 0], { r: 0.008 })
    // wash / dry station + vision camera looking up
    b.boxB('steel', [0.26, 0.1, 0.26], [0.12, 0.94, -0.2], { r: 0.01 })
    b.cyl('black', 0.04, 0.1, [0.42, 0.99, -0.2])
    b.cyl('emissiveWhite', 0.05, 0.01, [0.42, 1.045, -0.2])
    // turn table / unit inspection table
    b.cyl('steel', 0.13, 0.04, [0.42, 0.96, 0.15])
    // output JEDEC trays on the deck (good bins) + reject tray
    for (let i = 0; i < 3; i++) {
      const tx = 0.72 + i * 0.22
      b.boxB('black', [0.2, 0.03, 0.32], [tx, 0.94, 0.15], { r: 0.004 })
      for (let r = 0; r < 4; r++) b.box('dark', [0.18, 0.004, 0.06], [tx, 0.972, 0.03 + r * 0.08])
    }
    b.boxB('red', [0.14, 0.04, 0.14], [1.24, 0.94, -0.3], { r: 0.006 })
    // pick gantry beam along X
    for (const dx of [-0.6, 0.62]) b.boxB('dark', [0.06, 0.44, 0.06], [ox + dx, 0.94, -0.05])
    b.boxB('dark', [1.32, 0.08, 0.1], [ox, 1.38, -0.05], { r: 0.01 })
    b.box('steel', [1.3, 0.012, 0.04], [ox, 1.43, -0.02])
    b.anim(
      'picker',
      [ox, 1.38, 0.05],
      (s, o) => {
        const k = ease.saw(s.t + s.phase * 3, 2.6)
        o.position.x = Math.sin(k * Math.PI * 2) * 0.42
        o.position.z = Math.cos(k * Math.PI * 2) * 0.05
      },
      p => {
        p.boxB('accent', [0.16, 0.14, 0.1], [0, -0.06, 0], { r: 0.012 })
        p.anim(
          'pickZ',
          [0, -0.07, 0.06],
          (s, o) => {
            o.position.y = -ease.pingpong(s.t + s.phase * 3, 1.3) * 0.08
          },
          z => {
            for (const dx of [-0.05, 0, 0.05]) {
              z.cyl('chrome', 0.008, 0.2, [dx, -0.12, 0])
              z.cyl('rubber', 0.012, 0.015, [dx, -0.225, 0])
            }
            z.boxB('dark', [0.14, 0.04, 0.04], [0, -0.04, 0])
          },
        )
      },
    )
    // tray stack elevators at the front (empty in / full out)
    for (const tx of [0.15, 1.15]) {
      b.boxB('bodyAlt', [0.3, 0.05, 0.36], [tx, 0.92, 0.55], { r: 0.01 })
      for (let i = 0; i < 5; i++) b.boxB('black', [0.22, 0.02, 0.32], [tx, 0.98 + i * 0.022, 0.55])
    }
    b.port([0.15, 1.09, 0.55])
    // glass hood over sorter
    b.boxB('glass', [1.38, 0.8, D - 0.04], [ox, 0.94, 0], { r: 0.02 })
    b.boxB('bodyAlt', [1.42, 0.12, D], [ox, 1.74, 0], { r: 0.02 })
    b.box('accent', [1.422, 0.03, D + 0.002], [ox, 1.76, 0])
    hmi(b, 1.1, 0.92, fz + 0.06)
    estop(b, 0.2, 0.7, fz + 0.01)
    b.tower([1.25, 1.86, -0.55])
  },
}

/**
 * Trim & form system for leaded packages (QFP / SOP / TSOP):
 * strip magazine in, dejunk / trim / form punch press with die set,
 * singulated units out to tube and tray. ~2.4 × 1.4 m, ~1.9 m tall.
 * u: unused.
 */
export const trimForm: ModelDef = {
  key: 'trimForm',
  name: 'Trim & form system',
  size: [2.4, 1.4, 1.9],
  build(b) {
    const D = 1.3
    const fz = D / 2
    b.boxB('dark', [2.36, 0.08, D - 0.04], [0, 0, 0], { r: 0.01 })
    // main cabinet
    b.boxB('body', [2.4, 0.82, D], [0, 0.08, 0], { r: 0.025 })
    for (const px of [-0.8, 0, 0.8]) {
      b.box('panel', [0.004, 0.66, 0.002], [px, 0.46, fz + 0.001])
      b.box('dark', [0.32, 0.05, 0.004], [px - 0.2, 0.2, fz + 0.002])
      b.box('steel', [0.02, 0.12, 0.025], [px + 0.05, 0.6, fz + 0.01], { r: 0.006 })
    }
    b.box('status', [2.2, 0.025, 0.01], [0, 0.86, fz + 0.003])
    b.boxB('dark', [2.4, 0.05, D], [0, 0.9, 0], { r: 0.01 })
    // strip feed rails across
    for (const z of [-0.05, 0.05]) b.box('steel', [2.2, 0.02, 0.015], [0, 0.98, z])
    // input magazine elevator (left)
    b.boxB('bodyAlt', [0.3, 0.55, 0.4], [-1.0, 0.95, 0.0], { r: 0.015 })
    b.anim(
      'inMag',
      [-1.0, 1.5, 0.0],
      (s, o) => {
        o.position.y = -Math.floor(ease.saw(s.t + s.phase * 30, 40) * 8) * 0.025
      },
      m => {
        m.boxB('black', [0.2, 0.22, 0.26], [0, 0, 0], { r: 0.004 })
        for (let i = 0; i < 6; i++) m.box('copper', [0.18, 0.003, 0.24], [0, 0.03 + i * 0.03, 0])
      },
    )
    b.port([-1.0, 1.5, 0.0])
    // press stations (dejunk, trim, form, singulate)
    for (const [i, px] of [-0.45, 0.05].entries()) {
      // bolster + die set
      b.boxB('dark', [0.42, 0.08, 0.5], [px, 0.95, 0], { r: 0.01 })
      b.boxB('steel', [0.32, 0.06, 0.34], [px, 1.03, 0], { r: 0.006 })
      // four guide posts
      for (const cx of [-0.15, 0.15]) for (const cz of [-0.18, 0.18]) b.cyl('chrome', 0.018, 0.45, [px + cx, 1.31, cz])
      // crown + motor
      b.boxB('dark', [0.44, 0.14, 0.5], [px, 1.53, 0], { r: 0.012 })
      b.boxB('accent', [0.442, 0.03, 0.502], [px, 1.58, 0])
      b.cyl('panel', 0.08, 0.2, [px, 1.77, -0.08])
      b.cyl('dark', 0.09, 0.03, [px, 1.68, -0.08])
      // ram + upper die moving up/down
      b.anim(
        `ram${i}`,
        [px, 1.24, 0],
        (s, o) => {
          const k = (s.t * 1.2 + i * 0.5 + s.phase) % 1
          o.position.y = -(k < 0.3 ? Math.sin((k / 0.3) * Math.PI) : 0) * 0.07
        },
        r => {
          r.cyl('chrome', 0.04, 0.3, [0, 0.14, 0])
          r.boxB('steel', [0.34, 0.08, 0.36], [0, -0.08, 0], { r: 0.008 })
          r.boxB('dark', [0.26, 0.05, 0.26], [0, -0.13, 0], { r: 0.004 })
          for (const cx of [-0.15, 0.15]) for (const cz of [-0.18, 0.18]) r.cyl('steel', 0.03, 0.08, [cx, -0.04, cz])
        },
      )
    }
    // strip on the feeder
    b.box('copper', [0.6, 0.004, 0.08], [-0.2, 1.065, 0])
    // output: tube loader (angled tubes) + tray
    for (let i = 0; i < 5; i++)
      b.box('glass', [0.6, 0.02, 0.025], [0.75, 1.08 + i * 0.03, -0.25 + i * 0.002], { rot: [0, 0, -0.15] })
    b.boxB('panel', [0.12, 0.25, 0.18], [0.45, 0.95, -0.25], { r: 0.01 })
    b.boxB('black', [0.32, 0.03, 0.22], [0.8, 0.95, 0.25], { r: 0.004 })
    for (let i = 0; i < 4; i++) b.box('dark', [0.3, 0.004, 0.03], [0.8, 0.982, 0.17 + i * 0.05])
    for (let i = 0; i < 4; i++) b.boxB('black', [0.32, 0.02, 0.22], [1.0, 0.95 + i * 0.022, 0.52])
    b.port([1.0, 1.04, 0.52])
    // glass hood with dark frame + roof
    b.boxB('glass', [2.36, 0.82, D - 0.04], [0, 0.95, 0], { r: 0.02 })
    b.box('dark', [2.38, 0.03, 0.03], [0, 0.96, fz - 0.02])
    for (const px of [-0.6, 0.6]) b.box('dark', [0.03, 0.8, 0.03], [px, 1.36, fz - 0.02])
    b.boxB('bodyAlt', [2.4, 0.13, D], [0, 1.77, 0], { r: 0.02 })
    // scrap chute + bin (side door)
    b.box('panel', [0.004, 0.5, 0.5], [1.201, 0.45, -0.2])
    b.box('steel', [0.025, 0.12, 0.02], [1.21, 0.5, 0.0], { r: 0.006 })
    // HMI, keyboard, e-stop
    b.cyl('steel', 0.018, 0.32, [-0.7, 1.08, fz + 0.06])
    b.box('dark', [0.34, 0.24, 0.03], [-0.7, 1.34, fz + 0.08], { r: 0.01, rot: [-0.15, 0, 0] })
    b.box('screen', [0.3, 0.2, 0.004], [-0.7, 1.34, fz + 0.097], { rot: [-0.15, 0, 0] })
    b.box('dark', [0.4, 0.025, 0.15], [-0.2, 0.86, fz + 0.06], { r: 0.008 })
    b.box('black', [0.34, 0.012, 0.11], [-0.2, 0.88, fz + 0.06])
    b.cyl('yellow', 0.03, 0.02, [0.4, 0.7, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.02, 0.03, [0.4, 0.7, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    b.tower([1.05, 1.9, -0.5])
  },
}
