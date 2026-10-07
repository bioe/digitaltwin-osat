import { ease, type ModelDef } from './dsl'

/**
 * Batch snap-cure / post-mold-cure oven, ~1.3 × 1.1 m, 2.0 m to the top of
 * the exhaust duct. Double-wall cabinet, big front door with window and two
 * latch handles, controller column on the right, exhaust fan on the roof.
 * Port: magazine shelf inside the chamber (front edge, middle shelf).
 * u: unused.
 */
export const cureOven: ModelDef = {
  key: 'cureOven',
  name: 'Batch cure oven (snap / post-mold cure)',
  size: [1.3, 1.1, 2.0],
  build(b) {
    const fz = 0.5
    const top = 1.55
    // plinth + leveling feet
    b.boxB('dark', [1.26, 0.1, 0.96], [0, 0.02, 0], { r: 0.01 })
    for (const x of [-0.58, 0.58]) for (const z of [-0.42, 0.42]) b.cyl('black', 0.03, 0.03, [x, 0.015, z])
    // outer cabinet (double wall shell) + roof cap
    b.boxB('bodyAlt', [0.3, top - 0.12, 1.0], [0.5, 0.12, 0], { r: 0.02 }) // controller column
    for (const x of [-0.62, 0.32]) b.boxB('bodyAlt', [0.06, top - 0.12, 1.0], [x, 0.12, 0]) // chamber side walls
    b.boxB('bodyAlt', [0.9, 0.2, 1.0], [-0.15, 0.12, 0]) // chamber floor
    b.boxB('bodyAlt', [0.9, 0.14, 1.0], [-0.15, top - 0.14, 0]) // chamber roof
    b.boxB('bodyAlt', [0.9, top - 0.12, 0.06], [-0.15, 0.12, -0.47]) // back wall
    b.boxB('panel', [1.32, 0.03, 1.02], [0, top, 0], { r: 0.01 })
    // side insulation seams
    for (const y of [0.6, 1.1]) b.box('panel', [1.302, 0.004, 0.9], [0, y, 0])
    // --- chamber door (left 1.0 m)
    const dx = -0.15
    b.box('dark', [0.98, 1.3, 0.02], [dx, 0.85, fz + 0.005], { r: 0.012 }) // door gasket frame
    b.box('body', [0.94, 1.26, 0.06], [dx, 0.85, fz + 0.035], { r: 0.02 })
    b.box('bodyAlt', [0.86, 1.18, 0.006], [dx, 0.85, fz + 0.067]) // inner panel inset
    // window with frame
    b.box('dark', [0.44, 0.38, 0.012], [dx, 1.12, fz + 0.07], { r: 0.01 })
    b.box('glass', [0.38, 0.32, 0.014], [dx, 1.12, fz + 0.072])
    // interior visible through window: shelves + magazines + heater glow strip
    b.box('steel', [0.85, 1.1, 0.01], [dx, 0.88, -0.43]) // inner liner
    for (const y of [0.55, 0.85, 1.15]) {
      b.box('steel', [0.85, 0.01, 0.75], [dx, y, 0.05])
      for (const x of [-0.35, -0.12, 0.11]) b.boxB('black', [0.18, 0.2, 0.08], [dx + x + 0.12, y + 0.005, 0.1], { r: 0.004 })
    }
    b.box('orange', [0.7, 0.02, 0.01], [dx, 1.4, -0.42])
    // hinges (left) and two latch handles (right)
    for (const y of [0.4, 1.3]) b.cyl('chrome', 0.02, 0.12, [dx - 0.48, y, fz + 0.04])
    for (const y of [0.6, 1.1]) {
      b.box('chrome', [0.04, 0.05, 0.05], [dx + 0.4, y, fz + 0.08], { r: 0.01 })
      b.box('chrome', [0.03, 0.18, 0.03], [dx + 0.4, y - 0.08, fz + 0.12], { r: 0.012 })
    }
    b.box('yellow', [0.3, 0.06, 0.004], [dx, 1.42, fz + 0.068]) // HOT warning label
    b.box('status', [0.7, 0.02, 0.01], [dx, 0.2, fz + 0.006])
    b.port([dx, 0.86, fz - 0.1])
    // --- controller column (right 0.3 m)
    const cx = 0.5
    b.box('panel', [0.004, 1.4, 0.002], [0.35, 0.86, fz + 0.001])
    b.box('dark', [0.24, 0.32, 0.02], [cx, 1.3, fz + 0.01], { r: 0.01 })
    b.box('screen', [0.2, 0.26, 0.004], [cx, 1.3, fz + 0.022])
    // temperature controller + buttons
    b.box('black', [0.12, 0.08, 0.02], [cx, 1.05, fz + 0.01])
    b.box('red', [0.05, 0.02, 0.004], [cx, 1.06, fz + 0.022])
    for (const [i, m] of (['lampG', 'lampY', 'accent'] as const).entries()) b.cyl(m, 0.015, 0.02, [cx - 0.06 + i * 0.06, 0.92, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('yellow', 0.035, 0.02, [cx, 0.78, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [cx, 0.78, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    for (let i = 0; i < 6; i++) b.box('dark', [0.2, 0.012, 0.004], [cx, 0.25 + i * 0.03, fz + 0.001])
    b.box('accent', [0.3, 0.03, 0.006], [cx, 1.48, fz + 0.003])
    // N2 inlet + chart recorder pipe on the side
    b.cyl('steel', 0.012, 0.6, [0.66, 0.6, -0.2])
    b.cyl('accent2', 0.012, 0.6, [0.66, 0.6, -0.1])
    // --- exhaust duct + fan on roof
    const ex = -0.25
    const ez = -0.2
    b.boxB('dark', [0.4, 0.06, 0.4], [ex, top + 0.03, ez], { r: 0.01 })
    b.cyl('steel', 0.16, 0.14, [ex, top + 0.16, ez], { seg: 28 })
    b.cyl('steel', 0.17, 0.008, [ex, top + 0.235, ez], { seg: 28, open: true })
    b.anim(
      'fan',
      [ex, top + 0.2, ez],
      (s, o) => {
        o.rotation.y = s.t * 6 + s.phase * 6
      },
      f => {
        f.cyl('dark', 0.03, 0.03, [0, 0, 0])
        for (let i = 0; i < 5; i++) f.box('panel', [0.13, 0.004, 0.04], [0.075, 0, 0], { rot: [0.35, (i * Math.PI * 2) / 5, 0] })
      },
    )
    // grille spokes over the fan
    for (const a of [0, Math.PI / 2]) b.box('steel', [0.32, 0.008, 0.01], [ex, top + 0.235, ez], { rot: [0, a, 0] })
    // duct elbow up to the ceiling exhaust
    b.cyl('steel', 0.08, 0.22, [0.25, top + 0.14, -0.3])
    b.cyl('steel', 0.08, 0.14, [0.25, top + 0.32, -0.3], { rot: [0, 0, 0] })
    b.torus('steel', 0.08, 0.02, [0.25, top + 0.25, -0.3], { rot: [Math.PI / 2, 0, 0] })
    b.tower([0.5, top + 0.03, 0.3])
  },
}

/**
 * In-line strip plasma cleaner (Nordson MARCH AP / FlexTRAK class),
 * ~1.2 × 1.0 m. Central vacuum chamber with glowing window and lifting lid,
 * input (left) / output (right) magazine elevators, RF generator + pump below.
 * Ports: [0] input magazine, [1] output magazine.
 * u: unused.
 */
export const plasmaCleaner: ModelDef = {
  key: 'plasmaCleaner',
  name: 'Strip plasma cleaner (Nordson MARCH class)',
  size: [1.2, 1.0, 1.8],
  build(b) {
    const fz = 0.45
    const deck = 0.95
    // --- base cabinet (RF generator, vacuum pump)
    b.boxB('dark', [0.58, 0.08, 0.86], [0, 0, 0], { r: 0.01 })
    b.boxB('body', [0.6, 0.87, 0.9], [0, 0.08, 0], { r: 0.025 })
    b.box('panel', [0.004, 0.7, 0.002], [0, 0.48, fz + 0.001])
    for (const x of [-0.04, 0.04]) b.box('steel', [0.02, 0.14, 0.025], [x, 0.55, fz + 0.012], { r: 0.008 })
    for (const x of [-0.16, 0.16]) for (let i = 0; i < 5; i++) b.box('dark', [0.2, 0.012, 0.004], [x, 0.15 + i * 0.03, fz + 0.001])
    b.box('accent', [0.6, 0.03, 0.006], [0, 0.89, fz + 0.003])
    b.box('status', [0.5, 0.02, 0.01], [0, 0.86, fz + 0.005])
    // --- vacuum chamber
    b.boxB('dark', [0.62, 0.04, 0.6], [0, deck, -0.02], { r: 0.01 })
    b.boxB('steel', [0.5, 0.26, 0.46], [0, deck + 0.04, -0.02], { r: 0.02 })
    b.box('dark', [0.32, 0.14, 0.01], [0, deck + 0.17, 0.212], { r: 0.01 })
    b.box('glass', [0.28, 0.1, 0.01], [0, deck + 0.17, 0.218])
    b.box('status', [0.26, 0.08, 0.004], [0, deck + 0.17, 0.205]) // plasma glow behind window
    // strip transport rails through the chamber
    for (const dz of [-0.03, 0.03]) b.box('steel', [1.18, 0.015, 0.012], [0, deck + 0.12, dz])
    // RF match box + gauges behind chamber
    b.boxB('bodyAlt', [0.3, 0.2, 0.14], [0, deck + 0.04, -0.34], { r: 0.01 })
    b.cyl('chrome', 0.03, 0.04, [0.18, deck + 0.24, -0.3])
    b.cyl('black', 0.03, 0.01, [0.18, deck + 0.24, -0.3 + 0.0], { rot: [0, 0, 0] })
    b.cyl('steel', 0.04, 0.4, [-0.2, 0.75, -0.35]) // pump foreline
    // lifting chamber lid on two guide rods
    for (const x of [-0.22, 0.22]) b.cyl('chrome', 0.012, 0.3, [x, deck + 0.4, -0.2])
    b.anim(
      'lid',
      [0, deck + 0.3, -0.02],
      (s, o) => {
        const p = ease.saw(s.t + s.phase * 18, 18)
        o.position.y = p < 0.15 ? Math.sin((p / 0.15) * Math.PI) * 0.08 : 0
      },
      l => {
        l.boxB('steel', [0.52, 0.04, 0.48], [0, 0, 0], { r: 0.015 })
        l.boxB('bodyAlt', [0.5, 0.03, 0.46], [0, 0.04, 0], { r: 0.012 })
        for (const x of [-0.12, 0.12]) l.box('steel', [0.08, 0.025, 0.03], [x, 0.085, 0.22], { r: 0.008 })
        l.cyl('copper', 0.04, 0.04, [0, 0.09, -0.1]) // RF feedthrough
      },
    )
    // --- magazine elevators
    for (const side of [-1, 1]) {
      const x = side * 0.45
      b.boxB('bodyAlt', [0.3, 0.95, 0.76], [x, 0, -0.02], { r: 0.02 })
      b.box('dark', [0.004, 0.5, 0.5], [x + side * 0.151, 0.5, -0.02])
      b.box('accent', [0.3, 0.03, 0.006], [x, 0.89, 0.363])
      for (const dz of [-0.28, 0.24]) b.boxB('steel', [0.025, 0.42, 0.025], [x + side * 0.12, deck, dz])
      b.boxB('glass', [0.28, 0.4, 0.56], [x, deck, -0.02])
      b.box('dark', [0.3, 0.02, 0.58], [x, deck + 0.41, -0.02])
      b.anim(
        `mag${side}`,
        [x, deck + 0.02, 0],
        (s, o) => {
          o.position.y = Math.floor(ease.saw(s.t + s.phase * 24 + (side > 0 ? 9 : 0), 24) * 8) * 0.018
        },
        m => {
          m.boxB('black', [0.26, 0.24, 0.1], [0, 0, 0], { r: 0.004 })
          for (let i = 0; i < 7; i++) m.box('copper', [0.24, 0.003, 0.06], [0, 0.025 + i * 0.03, 0])
        },
      )
    }
    b.port([-0.45, deck + 0.42, -0.02])
    b.port([0.45, deck + 0.42, -0.02])
    // --- HMI monitor on arm + e-stop + keyboard
    b.cyl('steel', 0.02, 0.4, [0.22, deck + 0.2, 0.4])
    b.box('dark', [0.34, 0.24, 0.03], [0.22, deck + 0.5, 0.43], { r: 0.01, rot: [-0.15, -0.2, 0] })
    b.box('screen', [0.3, 0.19, 0.004], [0.217, deck + 0.5, 0.447], { rot: [-0.15, -0.2, 0] })
    b.box('dark', [0.36, 0.025, 0.14], [0, 0.92, 0.53], { r: 0.008 })
    b.box('black', [0.3, 0.012, 0.1], [0, 0.94, 0.53])
    b.cyl('yellow', 0.035, 0.02, [0.22, 0.7, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [0.22, 0.7, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    // gas lines (Ar / O2) at the back
    for (const [i, m] of (['steel', 'accent2'] as const).entries()) b.cyl(m, 0.008, 0.9, [-0.1 + i * 0.05, 0.5, -0.47])
    b.tower([0.45, deck + 0.42, -0.26])
  },
}
