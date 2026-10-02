import { CATEGORIES, REORDER_FRACTION, type Category, type Rack } from './model'

export interface CategoryStock {
  category: Category
  stock: number
  capacity: number
  reorder: number
  low: boolean
}

export function inventoryByCategory(racks: Rack[]): CategoryStock[] {
  return CATEGORIES.map(category => {
    const rs = racks.filter(r => r.category === category)
    const stock = rs.reduce((a, r) => a + r.stock, 0)
    const capacity = rs.reduce((a, r) => a + r.capacity, 0)
    const reorder = capacity * REORDER_FRACTION
    return { category, stock, capacity, reorder, low: stock < reorder }
  })
}
