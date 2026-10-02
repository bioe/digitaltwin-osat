import { describe, expect, it } from 'vitest'
import { polyline } from './polyline'
import { BLOCKS, floorBase, blockHeight } from './site'
import { BAY_COUNT, TOOLS_PER_BAY, TOOL_SIZE, TRACK, toolLocal } from './fab'
import { RACK_COLS, RACK_ROWS, RACK_SIZE, agvRoute, rackLocal } from './warehouse'

describe('polyline', () => {
  it('measures and samples an open line', () => {
    const p = polyline([[0, 0], [10, 0], [10, 10]])
    expect(p.length).toBe(20)
    expect(p.at(5)).toEqual([5, 0])
    expect(p.at(15)).toEqual([10, 5])
    expect(p.at(99)).toEqual([10, 10])
    expect(p.dirAt(15)).toEqual([0, 1])
  })

  it('wraps a closed line', () => {
    const p = polyline([[0, 0], [10, 0], [10, 10], [0, 10]], true)
    expect(p.length).toBe(40)
    expect(p.at(45)).toEqual([5, 0])
    expect(p.at(-5)).toEqual([0, 5])
  })
})

describe('site', () => {
  it('stacks floor bases from floor heights', () => {
    expect(floorBase('fab', 1)).toBe(0)
    expect(floorBase('fab', 2)).toBe(6)
    expect(floorBase('fab', 3)).toBe(14)
    expect(blockHeight('fab')).toBe(20)
    expect(floorBase('office', 2)).toBe(6)
  })

  it('keeps blocks inside the campus and apart', () => {
    const spans = Object.values(BLOCKS).map(b => [b.center[0] - b.size[0] / 2, b.center[0] + b.size[0] / 2])
    spans.sort((a, b) => a[0] - b[0])
    for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThan(spans[i - 1][1])
    for (const [a, b] of spans) {
      expect(a).toBeGreaterThan(-320)
      expect(b).toBeLessThan(320)
    }
  })
})

describe('fab layout', () => {
  const [w, , d] = TOOL_SIZE
  const tools = Array.from({ length: BAY_COUNT * TOOLS_PER_BAY }, (_, i) =>
    toolLocal(Math.floor(i / TOOLS_PER_BAY), i % TOOLS_PER_BAY),
  )

  it('places 200 unique tools inside the fab footprint', () => {
    expect(new Set(tools.map(t => t.join())).size).toBe(200)
    for (const [x, z] of tools) {
      expect(Math.abs(x) + w / 2).toBeLessThan(150)
      expect(Math.abs(z) + d / 2).toBeLessThan(100)
    }
  })

  it('routes the AMHS track clear of every tool', () => {
    for (let s = 0; s < TRACK.length; s += 1) {
      const [x, z] = TRACK.at(s)
      expect(Math.abs(x)).toBeLessThan(150)
      expect(Math.abs(z)).toBeLessThan(100)
      for (const [tx, tz] of tools) {
        const inside = Math.abs(x - tx) < w / 2 && Math.abs(z - tz) < d / 2
        expect(inside).toBe(false)
      }
    }
  })
})

describe('warehouse layout', () => {
  it('keeps racks and AGV routes inside the footprint and off racks', () => {
    const racks = []
    for (let r = 0; r < RACK_ROWS; r++) for (let c = 0; c < RACK_COLS; c++) racks.push(rackLocal(r, c))
    expect(racks).toHaveLength(40)
    const [rw, , rd] = RACK_SIZE
    for (const [x, z] of racks) {
      expect(Math.abs(x) + rw / 2).toBeLessThan(60)
      expect(Math.abs(z) + rd / 2).toBeLessThan(75)
    }
    const route = agvRoute(3, 4, 2)
    for (let s = 0; s < route.length; s += 0.5) {
      const [x, z] = route.at(s)
      for (const [rx, rz] of racks) {
        expect(Math.abs(x - rx) < rw / 2 && Math.abs(z - rz) < rd / 2).toBe(false)
      }
    }
  })
})
