# Fab Digital Twin Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/superpowers/specs/2026-10-02-fab-digital-twin-design.md`.

**Goal:** Build the browser-only 3D digital twin of the 100-acre, 3-storey fab campus described in the spec.

**Architecture:** Pure-TS simulation (`src/sim`) + shared pure-TS geometry (`src/layout`) → Zustand store with 1 s sim loop and history rings (`src/store`) → react-three-fiber scene (`src/scene`) and Tailwind panels (`src/ui`) that only read the store and write view state.

**Tech Stack:** Vite, React 19, TypeScript, three, @react-three/fiber, @react-three/drei, zustand, recharts, Tailwind v4, Vitest, Playwright.

---

## File map

| Path | Responsibility |
|---|---|
| `src/layout/polyline.ts` | Polyline length + point-at-distance (FOUP track, AGV routes) |
| `src/layout/site.ts` | Block footprints, floor heights, floor bases |
| `src/layout/fab.ts` | Tool slots, AMHS track, env cell grid |
| `src/layout/warehouse.ts` | Rack slots, dock doors, AGV routes |
| `src/layout/office.ts` | Zone quads, desk grid, board-room screen |
| `src/sim/model.ts` | All sim types + constants |
| `src/sim/rng.ts` | Seeded PRNG (mulberry32) |
| `src/sim/seed.ts` | `createInitialState(rng)` |
| `src/sim/scenarios.ts` | Scenario defs, `activeFx`, `startScenario`, `normalDay` |
| `src/sim/tick.ts` | `advance(state, dt, rng)` |
| `src/sim/alarms.ts` | `deriveAlarms(state)` |
| `src/sim/inventory.ts` | `inventoryByCategory(racks)` |
| `src/store/history.ts` | `Ring`, `History` |
| `src/store/store.ts` | Zustand store, view state, actions, sim loop hook |
| `src/scene/*` | Canvas, site, buildings, interiors, overlays, camera rig, selection marker |
| `src/ui/*` | Top bar, KPI chips, breadcrumb, floor switcher, overlay toggle, legend, scenario menu, detail panels, fallback |
| `e2e/smoke.spec.ts` | Playwright smoke test |

## Tasks

### Task 1: Scaffold
- [ ] `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`
- [ ] Install deps; `npm run build` passes on an empty App. Commit.

### Task 2: Layout geometry (TDD)
- [ ] Tests `src/layout/layout.test.ts`: polyline length/at(); 200 unique tool slots inside fab footprint; track never enters a tool footprint; 40 racks/floor inside warehouse; floorBase(fab,3) = 14.
- [ ] Implement `polyline.ts`, `site.ts`, `fab.ts`, `warehouse.ts`, `office.ts`. Tests pass. Commit.

### Task 3: Sim model, seed, scenarios, tick, alarms (TDD)
- [ ] Tests `src/sim/sim.test.ts`:
  - seed: 200 tools with IDs `<TYPE>-<NN>` incl. `ETCH-03`; 1,200 lots; 150 FOUPs; 120 racks; 8 AGVs; 12 office zones; 96 env cells.
  - invariants over 600 ticks: stock in [0, capacity]; battery in [0,100]; FOUP s in [0, track length); yield/OEE in [0,100]; lots count constant.
  - toolDown: ETCH-03 down while active, fab OEE lower than baseline run within 30 ticks, ETCH-03 queue grows, alarm present; recovers after duration.
  - particleSpike: a cell > 100 % within 30 ticks + alarm.
  - lowStock: Chemicals below reorder within 40 ticks + warning.
  - hvacPeak: office kW rises.
  - two scenarios run at once; `normalDay` clears scenarios and keeps `t`.
- [ ] Implement `model.ts`, `rng.ts`, `seed.ts`, `scenarios.ts`, `tick.ts`, `alarms.ts`, `inventory.ts`. Tests pass. Commit.

### Task 4: Store + history (TDD)
- [ ] Tests `src/store/store.test.ts`: Ring order/wrap; `tick()` appends history; drill actions set level/block/floor and default overlay; `select` sets selection; `goSite` clears.
- [ ] Implement. Tests pass. Commit.

### Task 5: Scene shell
- [ ] `Scene.tsx` (Canvas, lights, OrbitControls), `Site.tsx` (ground, roads, parking, utility yard, trees, bridges at +6 m), `Building.tsx` (solid / stack / cutaway / ghost modes), `CameraRig.tsx` + `cameraGoals.ts`.
- [ ] Manual check in browser: site view renders; click block → block view; floor → cutaway. Commit.

### Task 6: Interiors + overlays
- [ ] `FabL2.tsx` (instanced tools, AMHS track line, FOUPs interpolated), `FabUtility.tsx` (L1/L3 equipment), `Heatmap.tsx` (fab env cells, office zones), `Warehouse.tsx` (racks colored by stock, docks, AGVs), `Office.tsx` (zones, desks, meeting rooms, KPI board screen), `SelectionMarker.tsx`, `positions.ts`.
- [ ] Manual check: click tool/FOUP/rack/AGV/zone/board → selection marker + camera move. Commit.

### Task 7: UI panels
- [ ] `TopBar`, `KpiChips`, `Breadcrumb`, `FloorSwitcher`, `OverlayToggle`, `Legend`, `ScenarioMenu`, `DetailPanel` + per-selection panels, `TrendChart`, `AlarmList`, `Fallback`.
- [ ] Manual check: every selection kind shows its panel; scenario menu starts/stops; chips change per level. Commit.

### Task 8: E2E + verification
- [ ] `playwright.config.ts`, `e2e/smoke.spec.ts`: load → `window.__store` drill to Fab L2 → select ETCH-03 → panel shows "ETCH-03" → click "Tool down" scenario → panel shows "Down".
- [ ] `npm test`, `npm run build`, `npm run test:e2e` all pass. Screenshot each level and review. Commit.
