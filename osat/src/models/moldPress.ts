import { ease, type ModelDef } from './dsl'

/**
 * Automatic transfer mold system, TOWA YPM / ASMPT IDEALmold class.
 * Strip loader + magazines on the left, two press modules in the middle,
 * degate / unloader + output magazines on the right, gantry loader on top.
 * Real lines are ~4.2–4.6 m wide, ~1.7–1.9 m deep, ~2.0 m tall.
 * u: unused.
 */
export const moldPress: ModelDef = {
  key: 'moldPress',
  name: 'Transfer mold system (TOWA YPM class)',
  size: [4.4, 1.8, 2.1],
  build(b) {
    const W = 4.4
    const D = 1.7
    // --- base plinth + kick plate along the whole line
    b.boxB('dark', [W - 0.04, 0.1, D - 0.06], [0, 0, 0], { r: 0.01 })
    b.box('black', [W - 0.1, 0.06, 0.004], [0, 0.05, (D - 0.06) / 2 + 0.002])

    // ===== Loader module (left), x -2.2 .. -1.2
    const lx = -1.7
    b.boxB('body', [0.98, 0.8, D], [lx, 0.1, 0], { r: 0.025 })
    b.box('panel', [0.004, 0.66, 0.002], [lx, 0.46, D / 2 + 0.001])
    for (const dx of [-0.22, 0.22]) {
      b.box('steel', [0.1, 0.02, 0.025], [lx + dx, 0.78, D / 2 + 0.01], { r: 0.008 })
      b.box('dark', [0.3, 0.05, 0.004], [lx + dx, 0.22, D / 2 + 0.002])
    }
    // magazine elevators (2 input magazines) behind glass
    b.box('bodyAlt', [0.98, 0.92, 0.04], [lx, 1.36, -D / 2 + 0.02])
    b.box('bodyAlt', [0.04, 0.92, D], [lx - 0.47, 1.36, 0])
    b.boxB('bodyAlt', [0.98, 0.14, D], [lx, 1.82, 0], { r: 0.02 })
    b.box('glass', [0.9, 0.9, 0.006], [lx + 0.02, 1.36, D / 2 - 0.01])
    b.box('dark', [0.94, 0.03, 0.03], [lx, 1.8, D / 2 - 0.01])
    b.box('dark', [0.94, 0.03, 0.03], [lx, 0.92, D / 2 - 0.01])
    for (const mx of [-0.2, 0.15]) {
      b.boxB('steel', [0.02, 0.8, 0.02], [lx + mx - 0.14, 0.95, 0.6])
      b.boxB('steel', [0.02, 0.8, 0.02], [lx + mx + 0.14, 0.95, 0.6])
      b.anim(
        `inMag${mx}`,
        [lx + mx, 1.15, 0.45],
        (s, o) => {
          o.position.y = Math.floor(ease.saw(s.t + s.phase * 40 + mx * 20, 36) * 10) * 0.025
        },
        m => {
          m.boxB('black', [0.26, 0.26, 0.24], [0, 0, 0], { r: 0.004 })
          for (let i = 0; i < 7; i++) m.box('copper', [0.24, 0.003, 0.22], [0, 0.03 + i * 0.03, 0])
        },
      )
    }
    // loader HMI + e-stop
    b.cyl('steel', 0.02, 0.35, [lx + 0.32, 1.25, D / 2 + 0.04])
    b.box('dark', [0.4, 0.3, 0.03], [lx + 0.32, 1.55, D / 2 + 0.06], { r: 0.01, rot: [-0.15, 0, 0] })
    b.box('screen', [0.36, 0.25, 0.004], [lx + 0.32, 1.55, D / 2 + 0.077], { rot: [-0.15, 0, 0] })
    b.box('dark', [0.42, 0.025, 0.16], [lx - 0.1, 0.9, D / 2 + 0.1], { r: 0.008 })
    b.box('black', [0.36, 0.012, 0.12], [lx - 0.1, 0.92, D / 2 + 0.1])
    b.cyl('yellow', 0.035, 0.02, [lx - 0.4, 0.82, D / 2 + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [lx - 0.4, 0.82, D / 2 + 0.03], { rot: [Math.PI / 2, 0, 0] })
    b.port([lx - 0.2, 1.15, 0.45])

    // ===== Press modules (middle), x -1.2 .. 1.2, 2 presses
    for (const [i, px] of [-0.6, 0.6].entries()) {
      // lower frame cabinet
      b.boxB('body', [1.18, 0.8, D], [px, 0.1, 0], { r: 0.02 })
      b.box('panel', [0.004, 0.66, 0.002], [px, 0.46, D / 2 + 0.001])
      b.box('dark', [0.4, 0.05, 0.004], [px - 0.3, 0.22, D / 2 + 0.002])
      b.box('dark', [0.4, 0.05, 0.004], [px + 0.3, 0.22, D / 2 + 0.002])
      b.box('steel', [0.1, 0.02, 0.025], [px - 0.1, 0.78, D / 2 + 0.01], { r: 0.008 })
      b.box('steel', [0.1, 0.02, 0.025], [px + 0.1, 0.78, D / 2 + 0.01], { r: 0.008 })
      // press bed
      b.boxB('dark', [0.9, 0.1, 0.9], [px, 0.9, -0.15], { r: 0.01 })
      // four tie-bar columns
      for (const cx of [-0.36, 0.36])
        for (const cz of [-0.51, 0.21]) b.cyl('chrome', 0.04, 0.68, [px + cx, 1.34, cz])
      // fixed upper (crown) platen
      b.boxB('dark', [0.9, 0.12, 0.9], [px, 1.68, -0.15], { r: 0.012 })
      b.boxB('accent', [0.902, 0.03, 0.902], [px, 1.72, -0.15])
      // upper mold chase (fixed under crown)
      b.boxB('steel', [0.6, 0.1, 0.55], [px, 1.58, -0.15], { r: 0.006 })
      b.boxB('copper', [0.5, 0.012, 0.45], [px, 1.568, -0.15])
      // moving lower platen + lower chase + plunger pot
      b.anim(
        `platen${i}`,
        [px, 1.0, -0.15],
        (s, o) => {
          const k = ease.smooth(Math.min(1, ease.pingpong(s.t + i * 4.5 + s.phase * 9, 9) * 1.6))
          o.position.y = k * 0.3
        },
        p => {
          p.boxB('dark', [0.82, 0.12, 0.82], [0, 0, 0], { r: 0.01 })
          // tie-bar bushings
          for (const cx of [-0.36, 0.36]) for (const cz of [-0.36, 0.36]) p.cyl('steel', 0.06, 0.12, [cx, 0.06, cz])
          p.boxB('steel', [0.6, 0.12, 0.55], [0, 0.12, 0], { r: 0.006 })
          p.boxB('copper', [0.5, 0.01, 0.45], [0, 0.24, 0])
          // strips in cavities
          for (const sz of [-0.12, 0.12]) p.box('copper', [0.46, 0.004, 0.08], [0, 0.252, sz])
          // transfer pots
          for (let k = -2; k <= 2; k++) p.cyl('black', 0.012, 0.01, [k * 0.08, 0.255, 0])
        },
      )
      // hydraulic / servo drive below
      b.cyl('steel', 0.1, 0.12, [px, 0.86, -0.15])
      // glass front doors along the press
      b.box('glass', [1.1, 0.9, 0.006], [px, 1.36, D / 2 - 0.01])
      b.box('dark', [1.14, 0.03, 0.03], [px, 0.92, D / 2 - 0.01])
      b.box('dark', [0.02, 0.9, 0.03], [px, 1.36, D / 2 - 0.005])
      b.box('steel', [0.02, 0.18, 0.025], [px - 0.04, 1.4, D / 2 + 0.01], { r: 0.006 })
      b.box('steel', [0.02, 0.18, 0.025], [px + 0.04, 1.4, D / 2 + 0.01], { r: 0.006 })
      // side / back panels
      b.box('bodyAlt', [1.18, 0.92, 0.02], [px, 1.36, -D / 2 + 0.01])
      // top cover above crown (resin tablet feeder housing)
      b.boxB('bodyAlt', [1.18, 0.14, D], [px, 1.82, 0], { r: 0.02 })
      b.box('dark', [0.5, 0.05, 0.004], [px, 1.89, D / 2 + 0.001])
      // resin tablet hopper (back)
      b.cyl('bodyAlt', 0.12, 0.25, [px + 0.35, 1.2, -0.7], { rTop: 0.16 })
    }
    // front status bar along the press bezel
    b.box('status', [2.2, 0.025, 0.01], [0, 0.885, D / 2 + 0.006])

    // ===== Unloader / degate (right), x 1.2 .. 2.2
    const ux = 1.7
    b.boxB('body', [0.98, 0.8, D], [ux, 0.1, 0], { r: 0.025 })
    b.box('panel', [0.004, 0.66, 0.002], [ux, 0.46, D / 2 + 0.001])
    for (const dx of [-0.22, 0.22]) {
      b.box('steel', [0.1, 0.02, 0.025], [ux + dx, 0.78, D / 2 + 0.01], { r: 0.008 })
      b.box('dark', [0.3, 0.05, 0.004], [ux + dx, 0.22, D / 2 + 0.002])
    }
    // degate table + cull bin
    b.boxB('dark', [0.6, 0.08, 0.6], [ux - 0.1, 0.9, -0.3], { r: 0.01 })
    b.boxB('steel', [0.34, 0.2, 0.3], [ux - 0.1, 0.98, -0.3], { r: 0.01 })
    b.boxB('black', [0.3, 0.2, 0.25], [ux + 0.3, 0.9, -0.55], { r: 0.01 })
    // output magazine elevator
    for (const dx of [-0.14, 0.14]) b.boxB('steel', [0.02, 0.8, 0.02], [ux + 0.15 + dx, 0.95, 0.6])
    b.anim(
      'outMag',
      [ux + 0.15, 1.15, 0.45],
      (s, o) => {
        o.position.y = Math.floor(ease.saw(s.t + s.phase * 40, 36) * 10) * 0.025
      },
      m => {
        m.boxB('black', [0.26, 0.26, 0.24], [0, 0, 0], { r: 0.004 })
        for (let i = 0; i < 4; i++) m.box('dark', [0.24, 0.004, 0.22], [0, 0.03 + i * 0.03, 0])
      },
    )
    // glass hood over unloader
    b.boxB('glass', [0.94, 0.92, D - 0.06], [ux, 0.9, 0], { r: 0.02 })
    b.boxB('bodyAlt', [0.98, 0.14, D], [ux, 1.82, 0], { r: 0.02 })
    b.box('dark', [0.98, 0.02, 0.01], [ux, 0.92, D / 2 + 0.004])
    b.port([ux + 0.15, 1.15, 0.45])
    // exhaust duct off the unloader roof
    b.cyl('steel', 0.08, 0.14, [ux + 0.2, 2.03, -0.6])

    // ===== Gantry loader rail along the top (spans the whole line)
    b.boxB('dark', [W - 0.5, 0.06, 0.12], [0, 1.96, -0.2], { r: 0.01 })
    b.box('steel', [W - 0.5, 0.012, 0.04], [0, 2.026, -0.2])
    b.box('yellow', [W - 0.5, 0.012, 0.004], [0, 1.99, -0.138])
    for (const sx of [-1.9, -0.6, 0.6, 1.5]) b.boxB('dark', [0.06, 0.04, 0.06], [sx, 1.96, -0.2])
    b.anim(
      'gantry',
      [0, 2.032, -0.2],
      (s, o) => {
        o.position.x = Math.sin(s.t * 0.35 + s.phase * 6) * 1.6
      },
      g => {
        g.boxB('accent', [0.26, 0.07, 0.2], [0, 0, 0], { r: 0.015 })
        g.box('dark', [0.27, 0.012, 0.21], [0, 0.04, 0])
        g.boxB('steel', [0.08, 0.05, 0.08], [0, 0.07, -0.05], { r: 0.01 })
        // cable carrier
        g.box('black', [0.05, 0.03, 0.06], [-0.16, 0.02, -0.08])
      },
    )

    b.tower([-2.05, 1.96, -0.7])
  },
}
