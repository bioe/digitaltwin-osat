import { world, type Worker } from '../sim/world'
import { useUI } from '../store'
import { Instanced, setPose } from './Instanced'

const all = (): Worker[] => [...world.techs, ...world.operators]

/** Technicians and zone operators walking between tools, benches and the maintenance desk. */
export function People() {
  const select = useUI(s => s.select)
  const show = useUI(s => s.layers.people)
  const people = all()
  if (!show) return null
  return (
    <group>
      <Instanced
        model="operator"
        capacity={people.length}
        dynamic
        fill={(i, inst) => {
          const k = people[i]
          setPose(inst.m, k.pos[0], 0, k.pos[1], k.heading)
          inst.state = k.task === 'repair' && k.working ? 'alarm' : 'run'
          inst.t = world.t
          inst.phase = i * 0.17
          inst.u = [k.moving ? 1 : 0, k.working && !k.carry ? 1 : 0, k.carry ? 1 : 0]
        }}
        onPick={i => select({ kind: 'tech', id: people[i].id })}
      />
      {/* item carried in front of the body */}
      <Instanced
        model="trayStack"
        capacity={people.length}
        dynamic
        count={() => people.length}
        fill={(i, inst) => {
          const k = people[i]
          inst.visible = !!k.carry
          const fx = Math.sin(k.heading) * 0.36
          const fz = Math.cos(k.heading) * 0.36
          setPose(inst.m, k.pos[0] + fx, 0.98, k.pos[1] + fz, k.heading + Math.PI / 2)
        }}
      />
    </group>
  )
}
