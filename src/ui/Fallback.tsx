import { SCENARIOS, SCENARIO_IDS } from '../sim/scenarios'
import { useFactory } from '../store/store'
import { SitePanel } from './panels/SitePanel'

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** 2D fallback when WebGL is missing: site summary + scenario menu, no drill-down. */
export function Fallback() {
  const start = useFactory(s => s.startScenario)
  const normalDay = useFactory(s => s.normalDay)
  return (
    <div className="mx-auto max-w-xl overflow-y-auto p-6" style={{ height: '100%' }}>
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        This browser has no WebGL, so the 3D view is not available. The live KPIs show below.
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SitePanel />
        <div className="mt-4 flex flex-wrap gap-2">
          {SCENARIO_IDS.map(id => (
            <button key={id} onClick={() => start(id)} className="rounded border border-slate-300 px-2 py-1 text-xs">
              {SCENARIOS[id].name}
            </button>
          ))}
          <button onClick={normalDay} className="rounded border border-slate-300 px-2 py-1 text-xs">
            Normal day
          </button>
        </div>
      </div>
    </div>
  )
}
