import type { ToolStatus } from './sim/model'

export const STATUS_COLOR: Record<ToolStatus, string> = {
  run: '#22c55e',
  idle: '#94a3b8',
  pm: '#f59e0b',
  down: '#ef4444',
}

export const STATUS_LABEL: Record<ToolStatus, string> = {
  run: 'Running',
  idle: 'Idle',
  pm: 'PM',
  down: 'Down',
}

export const WARN = '#f59e0b'
export const ALARM = '#ef4444'
export const OK = '#22c55e'

/** Sequential blue heatmap scale. */
export const HEAT_LOW = '#dbeafe'
export const HEAT_HIGH = '#2563eb'
/** Single-series chart line. */
export const SERIES = '#2563eb'

export const ARCH = {
  background: '#eef2f6',
  ground: '#dde5d6',
  groundOuter: '#e8ede4',
  road: '#c9cdd3',
  shell: '#eef1f5',
  band: '#b7c4d3',
  edge: '#8b98a9',
  slab: '#d5dbe3',
  floor: '#f6f8fa',
  equipment: '#cfd6df',
  tree: '#c7d8bf',
  accent: '#2563eb',
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Map t in [0, 1] onto the heat scale; t > 1 shows as alarm red. */
export function heatColor(t: number): string {
  if (t > 1) return ALARM
  const a = hexToRgb(HEAT_LOW)
  const b = hexToRgb(HEAT_HIGH)
  const k = Math.min(1, Math.max(0, t))
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k))
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
}
