import { ease, type Builder, type ModelDef } from './dsl'

/** 13-inch (330 mm) reel facing +Z, built around its hub at the origin. */
function reel(b: Builder, full: number) {
  for (const z of [-0.012, 0.012]) b.cyl('accent2', 0.165, 0.003, [0, 0, z], { rot: [Math.PI / 2, 0, 0], seg: 40 })
  b.cyl('black', full, 0.022, [0, 0, 0], { rot: [Math.PI / 2, 0, 0], seg: 32 })
  b.cyl('white', 0.05, 0.03, [0, 0, 0], { rot: [Math.PI / 2, 0, 0] })
  b.cyl('dark', 0.014, 0.04, [0, 0, 0.005], { rot: [Math.PI / 2, 0, 0] })
  // flange windows / spokes so the spin is visible
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    b.box('dark', [0.02, 0.1, 0.002], [Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.0145], { rot: [0, 0, a - Math.PI / 2] })
  }
}

/**
 * Turret tape & reel system (Cohu / Ismeca NX class): vibratory bowl and
 * tray input, indexing pick turret, carrier tape track with cover tape
 * heat-sealing head, empty carrier tape supply reel and 13-inch output
 * take-up reel on the front panel. ~1.9 × 1.3 m, ~1.8 m tall.
 * u: unused.
 */
