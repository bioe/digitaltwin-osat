# OSAT-7 Line A — capacity sizing

Basis for the tool counts in `src/data/processes.ts`.

## Assumptions

| Item | Value |
|---|---|
| Product | QFN 5×5 mm, 32 leads, Cu wire, MAP-molded, saw-singulated |
| Wafer | 300 mm, die 3.0 × 3.0 mm → ~7,400 gross die, ~7,000 good after sort |
| Demand | 1.2 M units/day (≈ 36 M/month) ≈ 175 wafers/day |
| Effective hours | 22 h/day (3 shifts, minus breaks/handover) |
| Planned OEE | 85 % → 18.7 productive h/day |
| Lot / carrier | 25-wafer FOUP → frame cassette → strip magazine (20 strips × 576 units) → JEDEC tray → 13" reel |

Formula: **tools = demand ÷ (UPH × 22 h × 0.85)**, rounded up, with N+1 where a single tool would be a single point of failure.

## Result

| # | Process | Equipment class (typical) | UPH / tool | Required | Installed | Footprint W×D×H (m) |
|---|---|---|---:|---:|---:|---|
| 1 | Wafer Sort | 300 mm prober + docked tester (TEL Precio / Accretech UF3000 + V93000 class) | 4,900 | 13.1 | **14** | 3.0 × 2.3 × 1.9 per cell |
| 2 | Back Grind | Grinder/polisher + inline mounter (DGP8761 + DFM2800 class) | 100,000 | 0.6 | **2** | 4.6 × 2.6 × 1.9 |
| 3 | Wafer Saw | Dual-spindle dicing saw (DFD6362 class) + 2 UV curers | 21,000 | 3.1 | **4** | 1.2 × 1.5 × 1.8 |
| 4 | Die Attach | Epoxy die bonder (ASMPT AD838 / Besi class) + 2 snap-cure ovens | 12,000 | 5.3 | **6** | 1.8 × 1.5 × 1.85 |
| 5 | Wire Bond | Cu ball bonder (K&S RAPID / ASMPT AERO class) + 2 plasma cleaners | 2,050 | 31.3 | **32** | 1.9 × 1.0 × 1.75 (with handlers) |
| 6 | Molding | Auto transfer mold, 2 presses (TOWA YPM / IDEALmold class) + 2 PMC ovens | 92,000 | 0.7 | **2** | 4.4 × 1.8 × 2.1 |
| 7 | Marking | Strip laser marker | 24,000 | 2.7 | **3** | 1.7 × 1.3 × 1.9 |
| 8 | Package Saw / T&F | Saw + sorter (DFD6760 / Hanmi class) + 2 trim & form for leaded SKUs | 8,600 | 7.5 | **8** | 2.8 × 1.7 × 1.9 |
| 9 | Final Test | 8-site pick-and-place handler + tester (J750 / V93000 class) | 7,500 | 8.6 | **9** | 3.2 × 2.2 × 1.95 per cell |
| 10 | Final Inspection | 2D/3D vision turret | 22,000 | 2.9 | **3** | 2.0 × 1.5 × 1.85 |
| 11 | Tape & Reel | Turret tape & reel | 22,000 | 2.9 | **3** | 1.9 × 1.3 × 1.8 |

Wire bond is the largest zone (32 tools): every unit needs 32 wires at ~20 wires/s including index time. That is why the industry rule of thumb is "wire bonders outnumber every other tool type".

## Material handling (mixed modes)

| Section | Mode | Why |
|---|---|---|
| Sort → Grind → Saw → Die Attach | **OHT** (10 vehicles, rail at 3.6 m) | Wafer-level carriers (FOUP, frame cassette) are heavy and fragile; OHT gives clean, ceiling-level transport, as in a front-end fab. |
| Wire Bond → Molding → Marking | **Overhead conveyor** (rail at 2.7 m, drop lifts per tool) | High-frequency, light magazines; a continuous conveyor is cheaper per move than vehicles. |
| Package Saw → Test → Inspection → T&R → FG | **ARV** (8 AMRs with lift + roller transfer) | Many small tray/reel moves over short distances; flexible routing as product mix changes. |

Stockers S0–S11 buffer WIP between every step. S4 and S7 are hand-off stockers between two transport modes.

## Material-handling optimisation

The fleets went from 22 OHT / 16 ARV to 16 / 12, and then to **10 OHT / 8 ARV**, with the same output (~62K UPH in the sim). Four dispatch rules make this possible:

| Rule | Effect |
|---|---|
| Direct tool-to-tool delivery | When the next process uses the same transport mode and a tool there has a free input port, the finished lot goes straight there. One move replaces two (tool → stocker → tool). About half of the OHT and ARV moves are now direct. |
| Nearest vehicle–job pairing | Free vehicles and waiting jobs are paired by the shortest empty run (rail distance for OHT, aisle distance for ARV), not first-come-first-served. |
| Urgency | Moves that feed an empty tool, or clear a full output port, get priority. |
| ARV opportunity charging | ARVs charge on contacts at every transfer port and take jobs down to 15 % battery, so they rarely drive back to the dock to charge. |

Measured over 30 sim minutes (average of 10 s samples):

| Fleet (OHT / ARV) | Dispatch | Output (UPH) | Tools waiting for material | Jobs waiting (OHT / ARV) |
|---|---|---|---|---|
| 16 / 12 | old | 59K | 8.1 | 4.7 / 4.8 |
| 16 / 12 | new | 62K | 4.4 | 0.1 / 0.0 |
| 11 / 9 | new | 62K | 6.2 | 2.1 / 0.8 |
| **10 / 8** | new | 62K | 8.7 | 2.4 / 4.3 |

At 10 / 8 the vehicles are busy 96–98 % of the time. Use 11 / 9 if you need spare capacity for peaks or breakdowns.

## Shipping

| Step | Equipment | Notes |
|---|---|---|
| FG feed | ARV (from the shared fleet) | One FG lot per move, S11 → packing-station infeed; 2 lots per pallet |
| Box packing | 1 packing station (carton erector, case sealer) | 12 cartons per pallet |
| Carton transfer | Belt conveyor + gantry picker | Belt to the pallet build position; the picker stacks 3 layers of 2 × 2 |
| Wrapping | 1 in-line rotary stretch-wrapper | Pallet rolls in on the pallet line, is wrapped, rolls out |
| Buffer | Accumulating roller conveyor, 4 pallets | Level 3, west end; the head pallet rolls into the lift car |
| Level 3 → ground | Exterior freight lift, 3 × 3 m car | One pallet per trip; the car stops at truck-bed height (1.25 m) |
| Dispatch | Rigid box truck, 6 pallets | Reverses to the lift; leaves when full, or after 30 s with no pallet ready |

## Floor

~157 × 31 m U-flow floor. Every process is its own walled cleanroom room (2.5 m glazed partitions, utility headers and drops on the long walls). Stocker bays sit between the rooms; the OHT (rail at 4.0 m) and the overhead conveyor (2.75 m) pass over the partitions from room to room through the bays, and ARVs drive through the bay openings. The central corridor holds the walkway, ARV docks, WIP racks and consumable cabinets. The war room sits on a 4.7 m mezzanine above the corridor centre, with a stair down to the walkway.
