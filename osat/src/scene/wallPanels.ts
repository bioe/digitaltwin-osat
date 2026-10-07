import * as THREE from 'three'
import { useMemo } from 'react'
import { DAILY_TARGET, PROCESSES } from '../data/processes'
import { world } from '../sim/world'
import { STATUS_HEX } from './materials'

/** The six war-room video-wall screens, drawn on canvases (shared by the 3D wall and the dashboard). */
export const PW = 1024
export const PH = 576

export type Draw = (g: CanvasRenderingContext2D) => void

function frame(g: CanvasRenderingContext2D, title: string) {
  g.fillStyle = '#06101f'
  g.fillRect(0, 0, PW, PH)
  g.strokeStyle = '#1d3a5f'
  g.lineWidth = 4
  g.strokeRect(2, 2, PW - 4, PH - 4)
  g.fillStyle = '#7dd3fc'
  g.font = '600 34px Rajdhani, sans-serif'
  g.fillText(title.toUpperCase(), 28, 50)
  g.fillStyle = '#1e3a5f'
  g.fillRect(28, 64, PW - 56, 2)
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

export const PANELS: Draw[] = [
  // 1. Floor map
  g => {
    frame(g, 'Floor status map')
    const B = world.L.bounds
    const sx = (PW - 80) / (B.x1 - B.x0)
    const sz = (PH - 120) / (B.z1 - B.z0)
    const X = (x: number) => 40 + (x - B.x0) * sx
    const Z = (z: number) => 90 + (z - B.z0) * sz
    g.fillStyle = '#0c1a2e'
    g.fillRect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * sx, (B.z1 - B.z0) * sz)
    for (const z of world.L.zones) {
      g.strokeStyle = '#27466e'
      g.lineWidth = 2
      g.strokeRect(X(z.x0), Z(z.z0), (z.x1 - z.x0) * sx, (z.z1 - z.z0) * sz)
      g.fillStyle = '#5b7aa3'
      g.font = '600 18px Rajdhani, sans-serif'
      g.fillText(z.proc.short, X(z.x0) + 4, z.row === 'north' ? Z(z.z0) - 6 : Z(z.z1) + 18)
    }
    for (const t of world.tools) {
      g.fillStyle = STATUS_HEX[t.state]
      g.fillRect(X(t.pos[0]) - 4, Z(t.pos[2]) - 4, 8, 8)
    }
    const wr = world.L.warRoom
    g.strokeStyle = '#f43f5e'
    g.strokeRect(X(wr.x0), Z(wr.z0), (wr.x1 - wr.x0) * sx, (wr.z1 - wr.z0) * sz)
  },
  // 2. KPIs
  g => {
    frame(g, 'Line KPIs · today')
    const k = world.kpis()
    const tiles: [string, string, string][] = [
      ['OUTPUT', fmt(k.units), `plan ${fmt(k.plan)}`],
      ['ATTAINMENT', `${((k.units / Math.max(1, k.plan)) * 100).toFixed(1)}%`, `target ${fmt(DAILY_TARGET)}/day`],
      ['LINE OEE', `${(k.oee * 100).toFixed(1)}%`, 'plan 85.0%'],
      ['WIP LOTS', fmt(k.wipLots), `${k.jobsActive} moves active`],
      ['TOOLS RUNNING', `${k.run}/${k.prodTotal}`, `${k.idle} idle`],
      ['ALARMS', String(k.alarm), 'active now'],
    ]
    tiles.forEach(([l, v, s], i) => {
      const x = 28 + (i % 3) * 328
      const y = 90 + Math.floor(i / 3) * 230
      g.fillStyle = '#0c1a2e'
      g.fillRect(x, y, 312, 210)
      g.fillStyle = '#7f9bbf'
      g.font = '600 26px Rajdhani, sans-serif'
      g.fillText(l, x + 18, y + 40)
      g.fillStyle = l === 'ALARMS' && k.alarm > 0 ? STATUS_HEX.alarm : '#e8f1ff'
      g.font = '700 72px Rajdhani, sans-serif'
      g.fillText(v, x + 18, y + 130)
      g.fillStyle = '#5b7aa3'
      g.font = '500 24px Inter, sans-serif'
      g.fillText(s, x + 18, y + 180)
    })
  },
  // 3. Hourly output
  g => {
    frame(g, 'Hourly output vs plan')
    const hs = world.hourly
    const max = Math.max(...hs.map(h => Math.max(h.units, h.plan))) * 1.15
    const bw = (PW - 100) / hs.length
    const base = PH - 60
    const H = base - 100
    hs.forEach((h, i) => {
      const x = 60 + i * bw
      const bh = (h.units / max) * H
      g.fillStyle = i === hs.length - 1 ? '#38bdf8' : '#2563eb'
      g.fillRect(x + 8, base - bh, bw - 16, bh)
      g.fillStyle = '#7f9bbf'
      g.font = '500 20px Inter, sans-serif'
      g.fillText(`${String(h.h).padStart(2, '0')}:00`, x + 8, base + 28)
    })
    const py = base - (hs[0].plan / max) * H
    g.strokeStyle = '#fbbf24'
    g.setLineDash([12, 8])
    g.lineWidth = 3
    g.beginPath(); g.moveTo(50, py); g.lineTo(PW - 30, py); g.stroke()
    g.setLineDash([])
    g.fillStyle = '#fbbf24'
    g.font = '600 22px Rajdhani, sans-serif'
    g.fillText(`PLAN ${fmt(hs[0].plan)}/h`, PW - 230, py - 10)
  },
  // 4. Process flow status
  g => {
    frame(g, 'Process flow · tool states')
    PROCESSES.forEach((p, i) => {
      const y = 92 + i * 43
      const tools = world.tools.filter(t => t.proc === p.id && !t.aux)
      const r = tools.filter(t => t.state === 'run').length
      const y2 = tools.filter(t => t.state === 'idle').length
      const a = tools.filter(t => t.state === 'alarm').length
      g.fillStyle = '#cfe0f5'
      g.font = '600 26px Rajdhani, sans-serif'
      g.fillText(p.name, 28, y + 26)
      const W = 440
      const x0 = 420
      const n = tools.length
      g.fillStyle = STATUS_HEX.run
      g.fillRect(x0, y + 6, (r / n) * W, 24)
      g.fillStyle = STATUS_HEX.idle
      g.fillRect(x0 + (r / n) * W, y + 6, (y2 / n) * W, 24)
      g.fillStyle = STATUS_HEX.alarm
      g.fillRect(x0 + ((r + y2) / n) * W, y + 6, (a / n) * W, 24)
      g.fillStyle = '#7f9bbf'
      g.font = '500 22px Inter, sans-serif'
      g.fillText(`${r}/${n}`, x0 + W + 20, y + 26)
      const s = world.stockers[i + 1]
      g.fillStyle = '#5b7aa3'
      g.fillText(`${s.lots.length}`, PW - 60, y + 26)
    })
  },
  // 5. Alarms
  g => {
    frame(g, 'Active alarms')
    const act = world.tools.filter(t => t.alarm).sort((a, b) => a.alarm!.at - b.alarm!.at)
    if (!act.length) {
      g.fillStyle = STATUS_HEX.run
      g.font = '600 40px Rajdhani, sans-serif'
      g.fillText('NO ACTIVE ALARMS', 28, 140)
    }
    act.slice(0, 10).forEach((t, i) => {
      const y = 100 + i * 46
      g.fillStyle = i % 2 ? '#0a1628' : '#0c1a2e'
      g.fillRect(28, y, PW - 56, 42)
      g.fillStyle = STATUS_HEX.alarm
      g.fillRect(28, y, 6, 42)
      g.font = '600 24px JetBrains Mono, monospace'
      g.fillText(t.alarm!.code, 46, y + 29)
      g.fillStyle = '#e8f1ff'
      g.font = '600 24px Rajdhani, sans-serif'
      g.fillText(t.id, 180, y + 29)
      g.fillStyle = '#b8c7db'
      g.font = '500 22px Inter, sans-serif'
      g.fillText(t.alarm!.text.slice(0, 40), 310, y + 29)
      const m = Math.floor((world.clock - t.alarm!.at) / 1000)
      g.fillStyle = '#7f9bbf'
      g.fillText(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, PW - 120, y + 29)
    })
  },
  // 6. AMHS
  g => {
    frame(g, 'Material handling (AMHS)')
    const k = world.kpis()
    const rows: [string, string, number, number, string][] = [
      ['OHT', 'Overhead hoist transport', k.ohtBusy, world.oht.length, '#3b82f6'],
      ['CONV', 'Overhead conveyor carriers', k.convItems, 40, '#a855f7'],
      ['ARV', 'Autonomous robotic vehicles', k.arvBusy, world.arvs.length, '#14b8a6'],
    ]
    rows.forEach(([code, name, busy, total, col], i) => {
      const y = 100 + i * 150
      g.fillStyle = '#0c1a2e'
      g.fillRect(28, y, PW - 56, 130)
      g.fillStyle = col
      g.fillRect(28, y, 8, 130)
      g.font = '700 44px Rajdhani, sans-serif'
      g.fillText(code, 56, y + 56)
      g.fillStyle = '#9fb3cc'
      g.font = '500 22px Inter, sans-serif'
      g.fillText(name, 56, y + 96)
      g.fillStyle = '#e8f1ff'
      g.font = '700 54px Rajdhani, sans-serif'
      g.fillText(code === 'CONV' ? `${busy}` : `${busy}/${total}`, 470, y + 72)
      g.fillStyle = '#7f9bbf'
      g.font = '500 22px Inter, sans-serif'
      const d = k.deliv[code as 'OHT']
      g.fillText(`${d.n} moves / 10 min · avg ${d.avg.toFixed(0)} s`, 640, y + 72)
    })
  },
]

export function useScreens() {
  return useMemo(
    () =>
      PANELS.map(draw => {
        const c = document.createElement('canvas')
        c.width = PW
        c.height = PH
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        return { c, tex, draw }
      }),
    [],
  )
}

