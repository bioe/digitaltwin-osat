import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'
import { create } from 'zustand'
import type { Vec3 } from './positions'

/**
 * Screen-space labels for 3D positions. Scene components register label data;
 * a DOM layer outside the canvas renders them; a projector inside the canvas
 * moves them every frame. This avoids one React root per label.
 */
export interface LabelData {
  id: string
  text: string
  pos: Vec3
  variant?: 'tag' | 'button' | 'button-active'
  onClick?: () => void
  onHover?: (on: boolean) => void
}

interface LabelStore {
  labels: Record<string, LabelData>
  put(l: LabelData): void
  remove(id: string): void
}

export const useLabels = create<LabelStore>(set => ({
  labels: {},
  put: l => set(s => ({ labels: { ...s.labels, [l.id]: l } })),
  remove: id =>
    set(s => {
      const { [id]: _, ...rest } = s.labels
      return { labels: rest }
    }),
}))

/** DOM elements by label id, filled by the DOM layer. */
export const labelEls = new Map<string, HTMLElement>()

/** Register a label while mounted. */
export function Label(props: LabelData) {
  const { id, text, variant, pos } = props
  const key = `${text}|${variant}|${pos.join(',')}`
  useEffect(() => {
    useLabels.getState().put(props)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => () => useLabels.getState().remove(id), [id])
  return null
}

const v = new Vector3()

/** Projects every registered label to screen space each frame. */
export function LabelProjector() {
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  useFrame(() => {
    const { labels } = useLabels.getState()
    for (const id in labels) {
      const el = labelEls.get(id)
      if (!el) continue
      v.set(...labels[id].pos).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.display = visible ? '' : 'none'
      if (visible) {
        const x = ((v.x + 1) / 2) * size.width
        const y = ((1 - v.y) / 2) * size.height
        el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
      }
    }
  })
  return null
}
