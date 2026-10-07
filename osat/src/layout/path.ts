/** 2D (x, z) polylines with arc-length parameterisation. */

export type P2 = [number, number]

export interface Path {
  pts: P2[]
  cum: number[]
  length: number
  closed: boolean
}

/** Rounds every corner of a polyline with an arc of radius r. */
export function roundCorners(pts: P2[], r: number, closed: boolean, steps = 6): P2[] {
  const out: P2[] = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const hasPrev = closed || i > 0
    const hasNext = closed || i < n - 1
    if (!hasPrev || !hasNext) {
      out.push(p)
      continue
    }
    const a = pts[(i - 1 + n) % n]
    const c = pts[(i + 1) % n]
    const d1 = norm([p[0] - a[0], p[1] - a[1]])
    const d2 = norm([c[0] - p[0], c[1] - p[1]])
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1])
    const l2 = Math.hypot(c[0] - p[0], c[1] - p[1])
    const rr = Math.min(r, l1 / 2, l2 / 2)
    const s: P2 = [p[0] - d1[0] * rr, p[1] - d1[1] * rr]
    const e: P2 = [p[0] + d2[0] * rr, p[1] + d2[1] * rr]
    // quadratic bezier approximates the fillet well enough
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      const u = 1 - t
      out.push([u * u * s[0] + 2 * u * t * p[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p[1] + t * t * e[1]])
    }
  }
  return out
}

function norm(v: P2): P2 {
  const l = Math.hypot(v[0], v[1]) || 1
  return [v[0] / l, v[1] / l]
}

export function makePath(pts: P2[], closed: boolean): Path {
  const list = closed ? [...pts, pts[0]] : pts
  const cum = [0]
  for (let i = 1; i < list.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]))
  }
  return { pts: list, cum, length: cum[cum.length - 1], closed }
}

/** Position and unit direction at arc length s. */
export function pathAt(path: Path, s: number): { p: P2; d: P2 } {
  const L = path.length
  let x = path.closed ? ((s % L) + L) % L : Math.min(Math.max(s, 0), L)
  const { cum, pts } = path
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= x) lo = mid
    else hi = mid
  }
  const seg = cum[hi] - cum[lo] || 1
  const t = (x - cum[lo]) / seg
  const a = pts[lo]
  const b = pts[hi]
  return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d: norm([b[0] - a[0], b[1] - a[1]]) }
}

/** Arc length of the closest point on the path to q. */
export function project(path: Path, q: P2): { s: number; dist: number } {
  let best = { s: 0, dist: Infinity }
  for (let i = 1; i < path.pts.length; i++) {
    const a = path.pts[i - 1]
    const b = path.pts[i]
    const vx = b[0] - a[0]
    const vz = b[1] - a[1]
    const l2 = vx * vx + vz * vz || 1
    const t = Math.min(1, Math.max(0, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vz) / l2))
    const px = a[0] + vx * t
    const pz = a[1] + vz * t
    const dist = Math.hypot(q[0] - px, q[1] - pz)
    if (dist < best.dist) best = { s: path.cum[i - 1] + Math.sqrt(l2) * t, dist }
  }
  return best
}

/** Forward distance from a to b along a closed loop. */
export function ahead(path: Path, a: number, b: number) {
  const L = path.length
  return (((b - a) % L) + L) % L
}
