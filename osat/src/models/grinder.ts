import { ease, type ModelDef } from './dsl'

/**
 * Back grinder / polisher (Disco DGP8761 class) with an inline tape
 * mounter (DFM2800 class) joined on its right side. Two FOUP-size load
 * ports on the front: input wafer cassette (grinder, left) and output
 * frame cassette (mounter, right). Combined ~4.6 × 2.6 m.
 * u: unused.
 */
export const backGrinder: ModelDef = {
  key: 'backGrinder',
  name: 'Back grinder + tape mounter (Disco DGP8761 / DFM2800 class)',
  size: [4.6, 2.6, 1.9],
  build(b) {
    const fz = 1.0 // front face z of the main cabinets
    const bz = -1.3
    const dz = fz - bz
    const cz = (fz + bz) / 2

    // ===================== grinder (x -2.3 .. 0.6)
    const gx = -0.85
    const gw = 2.9
    b.boxB('dark', [gw - 0.04, 0.08, dz - 0.04], [gx, 0, cz], { r: 0.01 })
    b.boxB('body', [gw, 0.87, dz], [gx, 0.08, cz], { r: 0.025 })
    // upper enclosure: solid back + roof, glass front over work area
    b.boxB('body', [gw, 0.55, 0.7], [gx, 0.95, bz + 0.35], { r: 0.02 })
    b.boxB('body', [gw, 0.06, dz], [gx, 1.5, cz], { r: 0.02 })
    for (const x of [gx - gw / 2 + 0.03, gx + gw / 2 - 0.03]) b.boxB('body', [0.06, 0.55, 1.6], [x, 0.95, fz - 0.8])
    // front frame posts + glass doors
    for (const x of [-2.27, -1.45, -0.55, 0.57]) b.boxB('dark', [0.05, 0.55, 0.05], [x, 0.95, fz - 0.03])
    b.box('glass', [2.8, 0.5, 0.012], [gx, 1.23, fz - 0.03])
    b.box('dark', [gw, 0.04, 0.06], [gx, 0.97, fz - 0.03])
    // door handles
    for (const x of [-1.5, -1.4, -0.6, -0.5]) b.box('steel', [0.02, 0.18, 0.03], [x, 1.3, fz + 0.01], { r: 0.008 })
    // lower front: seams, vents, accent + status bar
    for (const x of [-1.6, -0.6, 0.2]) b.box('panel', [0.004, 0.7, 0.002], [x, 0.48, fz + 0.001])
    for (const x of [-1.1, -0.2]) for (let i = 0; i < 4; i++) b.box('dark', [0.4, 0.014, 0.004], [x, 0.16 + i * 0.03, fz + 0.001])
    b.box('accent', [gw, 0.035, 0.006], [gx, 0.9, fz + 0.003])
    b.box('status', [1.4, 0.022, 0.01], [gx + 0.3, 0.86, fz + 0.005])

    // --- work area deck
    b.boxB('dark', [2.7, 0.04, 1.0], [gx, 0.95, 0.45])
    // coolant splash guard ring around the turntable
    const tx = -0.75
    const tz = 0.25
    b.cyl('steel', 0.62, 0.08, [tx, 1.03, tz], { open: true, seg: 40 })
    // rotating turntable with 3 chuck tables
    b.anim(
      'turntable',
      [tx, 0.99, tz],
      (s, o) => {
        // index 120° every 8 s with smooth move
        const p = (s.t + s.phase * 24) / 8
        const k = Math.floor(p)
        o.rotation.y = (k + ease.smooth((p - k) * 3)) * ((Math.PI * 2) / 3)
      },
      t => {
        t.cyl('panel', 0.58, 0.05, [0, 0.025, 0], { seg: 40 })
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3
          const x = Math.cos(a) * 0.33
          const z = Math.sin(a) * 0.33
          t.cyl('dark', 0.19, 0.03, [x, 0.065, z], { seg: 32 })
          t.cyl('steel', 0.165, 0.012, [x, 0.085, z], { seg: 32 }) // porous chuck
          t.cyl('wafer', 0.15, 0.003, [x, 0.093, z], { seg: 36 })
        }
      },
    )
    // two grinding spindles (Z1 rough, Z2 fine) on columns at the back
    for (const [i, a] of [[0, -0.35], [1, 0.95]] as const) {
      const sx = tx + Math.cos(a - Math.PI / 2) * 0.33
      const sz = tz + Math.sin(a - Math.PI / 2) * 0.33
      b.boxB('bodyAlt', [0.32, 0.5, 0.28], [sx, 0.99, -0.32], { r: 0.015 }) // column
      b.box('dark', [0.04, 0.4, 0.02], [sx, 1.25, -0.17]) // Z guide rail
      b.anim(
        `z${i + 1}`,
        [sx, 1.38, sz],
        (s, o) => {
          o.position.y = -ease.pingpong(s.t + i * 1.7 + s.phase * 9, 6) * 0.05
        },
        z => {
          z.box('bodyAlt', [0.22, 0.2, 0.2], [0, 0.0, (-0.32 - sz) + 0.18], { r: 0.015 }) // saddle
          z.cyl('body', 0.11, 0.24, [0, 0.0, 0], { seg: 24 }) // spindle motor
          z.box('accent', [0.012, 0.25, 0.012], [0, 0.02, 0.11])
          z.cyl('dark', 0.13, 0.04, [0, -0.17, 0], { seg: 24 }) // wheel cover
          z.anim(
            'wheel',
            [0, -0.25, 0],
            (s, o) => {
              o.rotation.y = s.t * (i ? 25 : 19)
            },
            w => {
              w.cyl('chrome', 0.1, 0.03, [0, 0.02, 0], { seg: 24 })
              w.cyl(i ? 'white' : 'panel', 0.1, 0.025, [0, -0.01, 0], { seg: 24, rTop: 0.1 })
              w.box('black', [0.18, 0.02, 0.02], [0, -0.02, 0])
            },
          )
          z.cyl('steel', 0.006, 0.1, [0.12, -0.18, 0.02]) // coolant nozzle
        },
      )
    }
    // --- transfer robot near the input port
    const rx = -1.8
    const rz = 0.45
    b.cyl('dark', 0.11, 0.06, [rx, 1.0, rz])
    b.anim(
      'robot',
      [rx, 1.03, rz],
      (s, o) => {
        o.rotation.y = Math.sin(s.t * 0.7 + s.phase * 6) * 1.3
      },
      r => {
        r.cyl('bodyAlt', 0.08, 0.16, [0, 0.08, 0])
        r.box('bodyAlt', [0.3, 0.05, 0.1], [0.12, 0.18, 0], { r: 0.02 })
        r.anim(
          'fore',
          [0.26, 0.2, 0],
          (s, o) => {
            o.rotation.y = -Math.sin(s.t * 0.7 + s.phase * 6) * 2
          },
          f => {
            f.box('bodyAlt', [0.26, 0.04, 0.08], [0.11, 0.02, 0], { r: 0.015 })
            f.box('steel', [0.18, 0.006, 0.06], [0.3, 0.035, 0]) // fork
            f.box('steel', [0.08, 0.006, 0.02], [0.42, 0.035, 0.025])
            f.box('steel', [0.08, 0.006, 0.02], [0.42, 0.035, -0.025])
          },
        )
      },
    )
    // spinner / cleaning cup next to robot
    b.cyl('panel', 0.18, 0.12, [-1.75, 1.0, -0.02], { seg: 28 })
    b.cyl('black', 0.15, 0.122, [-1.75, 1.0, -0.02], { seg: 28 })

    // --- input FOUP load port (grinder front-left)
    const ip = -1.85
    b.boxB('bodyAlt', [0.52, 0.9, 0.3], [ip, 0, fz + 0.15], { r: 0.015 })
    b.box('dark', [0.48, 0.02, 0.28], [ip, 0.89, fz + 0.15])
    for (const dx of [-0.2, 0.2]) b.box('steel', [0.02, 0.015, 0.26], [ip + dx, 0.905, fz + 0.15])
    b.box('black', [0.38, 0.34, 0.01], [ip, 1.1, fz - 0.005], { r: 0.01 })
    b.box('dark', [0.12, 0.06, 0.012], [ip + 0.18, 0.72, fz + 0.305], { r: 0.005 })
    b.box('lampG', [0.02, 0.02, 0.006], [ip + 0.15, 0.72, fz + 0.312])
    b.box('accent', [0.52, 0.03, 0.005], [ip, 0.5, fz + 0.303])
    b.port([ip, 0.9, fz + 0.15])

    // --- HMI (touch panel on grinder front) + keyboard + e-stop
    b.box('dark', [0.42, 0.32, 0.06], [-0.05, 1.32, fz + 0.03], { r: 0.012, rot: [-0.1, 0, 0] })
    b.box('screen', [0.37, 0.26, 0.004], [-0.05, 1.32, fz + 0.063], { rot: [-0.1, 0, 0] })
    b.box('dark', [0.46, 0.025, 0.18], [-0.05, 0.92, fz + 0.1], { r: 0.008 })
    b.box('black', [0.4, 0.012, 0.13], [-0.05, 0.94, fz + 0.1])
    b.cyl('yellow', 0.035, 0.02, [0.35, 0.72, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [0.35, 0.72, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    // exhaust / coolant ducts on the roof + back
    b.cyl('steel', 0.08, 0.1, [-1.9, 1.6, -0.9])
    b.box('steel', [0.16, 0.06, 0.7], [-1.9, 1.56, -0.95])
    b.cyl('black', 0.03, 0.9, [0.4, 0.45, bz])
    b.cyl('accent2', 0.025, 0.9, [0.48, 0.45, bz])
    b.tower([-2.15, 1.56, -1.15])

    // ===================== inline tape mounter (x 0.6 .. 2.3)
    const mx = 1.45
    const mw = 1.7
    const mfz = 0.9
    const mdz = mfz - bz
    const mcz = (mfz + bz) / 2
    b.boxB('dark', [mw - 0.04, 0.08, mdz - 0.04], [mx, 0, mcz], { r: 0.01 })
    b.boxB('bodyAlt', [mw, 0.87, mdz], [mx, 0.08, mcz], { r: 0.025 })
    b.boxB('bodyAlt', [mw, 0.55, 0.7], [mx, 0.95, bz + 0.35], { r: 0.02 })
    b.boxB('bodyAlt', [mw, 0.06, mdz], [mx, 1.5, mcz], { r: 0.02 })
    b.boxB('bodyAlt', [0.06, 0.55, 1.5], [mx + mw / 2 - 0.03, 0.95, mfz - 0.75])
    for (const x of [0.63, 1.45, 2.27]) b.boxB('dark', [0.05, 0.55, 0.05], [x, 0.95, mfz - 0.03])
    b.box('glass', [1.62, 0.5, 0.012], [mx, 1.23, mfz - 0.03])
    b.box('dark', [mw, 0.04, 0.06], [mx, 0.97, mfz - 0.03])
    for (const x of [1.4, 1.5]) b.box('steel', [0.02, 0.18, 0.03], [x, 1.3, mfz + 0.01], { r: 0.008 })
    b.box('panel', [0.004, 0.7, 0.002], [1.2, 0.48, mfz + 0.001])
    for (let i = 0; i < 4; i++) b.box('dark', [0.4, 0.014, 0.004], [1.75, 0.16 + i * 0.03, mfz + 0.001])
    b.box('accent', [mw, 0.035, 0.006], [mx, 0.9, mfz + 0.003])
    b.box('status', [0.8, 0.022, 0.01], [mx, 0.86, mfz + 0.005])
    // joining tunnel between machines
    b.box('dark', [0.08, 0.3, 0.5], [0.6, 1.15, 0.2])
    // mounter internals: tape roll, take-up roll, frame table, roller
    b.boxB('dark', [1.5, 0.04, 0.9], [mx, 0.95, 0.4])
    b.boxB('panel', [0.6, 0.5, 0.05], [1.85, 0.99, -0.4])
    for (const [x, y, z, r] of [[1.75, 1.3, 0.0, 0.13], [2.04, 1.13, -0.05, 0.09]] as const) {
      b.anim(
        `roll${r}`,
        [x, y, z - 0.1],
        (s, o) => {
          o.rotation.z = s.t * (r > 0.1 ? 0.5 : -0.7)
        },
        rl => {
          rl.cyl('tape', r, 0.32, [0, 0, 0.05], { rot: [Math.PI / 2, 0, 0], seg: 24 })
          rl.cyl('chrome', 0.03, 0.4, [0, 0, 0.05], { rot: [Math.PI / 2, 0, 0] })
          rl.box('dark', [0.02, 0.02, 0.33], [0, r, 0.05])
        },
      )
    }
    // frame table with wafer on taped ring frame
    b.boxB('panel', [0.5, 0.06, 0.5], [1.2, 0.99, 0.3], { r: 0.01 })
    b.box('steel', [0.42, 0.006, 0.42], [1.2, 1.053, 0.3], { r: 0.06 })
    b.box('tape', [0.38, 0.004, 0.38], [1.2, 1.058, 0.3], { r: 0.05 })
    b.cyl('wafer', 0.15, 0.003, [1.2, 1.062, 0.3], { seg: 36 })
    // laminating roller sweeping across the frame
    b.anim(
      'roller',
      [1.2, 1.12, 0.3],
      (s, o) => {
        o.position.x = (ease.pingpong(s.t + s.phase * 7, 5) - 0.5) * 0.36
      },
      r => {
        r.cyl('rubber', 0.03, 0.44, [0, 0, 0], { rot: [Math.PI / 2, 0, 0] })
        r.box('dark', [0.04, 0.1, 0.03], [0, 0.06, 0.23])
        r.box('dark', [0.04, 0.1, 0.03], [0, 0.06, -0.23])
        r.box('steel', [0.04, 0.03, 0.5], [0, 0.11, 0])
      },
    )
    // frame cassette elevator (output), behind output port
    b.boxB('dark', [0.46, 0.5, 0.42], [1.95, 0.99, 0.55], { r: 0.01 })
    b.boxB('black', [0.4, 0.44, 0.38], [1.95, 1.02, 0.56])

    // --- output frame cassette load port (mounter front-right)
    const op = 1.9
    b.boxB('body', [0.58, 0.9, 0.38], [op, 0, mfz + 0.19], { r: 0.015 })
    b.box('dark', [0.54, 0.02, 0.36], [op, 0.89, mfz + 0.19])
    for (const dx of [-0.23, 0.23]) b.box('steel', [0.02, 0.03, 0.34], [op + dx, 0.915, mfz + 0.19])
    b.box('black', [0.44, 0.36, 0.01], [op, 1.12, mfz - 0.005], { r: 0.01 })
    b.box('dark', [0.12, 0.06, 0.012], [op - 0.2, 0.72, mfz + 0.385], { r: 0.005 })
    b.box('lampG', [0.02, 0.02, 0.006], [op - 0.23, 0.72, mfz + 0.392])
    b.box('accent', [0.58, 0.03, 0.005], [op, 0.5, mfz + 0.383])
    b.port([op, 0.9, mfz + 0.19])
    // mounter HMI
    b.box('dark', [0.34, 0.26, 0.05], [0.95, 1.4, mfz + 0.03], { r: 0.01, rot: [-0.1, 0, 0] })
    b.box('screen', [0.3, 0.21, 0.004], [0.95, 1.4, mfz + 0.058], { rot: [-0.1, 0, 0] })
    b.cyl('yellow', 0.035, 0.02, [1.0, 0.72, mfz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [1.0, 0.72, mfz + 0.025], { rot: [Math.PI / 2, 0, 0] })
  },
}