export const tapeReel: ModelDef = {
  key: 'tapeReel',
  name: 'Turret tape & reel (Ismeca NX class)',
  size: [1.9, 1.3, 1.8],
  build(b) {
    const D = 1.2
    const cz = -0.05
    const fz = cz + D / 2
    b.boxB('dark', [1.86, 0.08, D - 0.04], [0, 0, cz], { r: 0.01 })
    b.boxB('body', [1.9, 0.82, D], [0, 0.08, cz], { r: 0.025 })
    // front panel: doors, vents
    b.box('panel', [0.004, 0.66, 0.002], [0, 0.46, fz + 0.001])
    b.box('dark', [0.3, 0.05, 0.004], [-0.2, 0.18, fz + 0.002])
    b.box('dark', [0.3, 0.05, 0.004], [0.2, 0.18, fz + 0.002])
    b.box('steel', [0.02, 0.12, 0.025], [-0.05, 0.5, fz + 0.012], { r: 0.006 })
    b.box('steel', [0.02, 0.12, 0.025], [0.05, 0.5, fz + 0.012], { r: 0.006 })
    b.box('status', [1.76, 0.025, 0.01], [0, 0.86, fz + 0.003])
    b.boxB('dark', [1.9, 0.05, D], [0, 0.9, cz], { r: 0.01 })
    // --- input: vibratory bowl feeder + linear track
    b.cyl('panel', 0.12, 0.2, [-0.6, 1.05, -0.3])
    b.lathe('steel', [
      [0.08, 0],
      [0.2, 0.02],
      [0.22, 0.1],
      [0.21, 0.1],
      [0.19, 0.03],
      [0.0, 0.025],
    ], [-0.6, 1.15, -0.3], { seg: 32 })
    b.box('steel', [0.4, 0.02, 0.04], [-0.3, 1.22, -0.18], { rot: [0, -0.4, 0] })
    // input tray stack (alternate input)
    for (let k = 0; k < 5; k++) b.boxB('black', [0.26, 0.02, 0.34], [-0.7, 0.95 + k * 0.022, 0.3])
    b.port([-0.6, 1.25, -0.3])
    // --- turret (16 nozzles), indexing
    b.cyl('panel', 0.1, 0.25, [-0.05, 1.05, -0.05])
    b.anim(
      'turret',
      [-0.05, 1.33, -0.05],
      (s, o) => {
        const step = (s.t + s.phase * 10) / 0.3
        const n = Math.floor(step)
        o.rotation.y = -((n + ease.smooth((step - n) * 2.5)) * Math.PI * 2) / 16
      },
      t => {
        t.cyl('steel', 0.24, 0.05, [0, 0, 0], { seg: 32 })
        t.cyl('accent', 0.08, 0.06, [0, 0.05, 0])
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2
          t.cyl('chrome', 0.007, 0.12, [Math.cos(a) * 0.22, -0.09, Math.sin(a) * 0.22])
          t.cyl('rubber', 0.01, 0.01, [Math.cos(a) * 0.22, -0.155, Math.sin(a) * 0.22])
        }
      },
    )
    // inspection camera + reject bin around turret
    b.cyl('black', 0.03, 0.1, [-0.27, 1.0, -0.05])
    b.boxB('red', [0.1, 0.06, 0.1], [-0.05, 0.95, -0.35], { r: 0.006 })
    // --- carrier tape track along X at the front of the turret
    const tz = 0.17
    b.boxB('steel', [1.15, 0.05, 0.06], [0.275, 0.95, tz], { r: 0.004 })
    b.box('black', [1.15, 0.004, 0.024], [0.275, 1.002, tz])
    // pockets with units on the tape (static look)
    for (let i = 0; i < 18; i++) b.box('dark', [0.016, 0.004, 0.016], [0.3 + i * 0.03, 1.006, tz])
    // sprocket wheel indexing the tape
    b.anim(
      'sprocket',
      [0.75, 0.98, tz + 0.04],
      (s, o) => {
        const step = (s.t + s.phase * 10) / 0.3
        const n = Math.floor(step)
        o.rotation.z = -((n + ease.smooth((step - n) * 2.5)) * Math.PI) / 8
      },
      sp => {
        sp.cyl('chrome', 0.03, 0.012, [0, 0, 0], { rot: [Math.PI / 2, 0, 0], seg: 16 })
        sp.box('dark', [0.05, 0.006, 0.014], [0, 0, 0.002])
      },
    )
    // cover tape sealing head (heated shoes) on a post
    b.boxB('dark', [0.06, 0.4, 0.06], [0.42, 0.95, tz - 0.12])
    b.box('dark', [0.06, 0.06, 0.14], [0.42, 1.32, tz - 0.06])
    b.anim(
      'sealer',
      [0.42, 1.2, tz],
      (s, o) => {
        o.position.y = -ease.pingpong(s.t + s.phase * 10, 0.3) * 0.015
      },
      h => {
        h.boxB('accent', [0.12, 0.1, 0.07], [0, 0, 0], { r: 0.008 })
        h.box('orange', [0.1, 0.17, 0.03], [0, -0.07, 0])
        h.box('copper', [0.1, 0.01, 0.02], [0, -0.15, 0])
      },
    )
    // cover tape supply reel above the sealer
    b.cyl('steel', 0.008, 0.08, [0.2, 1.4, tz - 0.03], { rot: [Math.PI / 2, 0, 0] })
    b.anim(
      'coverReel',
      [0.2, 1.4, tz],
      (s, o) => {
        o.rotation.z = s.t * 1.1
      },
      c => {
        c.cyl('glass', 0.07, 0.03, [0, 0, 0], { rot: [Math.PI / 2, 0, 0] })
        c.cyl('white', 0.05, 0.032, [0, 0, 0], { rot: [Math.PI / 2, 0, 0] })
        c.box('dark', [0.1, 0.01, 0.002], [0, 0, 0.017])
      },
    )
    // glass hood over the deck + roof
    b.boxB('glass', [1.86, 0.65, D - 0.04], [0, 0.95, cz], { r: 0.02 })
    b.box('dark', [1.88, 0.03, 0.03], [0, 0.97, fz - 0.02])
    b.box('dark', [0.03, 0.63, 0.03], [-0.3, 1.27, fz - 0.02])
    b.box('steel', [0.02, 0.14, 0.025], [-0.25, 1.27, fz + 0.005], { r: 0.006 })
    b.boxB('bodyAlt', [1.9, 0.12, D], [0, 1.6, cz], { r: 0.02 })
    b.box('accent', [1.902, 0.03, D + 0.002], [0, 1.62, cz])
    // --- reels on the front panel: carrier supply (left), 13" output (right)
    b.box('dark', [0.4, 0.4, 0.004], [0.62, 0.5, fz + 0.002], { r: 0.01 })
    b.cyl('steel', 0.012, 0.06, [0.62, 0.5, fz + 0.03], { rot: [Math.PI / 2, 0, 0] })
    b.anim(
      'outReel',
      [0.62, 0.5, fz + 0.04],
      (s, o) => {
        o.rotation.z = -s.t * 1.4
      },
      r => reel(r, 0.12),
    )
    b.cyl('steel', 0.012, 0.06, [-0.55, 0.5, fz + 0.03], { rot: [Math.PI / 2, 0, 0] })
    b.anim(
      'supplyReel',
      [-0.55, 0.5, fz + 0.04],
      (s, o) => {
        o.rotation.z = -s.t * 1.0
      },
      r => reel(r, 0.14),
    )
    // tape leaving the deck down to the output reel
    b.box('black', [0.024, 0.32, 0.003], [0.79, 0.76, fz + 0.04], { rot: [0, 0, 0.05] })
    b.port([0.62, 0.5, fz + 0.06])
    // HMI on arm + keyboard + e-stop
    b.cyl('steel', 0.018, 0.35, [0.0, 1.05, fz + 0.06])
    b.box('dark', [0.34, 0.24, 0.03], [0.0, 1.34, fz + 0.08], { r: 0.01, rot: [-0.15, 0, 0] })
    b.box('screen', [0.3, 0.2, 0.004], [0.0, 1.34, fz + 0.097], { rot: [-0.15, 0, 0] })
    b.box('dark', [0.36, 0.025, 0.14], [-0.1, 0.96, fz + 0.09], { r: 0.008 })
    b.box('black', [0.3, 0.012, 0.1], [-0.1, 0.98, fz + 0.09])
    b.cyl('yellow', 0.03, 0.02, [0.85, 0.75, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.02, 0.03, [0.85, 0.75, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    b.tower([-0.82, 1.72, -0.55])
  },
}
