import { useMemo } from 'react'
import * as THREE from 'three'
import { DAILY_TARGET, PROCESSES } from '../data/processes'
import { AI_STAGES, world, type Tool } from '../sim/world'
import { thumbnail } from '../ui/thumbs'
import { BRAND, BRAND_SUB } from '../ui/brand'
import { MODE_TINT } from './Building'
import { STATUS_HEX } from './materials'

/**
 * The war-room video wall: the same command-centre layout as the app.
 * Brand title strip above three screens: left (equipment + AI recovery),
 * centre (digital twin floor map), right (performance + alert queue).
 * Shared by the 3D wall and the full-screen WAR ROOM view.
 */

export type Draw = (g: CanvasRenderingContext2D) => void
export interface Screen {
  key: 'title' | 'left' | 'center' | 'right'
  w: number
  h: number
  draw: Draw
}

const CYAN = '#38bdf8'
const INK = '#eaf6ff'
const INK2 = '#9fb3cc'
const INK3 = '#6b819e'
const AMBER = '#fbbf24'
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function bg(g: CanvasRenderingContext2D, w: number, h: number) {
  const grd = g.createLinearGradient(0, 0, 0, h)
  grd.addColorStop(0, '#0b1d36')
  grd.addColorStop(1, '#06101f')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
}

function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string) {
  g.fillStyle = 'rgba(12,30,56,0.9)'
  g.fillRect(x, y, w, h)
  g.strokeStyle = 'rgba(56,189,248,0.55)'
  g.lineWidth = 2
  g.strokeRect(x + 1, y + 1, w - 2, h - 2)
  g.fillStyle = CYAN
  g.fillRect(x + 12, y + 14, 5, 24)
  g.fillStyle = INK
  g.font = '700 26px Rajdhani, sans-serif'
  g.fillText(title.toUpperCase(), x + 26, y + 35)
}

function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fillStyle = c
  g.shadowColor = c
  g.shadowBlur = 8
  g.fill()
  g.shadowBlur = 0
}

function stateOf(t: Tool): [string, string] {
  if (t.alarm?.ai) return ['AI recovery', AMBER]
  if (t.state === 'alarm') return ['Down', STATUS_HEX.alarm]
  if (t.state === 'idle') return ['Idle', STATUS_HEX.idle]
  return ['Running', STATUS_HEX.run]
}

const imgs = new Map<string, HTMLImageElement>()
function thumb(model: string) {
  let im = imgs.get(model)
  if (!im) {
    im = new Image()
    im.src = thumbnail(model)
    imgs.set(model, im)
  }
  return im
}

