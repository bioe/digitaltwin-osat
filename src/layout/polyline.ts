export type Vec2 = [number, number]

export interface Polyline {
  points: Vec2[]
  length: number
  /** Point at distance `s` along the line. Closed lines wrap; open lines clamp. */
  at(s: number): Vec2
  /** Unit direction of travel at distance `s`. */
  dirAt(s: number): Vec2
}

export function polyline(points: Vec2[], closed = false): Polyline {
  const pts = closed ? [...points, points[0]] : points
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    cum.push(cum[i - 1] + Math.hypot(bx - ax, bz - az))
  }
  const length = cum[cum.length - 1]

  const norm = (s: number) =>
    closed ? ((s % length) + length) % length : Math.min(Math.max(s, 0), length)

  const segmentAt = (s: number) => {
    let i = 1
    while (i < cum.length - 1 && cum[i] < s) i++
    return i
  }

  return {
    points,
    length,
    at(s) {
      const d = norm(s)
      const i = segmentAt(d)
      const seg = cum[i] - cum[i - 1]
      const f = seg === 0 ? 0 : (d - cum[i - 1]) / seg
      const [ax, az] = pts[i - 1]
      const [bx, bz] = pts[i]
      return [ax + (bx - ax) * f, az + (bz - az) * f]
    },
    dirAt(s) {
      const i = segmentAt(norm(s))
      const [ax, az] = pts[i - 1]
      const [bx, bz] = pts[i]
      const len = Math.hypot(bx - ax, bz - az) || 1
      return [(bx - ax) / len, (bz - az) / len]
    },
  }
}
