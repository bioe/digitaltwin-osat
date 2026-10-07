import { ease, type ModelDef } from './dsl'

/**
 * Epoxy die bonder (ASMPT AD838 / Besi Datacon class), ~1.8 × 1.5 m incl.
 * input/output magazine elevators. Wafer table with taped wafer on its ring
 * frame (front-left), wafer frame cassette loader beside it, leadframe strip
 * track running along X at the back with epoxy dispenser and bond site,
 * pick-and-place bond head on an XY gantry.
 * Ports: [0] input magazine (left), [1] output magazine (right),
 * [2] wafer frame cassette.
 * u: unused.
 */
export const dieBonder: ModelDef = {
  key: 'dieBonder',
  name: 'Epoxy die bonder (ASMPT AD838 class)',
  size: [1.8, 1.5, 1.85],
  build(b) {
    const fz = 0.6
    const deck = 0.94
    const trackZ = -0.22
    // --- core cabinet
    b.boxB('dark', [1.16, 0.08, 1.16], [0, 0, 0], { r: 0.01 })
    b.boxB('body', [1.2, 0.86, 1.2], [0, 0.08, 0], { r: 0.025 })
    b.box('panel', [0.004, 0.7, 0.002], [0, 0.48, fz + 0.001])
    for (const dx of [-0.05, 0.05]) b.box('steel', [0.02, 0.14, 0.025], [dx, 0.55, fz + 0.012], { r: 0.008 })
    for (const dx of [-0.3, 0.3]) for (let i = 0; i < 4; i++) b.box('dark', [0.3, 0.012, 0.004], [dx, 0.16 + i * 0.03, fz + 0.001])
    for (let i = 0; i < 5; i++) b.box('dark', [0.004, 0.012, 0.6], [0.601, 0.3 + i * 0.03, -0.1])
    b.box('accent', [1.2, 0.03, 0.006], [0, 0.89, fz + 0.003])
    b.box('status', [0.8, 0.022, 0.01], [0, 0.86, fz + 0.005])
    // machine bed
    b.boxB('dark', [1.22, 0.05, 1.22], [0, 0.89, 0], { r: 0.01 })

    // --- leadframe strip track (full width into both elevators)
    for (const dz of [-0.04, 0.04]) b.box('steel', [1.78, 0.022, 0.016], [0, deck + 0.05, trackZ + dz])
    b.boxB('panel', [1.2, 0.04, 0.12], [0, deck, trackZ])
    for (const x of [-0.5, 0.0, 0.45]) b.boxB('dark', [0.04, 0.05, 0.14], [x, deck, trackZ])
    // static strips on the track
    for (const x of [-0.42, 0.42]) b.box('copper', [0.24, 0.004, 0.06], [x, deck + 0.058, trackZ])
    // bond site heater block + indexed strip
    b.boxB('copper', [0.12, 0.02, 0.07], [0.25, deck + 0.04, trackZ])
    b.anim(
      'strip',
      [0, deck + 0.058, trackZ],
      (s, o) => {
        o.position.x = Math.floor(ease.saw(s.t + s.phase * 10, 10) * 5) * 0.025
      },
      st => {
        st.box('copper', [0.24, 0.004, 0.06], [0.08, 0, 0])
        for (let i = 0; i < 6; i++) st.box('black', [0.02, 0.006, 0.02], [-0.02 + i * 0.03, 0.004, 0])
      },
    )
    // epoxy dispenser (writing head) on its own Z slide
    b.boxB('bodyAlt', [0.08, 0.36, 0.08], [0.02, deck, trackZ - 0.13], { r: 0.01 })
    b.anim(
      'dispense',
      [0.02, deck + 0.2, trackZ],
      (s, o) => {
        o.position.y = -ease.pingpong(s.t + s.phase * 4, 1.6) * 0.03
        o.position.x = Math.sin(s.t * 4) * 0.008
      },
      d => {
        d.box('bodyAlt', [0.06, 0.1, 0.14], [0, 0.04, -0.06], { r: 0.008 })
        d.cyl('white', 0.016, 0.1, [0, 0.03, 0]) // syringe
        d.cyl('orange', 0.018, 0.012, [0, 0.085, 0])
        d.cyl('chrome', 0.003, 0.05, [0, -0.045, 0], { rTop: 0.006 })
      },
    )

    // --- wafer table (XY stepping) with ejector + ring frame
    const wx = -0.12
    const wz = 0.2
    b.boxB('panel', [0.5, 0.06, 0.42], [wx, deck, wz], { r: 0.01 })
    b.cyl('chrome', 0.02, 0.06, [wx, deck + 0.09, wz]) // ejector pin cap
    b.anim(
      'waferTable',
      [wx, deck + 0.08, wz],
      (s, o) => {
        const k = Math.floor(ease.saw(s.t + s.phase * 30, 30) * 40)
        o.position.x = ((k % 8) - 3.5) * 0.012
        o.position.z = (Math.floor(k / 8) - 2) * 0.012
      },
      t => {
        t.cyl('dark', 0.2, 0.02, [0, 0, 0], { open: true, seg: 32 })
        t.box('steel', [0.4, 0.006, 0.4], [0, 0.012, 0], { r: 0.06 })
        t.box('tape', [0.36, 0.004, 0.36], [0, 0.016, 0], { r: 0.05 })
        t.cyl('wafer', 0.15, 0.003, [0, 0.02, 0], { seg: 40 })
        for (const a of [0, 1, 2, 3]) t.box('dark', [0.03, 0.015, 0.03], [Math.cos(a * 1.57 + 0.78) * 0.19, 0.02, Math.sin(a * 1.57 + 0.78) * 0.19])
      },
    )
    // wafer camera
    b.box('bodyAlt', [0.04, 0.04, 0.3], [wx + 0.14, deck + 0.4, wz - 0.1])
    b.cyl('black', 0.025, 0.12, [wx + 0.14, deck + 0.33, wz], { rot: [0, 0, 0.3] })

    // --- bond head gantry: beam along X at the back, head travels wafer <-> bond site
    for (const x of [-0.55, 0.55]) b.boxB('dark', [0.06, 0.52, 0.08], [x, deck, -0.42])
    b.box('bodyAlt', [1.16, 0.08, 0.1], [0, deck + 0.52, -0.42], { r: 0.01 })
    b.box('steel', [1.0, 0.02, 0.02], [0, deck + 0.5, -0.36])
    b.anim(
      'gantry',
      [0, deck + 0.52, -0.36],
      (s, o) => {
        // dwell at each end: smoothed pingpong
        const p = ease.smooth((ease.pingpong(s.t + s.phase * 5, 1.4) - 0.15) / 0.7)
        o.position.x = wx + (0.25 - wx) * p
      },
      g => {
        g.box('body', [0.12, 0.12, 0.06], [0, 0, 0.02], { r: 0.01 })
        g.box('accent', [0.122, 0.02, 0.062], [0, 0.04, 0.02])
        g.anim(
          'y',
          [0, -0.04, 0.05],
          (s, o) => {
            const p = ease.smooth((ease.pingpong(s.t + s.phase * 5, 1.4) - 0.15) / 0.7)
            o.position.z = (wz + 0.36 - 0.05) * (1 - p) + (trackZ + 0.36 - 0.05) * p
          },
          y => {
            y.box('bodyAlt', [0.06, 0.04, 0.36], [0, 0, -0.14], { r: 0.008 }) // Y arm
            y.box('bodyAlt', [0.08, 0.18, 0.08], [0, -0.06, 0], { r: 0.012 })
            y.anim(
              'z',
              [0, -0.16, 0],
              (s, o) => {
                const x = ease.pingpong(s.t + s.phase * 5, 1.4)
                // bob down at both ends of the swing
                o.position.y = -Math.max(0, Math.abs(x - 0.5) - 0.4) * 0.3
              },
              z => {
                z.cyl('chrome', 0.012, 0.16, [0, -0.08, 0])
                z.cyl('black', 0.008, 0.02, [0, -0.17, 0]) // rubber collet
              },
            )
          },
        )
      },
    )

    // --- wafer frame cassette loader (front-left)
    const cx = -0.46
    const cz = 0.38
    b.boxB('bodyAlt', [0.26, 0.42, 0.42], [cx, deck, cz], { r: 0.01 })
    b.box('glass', [0.24, 0.36, 0.006], [cx, deck + 0.2, cz + 0.212])
    b.anim(
      'frameCassette',
      [cx, deck + 0.04, cz],
      (s, o) => {
        o.position.y = Math.floor(ease.saw(s.t + s.phase * 60, 60) * 8) * 0.012
      },
      c => {
        for (const dz of [-0.17, 0.17]) c.boxB('black', [0.2, 0.24, 0.02], [0, 0, dz])
        for (let i = 0; i < 5; i++) c.box('steel', [0.2, 0.004, 0.34], [0, 0.03 + i * 0.04, 0])
      },
    )
    b.box('dark', [0.26, 0.02, 0.42], [cx, deck + 0.43, cz])

    // --- input / output magazine elevators
    for (const side of [-1, 1]) {
      const x = side * 0.75
      b.boxB('bodyAlt', [0.3, 0.92, 0.7], [x, 0, -0.1], { r: 0.02 })
      b.box('dark', [0.004, 0.5, 0.5], [x + side * 0.151, 0.5, -0.1])
      b.box('status', [0.2, 0.015, 0.008], [x, 0.85, 0.252])
      for (const dz of [-0.36, 0.16]) b.boxB('steel', [0.025, 0.56, 0.025], [x + side * 0.12, 0.92, dz])
      b.boxB('glass', [0.28, 0.54, 0.5], [x, 0.92, -0.1])
      b.box('dark', [0.3, 0.02, 0.52], [x, 1.47, -0.1])
      b.anim(
        `mag${side}`,
        [x, 0.98, trackZ],
        (s, o) => {
          o.position.y = Math.floor(ease.saw(s.t + s.phase * 40 + (side > 0 ? 15 : 0), 40) * 8) * 0.025
        },
        m => {
          m.boxB('black', [0.26, 0.22, 0.1], [0, 0, 0], { r: 0.004 })
          for (let i = 0; i < 7; i++) m.box('copper', [0.24, 0.003, 0.06], [0, 0.025 + i * 0.028, 0])
        },
      )
    }
    b.port([-0.75, 1.48, -0.1])
    b.port([0.75, 1.48, -0.1])
    b.port([cx, deck + 0.44, cz])

    // --- safety hood over the work area
    b.boxB('glass', [1.16, 0.56, 0.9], [0.04, deck + 0.02, 0.1], { r: 0.02 })
    b.box('dark', [1.18, 0.025, 0.92], [0.04, deck + 0.59, 0.1], { r: 0.008 })
    b.box('steel', [0.3, 0.02, 0.03], [0.2, deck + 0.3, 0.57], { r: 0.008 })
    // --- HMI monitor on swing arm + keyboard + e-stop
    b.cyl('steel', 0.02, 0.5, [0.5, 1.25, 0.66])
    b.box('dark', [0.38, 0.27, 0.03], [0.5, 1.58, 0.7], { r: 0.01, rot: [-0.15, -0.25, 0] })
    b.box('screen', [0.34, 0.22, 0.004], [0.497, 1.58, 0.717], { rot: [-0.15, -0.25, 0] })
    b.box('dark', [0.42, 0.025, 0.16], [-0.1, 0.92, 0.7], { r: 0.008 })
    b.box('black', [0.36, 0.012, 0.12], [-0.1, 0.94, 0.7])
    b.cyl('yellow', 0.035, 0.02, [0.45, 0.7, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [0.45, 0.7, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    // cable carrier / air hoses at back
    b.box('black', [0.9, 0.03, 0.06], [0, deck + 0.6, -0.5])
    b.cyl('accent2', 0.012, 0.6, [0.5, 0.6, -0.61])
    b.tower([0.55, deck + 0.52, -0.42])
  },
}
