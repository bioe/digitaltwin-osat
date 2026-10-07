import { ease, type ModelDef } from './dsl'

/**
 * Ball bonder, K&S RAPID / ASMPT AERO class, with input and output
 * magazine handlers. Real machine core is ~0.95 × 0.98 m; with both
 * elevators the line is ~1.9 m wide, ~1.75 m to the top of the tower.
 * u: unused.
 */
export const wireBonder: ModelDef = {
  key: 'wireBonder',
  name: 'Cu ball bonder (K&S RAPID class)',
  size: [1.9, 1.0, 1.75],
  build(b) {
    // --- core cabinet
    b.boxB('dark', [0.96, 0.08, 0.86], [0, 0, 0], { r: 0.01 })
    b.boxB('body', [0.98, 0.84, 0.9], [0, 0.08, 0], { r: 0.025 })
    // door seams and handles
    b.box('panel', [0.004, 0.7, 0.002], [0, 0.48, 0.451])
    b.box('steel', [0.12, 0.02, 0.025], [-0.2, 0.75, 0.46], { r: 0.008 })
    b.box('steel', [0.12, 0.02, 0.025], [0.2, 0.75, 0.46], { r: 0.008 })
    b.box('dark', [0.3, 0.06, 0.004], [-0.25, 0.2, 0.451]) // vent
    b.box('dark', [0.3, 0.06, 0.004], [0.25, 0.2, 0.451])
    // status light bar along the front
    b.box('status', [0.9, 0.025, 0.01], [0, 0.885, 0.452])
    // granite / cast top deck
    b.boxB('dark', [1.0, 0.06, 0.92], [0, 0.92, 0], { r: 0.01 })
    // indexer rails running full width (strip transport)
    for (const z of [-0.045, 0.045]) b.box('steel', [1.86, 0.025, 0.018], [0, 1.0, z + 0.05])
    // heat block / bond site
    b.boxB('copper', [0.16, 0.03, 0.09], [0, 0.98, 0.05])
    // strip being bonded
    b.box('copper', [0.24, 0.004, 0.07], [0, 1.012, 0.05])
    // XY table base behind bond site
    b.boxB('panel', [0.5, 0.12, 0.34], [0, 0.98, -0.26], { r: 0.01 })
    // optics / camera tower
    b.cyl('black', 0.03, 0.18, [0.16, 1.22, -0.02])
    b.cyl('chrome', 0.035, 0.03, [0.16, 1.14, -0.02])
    // --- bondhead on XY table (moves while running)
    b.anim(
      'xy',
      [0, 1.1, -0.22],
      (s, o) => {
        o.position.x = Math.sin(s.t * 1.7 + s.phase * 6) * 0.04
        o.position.z = Math.cos(s.t * 1.3 + s.phase * 4) * 0.02
      },
      h => {
        h.boxB('body', [0.22, 0.2, 0.26], [0, 0, 0], { r: 0.02 })
        h.box('accent', [0.222, 0.03, 0.262], [0, 0.17, 0])
        // transducer horn reaching to the bond site
        h.anim(
          'z',
          [0, 0.06, 0.13],
          (s, o) => {
            o.position.y = -ease.pingpong(s.t, 0.22) * 0.012
          },
          z => {
            z.cyl('chrome', 0.012, 0.2, [0, 0, 0.08], { rot: [Math.PI / 2, 0, 0], rTop: 0.006 })
            z.cyl('steel', 0.003, 0.05, [0, -0.03, 0.18])
          },
        )
        // wire spool + tensioner
        h.cyl('copper', 0.035, 0.03, [0.06, 0.29, -0.02], { rot: [0, 0, Math.PI / 2] })
        h.cyl('dark', 0.012, 0.09, [0.0, 0.24, 0.02])
      },
    )
    // safety hood (glass) over the work area
    b.boxB('glass', [0.86, 0.42, 0.62], [0, 0.98, -0.06], { r: 0.02 })
    b.box('dark', [0.88, 0.02, 0.64], [0, 1.41, -0.06], { r: 0.008 })
    // --- input and output magazine elevators
    for (const side of [-1, 1]) {
      const x = side * 0.72
      b.boxB('bodyAlt', [0.42, 0.9, 0.78], [x, 0, -0.04], { r: 0.02 })
      b.box('dark', [0.004, 0.6, 0.6], [x - side * 0.211, 0.5, -0.04])
      // elevator frame
      for (const dx of [-0.17, 0.17]) b.boxB('steel', [0.025, 0.72, 0.025], [x + dx, 0.9, 0.3])
      b.boxB('steel', [0.38, 0.025, 0.025], [x, 1.6, 0.3])
      b.boxB('glass', [0.4, 0.7, 0.5], [x, 0.9, 0.0])
      // stepping magazine
      b.anim(
        `mag${side}`,
        [x, 0.95, 0.0],
        (s, o) => {
          o.position.y = Math.floor(ease.saw(s.t + s.phase * 30, 30) * 8) * 0.03
        },
        m => {
          m.boxB('black', [0.26, 0.2, 0.08], [0, 0, 0], { r: 0.004 })
          for (let i = 0; i < 6; i++) m.box('copper', [0.24, 0.003, 0.07], [0, 0.03 + i * 0.03, 0])
        },
      )
    }
    b.port([-0.72, 1.62, 0.3])
    // --- HMI monitor on swing arm (front right)
    b.cyl('steel', 0.02, 0.4, [0.38, 1.12, 0.4])
    b.box('dark', [0.36, 0.25, 0.03], [0.38, 1.38, 0.43], { r: 0.01, rot: [-0.15, -0.25, 0] })
    b.box('screen', [0.32, 0.2, 0.004], [0.375, 1.38, 0.448], { rot: [-0.15, -0.25, 0] })
    // keyboard tray + e-stop
    b.box('dark', [0.4, 0.025, 0.16], [-0.1, 0.9, 0.52], { r: 0.008 })
    b.box('black', [0.34, 0.012, 0.12], [-0.1, 0.92, 0.52])
    b.cyl('yellow', 0.035, 0.02, [0.4, 0.9, 0.46], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [0.4, 0.9, 0.48], { rot: [Math.PI / 2, 0, 0] })
    b.tower([0.42, 1.42, -0.3])
  },
}
