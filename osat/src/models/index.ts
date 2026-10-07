import type { ModelDef } from './dsl'
import { wireBonder } from './wireBonder'
import { proberCell } from './prober'
import { backGrinder } from './grinder'
import { dicingSaw, uvCurer } from './dicingSaw'
import { dieBonder } from './dieBonder'
import { cureOven, plasmaCleaner } from './ovens'
import { moldPress } from './moldPress'
import { laserMarker } from './laserMarker'
import { packageSaw, trimForm } from './packageSaw'
import { testCell } from './testCell'
import { visionInspection } from './inspection'
import { tapeReel } from './tapeReel'
import { stockerWafer, stockerMag } from './stockers'
import { ohtVehicle, arv } from './vehicles'
import { foup, frameCassette, magazine, trayStack, reelBox } from './carriers'
import { operator, officeWorker, seatedWorker } from './people'
import { consoleDesk, chair, conveyorLift } from './warroom'
import { workbench, wipRack, partsCabinet } from './props'
import { pottedFig, pottedMonstera, sofa, coffeeTable, rug, pendantLamp, highTable } from './interior'
import { carton, packStation, pallet, palletBase, stretchWrapper, truck } from './logistics'
import { rainTree, columnTree, palm, shrub, hedge, carWhite, carGrey, carBlue, streetLight } from './landscape'

export const MODELS: Record<string, ModelDef> = Object.fromEntries(
  [
    wireBonder, proberCell, backGrinder, dicingSaw, uvCurer, dieBonder, cureOven, plasmaCleaner,
    moldPress, laserMarker, packageSaw, trimForm, testCell, visionInspection, tapeReel,
    stockerWafer, stockerMag, ohtVehicle, arv, foup, frameCassette, magazine, trayStack, reelBox,
    operator, officeWorker, seatedWorker, consoleDesk, chair, conveyorLift,
    workbench, wipRack, partsCabinet,
    pottedFig, pottedMonstera, sofa, coffeeTable, rug, pendantLamp, highTable,
    truck, pallet, palletBase, carton, packStation, stretchWrapper,
    rainTree, columnTree, palm, shrub, hedge, carWhite, carGrey, carBlue, streetLight,
  ].map(m => [m.key, m]),
)
