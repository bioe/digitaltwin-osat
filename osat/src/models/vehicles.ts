import * as THREE from 'three'
import type { ModelDef } from './dsl'

/**
 * Overhead hoist transport vehicle (Daifuku OHT class).
 * ORIGIN = rail running surface. Travel direction = +Z. The vehicle hangs
 * below y = 0 (traction unit y 0..-0.12, body down to y = -0.80).
 * u[0] = hoist drop distance in metres (0 = retracted).
 * Gripper bottom face (FOUP flange top) at y = -0.80 - u[0].
 */
export const ohtVehicle: ModelDef = {
  key: 'ohtVehicle',
  name: 'Overhead hoist transport vehicle (Daifuku OHT class)',
  size: [0.55, 0.95, 0.8],
  build(b) {
    // --- traction unit (runs inside the rail, below the running surface)
    b.box('dark', [0.2, 0.1, 0.62], [0, -0.06, 0], { r: 0.015 })
    for (const z of [-0.24, 0.24]) {
      for (const x of [-0.11, 0.11]) b.cyl('rubber', 0.035, 0.03, [x, -0.035, z], { rot: [0, 0, Math.PI / 2] })
      // guide rollers + steering
      b.cyl('chrome', 0.015, 0.03, [0, -0.005, z + 0.05])
      b.box('steel', [0.12, 0.02, 0.06], [0, -0.1, z])
    }
    b.box('orange', [0.04, 0.03, 0.4], [0.07, -0.1, 0]) // power pickup coil
    // hangers to the body
    for (const z of [-0.24, 0.24]) b.box('steel', [0.08, 0.06, 0.08], [0, -0.14, z])

    // --- hoist housing (top of body)
    b.box('body', [0.55, 0.22, 0.8], [0, -0.28, 0], { r: 0.03 })
    b.box('panel', [0.556, 0.004, 0.7], [0, -0.32, 0]) // seam
    b.box('status', [0.558, 0.02, 0.5], [0, -0.215, 0]) // light strip both sides
    b.box('dark', [0.4, 0.02, 0.6], [0, -0.39, 0]) // hoist base plate
    // front / rear end covers down to the FOUP bottom
    for (const sgn of [-1, 1]) {
      b.box('body', [0.55, 0.42, 0.08], [0, -0.59, sgn * 0.36], { r: 0.02 })
      b.box('dark', [0.4, 0.06, 0.004], [0, -0.75, sgn * 0.401]) // drop sensor window
    }
    // wedge nose (front) and tail (rear): profile in (z, y), extruded across X
    const nose = (dir: 1 | -1) => {
      const s = new THREE.Shape()
      s.moveTo(0.38, -0.17)
      s.lineTo(0.475, -0.27)
      s.lineTo(0.475, -0.6)
      s.lineTo(0.4, -0.8)
      s.lineTo(0.38, -0.8)
      s.closePath()
      b.group([0, 0, 0], [0, dir === 1 ? 0 : Math.PI, 0], g =>
        g.extrude('body', s, 0.53, [0.265, 0, 0], { rot: [0, -Math.PI / 2, 0] }),
      )
    }
    nose(1)
    nose(-1)
    b.box('black', [0.36, 0.08, 0.01], [0, -0.33, 0.47], { rot: [-0.8, 0, 0] }) // front sensor
    b.box('accent', [0.531, 0.03, 0.01], [0, -0.45, 0.477])
    b.box('status', [0.3, 0.02, 0.01], [0, -0.52, 0.477]) // front light strip
    b.box('status', [0.3, 0.02, 0.01], [0, -0.52, -0.477])
    // side covers (fall protection), leave the lower FOUP visible
    for (const x of [-0.27, 0.27]) {
      b.box('bodyAlt', [0.012, 0.18, 0.64], [x, -0.48, 0], { r: 0.004 })
      b.box('yellow', [0.014, 0.02, 0.64], [x, -0.56, 0])
    }

    // --- hoist: 4 belts + gripper
    const belts: [number, number][] = [
      [-0.12, -0.1],
      [0.12, -0.1],
      [-0.12, 0.1],
      [0.12, 0.1],
    ]
    for (const [x, z] of belts) {
      b.cyl('dark', 0.03, 0.03, [x, -0.385, z], { rot: [0, 0, Math.PI / 2] }) // drum
      b.anim(
        `belt${x}${z}`,
        [x, -0.7, z],
        (s, o) => {
          o.scale.y = Math.max(0.001, (s.u[0] ?? 0) + 0.02)
        },
        g => g.box('black', [0.025, 1, 0.004], [0, -0.5, 0]),
      )
    }
    b.box('dark', [0.34, 0.3, 0.26], [0, -0.55, 0], { r: 0.01 }) // hoist frame (retracted gripper sits below)
    b.anim(
      'gripper',
      [0, -0.8, 0],
      (s, o) => {
        o.position.y = -(s.u[0] ?? 0)
      },
      g => {
        g.boxB('bodyAlt', [0.36, 0.06, 0.3], [0, 0.02, 0], { r: 0.01 })
        g.boxB('dark', [0.24, 0.02, 0.22], [0, 0, 0])
        for (const x of [-0.08, 0.08]) g.box('steel', [0.03, 0.03, 0.12], [x, 0.01, 0])
        g.box('status', [0.2, 0.012, 0.004], [0, 0.05, 0.151])
      },
    )
  },
}