// ------------------------------------------------------------------ title
const drawTitle: Draw = g => {
  const w = 2048
  const h = 256
  g.clearRect(0, 0, w, h)
  g.textAlign = 'center'
  g.fillStyle = '#f2fbff'
  g.shadowColor = 'rgba(125,211,252,1)'
  g.shadowBlur = 28
  g.font = '700 140px Rajdhani, sans-serif'
  ;(g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '40px'
  g.fillText(BRAND, w / 2, 150)
  g.shadowBlur = 10
  g.font = '600 40px Rajdhani, sans-serif'
  ;(g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '16px'
  g.fillStyle = '#cfe8ff'
  g.fillText(BRAND_SUB.toUpperCase(), w / 2, 222)
  g.shadowBlur = 0
  ;(g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'
  g.textAlign = 'left'
}

// ------------------------------------------------------------------ left
const drawLeft: Draw = g => {
  const W = 1024
  const H = 1152
  bg(g, W, H)
  // equipment status
  panel(g, 12, 12, W - 24, 690, 'Equipment status')
  const cw = (W - 24 - 36) / 2
  const ch = 100
  PROCESSES.forEach((p, i) => {
    const x = 24 + (i % 2) * (cw + 12)
    const y = 58 + Math.floor(i / 2) * (ch + 8)
    if (y + ch > 700) return
    g.fillStyle = 'rgba(10,26,48,0.95)'
    g.fillRect(x, y, cw, ch)
    g.strokeStyle = 'rgba(56,189,248,0.25)'
    g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1)
    const im = thumb(p.model)
    if (im.complete) g.drawImage(im, x + 8, y + 9, 114, 82)
    const tools = world.tools.filter(t => t.proc === p.id && !t.aux)
    const run = tools.filter(t => t.state === 'run').length
    g.fillStyle = INK
    g.font = '700 23px Rajdhani, sans-serif'
    g.fillText(p.name.length > 18 ? p.short : p.name, x + 134, y + 26)
    g.fillStyle = STATUS_HEX.run
    g.textAlign = 'right'
    g.fillText(`${run}/${tools.length}`, x + cw - 10, y + 26)
    g.textAlign = 'left'
    const shown = [...tools].sort((a, b) => ({ alarm: 0, idle: 1, run: 2 })[a.state] - ({ alarm: 0, idle: 1, run: 2 })[b.state]).slice(0, 3)
    shown.forEach((t, k) => {
      const [txt, c] = stateOf(t)
      const ty = y + 50 + k * 20
      dot(g, x + 140, ty - 6, 5, c)
      g.fillStyle = INK2
      g.font = '500 18px JetBrains Mono, monospace'
      g.fillText(t.id, x + 152, ty)
      g.fillStyle = c
      g.font = '600 19px Rajdhani, sans-serif'
      g.fillText(txt, x + 266, ty)
    })
  })
  // pack & ship card in the free slot after the last process
  {
    const i = PROCESSES.length
    const x = 24 + (i % 2) * (cw + 12)
    const y = 58 + Math.floor(i / 2) * (ch + 8)
    const units = world.shipUnits()
    g.fillStyle = 'rgba(10,26,48,0.95)'
    g.fillRect(x, y, cw, ch)
    g.strokeStyle = 'rgba(56,189,248,0.25)'
    g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1)
    const im = thumb('packStation')
    if (im.complete) g.drawImage(im, x + 8, y + 9, 114, 82)
    g.fillStyle = INK
    g.font = '700 23px Rajdhani, sans-serif'
    g.fillText('Pack & Ship', x + 134, y + 26)
    g.fillStyle = STATUS_HEX.run
    g.textAlign = 'right'
    g.fillText(`${units.filter(u => u.state === 'run').length}/${units.length}`, x + cw - 10, y + 26)
    g.textAlign = 'left'
    units.slice(0, 3).forEach((u, k) => {
      const c = STATUS_HEX[u.state]
      const ty = y + 50 + k * 20
      dot(g, x + 140, ty - 6, 5, c)
      g.fillStyle = INK2
      g.font = '500 18px JetBrains Mono, monospace'
      g.fillText(u.id, x + 152, ty)
      g.fillStyle = c
      g.font = '600 19px Rajdhani, sans-serif'
      g.fillText(u.text, x + 266, ty)
    })
  }
  // AI auto recovery
  const y0 = 716
  panel(g, 12, y0, W - 24, H - y0 - 12, 'AI auto recovery')
  const active = world.tools.filter(t => t.alarm?.ai)
  AI_STAGES.forEach((label, i) => {
    const x = 40 + i * 194
    const n = active.filter(t => t.alarm!.ai!.stage === i).length
    const c = i === 4 ? '#34d399' : CYAN
    g.strokeStyle = c
    g.lineWidth = 2
    g.fillStyle = n ? `${c}44` : `${c}14`
    g.fillRect(x, y0 + 56, 64, 64)
    g.strokeRect(x, y0 + 56, 64, 64)
    if (n) {
      dot(g, x + 64, y0 + 56, 12, AMBER)
      g.fillStyle = '#000'
      g.font = '700 16px Rajdhani'
      g.fillText(String(n), x + 59, y0 + 62)
    }
    g.fillStyle = c
    g.font = '700 30px Rajdhani'
    g.textAlign = 'center'
    g.fillText(['◎', '⚙', '☰', '▶', '✓'][i], x + 32, y0 + 100)
    g.fillStyle = INK2
    g.font = '500 17px Inter, sans-serif'
    label.split(' ').reduce<string[]>((acc, wd) => {
      const last = acc[acc.length - 1]
      if (last && (last + ' ' + wd).length < 13) acc[acc.length - 1] = last + ' ' + wd
      else acc.push(wd)
      return acc
    }, []).forEach((ln, k) => g.fillText(ln, x + 32, y0 + 144 + k * 19))
    g.textAlign = 'left'
    if (i < 4) {
      g.fillStyle = CYAN
      g.font = '700 30px Inter'
      g.fillText('→', x + 120, y0 + 98)
    }
  })
  const cols = [30, 120, 240, 520, 860]
  g.fillStyle = INK3
  g.font = '500 17px Inter, sans-serif'
  ;['Time', 'Equipment', 'Issue', 'AI action', 'Status'].forEach((h, i) => g.fillText(h, cols[i], y0 + 210))
  world.alarmLog
    .filter(a => a.ai)
    .slice(0, 8)
    .forEach((a, k) => {
      const y = y0 + 240 + k * 26
      const done = !!a.cleared
      const c = done ? '#34d399' : AMBER
      dot(g, cols[0] - 10, y - 6, 5, c)
      g.font = '500 18px Inter, sans-serif'
      g.fillStyle = INK
      g.fillText(hhmm(a.at), cols[0], y)
      g.fillText(a.tool, cols[1], y)
      g.fillStyle = INK2
      g.fillText(a.text.slice(0, 26), cols[2], y)
      g.fillStyle = INK
      g.fillText(a.ai!.action.slice(0, 30), cols[3], y)
      g.fillStyle = c
      g.fillText(done ? 'Resolved' : 'In progress', cols[4], y)
    })
}

// ------------------------------------------------------------------ centre
const drawCenter: Draw = g => {
  const W = 1792
  const H = 1152
  bg(g, W, H)
  panel(g, 12, 12, W - 24, H - 24, 'Digital twin')
  // process tabs
  let tx = 220
  PROCESSES.forEach(p => {
    const tools = world.tools.filter(t => t.proc === p.id && !t.aux)
    const worst = tools.some(t => t.state === 'alarm') ? 'alarm' : tools.some(t => t.state === 'idle') ? 'idle' : 'run'
    g.font = '600 20px Rajdhani, sans-serif'
    const tw = g.measureText(p.short).width + 40
    g.fillStyle = 'rgba(14,40,72,0.9)'
    g.fillRect(tx, 20, tw, 32)
    dot(g, tx + 14, 36, 5, STATUS_HEX[worst])
    g.fillStyle = INK
    g.fillText(p.short, tx + 26, 43)
    tx += tw + 8
  })
  {
    const units = world.shipUnits()
    const st = units.some(u => u.state === 'alarm') ? 'alarm' : units.some(u => u.state === 'idle') ? 'idle' : 'run'
    const tw = g.measureText('SHIP').width + 40
    g.fillStyle = 'rgba(14,40,72,0.9)'
    g.fillRect(tx, 20, tw, 32)
    dot(g, tx + 14, 36, 5, STATUS_HEX[st])
    g.fillStyle = INK
    g.fillText('SHIP', tx + 26, 43)
  }
  // floor map
  const B = world.L.bounds
  const mx = 40
  const my = 90
  const mw = W - 80
  const mh = H - 190
  const sx = mw / (B.x1 - B.x0)
  const sz = mh / (B.z1 - B.z0)
  const X = (x: number) => mx + (x - B.x0) * sx
  const Z = (z: number) => my + (z - B.z0) * sz
  g.fillStyle = '#0d1d33'
  g.fillRect(mx, my, mw, mh)
  for (const z of world.L.zones) {
    g.fillStyle = `${MODE_TINT[z.proc.mode]}26`
    g.fillRect(X(z.x0), Z(z.z0), (z.x1 - z.x0) * sx, (z.z1 - z.z0) * sz)
    g.strokeStyle = `${MODE_TINT[z.proc.mode]}aa`
    g.lineWidth = 2
    g.strokeRect(X(z.x0), Z(z.z0), (z.x1 - z.x0) * sx, (z.z1 - z.z0) * sz)
  }
  // transport loops
  for (const [loop, c] of [[world.L.loops.OHT, '#60a5fa'], [world.L.loops.CONV, '#c084fc']] as const) {
    g.strokeStyle = c
    g.lineWidth = 2
    g.beginPath()
    loop.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))))
    g.stroke()
  }
  for (const s of world.stockers) {
    g.fillStyle = '#94a3b8'
    g.fillRect(X(s.pos[0]) - 10, Z(s.pos[2]) - 6, 20, 12)
  }
  for (const t of world.tools) {
    const c = t.alarm?.ai ? AMBER : STATUS_HEX[t.state]
    g.fillStyle = c
    g.fillRect(X(t.pos[0]) - t.size[0] * sx * 0.45, Z(t.pos[2]) - t.size[1] * sz * 0.45, t.size[0] * sx * 0.9, t.size[1] * sz * 0.9)
  }
  for (const a of world.arvs) dot(g, X(a.pos[0]), Z(a.pos[1]), 5, '#2dd4bf')
  for (const k of [...world.techs, ...world.operators]) dot(g, X(k.pos[0]), Z(k.pos[1]), 3, '#f8fafc')
  const wr = world.L.warRoom
  g.strokeStyle = '#f43f5e'
  g.lineWidth = 3
  g.strokeRect(X(wr.x0), Z(wr.z0), (wr.x1 - wr.x0) * sx, (wr.z1 - wr.z0) * sz)
  // zone callouts
  for (const z of world.L.zones) {
    const tools = world.tools.filter(t => t.proc === z.proc.id && !t.aux)
    const pct = Math.round((tools.filter(t => t.state === 'run').length / tools.length) * 100)
    const x = X((z.x0 + z.x1) / 2)
    const y = z.row === 'north' ? Z(z.z0) - 8 : Z(z.z1) + 70
    g.font = '700 21px Rajdhani, sans-serif'
    const w = Math.max(g.measureText(z.proc.short).width, 120) + 20
    g.fillStyle = 'rgba(6,18,34,0.92)'
    g.fillRect(x - w / 2, y - 46, w, 62)
    g.strokeStyle = MODE_TINT[z.proc.mode]
    g.strokeRect(x - w / 2, y - 46, w, 62)
    g.fillStyle = INK
    g.textAlign = 'center'
    g.fillText(z.proc.short, x, y - 27)
    g.font = '600 17px Rajdhani, sans-serif'
    g.fillStyle = pct >= 80 ? STATUS_HEX.run : STATUS_HEX.idle
    g.fillText(`Running ${pct}%`, x, y - 9)
    g.fillStyle = '#bae6fd'
    g.fillText(`MMR ${world.mmr(z.proc.id).label}`, x, y + 9)
    g.textAlign = 'left'
  }
  // alarm callouts
  for (const t of world.tools.filter(q => q.alarm)) {
    const c = t.alarm!.ai ? AMBER : STATUS_HEX.alarm
    const x = X(t.pos[0])
    const y = Z(t.pos[2])
    g.strokeStyle = c
    g.lineWidth = 3
    g.beginPath()
    g.arc(x, y, 14, 0, Math.PI * 2)
    g.stroke()
  }
  // legend
  const ly = H - 46
  ;[['Running', STATUS_HEX.run], ['Idle', STATUS_HEX.idle], ['Down', STATUS_HEX.alarm], ['AI recovery', AMBER], ['OHT', '#60a5fa'], ['Conveyor', '#c084fc'], ['ARV', '#2dd4bf']].forEach(
    ([l, c], i) => {
      dot(g, 50 + i * 170, ly - 6, 7, c)
      g.fillStyle = INK2
      g.font = '500 20px Inter, sans-serif'
      g.fillText(l, 64 + i * 170, ly)
    },
  )
}

