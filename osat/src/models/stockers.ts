import type { Builder, MatKey, ModelDef } from './dsl'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

interface StockerSpec {
  /** Footprint [w, d, h]. Ports protrude `portDepth` inside the footprint depth. */
  W: number
  D: number
  H: number
  portXs: number[]
  portY: number
  portDepth: number
  portW: number
  /** Rack geometry. */
  rackD: number
  slotPitch: number
  rowPitch: number
  /** Lowest shelf row in the front rack (above the port openings). */
  frontRow0: number
  backRow0: number
  /** Draw one stored carrier with its bottom centre at the origin. */
  carrier: (b: Builder, i: number, front: boolean) => void
}

const FOUP_MATS: MatKey[] = ['body', 'accent', 'bodyAlt', 'accent2', 'body', 'panel']

function buildStocker(b: Builder, p: StockerSpec) {
  const { W, D, H } = p
  const zb = -D / 2 // back wall
  const zf = D / 2 - p.portDepth // front wall
  const inW = W - 0.24
  const lowH = p.portY + 0.4 // solid lower band of the front wall
  const capH = 0.22
  const zFront = zf - 0.06 - p.rackD / 2 // front rack centre
  const zBack = zb + 0.06 + p.rackD / 2 // back rack centre
  const zAisle = (zFront - p.rackD / 2 + zBack + p.rackD / 2) / 2

  // --- frame + skin
  b.boxB('dark', [W - 0.04, 0.1, zf - zb - 0.04], [0, 0, (zf + zb) / 2]) // kick plate
  for (const x of [-W / 2 + 0.04, W / 2 - 0.04])
    for (const z of [zb + 0.04, zf - 0.04]) b.boxB('dark', [0.08, H - capH, 0.08], [x, 0, z])
  // side walls (solid), back wall
  for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) {
    b.boxB('body', [0.04, H - capH - 0.1, zf - zb - 0.12], [x, 0.1, (zf + zb) / 2])
    b.box('panel', [0.006, H - capH - 0.4, 0.004], [x, (H - capH) / 2, (zf + zb) / 2]) // seam
    // side vents
    for (const y of [0.4, 0.6]) b.box('dark', [0.044, 0.05, 0.6], [x, y, (zf + zb) / 2])
  }
  b.boxB('bodyAlt', [W - 0.12, H - capH - 0.1, 0.04], [0, 0.1, zb + 0.02])
  // top cap with fan filter units
  b.boxB('body', [W, capH, zf - zb], [0, H - capH, (zf + zb) / 2], { r: 0.03 })
  for (let i = 0; i < Math.floor(W / 1.2); i++) {
    const x = -W / 2 + 0.6 + i * 1.2 + (W - Math.floor(W / 1.2) * 1.2) / 2
    b.box('panel', [0.9, 0.02, (zf - zb) * 0.6], [x, H + 0.01, (zf + zb) / 2])
  }
  b.box('accent', [W + 0.002, 0.04, 0.004], [0, H - capH / 2, zf + 0.002])

  // --- front wall: lower solid band + glass upper with mullions
  b.boxB('body', [W, lowH - 0.1, 0.04], [0, 0.1, zf - 0.02])
  b.box('status', [W * 0.5, 0.025, 0.01], [0, lowH - 0.06, zf + 0.004]) // light bar
  const glassH = H - capH - lowH
  b.boxB('glass', [W - 0.1, glassH, 0.02], [0, lowH, zf - 0.02])
  const nMul = Math.round(W / 1.0)
  for (let i = 0; i <= nMul; i++) {
    const x = -W / 2 + 0.05 + (i * (W - 0.1)) / nMul
    b.boxB('dark', [0.05, glassH, 0.05], [x, lowH, zf - 0.02])
  }
  b.box('dark', [W, 0.05, 0.05], [0, lowH, zf - 0.02])
  // service door seams on the lower band
  for (const x of [-W / 2 + 0.6, W / 2 - 0.6]) {
    b.box('panel', [0.004, lowH - 0.25, 0.002], [x, lowH / 2 + 0.05, zf + 0.001])
    b.box('steel', [0.02, 0.14, 0.025], [x - 0.06, lowH * 0.55, zf + 0.012], { r: 0.006 })
  }

  // --- racks (steel shelves) + stored carriers
  const nCol = Math.floor(inW / p.slotPitch)
  const x0 = -((nCol - 1) * p.slotPitch) / 2
  const topY = H - capH - 0.45
  let k = 0
  const rack = (zc: number, row0: number, front: boolean) => {
    for (const x of [-inW / 2, inW / 2]) b.boxB('dark', [0.04, topY - row0 + 0.4, 0.04], [x, row0 - 0.03, zc])
    for (let y = row0; y <= topY; y += p.rowPitch) {
      b.box('steel', [inW, 0.02, p.rackD], [0, y - 0.01, zc])
      for (let c = 0; c < nCol; c++) {
        k++
        if ((c * 7 + Math.round(y * 10) * 3 + (front ? 0 : 2)) % 6 === 0) continue // empty slot
        b.group([x0 + c * p.slotPitch, y, zc], undefined, g => p.carrier(g, k, front))
      }
    }
  }
  rack(zFront, p.frontRow0, true)
  rack(zBack, p.backRow0, false)

  // --- stacker crane: floor + ceiling rails along the aisle
  b.boxB('steel', [inW, 0.06, 0.12], [0, 0.1, zAisle])
  b.box('dark', [inW, 0.06, 0.1], [0, H - capH - 0.05, zAisle])
  const xMin = -inW / 2 + 0.25
  const span = inW - 0.5
  const mastH = H - capH - 0.35
  b.anim(
    'crane',
    [xMin, 0.16, zAisle],
    (s, o) => {
      o.position.x = clamp01(s.u[0] ?? 0) * span
    },
    m => {
      // travel truck with wheels
      m.boxB('dark', [0.5, 0.14, 0.3], [0, 0, 0], { r: 0.02 })
      m.box('yellow', [0.52, 0.03, 0.31], [0, 0.07, 0])
      for (const x of [-0.18, 0.18]) m.cyl('rubber', 0.06, 0.04, [x, 0.0, 0.17], { rot: [Math.PI / 2, 0, 0] })
      // twin masts
      for (const x of [-0.12, 0.12]) m.boxB('steel', [0.08, mastH, 0.12], [x, 0.14, 0])
      m.boxB('dark', [0.4, 0.1, 0.2], [0, mastH + 0.04, 0])
      m.boxB('orange', [0.04, mastH - 0.2, 0.02], [0, 0.24, -0.07]) // cable chain
      // carriage with telescopic fork towards the front rack
      m.anim(
        'carriage',
        [0, 0.3, 0],
        (s, o) => {
          o.position.y = clamp01(s.u[1] ?? 0) * (mastH - 0.55)
        },
        c => {
          c.boxB('bodyAlt', [0.42, 0.26, 0.26], [0, 0, 0], { r: 0.02 })
          c.box('accent', [0.424, 0.03, 0.264], [0, 0.22, 0])
          c.boxB('dark', [0.36, 0.03, 0.4], [0, 0.02, 0.2])
          for (const x of [-0.12, 0.12]) c.box('steel', [0.03, 0.02, 0.36], [x, 0.045, 0.22])
          c.cyl('black', 0.02, 0.04, [0.16, 0.2, 0.135], { rot: [Math.PI / 2, 0, 0] }) // sensor
        },
      )
    },
  )

  // --- load ports (front, protrude portDepth)
  for (const x of p.portXs) {
    const zc = zf + p.portDepth / 2
    b.boxB('dark', [p.portW - 0.04, 0.08, p.portDepth - 0.04], [x, 0, zc])
    b.boxB('bodyAlt', [p.portW, p.portY - 0.12, p.portDepth], [x, 0.08, zc], { r: 0.02 })
    b.box('panel', [p.portW * 0.7, 0.004, 0.002], [x, p.portY * 0.5, zf + p.portDepth + 0.001])
    b.box('status', [p.portW * 0.6, 0.02, 0.006], [x, p.portY - 0.12, zf + p.portDepth + 0.003])
    b.boxB('dark', [p.portW, 0.04, p.portDepth], [x, p.portY - 0.04, zc], { r: 0.01 }) // stage plate
    for (const [dx, dz] of [[-0.1, -0.08], [0.1, -0.08], [0, 0.1]] as const)
      b.cyl('chrome', 0.01, 0.012, [x + dx * (p.portW / 0.6), p.portY + 0.006, zc + dz * (p.portDepth / 0.5)])
    // transfer opening in the wall behind the port
    b.box('black', [p.portW - 0.08, 0.42, 0.01], [x, p.portY + 0.24, zf + 0.004])
    b.box('dark', [p.portW - 0.04, 0.03, 0.03], [x, p.portY + 0.47, zf + 0.012])
    b.port([x, p.portY, zc])
  }

  // --- HMI pedestal (front, near the right end) + e-stop
  const hx = W / 2 - 0.35
  b.boxB('dark', [0.12, 0.25, 0.08], [hx, lowH - 0.1, zf + 0.04])
  b.box('dark', [0.42, 0.3, 0.04], [hx, lowH + 0.3, zf + 0.1], { r: 0.012, rot: [-0.12, 0, 0] })
  b.box('screen', [0.37, 0.25, 0.004], [hx, lowH + 0.3, zf + 0.123], { rot: [-0.12, 0, 0] })
  b.box('dark', [0.36, 0.025, 0.14], [hx, lowH - 0.12, zf + 0.09], { r: 0.008 })
  b.box('black', [0.32, 0.012, 0.1], [hx, lowH - 0.1, zf + 0.09])
  b.cyl('yellow', 0.04, 0.02, [hx - 0.32, lowH - 0.2, zf + 0.01], { rot: [Math.PI / 2, 0, 0] })
  b.cyl('red', 0.025, 0.03, [hx - 0.32, lowH - 0.2, zf + 0.03], { rot: [Math.PI / 2, 0, 0] })

  b.tower([W / 2 - 0.3, H, zb + 0.3])
}

