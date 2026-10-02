import { labelEls, useLabels, type LabelData } from '../scene/labels'

const STYLE: Record<NonNullable<LabelData['variant']>, string> = {
  tag: 'pointer-events-none rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm',
  button: 'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm hover:border-blue-400',
  'button-active': 'rounded-md border border-blue-500 bg-blue-600 px-2 py-1 text-xs text-white shadow-sm',
}

/** DOM side of the label system; positions are written by LabelProjector. */
export function LabelLayer() {
  const labels = useLabels(s => s.labels)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Object.values(labels).map(l => {
        const variant = l.variant ?? 'tag'
        const ref = (el: HTMLElement | null) => {
          if (el) labelEls.set(l.id, el)
          else labelEls.delete(l.id)
        }
        const cls = `absolute left-0 top-0 whitespace-nowrap ${STYLE[variant]}`
        return variant === 'tag' ? (
          <div key={l.id} ref={ref} className={cls} style={{ display: 'none' }}>
            {l.text}
          </div>
        ) : (
          <button
            key={l.id}
            ref={ref}
            className={`pointer-events-auto ${cls}`}
            style={{ display: 'none' }}
            onClick={l.onClick}
            onPointerEnter={() => l.onHover?.(true)}
            onPointerLeave={() => l.onHover?.(false)}
          >
            {l.text}
          </button>
        )
      })}
    </div>
  )
}