// ------------------------------------------------------------------ right
const drawRight: Draw = g => {
  const W = 1024
  const H = 1152
  bg(g, W, H)
  const k = world.kpis()
  panel(g, 12, 12, W - 24, 640, 'Production performance')
  const att = k.units / Math.max(1, k.plan)
  const tiles: [string, string, string, string][] = [
    ['Total output', `${fmt(k.units / 1000)} K`, `${((att - 1) * 100).toFixed(1)}% vs plan`, att >= 0.97 ? '#34d399' : CYAN],
    ['Plan achievement', `${(att * 100).toFixed(1)}%`, `target ${fmt(DAILY_TARGET / 1e6)} M/day`, '#34d399'],
    ['Line OEE', `${(k.oee * 100).toFixed(1)}%`, 'plan 85.0%', CYAN],
    ['Active alarms', String(k.alarm), `${world.tools.filter(t => t.alarm?.ai).length} handled by AI`, k.alarm ? AMBER : '#34d399'],
  ]
  tiles.forEach(([l, v, s, c], i) => {
    const x = 24 + i * 246
    g.fillStyle = 'rgba(10,26,48,0.95)'
    g.fillRect(x, 58, 236, 130)
    g.fillStyle = INK2
    g.font = '500 19px Inter, sans-serif'
    g.fillText(l, x + 12, 86)
    g.fillStyle = INK
    g.font = '700 46px Rajdhani, sans-serif'
    g.fillText(v, x + 12, 138)
    g.fillStyle = c
    g.font = '500 17px Inter, sans-serif'
    g.fillText(s, x + 12, 172)
  })
  // throughput bars + plan
  const cx0 = 40
  const cy0 = 230
  const cw = 640
  const ch = 380
  g.fillStyle = INK2
  g.font = '500 19px Inter, sans-serif'
  g.fillText('Throughput (units / hour)', cx0, cy0 - 6)
  const hs = world.hourly
  const max = Math.max(...hs.map(h => Math.max(h.units, h.plan))) * 1.15
  const bw = cw / hs.length
  hs.forEach((h, i) => {
    const bh = (h.units / max) * (ch - 40)
    g.fillStyle = i === hs.length - 1 ? '#38bdf8' : '#2563eb'
    g.fillRect(cx0 + i * bw + 6, cy0 + ch - 30 - bh, bw - 12, bh)
    g.fillStyle = INK3
    g.font = '500 15px Inter'
    if (i % 2 === 0) g.fillText(`${String(h.h).padStart(2, '0')}:00`, cx0 + i * bw + 4, cy0 + ch - 6)
  })
  const py = cy0 + ch - 30 - (hs[0].plan / max) * (ch - 40)
  g.strokeStyle = AMBER
  g.setLineDash([10, 8])
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(cx0, py)
  g.lineTo(cx0 + cw, py)
  g.stroke()
  g.setLineDash([])
  // OEE ring
  const rx = 840
  const ry = 380
  g.lineWidth = 22
  g.strokeStyle = '#12304f'
  g.beginPath()
  g.arc(rx, ry, 110, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = '#22e07a'
  g.shadowColor = '#22e07a'
  g.shadowBlur = 14
  g.beginPath()
  g.arc(rx, ry, 110, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k.oee)
  g.stroke()
  g.shadowBlur = 0
  g.textAlign = 'center'
  g.fillStyle = INK2
  g.font = '600 26px Rajdhani'
  g.fillText('OEE', rx, ry - 14)
  g.fillStyle = INK
  g.font = '700 54px Rajdhani'
  g.fillText(`${(k.oee * 100).toFixed(1)}%`, rx, ry + 36)
  g.textAlign = 'left'
  // alert queue
  const y0 = 666
  panel(g, 12, y0, W - 24, H - y0 - 12, 'Alert queue')
  const cols = [30, 90, 190, 340, 790, 900]
  g.fillStyle = INK3
  g.font = '500 17px Inter, sans-serif'
  ;['#', 'Time', 'Equipment', 'Description', 'Severity', 'Status'].forEach((h, i) => g.fillText(h, cols[i], y0 + 74))
  const SEV = { High: '#ff4d5e', Medium: AMBER, Low: CYAN }
  world.alarmLog.slice(0, 13).forEach((a, i) => {
    const y = y0 + 106 + i * 28
    const t = world.toolById.get(a.tool)
    const status = a.cleared ? 'Resolved' : a.ai || t?.tech?.working ? 'In progress' : 'Open'
    g.font = '500 18px Inter, sans-serif'
    g.fillStyle = INK3
    g.fillText(String(i + 1).padStart(3, '0'), cols[0], y)
    g.fillStyle = INK
    g.fillText(hhmm(a.at), cols[1], y)
    g.fillText(a.tool, cols[2], y)
    g.fillText(a.text.slice(0, 34), cols[3], y)
    dot(g, cols[4] + 6, y - 6, 6, SEV[a.severity])
    g.fillStyle = SEV[a.severity]
    g.fillText(a.severity, cols[4] + 18, y)
    g.fillStyle = status === 'Resolved' ? '#34d399' : status === 'In progress' ? CYAN : INK2
    g.fillText(status, cols[5], y)
  })
}

export const SCREENS: Screen[] = [
  { key: 'title', w: 2048, h: 256, draw: drawTitle },
  { key: 'left', w: 1024, h: 1152, draw: drawLeft },
  { key: 'center', w: 1792, h: 1152, draw: drawCenter },
  { key: 'right', w: 1024, h: 1152, draw: drawRight },
]

/** Canvas + texture per screen (3D wall). */
export function useScreens() {
  return useMemo(
    () =>
      SCREENS.map(s => {
        const c = document.createElement('canvas')
        c.width = s.w
        c.height = s.h
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        return { ...s, c, tex }
      }),
    [],
  )
}