/** Stored FOUP for the rack (cheap: 2–3 parts). */
function rackFoup(b: Builder, i: number, front: boolean) {
  const m = FOUP_MATS[i % FOUP_MATS.length]
  b.boxB(m, [0.39, 0.29, 0.33], [0, 0, 0], { r: 0.06 })
  b.boxB('dark', [0.2, 0.03, 0.2], [0, 0.29, 0], { r: 0.01 })
  if (front) b.box('panel', [0.32, 0.22, 0.01], [0, 0.145, -0.17], { r: 0.02 }) // door faces the crane
}

/** Stored magazine / tray stack for the rack. */
function rackMag(b: Builder, i: number, front: boolean) {
  if (i % 3 === 2) {
    // strapped JEDEC tray stack
    b.boxB(i % 2 ? 'black' : 'dark', [0.32, 0.13, 0.14], [0, 0, 0], { r: 0.006 })
    if (front) for (const x of [-0.09, 0.09]) b.boxB('white', [0.02, 0.134, 0.144], [x, -0.002, 0])
    return
  }
  b.boxB('dark', [0.26, 0.16, 0.08], [0, 0, 0], { r: 0.004 })
  if (front) for (let s = 0; s < 4; s++) b.box('copper', [0.262, 0.004, 0.06], [0, 0.03 + s * 0.035, 0])
}

