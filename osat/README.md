# OSAT-7 digital twin (assembly & test floor)

3D, fully simulated digital twin of a semiconductor back-end line:
Wafer Sort → Back Grind → Wafer Saw → Die Attach → Wire Bond → Molding → Marking →
Package Saw / Trim & Form → Final Test → Final Inspection → Tape & Reel.

```bash
npm run dev:osat     # http://localhost:5180
npm run build:osat
```

- **Capacity sizing**: `docs/capacity.md` (1.2 M units/day → 76 production tools + 10 auxiliary).
- **Models**: `src/models/*` — every machine built in code at real size with the DSL in `dsl.ts`, rendered with instancing.
- **Simulation**: `src/sim/world.ts` — lots flow stocker → tool → stocker (each tool stages its next lot while it runs); OHT, overhead conveyor and ARV fleets carry each move.
- **People**: 18 zone operators (attend tools, reset soft alarms at the tool, fetch consumables, carry QA samples to benches) and 8 technicians (repair hard alarms, PM rounds). Click anyone to see what they are doing.
- **Camera**: drag = rotate, right-drag = pan, wheel = zoom; ⟲ ⟳ ▲ ▼ buttons or Q/E/R/F keys; Space = auto-spin.
- **Status colours**: green = production, yellow = idle, red = alarm / stopped (blinking).
- **Building**: the production floor is level 3 (12 m up) above two dummy levels (glazed L1 with entrance and docks, clad L2). Simple site: lawn, apron, access road, car park, tree line.
- **War room**: compact loft-style room (brick wall, oak floor, black steel glazing, green wall, plants) on a mezzanine above the corridor. The **WAR ROOM** button shows the same six video-wall screens full size; click the floor map or an alarm to go there.
- **Traffic**: ARVs keep right and stop to give way to other ARVs and people; conveyor carriers queue; OHT vehicles keep spacing on the rail.
- **Follow**: selecting a vehicle or a person makes the camera follow it.
