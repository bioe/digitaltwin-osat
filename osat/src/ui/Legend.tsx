import { MODE_TINT } from '../scene/Building'
import { STATUS_HEX, STATUS_LABEL } from '../scene/materials'
import { world } from '../sim/world'
import { useUI } from '../store'

export function Legend() {
  const layers = useUI(s => s.layers)
  const toggle = useUI(s => s.toggle)
  const flyTo = useUI(s => s.flyTo)
  const orbit = useUI(s => s.orbit)
  const spin = useUI(s => s.spin)
  const toggleSpin = useUI(s => s.toggleSpin)
  const B = world.L.bounds
  const items: [keyof typeof layers, string, string?][] = [
    ['oht', 'OHT', MODE_TINT.OHT],
    ['conv', 'Conveyor', MODE_TINT.CONV],
    ['arv', 'ARV', MODE_TINT.ARV],
    ['people', 'People'],
    ['labels', 'Labels'],
  ]
  return (
    <div className="dock flex items-center justify-center gap-4 border-t px-3 py-1.5">
      <div className="flex items-center gap-3 text-[12px]">
        {(['run', 'idle', 'alarm'] as const).map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="dot" style={{ background: STATUS_HEX[s], boxShadow: `0 0 6px ${STATUS_HEX[s]}` }} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
      <div className="h-5 w-px bg-white/15" />
      <div className="flex gap-1">
        {items.map(([k, label, c]) => (
          <button key={k} className={`btn ${layers[k] ? 'on' : ''}`} onClick={() => toggle(k)}>
            {c && <span className="dot mr-1.5" style={{ background: c }} />}
            {label}
          </button>
        ))}
      </div>
      <div className="h-5 w-px bg-white/15" />
      <div className="flex gap-1" aria-label="Rotate view">
        <button className="btn !px-2" title="Rotate left (Q)" onClick={() => orbit(Math.PI / 4)}>⟲</button>
        <button className="btn !px-2" title="Rotate right (E)" onClick={() => orbit(-Math.PI / 4)}>⟳</button>
        <button className="btn !px-2" title="Tilt up (R)" onClick={() => orbit(0, -0.2)}>▲</button>
        <button className="btn !px-2" title="Tilt down (F)" onClick={() => orbit(0, 0.2)}>▼</button>
        <button className={`btn ${spin ? 'on' : ''}`} title="Auto-rotate (Space)" onClick={toggleSpin}>Spin</button>
      </div>
      <button className="btn" title="Drag = rotate · right-drag = pan · wheel = zoom · click = inspect" onClick={() => flyTo([(B.x0 + B.x1) / 2, 0, 0], 2)}>⌂ Overview</button>
    </div>
  )
}
