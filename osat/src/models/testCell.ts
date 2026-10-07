import { ease, type ModelDef } from './dsl'

/**
 * Final test cell: pick-and-place test handler (Cohu / Advantest M48xx class,
 * ~1.6 × 1.5 m) with a test head docked on top of its rear test site, held
 * by a manipulator, cabled to a tester mainframe (Teradyne J750 / Advantest
 * V93000 class) on the right. Whole cell ~3.2 × 2.2 m, ~1.95 m tall.
 * u: unused.
 */
export const testCell: ModelDef = {
  key: 'testCell',
  name: 'Final test cell (handler + tester)',
  size: [3.2, 2.2, 1.95],
  build(b) {
    // ===== Handler: x -1.58 .. 0.02, z -0.45 .. 1.05
    const hx = -0.78
    const hz = 0.3
    const hf = hz + 0.75 // front face z
    b.boxB('dark', [1.56, 0.08, 1.46], [hx, 0, hz], { r: 0.01 })
    b.boxB('body', [1.6, 0.87, 1.5], [hx, 0.08, hz], { r: 0.025 })
    // front doors, seams, handles, vents
    for (const dx of [-0.4, 0.4]) {
      b.box('panel', [0.004, 0.7, 0.002], [hx + dx, 0.47, hf + 0.001])
      b.box('steel', [0.02, 0.14, 0.025], [hx + dx - 0.06, 0.55, hf + 0.012], { r: 0.006 })
      b.box('dark', [0.3, 0.05, 0.004], [hx + dx, 0.2, hf + 0.002])
    }
    b.box('status', [1.5, 0.025, 0.01], [hx, 0.9, hf + 0.004])
    // deck
    b.boxB('dark', [1.6, 0.04, 1.5], [hx, 0.95, hz], { r: 0.01 })
    // front glass hood over the tray / pick area (z 0.15 .. 1.05)
    b.boxB('glass', [1.56, 0.6, 0.88], [hx, 0.99, 0.6], { r: 0.02 })
    b.boxB('bodyAlt', [1.6, 0.08, 0.9], [hx, 1.59, 0.6], { r: 0.02 })
    b.box('accent', [1.602, 0.025, 0.902], [hx, 1.62, 0.6])
    b.box('dark', [1.58, 0.03, 0.03], [hx, 1.01, hf - 0.01])
    b.box('dark', [0.03, 0.58, 0.03], [hx, 1.29, hf - 0.01])
    for (const dx of [-0.08, 0.08]) b.box('steel', [0.02, 0.16, 0.025], [hx + dx, 1.3, hf + 0.008], { r: 0.006 })
    // JEDEC tray stacks on the front deck (input, 2 output bins, reject)
    const stacks = [-1.4, -1.1, -0.8, -0.5]
    stacks.forEach((sx, i) => {
      const n = [7, 4, 3, 1][i]
      b.boxB('steel', [0.26, 0.02, 0.36], [sx, 0.99, 0.8], { r: 0.004 })
      for (let k = 0; k < n; k++) b.boxB(i === 3 ? 'red' : 'black', [0.24, 0.018, 0.33], [sx, 1.01 + k * 0.02, 0.8])
    })
    b.port([-1.4, 1.15, 0.8])
    b.port([-1.1, 1.09, 0.8])
    // soak / thermal chamber (buffer) + test site contactor area
    b.boxB('panel', [0.5, 0.2, 0.25], [-0.25, 0.99, 0.4], { r: 0.015 })
    b.boxB('steel', [0.3, 0.03, 0.14], [hx, 0.99, 0.28])
    // gantry Y rails (along Z) on both sides
    for (const dx of [-0.74, 0.74]) b.boxB('dark', [0.06, 0.05, 0.8], [hx + dx, 1.48, 0.6])
    // pick gantry: moves from tray stacks to the test site and back
    b.anim(
      'gantry',
      [hx, 1.48, 0.6],
      (s, o) => {
        const k = ease.saw(s.t + s.phase * 4, 4)
        o.position.z = (ease.smooth(k < 0.5 ? k * 4 : 2 - k * 2) - 0.5) * 0.5 - 0.06
      },
      g => {
        g.boxB('accent', [1.52, 0.05, 0.08], [0, 0, 0], { r: 0.01 })
        g.anim(
          'head',
          [0, 0, 0],
          (s, o) => {
            o.position.x = Math.sin((s.t + s.phase * 4) * (Math.PI / 4) * 2) * 0.5
          },
          h => {
            h.boxB('body', [0.16, 0.12, 0.14], [0, -0.1, 0], { r: 0.012 })
            h.anim(
              'plunger',
              [0, -0.1, 0],
              (s, o) => {
                o.position.y = -ease.pingpong(s.t + s.phase * 4, 1) * 0.1
              },
              p => {
                for (const dx of [-0.04, 0.04]) {
                  p.cyl('chrome', 0.01, 0.18, [dx, -0.09, 0])
                  p.boxB('black', [0.03, 0.02, 0.03], [dx, -0.2, 0])
                }
              },
            )
          },
        )
      },
    )
    // rear docking plate + test head (DUT board facing down)
    b.boxB('steel', [0.9, 0.04, 0.6], [hx, 0.99, -0.15], { r: 0.01 })
    b.boxB('dark', [0.8, 0.45, 0.7], [hx, 1.05, -0.15], { r: 0.03 })
    b.box('accent', [0.802, 0.03, 0.702], [hx, 1.4, -0.15])
    for (const dx of [-0.25, 0, 0.25]) b.box('black', [0.18, 0.2, 0.004], [hx + dx, 1.25, 0.202])
    // docking cams
    for (const dx of [-0.43, 0.43]) b.cyl('chrome', 0.04, 0.06, [hx + dx, 1.05, -0.15])
    // manipulator: column behind + cradle arms around the head
    b.boxB('dark', [0.6, 0.06, 0.5], [hx, 0, -0.82], { r: 0.01 })
    b.boxB('bodyAlt', [0.26, 1.82, 0.26], [hx, 0.06, -0.82], { r: 0.02 })
    b.box('yellow', [0.262, 0.04, 0.262], [hx, 1.4, -0.82])
    b.boxB('panel', [0.3, 0.16, 0.3], [hx, 1.2, -0.82], { r: 0.015 })
    b.box('dark', [0.08, 0.1, 0.5], [hx, 1.3, -0.6])
    b.box('dark', [1.0, 0.08, 0.08], [hx, 1.3, -0.36])
    for (const dx of [-0.46, 0.46]) b.box('dark', [0.06, 0.08, 0.3], [hx + dx, 1.3, -0.22])
    // ===== Tester mainframe cabinet (right): x 0.4 .. 1.55, z -1.05 .. -0.15
    const mx = 0.98
    const mz = -0.6
    const mf = mz + 0.45
    b.boxB('dark', [1.12, 0.06, 0.88], [mx, 0, mz], { r: 0.01 })
    b.boxB('bodyAlt', [1.15, 1.85, 0.9], [mx, 0.06, mz], { r: 0.025 })
    for (const dx of [-0.29, 0.29]) {
      b.box('panel', [0.004, 1.7, 0.002], [mx + dx * 2, 0.98, mf + 0.001])
      b.box('dark', [0.46, 0.5, 0.004], [mx + dx, 0.45, mf + 0.002])
      for (let i = 0; i < 8; i++) b.box('black', [0.42, 0.012, 0.006], [mx + dx, 0.25 + i * 0.055, mf + 0.004])
      b.box('steel', [0.02, 0.2, 0.025], [mx + dx * 0.15, 1.1, mf + 0.012], { r: 0.006 })
    }
    b.box('panel', [0.004, 1.7, 0.002], [mx, 0.98, mf + 0.001])
    b.box('accent', [1.152, 0.06, 0.902], [mx, 1.8, mz])
    b.box('dark', [0.9, 0.18, 0.004], [mx, 1.55, mf + 0.002])
    b.box('screen', [0.2, 0.06, 0.004], [mx - 0.3, 1.55, mf + 0.004])
    b.box('status', [0.5, 0.02, 0.006], [mx + 0.15, 1.55, mf + 0.005])
    // top exhaust fans
    for (const dx of [-0.3, 0, 0.3]) b.cyl('black', 0.1, 0.02, [mx + dx, 1.92, mz])
    // cable bundle: test head -> mainframe
    b.cyl('black', 0.07, 0.62, [-0.07, 1.3, -0.3], { rot: [0, 0, Math.PI / 2] })
    b.torus('black', 0.25, 0.07, [0.24, 1.3, -0.55], { rot: [Math.PI / 2, 0, 0], arc: Math.PI / 2 })
    for (const x of [-0.2, 0.05]) b.cyl('orange', 0.075, 0.04, [x, 1.3, -0.3], { rot: [0, 0, Math.PI / 2] })
    // handler HMI on the front-right arm, keyboard, e-stop
    b.cyl('steel', 0.018, 0.4, [-0.12, 1.2, hf + 0.05])
    b.box('dark', [0.36, 0.26, 0.03], [-0.12, 1.48, hf + 0.07], { r: 0.01, rot: [-0.15, -0.2, 0] })
    b.box('screen', [0.32, 0.22, 0.004], [-0.117, 1.48, hf + 0.087], { rot: [-0.15, -0.2, 0] })
    b.box('dark', [0.4, 0.025, 0.15], [-0.45, 0.94, hf + 0.08], { r: 0.008 })
    b.box('black', [0.34, 0.012, 0.11], [-0.45, 0.96, hf + 0.08])
    b.cyl('yellow', 0.03, 0.02, [-1.45, 0.75, hf + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.02, 0.03, [-1.45, 0.75, hf + 0.025], { rot: [Math.PI / 2, 0, 0] })
    // tester workstation PC + monitor on a small desk to the right front
    b.boxB('dark', [0.6, 0.04, 0.5], [1.0, 0.76, 0.6], { r: 0.008 })
    for (const dx of [-0.27, 0.27]) b.boxB('steel', [0.03, 0.76, 0.45], [1.0 + dx, 0, 0.6])
    b.box('dark', [0.46, 0.3, 0.03], [1.0, 1.0, 0.45], { r: 0.01 })
    b.box('screen', [0.42, 0.26, 0.004], [1.0, 1.0, 0.467])
    b.box('black', [0.36, 0.012, 0.12], [1.0, 0.81, 0.7])
    b.tower([-1.48, 1.63, 0.25])
  },
}
