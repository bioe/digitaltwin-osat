import { ease, type ModelDef } from './dsl'

/**
 * Strip laser marking system (EO Technics / Han's class). Fiber laser
 * source in the base, galvo scan head above the strip track, fume extractor
 * on the side, input / output magazine elevators at each end.
 * ~1.7 × 1.3 m, ~1.9 m to the cabinet top.
 * u: unused.
 */
export const laserMarker: ModelDef = {
  key: 'laserMarker',
  name: 'Strip laser marker (EO Technics class)',
  size: [1.7, 1.3, 1.9],
  build(b) {
    // --- base cabinet (laser source + controller)
    b.boxB('dark', [1.0, 0.08, 1.06], [-0.05, 0, -0.06], { r: 0.01 })
    b.boxB('body', [1.02, 0.8, 1.1], [-0.05, 0.08, -0.06], { r: 0.025 })
    b.box('panel', [0.004, 0.66, 0.002], [-0.05, 0.44, 0.491])
    for (const dx of [-0.25, 0.15]) {
      b.box('steel', [0.1, 0.02, 0.025], [dx, 0.76, 0.5], { r: 0.008 })
      b.box('dark', [0.32, 0.06, 0.004], [dx, 0.2, 0.491])
    }
    b.box('status', [0.94, 0.025, 0.01], [-0.05, 0.86, 0.492])
    // laser warning label
    b.box('yellow', [0.08, 0.07, 0.003], [-0.38, 0.62, 0.492])
    // deck
    b.boxB('dark', [1.04, 0.05, 1.12], [-0.05, 0.88, -0.06], { r: 0.01 })
    // strip track rails full width
    for (const z of [-0.04, 0.06]) b.box('steel', [1.66, 0.025, 0.018], [0, 0.95, z])
    // marking nest / vacuum table
    b.boxB('steel', [0.3, 0.03, 0.14], [-0.05, 0.93, 0.01])
    // strip indexing along the track
    b.anim(
      'strip',
      [-0.05, 0.965, 0.01],
      (s, o) => {
        o.position.x = Math.floor(ease.saw(s.t + s.phase * 8, 8) * 6) * 0.04 - 0.1
      },
      st => {
        st.box('copper', [0.24, 0.004, 0.08], [0, 0, 0])
        for (let i = 0; i < 6; i++) st.box('black', [0.03, 0.004, 0.06], [-0.1 + i * 0.04, 0.003, 0])
      },
    )
    // laser enclosure (class 1) with glass viewing window
    b.box('body', [1.02, 0.78, 0.04], [-0.05, 1.29, -0.6])
    b.box('body', [0.04, 0.78, 1.1], [-0.54, 1.29, -0.06])
    b.box('body', [0.04, 0.78, 1.1], [0.44, 1.29, -0.06])
    b.boxB('bodyAlt', [1.04, 0.18, 1.12], [-0.05, 1.68, -0.06], { r: 0.02 })
    b.box('accent', [1.042, 0.03, 1.122], [-0.05, 1.7, -0.06])
    b.box('glass', [0.94, 0.62, 0.008], [-0.05, 1.27, 0.49])
    b.box('dark', [0.96, 0.03, 0.03], [-0.05, 0.95, 0.49])
    b.box('dark', [0.96, 0.03, 0.03], [-0.05, 1.6, 0.49])
    b.box('steel', [0.2, 0.02, 0.025], [-0.05, 1.54, 0.51], { r: 0.008 })
    // galvo support column + Z axis
    b.boxB('dark', [0.12, 0.7, 0.12], [-0.05, 0.9, -0.45], { r: 0.01 })
    b.box('dark', [0.1, 0.08, 0.38], [-0.05, 1.5, -0.27])
    // fiber cable from source
    b.cyl('orange', 0.01, 0.6, [-0.12, 1.22, -0.48])
    // galvo scan head with small XY jitter
    b.anim(
      'galvo',
      [-0.05, 1.42, -0.1],
      (s, o) => {
        o.position.x = Math.sin(s.t * 3.1 + s.phase * 5) * 0.006
        o.position.z = Math.cos(s.t * 3.7 + s.phase * 3) * 0.006
      },
      g => {
        g.boxB('accent', [0.16, 0.12, 0.18], [0, 0, 0], { r: 0.012 })
        g.boxB('dark', [0.12, 0.08, 0.12], [0, -0.08, 0.02], { r: 0.008 })
        g.cyl('black', 0.04, 0.12, [0, -0.15, 0.02])
        g.cyl('chrome', 0.045, 0.02, [0, -0.21, 0.02])
        g.cyl('glass', 0.035, 0.005, [0, -0.222, 0.02])
        // coaxial camera
        g.cyl('black', 0.02, 0.1, [0.07, 0.08, 0.04])
      },
    )
    // --- fume extractor box + duct (right side)
    b.boxB('bodyAlt', [0.36, 0.95, 0.5], [0.66, 0, -0.38], { r: 0.02 })
    b.box('dark', [0.28, 0.4, 0.004], [0.66, 0.4, -0.129])
    for (let i = 0; i < 6; i++) b.box('black', [0.26, 0.012, 0.006], [0.66, 0.24 + i * 0.05, -0.126])
    b.box('screen', [0.08, 0.04, 0.004], [0.66, 0.82, -0.129])
    b.cyl('steel', 0.05, 0.75, [0.66, 1.3, -0.45])
    b.cyl('steel', 0.05, 0.25, [0.53, 1.64, -0.45], { rot: [0, 0, Math.PI / 2] })
    b.cyl('rubber', 0.055, 0.04, [0.45, 1.64, -0.45], { rot: [0, 0, Math.PI / 2] })
    // nozzle inside near the mark area
    b.cyl('steel', 0.025, 0.3, [0.25, 1.06, -0.1], { rot: [0, 0, 1.1] })
    // --- magazine in / out elevators
    for (const side of [-1, 1]) {
      const x = side === -1 ? -0.72 : 0.66
      const z = 0.06
      b.boxB('bodyAlt', [0.26, 0.9, 0.36], [x, 0, z], { r: 0.015 })
      b.box('dark', [0.2, 0.05, 0.004], [x, 0.2, z + 0.181])
      for (const dx of [-0.11, 0.11]) b.boxB('steel', [0.02, 0.55, 0.02], [x + dx, 0.9, z + 0.15])
      b.boxB('steel', [0.24, 0.02, 0.02], [x, 1.45, z + 0.15])
      b.anim(
        `mag${side}`,
        [x, 0.92, z],
        (s, o) => {
          o.position.y = Math.floor(ease.saw(s.t + s.phase * 30 + side * 7, 40) * 8) * 0.03
        },
        m => {
          m.boxB('black', [0.2, 0.2, 0.2], [0, 0, 0], { r: 0.004 })
          for (let i = 0; i < 6; i++) m.box('copper', [0.18, 0.003, 0.18], [0, 0.03 + i * 0.03, 0])
        },
      )
    }
    b.port([-0.72, 0.92, 0.06])
    b.port([0.66, 0.92, 0.06])
    // --- HMI + keyboard + e-stop
    b.cyl('steel', 0.018, 0.3, [-0.42, 1.05, 0.55])
    b.box('dark', [0.32, 0.22, 0.03], [-0.42, 1.3, 0.57], { r: 0.01, rot: [-0.15, 0.2, 0] })
    b.box('screen', [0.28, 0.18, 0.004], [-0.415, 1.3, 0.587], { rot: [-0.15, 0.2, 0] })
    b.box('dark', [0.36, 0.025, 0.14], [0.05, 0.86, 0.58], { r: 0.008 })
    b.box('black', [0.3, 0.012, 0.1], [0.05, 0.88, 0.58])
    b.cyl('yellow', 0.03, 0.02, [0.36, 0.7, 0.5], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.02, 0.03, [0.36, 0.7, 0.515], { rot: [Math.PI / 2, 0, 0] })
    b.tower([-0.45, 1.86, -0.5])
  },
}
