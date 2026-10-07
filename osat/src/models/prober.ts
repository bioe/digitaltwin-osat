import { ease, type ModelDef } from './dsl'

/**
 * 300 mm wafer prober cell: TEL Precio XL / Accretech UF3000 class prober
 * (~1.5 × 2.0 m body) with an Advantest V93000 class test head docked on
 * the head plate via a manipulator, and the tester mainframe / cooling
 * cabinet beside it (right). FOUP load port on the front-left of the prober.
 * u: unused.
 */
export const proberCell: ModelDef = {
  key: 'proberCell',
  name: '300 mm wafer prober + test head (TEL Precio / V93000 class)',
  size: [3.0, 2.3, 1.9],
  build(b) {
    // ===== prober body (left), x -1.35..0.15, z -1.05..0.75
    const px = -0.6
    const pz = -0.15
    const top = 1.22
    b.boxB('dark', [1.46, 0.08, 1.76], [px, 0, pz], { r: 0.01 }) // kick plate
    b.boxB('body', [1.5, 0.84, 1.8], [px, 0.08, pz], { r: 0.025 }) // lower cabinet
    // upper stage housing (window section)
    b.boxB('body', [1.5, 0.3, 1.8], [px, 0.92, pz], { r: 0.02 })
    // front panel seams, handles, vents
    const fz = pz + 0.901
    b.box('panel', [0.004, 0.7, 0.002], [px - 0.1, 0.48, fz])
    b.box('panel', [0.004, 0.7, 0.002], [px + 0.4, 0.48, fz])
    b.box('steel', [0.02, 0.14, 0.025], [px - 0.14, 0.6, fz + 0.01], { r: 0.008 })
    b.box('steel', [0.02, 0.14, 0.025], [px + 0.36, 0.6, fz + 0.01], { r: 0.008 })
    for (let i = 0; i < 4; i++) b.box('dark', [0.32, 0.012, 0.004], [px + 0.15, 0.16 + i * 0.03, fz])
    // accent stripe + status bar on the bezel
    b.box('accent', [1.5, 0.03, 0.006], [px, 0.89, fz + 0.002])
    b.box('status', [0.9, 0.022, 0.01], [px + 0.2, 0.86, fz + 0.004])
    // side vents
    for (let i = 0; i < 5; i++) b.box('dark', [0.004, 0.012, 0.5], [px - 0.751, 0.3 + i * 0.03, pz])
    // front viewing window into the stage area
    b.box('dark', [0.78, 0.26, 0.01], [px + 0.25, 1.07, fz + 0.002], { r: 0.01 })
    b.box('glass', [0.72, 0.21, 0.012], [px + 0.25, 1.07, fz + 0.006])
    // head plate on top (thick steel with insert ring)
    b.boxB('steel', [1.2, 0.04, 1.2], [px + 0.15, top, pz + 0.1], { r: 0.01 })
    b.cyl('chrome', 0.3, 0.03, [px + 0.15, top + 0.055, pz + 0.1], { seg: 32 })
    // inside: stage base, probe card holder, alignment camera bridge
    b.boxB('dark', [1.2, 0.04, 1.3], [px + 0.15, 0.9, pz + 0.1])
    b.cyl('steel', 0.24, 0.025, [px + 0.15, 1.17, pz + 0.1], { seg: 32 }) // card holder ring
    b.cyl('copper', 0.17, 0.008, [px + 0.15, 1.155, pz + 0.1], { seg: 32 }) // probe card PCB
    b.cyl('black', 0.05, 0.02, [px + 0.15, 1.14, pz + 0.1]) // needle area
    b.box('panel', [1.1, 0.04, 0.06], [px + 0.15, 1.12, pz + 0.5]) // camera bridge
    b.cyl('black', 0.025, 0.08, [px + 0.45, 1.08, pz + 0.5])
    // ----- wafer chuck: X/Y stepping under the probe card
    b.anim(
      'chuckX',
      [px + 0.15, 0.94, pz + 0.1],
      (s, o) => {
        const k = Math.floor(ease.saw(s.t + s.phase * 40, 12) * 12)
        o.position.x = ((k % 6) - 2.5) * 0.024
      },
      x => {
        x.boxB('panel', [0.75, 0.04, 0.12], [0, 0, 0], { r: 0.005 }) // X carriage
        x.anim(
          'chuckY',
          [0, 0.04, 0],
          (s, o) => {
            const k = Math.floor(ease.saw(s.t + s.phase * 40, 12) * 12)
            o.position.z = (Math.floor(k / 6) - 0.5) * 0.05 + Math.sin(s.t * 3) * 0.004
            // touchdown bob (Z up/down per step)
            o.position.y = ease.pingpong(s.t + s.phase, 1) * 0.008
          },
          y => {
            y.boxB('dark', [0.36, 0.04, 0.36], [0, 0, 0], { r: 0.01 })
            y.cyl('chrome', 0.16, 0.05, [0, 0.065, 0], { seg: 32 })
            y.cyl('wafer', 0.15, 0.004, [0, 0.092, 0], { seg: 40 })
          },
        )
      },
    )
    // ----- FOUP load port module (front left, protruding)
    const lx = px - 0.38
    b.boxB('bodyAlt', [0.52, 0.9, 0.4], [lx, 0, 0.93], { r: 0.015 })
    b.boxB('dark', [0.5, 0.06, 0.38], [lx, 0, 0.93])
    b.box('dark', [0.48, 0.02, 0.38], [lx, 0.89, 0.93]) // port stage plate
    // open-top FOUP-sized recess frame + kinematic pins
    for (const dx of [-0.2, 0.2]) b.box('steel', [0.02, 0.015, 0.34], [lx + dx, 0.905, 0.93])
    for (const [dx, dz] of [[-0.1, 0.85], [0.1, 0.85], [0, 1.02]] as const) b.cyl('chrome', 0.008, 0.012, [lx + dx, 0.905, dz])
    // port door (black opening plate) on prober face
    b.box('black', [0.38, 0.36, 0.01], [lx, 1.08, fz + 0.002], { r: 0.01 })
    b.box('panel', [0.42, 0.02, 0.01], [lx, 1.27, fz + 0.002])
    // port button panel
    b.box('dark', [0.12, 0.06, 0.012], [lx + 0.18, 0.72, 1.134], { r: 0.005 })
    b.box('lampG', [0.02, 0.02, 0.006], [lx + 0.15, 0.72, 1.142])
    b.box('lampY', [0.02, 0.02, 0.006], [lx + 0.21, 0.72, 1.142])
    b.box('accent', [0.52, 0.03, 0.005], [lx, 0.5, 1.133])
    b.port([lx, 0.9, 0.93])
    // ----- HMI monitor on swing arm + keyboard + e-stop (front right of prober)
    b.cyl('steel', 0.02, 0.4, [px + 0.55, 1.05, 0.82])
    b.box('dark', [0.38, 0.27, 0.03], [px + 0.55, 1.36, 0.85], { r: 0.01, rot: [-0.12, -0.2, 0] })
    b.box('screen', [0.34, 0.22, 0.004], [px + 0.547, 1.36, 0.867], { rot: [-0.12, -0.2, 0] })
    b.box('dark', [0.42, 0.025, 0.18], [px + 0.2, 0.86, 0.84], { r: 0.008 })
    b.box('black', [0.36, 0.012, 0.13], [px + 0.2, 0.88, 0.84])
    b.cyl('yellow', 0.035, 0.02, [px + 0.62, 0.7, fz + 0.01], { rot: [Math.PI / 2, 0, 0] })
    b.cyl('red', 0.022, 0.03, [px + 0.62, 0.7, fz + 0.025], { rot: [Math.PI / 2, 0, 0] })
    b.tower([px - 0.62, top + 0.04, pz - 0.75])

    // ===== tester mainframe / cooling cabinet (right)
    const mx = 0.95
    const mz = -0.45
    b.boxB('dark', [1.06, 0.06, 1.16], [mx, 0, mz], { r: 0.01 })
    b.boxB('bodyAlt', [1.1, 1.55, 1.2], [mx, 0.06, mz], { r: 0.025 })
    b.boxB('panel', [1.12, 0.04, 1.22], [mx, 1.61, mz], { r: 0.01 })
    const mf = mz + 0.601
    // two doors with seams + handles + louvres
    b.box('dark', [0.004, 1.4, 0.002], [mx, 0.8, mf])
    for (const dx of [-0.05, 0.05]) b.box('steel', [0.02, 0.2, 0.025], [mx + dx, 0.85, mf + 0.01], { r: 0.008 })
    for (const dx of [-0.28, 0.28]) for (let i = 0; i < 8; i++) b.box('dark', [0.36, 0.014, 0.004], [mx + dx, 0.2 + i * 0.04, mf])
    b.box('accent', [1.1, 0.04, 0.006], [mx, 1.45, mf + 0.002])
    b.box('status', [0.4, 0.02, 0.01], [mx, 1.38, mf + 0.004])
    // coolant hoses + cable duct along the side
    b.cyl('black', 0.02, 0.9, [mx - 0.5, 0.5, mz + 0.62])
    b.cyl('accent2', 0.018, 0.9, [mx - 0.45, 0.5, mz + 0.62])
    // roof fans
    for (const dx of [-0.25, 0.25]) {
      b.cyl('dark', 0.15, 0.03, [mx + dx, 1.665, mz - 0.2])
      b.cyl('black', 0.12, 0.032, [mx + dx, 1.666, mz - 0.2])
    }

    // ===== manipulator: column + arm holding the test head
    const cx = 0.3
    const cz = 0.4
    b.boxB('dark', [0.5, 0.06, 0.5], [cx, 0, cz], { r: 0.01 })
    b.boxB('bodyAlt', [0.26, 1.7, 0.26], [cx, 0.06, cz], { r: 0.02 })
    b.box('yellow', [0.262, 0.04, 0.262], [cx, 0.3, cz])
    b.boxB('dark', [0.3, 0.12, 0.3], [cx, 1.42, cz], { r: 0.01 }) // carriage
    b.box('steel', [0.4, 0.08, 0.1], [cx - 0.25, 1.5, cz - 0.2], { rot: [0, 0.6, 0] }) // arm
    // test head (big dark block docked on head plate)
    const hx = px + 0.15
    const hz = pz + 0.1
    b.boxB('dark', [0.86, 0.12, 0.86], [hx, top + 0.07, hz], { r: 0.015 }) // docking ring
    b.boxB('black', [0.82, 0.38, 0.82], [hx, top + 0.19, hz], { r: 0.03 })
    b.box('panel', [0.84, 0.03, 0.84], [hx, top + 0.42, hz], { r: 0.01 })
    // head fans and side cradle arms
    for (const dx of [-0.2, 0.2]) b.cyl('dark', 0.09, 0.01, [hx + dx, top + 0.44, hz + 0.1])
    for (const dz of [-0.35, 0.35]) b.box('steel', [0.06, 0.06, 0.04], [hx + 0.44, top + 0.3, hz + dz])
    b.box('accent', [0.824, 0.03, 0.824], [hx, top + 0.25, hz])
    // cable bundle head -> mainframe (with gentle sway)
    b.anim(
      'cable',
      [hx + 0.41, top + 0.23, hz - 0.1],
      (s, o) => {
        o.rotation.z = Math.sin(s.t * 0.6 + s.phase * 5) * 0.02
      },
      c => {
        c.torus('black', 0.3, 0.07, [0.3, 0, 0], { arc: Math.PI })
        c.torus('orange', 0.3, 0.02, [0.3, 0, 0.08], { arc: Math.PI })
      },
    )
    b.box('dark', [0.06, 0.24, 0.24], [mx - 0.56, top + 0.23, hz - 0.1], { r: 0.01 }) // cable entry boot
  },
}
