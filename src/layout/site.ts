export type BlockId = 'office' | 'fab' | 'warehouse'

export interface BlockDef {
  id: BlockId
  name: string
  /** World-space center on the ground plane (x, z), metres. */
  center: [number, number]
  /** Footprint (x width, z depth), metres. */
  size: [number, number]
  floorHeights: number[]
  floorNames: string[]
}

/** Campus is ~640 m × 640 m ≈ 100 acres. 1 scene unit = 1 m. */
export const SITE_SIZE = 640

export const BLOCKS: Record<BlockId, BlockDef> = {
  office: {
    id: 'office',
    name: 'Office',
    center: [-230, 0],
    size: [80, 80],
    floorHeights: [6, 6, 6],
    floorNames: ['Lobby & desks', 'Desks & meetings', 'Exec & board room'],
  },
  fab: {
    id: 'fab',
    name: 'Fab',
    center: [0, 0],
    size: [300, 200],
    floorHeights: [6, 8, 6],
    floorNames: ['Sub-fab utilities', 'Cleanroom', 'Fan deck / HVAC'],
  },
  warehouse: {
    id: 'warehouse',
    name: 'Warehouse',
    center: [250, 0],
    size: [120, 150],
    floorHeights: [6, 6, 6],
    floorNames: ['Receiving & AGV', 'Storage', 'Storage'],
  },
}

export const BLOCK_IDS: BlockId[] = ['office', 'fab', 'warehouse']

/** Height of the floor slab top for 1-based `floor`. */
export function floorBase(block: BlockId, floor: number): number {
  return BLOCKS[block].floorHeights.slice(0, floor - 1).reduce((a, b) => a + b, 0)
}

export function blockHeight(block: BlockId): number {
  return BLOCKS[block].floorHeights.reduce((a, b) => a + b, 0)
}

/** Bridges link blocks on L2 (+6 m on every block). */
export const BRIDGE_Y = 6

/** Convert block-local (x, z) to world (x, z). */
export function toWorld(block: BlockId, [x, z]: [number, number]): [number, number] {
  const [cx, cz] = BLOCKS[block].center
  return [cx + x, cz + z]
}
