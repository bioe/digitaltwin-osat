import { ease, type Builder, type ModelDef } from './dsl'

/**
 * Dual-spindle dicing saw (Disco DFD6362 class), ~1.2 × 1.5 m. Frame
 * cassette elevator on the front-left; glass window shows the chuck table
 * with a taped wafer on its ring frame, and two facing spindles (Z1/Z2)
 * with blade covers. Chuck cuts along X, spindles index in Y (our Z).
 * u: unused.
 */
export const dicingSaw: ModelDef = {
  key: 'dicingSaw',
  name: 'Dual-spindle dicing saw (Disco DFD6362 class)',
  size: [1.2, 1.5, 1.8],
  build(root) {
    // shift back so the front overhang (keyboard, port shelf) stays in the footprint
    root.group([0, 0, -0.08], undefined, b => buildSaw(b))
  },
}

function buildSaw(b: Builder) {
  {
    const fz = 0.72
    // --- base cabinet
    b.boxB('dark', [1.16, 0.08, 1.4], [0, 0, 0], { r: 0.01 })
    b.boxB('body', [1.2, 0.86, 1.44], [0, 0.08, 0], { r: 0.025 })
    b.box('panel', [0.004, 0.68, 0.002], [0.05, 0.48, fz + 0.001])
    b.box('steel', [0.02, 0.14, 0.025], [0.01, 0.55, fz + 0.012], { r: 0.008 })
    b.box('steel', [0.02, 0.14, 0.025], [0.09, 0.55, fz + 0.012], { r: 0.008 })
    for (let i = 0; i < 4; i++) b.box('dark', [0.36, 0.012, 0.004], [0.3, 0.16 + i * 0.03, fz + 0.001])
    for (let i = 0; i < 5; i++) b.box('dark', [0.004, 0.012, 0.5], [0.601, 0.25 + i * 0.03, -0.2])
    b.box('accent', [1.2, 0.03, 0.006], [0, 0.88, fz + 0.003])
    b.box('status', [0.7, 0.022, 0.01], [0.15, 0.85, fz + 0.005])
    // --- upper enclosure: back block + roof, glass window on front-right
    b.boxB('body', [1.2, 0.42, 0.5], [0, 0.94, -0.47], { r: 0.02 })
    b.boxB('body', [1.2, 0.06, 1.44], [0, 1.36, 0], { r: 0.02 })
    b.boxB('body', [0.06, 0.42, 0.94], [0.57, 0.94, 0.25])
    b.boxB('body', [0.5, 0.42, 0.62], [-0.35, 0.94, 0.09]) // left: cleaner module
    for (const x of [-0.58, -0.12]) b.boxB('body', [0.04, 0.42, 0.32], [x, 0.94, 0.56]) // cassette bay walls
    b.boxB('dark', [0.04, 0.42, 0.04], [-0.1, 0.94, fz - 0.02])
    b.boxB('dark', [0.04, 0.42, 0.04], [0.58, 0.94, fz - 0.02])
    b.box('dark', [0.7, 0.04, 0.04], [0.24, 1.34, fz - 0.02])
    b.box('glass', [0.66, 0.36, 0.01], [0.24, 1.15, fz - 0.02])
    b.box('steel', [0.18, 0.02, 0.03], [0.24, 1.3, fz + 0.01], { r: 0.008 })
    // --- frame cassette elevator port (front-left)
    b.box('black', [0.42, 0.4, 0.01], [-0.35, 1.15, 0.405])
    b.box('dark', [0.42, 0.02, 0.2], [-0.35, 0.95, fz + 0.09])
    b.box('glass', [0.38, 0.34, 0.006], [-0.35, 1.15, fz + 0.012])
    b.anim(
      'elevator',
      [-0.35, 0.96, fz - 0.15],
      (s, o) => {
        o.position.y = Math.floor(ease.saw(s.t + s.phase * 50, 50) * 10) * 0.012
      },
      e => {
        e.boxB('dark', [0.36, 0.02, 0.36], [0, 0, 0])
        for (const dx of [-0.17, 0.17]) e.boxB('black', [0.02, 0.24, 0.34], [dx, 0.02, 0])
        for (let i = 0; i < 6; i++) e.box('steel', [0.32, 0.004, 0.32], [0, 0.05 + i * 0.035, 0], { r: 0.04 })
      },
    )
    b.port([-0.35, 0.95, fz + 0.09])
    // spinner cleaner lid (top of left module)
    b.cyl('panel', 0.16, 0.04, [-0.35, 1.43, 0.1])
    // --- work area deck + X-axis bellows
    b.boxB('dark', [0.6, 0.04, 0.9], [0.24, 0.94, 0.25])
    b.box('black', [0.56, 0.03, 0.12], [0.24, 0.99, 0.1])
    for (let i = 0; i < 8; i++) b.box('dark', [0.01, 0.04, 0.13], [0.0 + i * 0.07, 1.0, 0.1])
    // chuck table moving along X (cutting feed)
    b.anim(
      'chuckX',
      [0.24, 1.0, 0.1],
      (s, o) => {
        o.position.x = (ease.pingpong(s.t + s.phase * 3, 2.4) - 0.5) * 0.24
      },
      c => {
        c.boxB('panel', [0.26, 0.04, 0.26], [0, 0, 0], { r: 0.01 })
        c.cyl('dark', 0.1, 0.05, [0, 0.065, 0], { seg: 28 })
        c.cyl('steel', 0.095, 0.01, [0, 0.095, 0], { seg: 28 })
        c.box('steel', [0.3, 0.004, 0.3], [0, 0.101, 0], { r: 0.04 }) // ring frame
        c.box('tape', [0.26, 0.003, 0.26], [0, 0.103, 0], { r: 0.035 })
        c.cyl('wafer', 0.1, 0.002, [0, 0.106, 0], { seg: 32 })
        for (const dx of [-0.135, 0.135]) c.box('dark', [0.02, 0.02, 0.06], [dx, 0.11, 0]) // frame clamps
      },
    )
    // gantry bridge carrying the two facing spindles
    b.boxB('bodyAlt', [0.08, 0.36, 0.1], [0.24, 0.94, -0.18], { r: 0.01 })
    b.box('bodyAlt', [0.12, 0.07, 0.6], [0.24, 1.31, 0.1], { r: 0.01 })
    for (const side of [-1, 1]) {
      b.anim(
        `spindle${side}`,
        [0.24, 1.17, 0.1 + side * 0.16],
        (s, o) => {
          const k = Math.floor(ease.saw(s.t + s.phase * 3 + (side > 0 ? 1.2 : 0), 24) * 10)
          o.position.z = side * (k * 0.004) - side * 0.02
          o.position.y = -ease.pingpong(s.t + s.phase * 3, 2.4) * 0.006
        },
        sp => {
          sp.box('bodyAlt', [0.08, 0.12, 0.08], [0, 0.08, side * 0.04], { r: 0.01 }) // Z slide
          sp.cyl('body', 0.04, 0.14, [0, 0, side * 0.03], { rot: [Math.PI / 2, 0, 0] })
          sp.box('accent', [0.082, 0.012, 0.1], [0, 0.04, side * 0.03])
          sp.cyl('chrome', 0.015, 0.03, [0, 0, -side * 0.055], { rot: [Math.PI / 2, 0, 0] })
          // blade cover (half shell) + coolant nozzles
          sp.box('steel', [0.08, 0.05, 0.03], [0, 0.015, -side * 0.08], { r: 0.008 })
          sp.cyl('steel', 0.004, 0.06, [0.035, -0.01, -side * 0.08], { rot: [0, 0, Math.PI / 2] })
          sp.anim(
            'blade',
            [0, 0, -side * 0.075],
            (s, o) => {
              o.rotation.z = s.t * 40
            },
            bl => {
              bl.cyl('chrome', 0.028, 0.002, [0, 0, 0], { rot: [Math.PI / 2, 0, 0], seg: 24 })
              bl.box('dark', [0.04, 0.004, 0.003], [0, 0, 0])
            },
          )
        },
      )
    }
    // microscope / alignment camera
    b.cyl('black', 0.02, 0.12, [0.42, 1.2, 0.1])
    // --- HMI monitor on arm + keyboard + e-stop
    b.cyl('steel', 0.02, 0.14, [0.4, 1.46, 0.62])
    b.box('dark', [0.36, 0.25, 0.03], [0.4, 1.62, 0.66], { r: 0.01, rot: [-0.15, -0.15, 0] })
    b.box('screen', [0.32, 0.2, 0.004], [0.398, 1.62, 0.677], { rot: [-0.15, -0.15, 0] })
    b.box('dark', [0.4, 0.025, 0.16], [0.25, 0.9, fz + 0.1], { r: 0.008 })
    b.box('black', [0.34, 0.012, 0.12], [0.25, 0.92, fz + 0.1])
    b.cyl('yellow', 0.035, 0.02, [0.5, 0.7, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [0.5, 0.7, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    // exhaust duct + utility hoses at the back
    b.cyl('steel', 0.06, 0.1, [-0.35, 1.47, -0.5])
    b.cyl('black', 0.02, 0.8, [0.45, 0.48, -0.73])
    b.cyl('accent2', 0.02, 0.8, [0.5, 0.48, -0.73])
    b.tower([0.5, 1.42, -0.6])
  }
}

/**
 * UV irradiation unit for dicing tape release (aux equipment), ~0.6 × 0.7 m.
 * Frame drawer at the front, UV lamp house behind a small window.
 * u: unused.
 */
export const uvCurer: ModelDef = {
  key: 'uvCurer',
  name: 'UV tape curer (Disco DCS / Nitto UM class)',
  size: [0.6, 0.7, 1.3],
  build(b) {
    const fz = 0.33
    b.boxB('dark', [0.56, 0.06, 0.62], [0, 0, 0], { r: 0.01 })
    b.boxB('bodyAlt', [0.6, 0.5, 0.66], [0, 0.06, 0], { r: 0.02 })
    b.boxB('body', [0.6, 0.3, 0.66], [0, 0.56, 0], { r: 0.02 })
    b.box('dark', [0.6, 0.02, 0.66], [0, 0.56, 0])
    // lower door with seams/handle/vents
    b.box('panel', [0.5, 0.004, 0.002], [0, 0.36, fz + 0.001])
    b.box('steel', [0.14, 0.02, 0.025], [0, 0.3, fz + 0.012], { r: 0.008 })
    for (let i = 0; i < 4; i++) b.box('dark', [0.3, 0.012, 0.004], [0, 0.12 + i * 0.03, fz + 0.001])
    b.box('status', [0.4, 0.02, 0.01], [0, 0.52, fz + 0.005])
    b.box('accent', [0.6, 0.025, 0.006], [0, 0.48, fz + 0.003])
    // frame drawer (slides out and back)
    b.anim(
      'drawer',
      [0, 0.58, fz],
      (s, o) => {
        const p = ease.saw(s.t + s.phase * 20, 20)
        o.position.z = p < 0.1 ? Math.sin((p / 0.1) * Math.PI) * 0.12 : 0
      },
      d => {
        d.box('panel', [0.5, 0.08, 0.02], [0, 0.04, 0.01], { r: 0.008 })
        d.box('steel', [0.16, 0.02, 0.025], [0, 0.05, 0.03], { r: 0.008 })
        d.box('steel', [0.42, 0.006, 0.36], [0, 0.04, -0.18], { r: 0.05 })
        d.box('tape', [0.36, 0.004, 0.32], [0, 0.045, -0.18], { r: 0.04 })
      },
    )
    // UV window (glowing chamber) + controls
    b.box('dark', [0.32, 0.14, 0.01], [-0.08, 0.76, fz + 0.002], { r: 0.008 })
    b.box('glass', [0.28, 0.1, 0.008], [-0.08, 0.76, fz + 0.006])
    b.box('accent2', [0.26, 0.02, 0.01], [-0.08, 0.78, fz - 0.02])
    b.box('screen', [0.12, 0.09, 0.006], [0.18, 0.78, fz + 0.004])
    b.cyl('yellow', 0.03, 0.02, [0.2, 0.66, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.018, 0.025, [0.2, 0.66, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    // exhaust fan on top-back
    b.cyl('dark', 0.07, 0.03, [-0.12, 0.875, -0.15])
    b.port([0, 0.63, fz + 0.04])
    b.tower([0.22, 0.86, -0.25])
  },
}