/**
 * Autonomous robotic vehicle (AMR with top roller conveyor transfer).
 * Body 0.75 W (X) × 1.05 L (Z, travel) × 0.6 H. Faces +Z.
 * u[0] = lift 0..1; deck top surface at y = 0.65 + 0.35 * u[0].
 * Wheels spin while s.state === 'run'.
 */
export const arv: ModelDef = {
  key: 'arv',
  name: 'Autonomous robotic vehicle (AMR, roller-top transfer)',
  size: [0.75, 1.05, 0.65],
  build(b) {
    // chassis
    b.boxB('dark', [0.66, 0.08, 0.94], [0, 0.04, 0], { r: 0.02 })
    b.boxB('body', [0.75, 0.48, 1.0], [0, 0.12, 0], { r: 0.05 })
    b.box('accent', [0.752, 0.04, 1.002], [0, 0.5, 0], { r: 0.01 })
    b.box('status', [0.754, 0.02, 0.9], [0, 0.17, 0]) // light strip sides
    b.box('status', [0.5, 0.02, 0.01], [0, 0.42, 0.5])
    b.box('status', [0.5, 0.02, 0.01], [0, 0.42, -0.5])
    b.boxB('bodyAlt', [0.72, 0.03, 0.97], [0, 0.57, 0], { r: 0.01 }) // top cover
    // side panel seams + charge contacts
    for (const x of [-0.376, 0.376]) {
      b.box('panel', [0.002, 0.3, 0.004], [x, 0.33, 0.2])
      b.box('panel', [0.002, 0.3, 0.004], [x, 0.33, -0.2])
    }
    b.box('copper', [0.12, 0.03, 0.006], [0, 0.22, -0.503])
    // bumpers (front / rear)
    for (const sgn of [-1, 1]) b.box('black', [0.7, 0.07, 0.05], [0, 0.11, sgn * 0.5], { r: 0.02 })
    // lidar (top front) + 3D camera
    b.boxB('dark', [0.16, 0.03, 0.1], [0, 0.6, 0.44], { r: 0.01 })
    b.cyl('dark', 0.045, 0.05, [0, 0.655, 0.44])
    b.cyl('black', 0.043, 0.03, [0, 0.69, 0.44])
    b.cyl('dark', 0.046, 0.01, [0, 0.71, 0.44])
    b.box('black', [0.14, 0.04, 0.01], [0, 0.32, 0.505], { r: 0.008 })
    // e-stops (rear face corners)
    for (const x of [-0.28, 0.28]) {
      b.cyl('yellow', 0.035, 0.02, [x, 0.45, -0.505], { rot: [Math.PI / 2, 0, 0] })
      b.cyl('red', 0.022, 0.03, [x, 0.45, -0.52], { rot: [Math.PI / 2, 0, 0] })
    }
    // small HMI on the rear face
    b.box('screen', [0.18, 0.1, 0.004], [0, 0.4, -0.503])

    // wheels: 2 drive (mid) + 4 casters
    const wheels: [number, number, number][] = [
      [-0.33, 0, 0.08],
      [0.33, 0, 0.08],
      [-0.25, 0.36, 0.045],
      [0.25, 0.36, 0.045],
      [-0.25, -0.36, 0.045],
      [0.25, -0.36, 0.045],
    ]
    wheels.forEach(([x, z, r], i) => {
      b.anim(
        `wheel${i}`,
        [x, r, z],
        (s, o) => {
          o.rotation.x = s.state === 'run' ? (s.T * 0.9) / r : 0
        },
        w => {
          w.cyl('rubber', r, 0.05, [0, 0, 0], { rot: [0, 0, Math.PI / 2] })
          w.box('steel', [0.052, r * 1.4, 0.015], [0, 0, 0]) // hub spoke shows spin
        },
      )
    })

    // roller deck on lift column
    b.anim(
      'deck',
      [0, 0.65, 0],
      (s, o) => {
        o.position.y = Math.min(1, Math.max(0, s.u[0] ?? 0)) * 0.35
      },
      d => {
        d.box('chrome', [0.12, 0.4, 0.12], [0, -0.25, 0]) // telescopic column (hidden when down)
        d.boxB('dark', [0.68, 0.025, 0.8], [0, -0.05, -0.05], { r: 0.008 })
        for (const x of [-0.33, 0.33]) d.boxB('bodyAlt', [0.03, 0.06, 0.8], [x, -0.05, -0.05])
        for (let i = 0; i < 11; i++)
          d.cyl('steel', 0.017, 0.62, [0, -0.017, -0.42 + i * 0.074], { rot: [0, 0, Math.PI / 2] })
        // end stops
        for (const z of [-0.45, 0.35]) d.boxB('yellow', [0.08, 0.03, 0.02], [0.28, 0, z])
      },
    )
  },
}
