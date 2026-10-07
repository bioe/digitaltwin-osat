import type { AnimState, Builder, MatKey, ModelDef } from './dsl'

interface Look {
  top: MatKey // shirt / suit upper
  legs: MatKey // trousers / suit legs
  hands: MatKey
  feet: MatKey
  sole: MatKey
  /** Cleanroom hood + mask with eye strip. Otherwise skin face with hair. */
  hood: boolean
}

const SUIT: Look = { top: 'white', legs: 'white', hands: 'bodyAlt', feet: 'white', sole: 'dark', hood: true }
const OFFICE: Look = { top: 'accent2', legs: 'dark', hands: 'skin', feet: 'black', sole: 'black', hood: false }

type Pose = 'stand' | 'seat'

const HIP_STAND = 0.92
const HIP_SEAT = 0.5
const THIGH = 0.44
const SHIN = 0.4
const UPPER_ARM = 0.29
const FOREARM = 0.25

/** Walk cycle swing angle (rad). u[0] = 1 walking, u[1] = 1 working (hands busy in front), u[2] = 1 carrying. */
const swing = (s: AnimState) => Math.sin(s.T * Math.PI * 2 * 0.9 + s.phase * 6) * 0.45 * Math.min(1, s.u[0] ?? 0)

function leg(b: Builder, L: Look, side: number, pose: Pose) {
  const hipY = pose === 'stand' ? HIP_STAND : HIP_SEAT
  b.anim(
    `leg${side}`,
    [side * 0.09, hipY, 0],
    (s, o) => {
      o.rotation.x = pose === 'seat' ? -Math.PI / 2 : side * swing(s)
    },
    t => {
      t.cyl(L.legs, 0.07, THIGH, [0, -THIGH / 2, 0], { rTop: 0.08 })
      t.sphere(L.legs, 0.058, [0, -THIGH, 0])
      t.anim(
        `shin${side}`,
        [0, -THIGH, 0],
        (s, o) => {
          // knee bends while the leg swings back
          o.rotation.x = pose === 'seat' ? Math.PI / 2 : Math.max(0, side * swing(s)) * 1.1
        },
        k => {
          k.cyl(L.legs, 0.05, SHIN, [0, -SHIN / 2, 0], { rTop: 0.058 })
          // boot / shoe (toe forward = local +Z)
          k.boxB(L.feet, [0.1, 0.07, 0.24], [0, -SHIN - 0.08, 0.05], { r: 0.03 })
          k.boxB(L.sole, [0.1, 0.012, 0.25], [0, -SHIN - 0.08, 0.05], { r: 0.005 })
          if (L.hood) k.cyl(L.feet, 0.06, 0.16, [0, -SHIN + 0.03, 0]) // boot shaft
        },
      )
    },
  )
}

function arm(b: Builder, L: Look, side: number, pose: Pose, shoulderY: number) {
  b.anim(
    `arm${side}`,
    [side * 0.2, shoulderY, 0],
    (s, o) => {
      if (pose === 'seat') {
        o.rotation.x = -0.75
        o.rotation.z = side * 0.12
        return
      }
      if (s.u[2]) o.rotation.x = -0.55 // carrying an item in front
      else if (s.u[1]) o.rotation.x = -0.85 + Math.sin(s.T * 2.6 + side * 1.7 + s.phase * 6) * 0.18 // working at a tool
      else o.rotation.x = -side * swing(s) * 0.8
      o.rotation.z = side * 0.06
    },
    a => {
      a.sphere(L.top, 0.06, [0, 0, 0])
      a.cyl(L.top, 0.045, UPPER_ARM, [0, -UPPER_ARM / 2, 0], { rTop: 0.055 })
      a.anim(
        `fore${side}`,
        [0, -UPPER_ARM, 0],
        (s, o) => {
          if (pose === 'seat') {
            // forearms forward onto the desk, small typing motion
            o.rotation.x = -0.85 + Math.sin(s.T * 7 + side * 2 + s.phase * 6) * 0.03
            return
          }
          if (s.u[2]) o.rotation.x = -1.0
          else if (s.u[1]) o.rotation.x = -0.55 + Math.sin(s.T * 4.2 + side * 2.3 + s.phase * 6) * 0.3
          else o.rotation.x = -0.15 - Math.max(0, side * swing(s)) * 0.5
        },
        f => {
          f.sphere(L.top, 0.045, [0, 0, 0])
          f.cyl(L.top, 0.036, FOREARM, [0, -FOREARM / 2, 0], { rTop: 0.045 })
          f.box(L.hands, [0.05, 0.1, 0.08], [0, -FOREARM - 0.05, 0.01], { r: 0.02 })
          f.cyl(L.hands, 0.012, 0.05, [side * -0.03, -FOREARM - 0.03, 0.03], { rot: [0.5, 0, 0] }) // thumb
        },
      )
    },
  )
}

