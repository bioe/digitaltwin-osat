# Semiconductor Fab Digital Twin — Design

Date: 2026-10-02
Status: Approved in brainstorming

## 1. Purpose

A 3D interactive digital twin of a 100-acre, 3-storey semiconductor factory campus, for **demo / pitch** use. All data is simulated in the browser. No backend.

The site has three zones: **office**, **production floor (fab)**, and **warehouse**. Each zone shows interactive data.

## 2. Decisions

| Topic | Decision |
|---|---|
| Purpose | Demo / pitch, simulated data |
| Visual style | Clean architectural: light, matte, isometric "architect model" look. Color only for data. |
| Site layout | Three connected 3-storey blocks (office, fab, warehouse), enclosed bridges on L2 |
| Screen layout | Full-screen 3D + floating KPI chips + slide-in detail panel |
| Data over time | Live tick (1 s) + scripted scenarios |
| Stack | Vite + React + TypeScript + react-three-fiber + drei + Zustand + Recharts + Tailwind |

## 3. Site and building model

Scale: 1 scene unit = 1 m. Campus ≈ 640 m × 640 m (100 acres).

| Block | Footprint | Floors |
|---|---|---|
| Office | 80 × 80 m | L1–L3: open desks + meeting rooms. L3 holds the executive KPI board room. |
| Fab | 300 × 200 m | L1 sub-fab (utilities), L2 cleanroom (8 m height), L3 fan deck / HVAC |
| Warehouse | 120 × 150 m | Racks on L1–L3. AGVs on L1. Dock doors on the outer wall. |

- Floor height 6 m, except fab L2 at 8 m.
- Fab L2 cleanroom: 8 tool bays in rows — litho, etch, deposition, CMP, implant, metrology, diffusion, clean. Overhead AMHS track loop with moving FOUPs.
- Fab L1 and L3: utility equipment as simple blocks. Environment and energy data only.
- Context items (no data, low detail): perimeter road, parking, utility yard (gas, water, power).
- All geometry is made in code. No imported models.

### Navigation (drill-down)

1. **Site** — orbit view of the campus.
2. **Block** — click a block. Roof and upper floors fade.
3. **Floor** — pick a floor. Assets show and are clickable.
4. **Asset** — click an asset. Camera moves to it. Detail panel opens.

A breadcrumb (`Site › Fab › L2`) lets the user go back up.

## 4. Data shown per zone

### Fab (production floor)
- **Tool status + OEE** — each tool colored by state. Click for OEE, uptime, queue, alarms.
- **Wafer lot flow** — animated FOUPs on the AMHS track. WIP count per step. FOUP click → lot ID, product, current step, route progress.
- **Yield + output KPIs** — wafer starts, wafer outs, line yield, cycle time.
- **Cleanroom environment** — heatmap overlays: particles, temperature, humidity.

### Warehouse
- **Inventory levels** — raw wafers, chemicals, gases, finished goods vs. reorder level. Rack click → contents.
- **AGV tracking** — animated AGVs between racks and docks. AGV click → task, battery, route.

### Office
- **Occupancy by area** — desks and rooms colored by use.
- **Energy + HVAC** — kW and temperature per zone.
- **Site-wide KPI board** — executive summary: output, yield, energy, safety days, alarms by block.

## 5. UI

- **KPI chips** (top): context-aware — site KPIs at site level, zone KPIs at block/floor level.
- **Detail panel** (right, slides in): floor summary when nothing is selected; asset detail when an asset is selected. Contains KPI tiles, a 10-minute trend chart, and an alarm list.
- **Overlay toggles** per floor. Fab: Tool status · Particles · Temp · Humidity. Office: Occupancy · Energy · Temp.
- **Scenario menu**: start a scripted event.
- **Breadcrumb** (bottom left) and **Legend**.

### Status colors (shared)

| State | Color |
|---|---|
| Running / OK | green `#22c55e` |
| Idle | grey `#94a3b8` |
| Warning / PM | amber `#f59e0b` |
| Down / Alarm | red `#ef4444` |
| Heatmap | sequential blue `#dbeafe → #2563eb` |

Building surfaces are matte grey / off-white.

## 6. Architecture

```
src/
  sim/            simulation engine (pure TS, no React)
    model.ts        types: Tool, Lot, Rack, AGV, Zone, KPIs
    seed.ts         initial factory state
    tick.ts         advance(state, dt) → new state
    scenarios.ts    scripted events
  store/          Zustand: sim state, 10-min history ring buffer, view state (drill level, selection, overlay)
  scene/          3D, reads store
    Site.tsx, FabBlock.tsx, OfficeBlock.tsx, WarehouseBlock.tsx
    assets/       Tool.tsx, FoupTrack.tsx, Rack.tsx, Agv.tsx, Desk.tsx
    CameraRig.tsx camera transitions per drill level
    overlays/     heatmaps
  ui/             2D panels
    KpiChips.tsx, Breadcrumb.tsx, DetailPanel.tsx, ScenarioMenu.tsx, Legend.tsx
```

### Unit boundaries
- `sim/` has no dependency on React or Three. Input: state + dt (+ active scenario events). Output: new state.
- `store/` owns the sim loop and history. It is the only bridge between `sim/` and the view.
- `scene/` and `ui/` read from the store through selectors and write only view state (selection, drill level, overlay, scenario start).

### Data flow
1. Sim loop calls `advance()` once per second.
2. Store saves new state and appends KPIs to the history buffer.
3. Scene components select only the data they need. FOUPs and AGVs interpolate between ticks for smooth 60 fps motion.
4. Click asset → store sets `selection` → detail panel opens, camera moves.
5. Start scenario → timed events are injected into the sim.

### Scenarios (first set)
- **Tool down** — ETCH-03 goes down → its queue grows → WIP increases → OEE decreases → alarm.
- **Particle spike** — one cleanroom zone exceeds limit → heatmap turns hot → alarm.
- **Low stock** — a chemical goes below reorder level → rack and KPI turn amber.
- **Office HVAC peak** — energy and temperature rise in office zones.
- **Normal day** — reset to baseline.

### Performance
- Repeated assets (tools, racks, desks, FOUPs) use instanced meshes.
- Low-poly code-made geometry only.
- Target: 60 fps on a recent laptop.

## 7. Error handling

- No WebGL → show a message and a 2D fallback: the KPI panels without 3D.
- Sim clamps all values to valid ranges (yield 0–100 %, stock ≥ 0, battery 0–100 %). A bad scenario step cannot corrupt state.
- Hidden tab → sim pauses. On return, it continues without catch-up.

## 8. Testing

- **Vitest** for `sim/`: seed validity; tick invariants (no negative stock, FOUPs only on valid route positions, values in range); scenario effects (e.g. tool down → OEE drops within N ticks).
- **Playwright** smoke test: load → drill to Fab L2 → click tool → panel opens → run scenario.
- Manual frame-rate check.

## 9. Out of scope

- Backend, real data feeds, authentication.
- Mobile layout (target: desktop / projector).
- Imported CAD / BIM models.
- VR / AR.

## 10. Success criteria

- A full pitch walkthrough runs in under 3 minutes: site → fab → tool-down scenario → warehouse low stock → office KPI board.
- Smooth interaction. Panels open in under 200 ms.
