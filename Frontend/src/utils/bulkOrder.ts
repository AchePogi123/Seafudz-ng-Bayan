export interface OrderItemLike {
  name?: string
  item?: { name?: string }
  product_name_snapshot?: string
  quantity?: number
}

/**
 * Checks if an order or cart qualifies as a Bulk Order based on product item quantities:
 * - Trays, Bowls, Tubs, 1.5L Bottles, Pitchers: >= 5
 * - Siomai items (Pork, Beef, Chicken, Sharksfin, Japanese): >= 30
 * - All other menu items (Alacarte, Meals, Add-ons, Drinks, Desserts): >= 10
 */
export function checkIfBulkOrder(items?: any): boolean {
  return false
}