function person(b: Builder, L: Look, pose: Pose) {
  const hipY = pose === 'stand' ? HIP_STAND : HIP_SEAT
  leg(b, L, -1, pose)
  leg(b, L, 1, pose)
  // pelvis (static)
  b.box(L.legs, [0.34, 0.16, 0.21], [0, hipY + 0.02, 0], { r: 0.07 })
  if (!L.hood) b.box('black', [0.345, 0.03, 0.215], [0, hipY + 0.1, 0], { r: 0.01 }) // belt
  // upper body: breathing when idle, bob when walking
  b.anim(
    'upper',
    [0, hipY, 0],
    (s, o) => {
      const walk = Math.min(1, s.u[0] ?? 0)
      o.position.y =
        (1 - walk) * Math.sin(s.T * 1.6 + s.phase * 6) * 0.004 +
        walk * Math.abs(Math.sin(s.T * Math.PI * 0.9 * 2 + s.phase * 6)) * 0.015
      o.scale.z = 1 + (1 - walk) * Math.sin(s.T * 1.6 + s.phase * 6) * 0.015
    },
    u => {
      // abdomen, chest (tapered)
      u.box(L.top, [0.31, 0.2, 0.2], [0, 0.18, 0], { r: 0.08 })
      u.box(L.top, [0.4, 0.26, 0.23], [0, 0.38, 0], { r: 0.09 })
      if (L.hood) {
        // suit zip + name tag
        u.box('bodyAlt', [0.012, 0.42, 0.004], [0, 0.26, 0.116])
        u.box('accent', [0.07, 0.03, 0.004], [0.09, 0.42, 0.117])
      } else {
        u.box('white', [0.08, 0.06, 0.004], [0, 0.49, 0.112], { rot: [0.3, 0, 0] }) // collar
      }
      // neck + head
      const headY = 0.69
      u.cyl(L.hood ? 'white' : 'skin', 0.05, 0.1, [0, 0.54, 0])
      if (L.hood) {
        u.cyl('white', 0.17, 0.12, [0, 0.52, 0], { rTop: 0.075 }) // hood skirt over shoulders
        u.sphere('white', 0.11, [0, headY, 0], { seg: 20 })
        u.box('skin', [0.15, 0.055, 0.03], [0, headY + 0.015, 0.088], { r: 0.01 }) // eye strip
        u.box('dark', [0.16, 0.035, 0.03], [0, headY + 0.015, 0.1], { r: 0.012 }) // goggles
        u.box('white', [0.14, 0.07, 0.03], [0, headY - 0.045, 0.085], { r: 0.02 }) // face mask
      } else {
        u.sphere('skin', 0.098, [0, headY, 0], { seg: 20 })
        u.sphere('black', 0.1, [0, headY + 0.018, -0.016], { seg: 20 }) // hair
        u.box('skin', [0.02, 0.05, 0.03], [0.1, headY, 0], { r: 0.008 }) // ears
        u.box('skin', [0.02, 0.05, 0.03], [-0.1, headY, 0], { r: 0.008 })
        u.box('skin', [0.022, 0.035, 0.03], [0, headY - 0.01, 0.1], { r: 0.008 }) // nose
      }
      arm(u, L, -1, pose, 0.48)
      arm(u, L, 1, pose, 0.48)
    },
  )
}

/**
 * Cleanroom operator in bunny suit, 1.72 m tall, faces +Z.
 * u[0] = 1 walking (legs/arms swing, using s.T); 0 = idle breathing.
 */
export const operator: ModelDef = {
  key: 'operator',
  name: 'Cleanroom operator',
  size: [0.5, 0.3, 1.72],
  build(b) {
    person(b, SUIT, 'stand')
  },
}

/**
 * Control-room worker (shirt, trousers, hair), standing, faces +Z.
 * u[0] = 1 walking; 0 = idle breathing.
 */
export const officeWorker: ModelDef = {
  key: 'officeWorker',
  name: 'Control-room worker',
  size: [0.5, 0.3, 1.73],
  build(b) {
    person(b, OFFICE, 'stand')
  },
}

/**
 * Seated control-room worker for operator desks (seat ~0.48 m), faces +Z.
 * Hands rest forward at ~0.77 m, 0.45–0.55 m in front of the origin.
 * Small typing motion (s.T). u: unused.
 */
export const seatedWorker: ModelDef = {
  key: 'seatedWorker',
  name: 'Seated control-room worker',
  size: [0.5, 0.7, 1.3],
  build(b) {
    person(b, OFFICE, 'seat')
  },
}
