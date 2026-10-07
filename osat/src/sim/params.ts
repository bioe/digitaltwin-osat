/** Live process parameters shown in the tool detail panel: [label, nominal, tolerance, unit, decimals]. */
export type ParamSpec = [string, number, number, string, number]

export const PARAMS: Record<string, ParamSpec[]> = {
  proberCell: [
    ['Chuck temperature', 25, 0.5, '°C', 1],
    ['Overdrive', 60, 2, 'µm', 0],
    ['Contact resistance', 0.42, 0.08, 'Ω', 2],
    ['Sites active', 16, 0, '', 0],
  ],
  backGrinder: [
    ['Z1 spindle speed', 4800, 40, 'rpm', 0],
    ['Target thickness', 200, 1.5, 'µm', 1],
    ['Wheel load current', 6.8, 0.6, 'A', 1],
    ['Chuck vacuum', -88, 2, 'kPa', 0],
  ],
  dicingSaw: [
    ['Spindle Z1 speed', 30000, 150, 'rpm', 0],
    ['Feed speed', 50, 0.5, 'mm/s', 1],
    ['Kerf width', 32, 1.5, 'µm', 1],
    ['Cutting water', 1.5, 0.08, 'L/min', 2],
  ],
  dieBonder: [
    ['Bond force', 0.8, 0.05, 'N', 2],
    ['Epoxy dot volume', 18, 1, 'nL', 1],
    ['Placement offset X', 0, 8, 'µm', 1],
    ['Ejector height', 350, 10, 'µm', 0],
  ],
  wireBonder: [
    ['USG power', 95, 4, 'mA', 0],
    ['Bond force', 22, 1.5, 'gf', 1],
    ['Heat block', 200, 2, '°C', 1],
    ['FAB diameter', 38, 0.8, 'µm', 1],
  ],
  moldPress: [
    ['Mold temperature', 175, 1.2, '°C', 1],
    ['Transfer pressure', 7.2, 0.3, 'MPa', 2],
    ['Cure time', 90, 1, 's', 0],
    ['Clamp force', 600, 8, 'kN', 0],
  ],
  laserMarker: [
    ['Laser power', 12, 0.4, 'W', 1],
    ['Mark depth', 25, 2, 'µm', 1],
    ['OCV score', 98, 1, '%', 1],
  ],
  packageSaw: [
    ['Spindle speed', 25000, 150, 'rpm', 0],
    ['Feed speed', 80, 1, 'mm/s', 0],
    ['Burr height', 18, 4, 'µm', 0],
    ['Sorter UPH', 8600, 300, '', 0],
  ],
  testCell: [
    ['Test time', 0.62, 0.04, 's', 2],
    ['Site-to-site Δ yield', 0.3, 0.2, '%', 2],
    ['Socket temperature', 25, 0.6, '°C', 1],
    ['First-pass yield', 98.8, 0.4, '%', 1],
  ],
  visionInspection: [
    ['Coplanarity', 38, 6, 'µm', 0],
    ['Package offset', 22, 5, 'µm', 0],
    ['Reject rate', 0.18, 0.08, '%', 2],
  ],
  tapeReel: [
    ['Seal temperature', 165, 3, '°C', 0],
    ['Peel force', 45, 6, 'gf', 0],
    ['Index pitch', 8, 0.02, 'mm', 2],
    ['Units on reel', 2500, 2500, '', 0],
  ],
  cureOven: [
    ['Chamber temperature', 175, 1.5, '°C', 1],
    ['N₂ flow', 60, 3, 'L/min', 0],
    ['O₂ level', 40, 10, 'ppm', 0],
  ],
  plasmaCleaner: [
    ['RF power', 300, 8, 'W', 0],
    ['Chamber pressure', 180, 10, 'mTorr', 0],
    ['Ar flow', 20, 1, 'sccm', 1],
  ],
  uvCurer: [
    ['UV intensity', 230, 12, 'mW/cm²', 0],
    ['Dose', 450, 20, 'mJ/cm²', 0],
  ],
  trimForm: [
    ['Press force', 30, 1.5, 'kN', 1],
    ['Lead coplanarity', 45, 8, 'µm', 0],
  ],
  packStation: [
    ['Cartons / min', 12, 1.5, '', 1],
    ['Seal tape tension', 18, 2, 'N', 1],
    ['Box weight', 4.6, 0.3, 'kg', 2],
  ],
  stretchWrapper: [
    ['Turntable speed', 12, 1, 'rpm', 1],
    ['Film pre-stretch', 250, 15, '%', 0],
    ['Wrap force', 35, 4, 'N', 0],
  ],
}

export const RECIPES: Record<string, string[]> = {
  packStation: ['PK_REEL13_BOX6_V2', 'PK_REEL7_BOX12_V1'],
  stretchWrapper: ['WR_PALLET_3TOP_2BOT', 'WR_PALLET_EXPORT_V3'],
  proberCell: ['MCU-A7_SORT_V12', 'PMIC-Q5_SORT_V08'],
  backGrinder: ['BG_775-200UM_P2', 'BG_775-150UM_P3'],
  dicingSaw: ['DC_3x3_CU-LK_V5', 'DC_2.6x2.6_V3'],
  dieBonder: ['DA_QFN55_EPX8200', 'DA_QFN44_EPX8200'],
  wireBonder: ['WB_QFN32_CU08_R7', 'WB_QFN24_CU08_R4'],
  moldPress: ['MD_QFN55_MAP_G770', 'MD_QFN44_MAP_G770'],
  laserMarker: ['MK_QFN55_LOGO_V2'],
  packageSaw: ['PS_QFN55_0.3ST', 'PS_QFN44_0.3ST'],
  testCell: ['FT_MCU-A7_HOT_V21', 'FT_PMIC-Q5_RT_V14'],
  visionInspection: ['VI_QFN55_3D_V6'],
  tapeReel: ['TR_QFN55_12MM_P8', 'TR_QFN44_12MM_P8'],
}

export const PRODUCTS = ['MCU-A7 QFN32 5×5', 'PMIC-Q5 QFN32 5×5', 'BLE-N3 QFN32 5×5']