/**
 * FOUP stocker (Daifuku / Murata class). Tall cleanroom enclosure with
 * glass front showing the FOUP racks and an internal stacker crane.
 * Front ports at x = -1.6 (input) and +1.6, top surface y = 0.9, port
 * modules protrude 0.5 m from the enclosure (ports at z = +1.05).
 * u[0] = crane X fraction 0..1 across the inner width (0 = -X end).
 * u[1] = carriage height fraction 0..1.
 */
export const stockerWafer: ModelDef = {
  key: 'stockerWafer',
  name: 'FOUP stocker (Daifuku / Murata class)',
  size: [6.0, 2.6, 4.2],
  build(b) {
    buildStocker(b, {
      W: 6.0,
      D: 2.6,
      H: 4.2,
      portXs: [-1.6, 1.6],
      portY: 0.9,
      portDepth: 0.5,
      portW: 0.6,
      rackD: 0.42,
      slotPitch: 0.5,
      rowPitch: 0.48,
      frontRow0: 1.45,
      backRow0: 0.35,
      carrier: rackFoup,
    })
  },
}

/**
 * Magazine / tray stocker. Same layout as the FOUP stocker with rack
 * shelves of strip magazines and strapped JEDEC tray stacks.
 * Front ports at x = -1.2 (input) and +1.2, top surface y = 0.9, port
 * modules protrude 0.4 m (ports at z = +0.7).
 * u[0] = crane X fraction 0..1, u[1] = carriage height fraction 0..1.
 */
export const stockerMag: ModelDef = {
  key: 'stockerMag',
  name: 'Magazine / tray stocker',
  size: [4.0, 1.8, 3.0],
  build(b) {
    buildStocker(b, {
      W: 4.0,
      D: 1.8,
      H: 3.0,
      portXs: [-1.2, 1.2],
      portY: 0.9,
      portDepth: 0.4,
      portW: 0.46,
      rackD: 0.26,
      slotPitch: 0.34,
      rowPitch: 0.26,
      frontRow0: 1.4,
      backRow0: 0.3,
      carrier: rackMag,
    })
  },
}
