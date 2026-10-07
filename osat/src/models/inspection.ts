import { ease, type ModelDef } from './dsl'

/**
 * Final vision inspection system (2D/3D, turret type): JEDEC tray input,
 * pick into an indexing turret that carries units past top / bottom /
 * side / 3D laser-line camera stations, good units back to tray, rejects
 * to a bin. ~2.0 × 1.5 m, ~1.85 m tall.
 * u: unused.
 */
export const visionInspection: ModelDef = {
  key: 'visionInspection',
  name: 'Final vision inspection (turret 2D/3D)',
  size: [2.0, 1.5, 1.85],
  build(b) {
    const D = 1.3
    const fz = D / 2 - 0.05
    const cz = -0.05
    b.boxB('dark', [1.96, 0.08, D - 0.04], [0, 0, cz], { r: 0.01 })
    b.boxB('body', [2.0, 0.82, D], [0, 0.08, cz], { r: 0.025 })
    for (const px of [-0.5, 0.5]) {
      b.box('panel', [0.004, 0.66, 0.002], [px, 0.46, fz + 0.001])
      b.box('steel', [0.1, 0.02, 0.025], [px - 0.25, 0.76, fz + 0.01], { r: 0.008 })
      b.box('steel', [0.1, 0.02, 0.025], [px + 0.25, 0.76, fz + 0.01], { r: 0.008 })
      b.box('dark', [0.4, 0.05, 0.004], [px, 0.2, fz + 0.002])
    }
    b.box('panel', [0.004, 0.66, 0.002], [0, 0.46, fz + 0.001])
    b.box('status', [1.86, 0.025, 0.01], [0, 0.86, fz + 0.003])
    b.boxB('dark', [2.0, 0.05, D], [0, 0.9, cz], { r: 0.01 })
    // turret base + motor
    b.cyl('panel', 0.14, 0.12, [0, 1.01, -0.15])
    b.cyl('steel', 0.04, 0.2, [0, 1.15, -0.15])
    // rotating turret with 16 pick nozzles
    b.anim(
      'turret',
      [0, 1.28, -0.15],
      (s, o) => {
        const step = (s.t + s.phase * 10) / 0.4
        const n = Math.floor(step)
        o.rotation.y = ((n + ease.smooth((step - n) * 2.5)) * Math.PI * 2) / 16
      },
      t => {
        t.cyl('steel', 0.3, 0.05, [0, 0, 0], { seg: 32 })
        t.cyl('accent', 0.1, 0.06, [0, 0.05, 0])
        t.cyl('dark', 0.29, 0.02, [0, -0.035, 0], { seg: 32 })
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2
          const x = Math.cos(a) * 0.27
          const z = Math.sin(a) * 0.27
          t.cyl('chrome', 0.008, 0.12, [x, -0.09, z])
          t.cyl('rubber', 0.012, 0.012, [x, -0.155, z])
          if (i % 3 === 0) t.box('black', [0.02, 0.006, 0.02], [x, -0.165, z])
        }
      },
    )
    // camera stations around the turret
    const cams: [number, number][] = [
      [0.5, 0.4],
      [1.2, 0.4],
      [2.0, 0.4],
      [2.8, 0.4],
      [3.6, 0.4],
    ]
    for (const [a, rr] of cams) {
      const x = Math.cos(a) * rr
      const z = -0.15 + Math.sin(a) * rr
      // bottom-looking camera + ring light under the nozzle path
      b.cyl('black', 0.035, 0.12, [x * 0.68, 1.0, -0.15 + (z + 0.15) * 0.68])
      b.torus('emissiveWhite', 0.035, 0.008, [x * 0.68, 1.07, -0.15 + (z + 0.15) * 0.68], { rot: [Math.PI / 2, 0, 0] })
      // side camera on a post
      b.boxB('dark', [0.05, 0.3, 0.05], [x, 0.95, z])
      b.box('black', [0.06, 0.06, 0.12], [x, 1.2, z], { rot: [0, Math.PI / 2 - a, 0] })
    }
    // 3D laser-line head above the turret
    b.boxB('dark', [0.06, 0.6, 0.06], [0.3, 0.95, -0.55])
    b.box('dark', [0.06, 0.06, 0.4], [0.3, 1.55, -0.38])
    b.boxB('accent2', [0.12, 0.14, 0.1], [0.3, 1.4, -0.2], { r: 0.01 })
    b.box('red', [0.02, 0.004, 0.06], [0.3, 1.398, -0.2])
    // tray input / output stacks and reject bin
    for (const [tx, n] of [
      [-0.7, 6],
      [0.7, 3],
    ] as const) {
      b.boxB('steel', [0.3, 0.02, 0.38], [tx, 0.95, 0.3], { r: 0.004 })
      for (let k = 0; k < n; k++) b.boxB('black', [0.26, 0.02, 0.34], [tx, 0.97 + k * 0.022, 0.3])
    }
    b.boxB('red', [0.16, 0.08, 0.16], [0.75, 0.95, -0.3], { r: 0.008 })
    b.port([-0.7, 1.1, 0.3])
    b.port([0.7, 1.03, 0.3])
    // tray-to-turret pick arm
    b.boxB('dark', [1.6, 0.05, 0.06], [0, 1.52, 0.1], { r: 0.01 })
    b.anim(
      'pickArm',
      [0, 1.52, 0.15],
      (s, o) => {
        o.position.x = Math.sin(s.t * 1.6 + s.phase * 6) * 0.6
      },
      p => {
        p.boxB('body', [0.1, 0.1, 0.08], [0, -0.1, 0], { r: 0.01 })
        p.cyl('chrome', 0.008, 0.2, [0, -0.2, 0])
      },
    )
    // glass hood + roof
    b.boxB('glass', [1.96, 0.75, D - 0.04], [0, 0.95, cz], { r: 0.02 })
    b.box('dark', [1.98, 0.03, 0.03], [0, 0.97, fz - 0.02])
    b.box('dark', [0.03, 0.73, 0.03], [0, 1.32, fz - 0.02])
    for (const dx of [-0.08, 0.08]) b.box('steel', [0.02, 0.16, 0.025], [dx, 1.32, fz + 0.005], { r: 0.006 })
    b.boxB('bodyAlt', [2.0, 0.14, D], [0, 1.7, cz], { r: 0.02 })
    b.box('accent', [2.002, 0.03, D + 0.002], [0, 1.72, cz])
    // two monitors (HMI + image view) on arm
    b.cyl('steel', 0.02, 0.4, [0.55, 1.1, fz + 0.06])
    for (const dx of [-0.2, 0.2]) {
      b.box('dark', [0.38, 0.26, 0.03], [0.55 + dx, 1.42, fz + 0.08], { r: 0.01, rot: [-0.12, -dx, 0] })
      b.box('screen', [0.34, 0.22, 0.004], [0.55 + dx, 1.42, fz + 0.097], { rot: [-0.12, -dx, 0] })
    }
    b.box('dark', [0.42, 0.025, 0.16], [0, 0.9, fz + 0.08], { r: 0.008 })
    b.box('black', [0.36, 0.012, 0.12], [0, 0.92, fz + 0.08])
    b.cyl('yellow', 0.03, 0.02, [-0.85, 0.7, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.02, 0.03, [-0.85, 0.7, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    b.tower([-0.88, 1.84, -0.6])
  },
}
