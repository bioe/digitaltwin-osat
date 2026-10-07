import type { ProcId } from '../data/processes'

/** Realistic alarm texts per process (code, text, soft = remote reset allowed). */
export const ALARMS: Record<ProcId | 'cureOven' | 'plasmaCleaner' | 'uvCurer' | 'trimForm' | 'packStation' | 'stretchWrapper', [string, string, boolean][]> = {
  sort: [
    ['P-1203', 'Probe card contact resistance high', false],
    ['P-1410', 'Chuck vacuum error', true],
    ['T-2207', 'Tester DPS over-current', false],
    ['P-1655', 'Needle mark offset out of spec', false],
    ['P-1102', 'Wafer alignment fail', true],
  ],
  grind: [
    ['G-0310', 'Z1 wheel load current high', false],
    ['G-0522', 'In-line thickness gauge deviation', true],
    ['G-0118', 'Chuck table vacuum low', true],
    ['G-0740', 'Grinding wheel wear limit', false],
  ],
  saw: [
    ['D-3001', 'Blade breakage detected (BBD)', false],
    ['D-3120', 'Kerf check out of spec', true],
    ['D-3402', 'Spindle air pressure low', false],
    ['D-3215', 'Cutting water flow low', true],
  ],
  da: [
    ['A-5104', 'Die pick-up fail (ejector)', true],
    ['A-5230', 'Epoxy volume out of spec', false],
    ['A-5311', 'Bond placement offset', true],
    ['A-5017', 'Wafer map read error', true],
  ],
  wb: [
    ['W-6001', 'NSOP – non-stick on pad', true],
    ['W-6005', 'Short tail detected', true],
    ['W-6110', 'EFO open – no free air ball', false],
    ['W-6230', 'Capillary life end', false],
    ['W-6302', 'Cu wire spool empty', false],
  ],
  mold: [
    ['M-7012', 'Mold chase temperature deviation', false],
    ['M-7105', 'Transfer pressure low', false],
    ['M-7220', 'Strip jam at loader', true],
    ['M-7331', 'Cull removal fail (degate)', true],
  ],
  mark: [
    ['L-8010', 'Laser power below limit', false],
    ['L-8122', 'Mark OCV/OCR fail', true],
    ['L-8204', 'Fume extractor flow low', false],
  ],
  pkgsaw: [
    ['S-9011', 'Blade wear limit reached', false],
    ['S-9130', 'Sorter pick-up miss', true],
    ['S-9244', 'Vision reject rate high', true],
    ['S-9302', 'Chuck vacuum leak', false],
  ],
  test: [
    ['F-4105', 'Socket contact yield drop', false],
    ['F-4210', 'Handler jam at test site', true],
    ['F-4033', 'Tester calibration expired', false],
    ['F-4318', 'Bin 5 (open/short) limit exceeded', true],
  ],
  fvi: [
    ['V-2101', 'Coplanarity reject rate high', true],
    ['V-2230', 'Camera illumination fault', false],
    ['V-2312', 'Turret nozzle vacuum error', true],
  ],
  tnr: [
    ['R-1501', 'Cover tape seal fail', false],
    ['R-1514', 'Empty pocket detected', true],
    ['R-1620', 'Reel full – change reel', true],
    ['R-1702', 'Carrier tape splice detected', true],
  ],
  cureOven: [
    ['O-0901', 'Oven over-temperature', false],
    ['O-0915', 'N₂ flow low', true],
  ],
  plasmaCleaner: [
    ['C-0410', 'RF reflected power high', false],
    ['C-0422', 'Chamber pressure out of range', true],
  ],
  uvCurer: [['U-0110', 'UV lamp intensity low', false]],
  trimForm: [
    ['T-0205', 'Punch die jam', true],
    ['T-0311', 'Lead coplanarity fail', false],
  ],
  packStation: [
    ['K-0102', 'Carton erector jam', true],
    ['K-0215', 'Case sealer tape out', true],
    ['K-0330', 'Box label verify fail', true],
    ['K-0410', 'Carton magazine empty', false],
  ],
  stretchWrapper: [
    ['W-0105', 'Film break detected', true],
    ['W-0220', 'Turntable drive overload', false],
    ['W-0312', 'Pallet height sensor blocked', true],
  ],
}
