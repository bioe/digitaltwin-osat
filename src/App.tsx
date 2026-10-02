import { useState } from 'react'
import { Scene } from './scene/Scene'
import { useSimLoop } from './store/store'
import { BottomBar } from './ui/BottomBar'
import { DetailPanel } from './ui/DetailPanel'
import { LabelLayer } from './ui/LabelLayer'
import { Fallback, hasWebGL } from './ui/Fallback'
import { TopBar } from './ui/TopBar'

export default function App() {
  useSimLoop()
  const [webgl] = useState(hasWebGL)
  if (!webgl) return <Fallback />
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <Scene />
      </div>
      <LabelLayer />
      <TopBar />
      <DetailPanel />
      <BottomBar />
    </div>
  )
}
