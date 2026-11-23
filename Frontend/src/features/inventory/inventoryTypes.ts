export type InventoryItemType = 'FOOD' | 'PACKAGING'

export type FoodCategory =
  | 'Seafoods'
  | 'Meat & Poultry'
  | 'Vegetables & Produce'
  | 'Seasonings & Sauces'
  | 'Dairy & Fats'
  | 'Grains & Noodles'
  | 'Beverages & Bar'
  | 'Other Food'

export type PackagingCategory =
  | 'Trays, Bowls & Containers'
  | 'Cups, Lids & Straws'
  | 'Bags, Pouches & Carriers'
  | 'Cutlery, Napkins & Packets'
  | 'Boxes & Bilao Packaging'
  | 'Labels & Sealing Stickers'
  | 'Packaging & Disposables'

export type IngredientCategory = FoodCategory | PackagingCategory

export const FOOD_CATEGORIES: FoodCategory[] = [
  'Seafoods',
  'Meat & Poultry',
  'Vegetables & Produce',
  'Seasonings & Sauces',
  'Dairy & Fats',
  'Grains & Noodles',
  'Beverages & Bar',
  'Other Food',
]

export const PACKAGING_CATEGORIES: PackagingCategory[] = [
  'Trays, Bowls & Containers',
  'Cups, Lids & Straws',
  'Bags, Pouches & Carriers',
  'Cutlery, Napkins & Packets',
  'Boxes & Bilao Packaging',
  'Labels & Sealing Stickers',
  'Packaging & Disposables',
]

export const ALL_CATEGORIES: IngredientCategory[] = [
  ...FOOD_CATEGORIES,
  ...PACKAGING_CATEGORIES,
]

export type MeasurementUnit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'L'
  | 'pcs'
  | 'pack'
  | 'box'
  | 'roll'
  | 'bundle'
  | 'sachet'
  | 'tray'
  | 'bottle'
  | 'can'

export const MEASUREMENT_UNITS: MeasurementUnit[] = [
  'pcs',
  'pack',
  'box',
  'roll',
  'bundle',
  'sachet',
  'tray',
  'g',
  'kg',
  'ml',
  'L',
  'bottle',
  'can',
]

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface Ingredient {
  id: string
  name: string
  sku?: string
  itemType: InventoryItemType // 'FOOD' vs 'PACKAGING'
  category: IngredientCategory
  baseUnit: MeasurementUnit
  currentStock: number
  minStockLevel: number
  preferredRestockQty: number
  supplierId?: string
  supplierName?: string
  storageNotes?: string
  status: StockStatus
  lastRestockedAt?: string
  updatedAt: string
}

export interface RecipeIngredient {
  ingredientId: string
  ingredientName: string
  portionQuantity: number
  unit: MeasurementUnit
}

export type FulfillmentType = 'DINE_IN' | 'TAKEOUT' | 'DELIVERY' | 'ALL'

/**
 * The order types a packaging line can apply to, in the words the admin screens use.
 *
 * Shared by the Recipes (BOM) tab and the Add-dish form so a box labelled "Takeout & pickup" in
 * one place cannot read as something else in the other.
 */
export const FULFILLMENT_OPTIONS: { label: string; value: FulfillmentType }[] = [
  { label: 'Takeout & pickup', value: 'TAKEOUT' },
  { label: 'Delivery', value: 'DELIVERY' },
  { label: 'Takeout, delivery & pickup', value: 'ALL' },
  { label: 'Dine-in (special)', value: 'DINE_IN' },
]

export const fulfillmentLabel = (value: FulfillmentType): string =>
  FULFILLMENT_OPTIONS.find((f) => f.value === value)?.label ?? value
export type PackagingScope = 'PER_ITEM' | 'SHARED_ORDER'

export interface PackagingRequirement {
  id: string
  packagingId: string // references Ingredient.id where itemType === 'PACKAGING'
  packagingName: string
  category: PackagingCategory
  quantity: number
  unit: MeasurementUnit
  fulfillmentType: FulfillmentType // 'DINE_IN', 'TAKEOUT', 'DELIVERY', 'ALL'
  scope: PackagingScope // 'PER_ITEM' vs 'SHARED_ORDER'
  sharedCapacity?: number // e.g. 1 bag holds up to 3 items
  notes?: string
}

/**
 * A dish's bill of materials: what it is made of and how much of each, per serving.
 *
 * Deliberately carries no costing. The stockroom tracks quantities, not money — there is no
 * purchasing spend, no per-unit prices maintained and no margin analysis — so recipe food cost,
 * packaging cost and gross margin were dropped (migration 042) rather than shown as figures
 * derived from an unmaintained number. `productPrice` is the dish's SELLING price, which the menu
 * and the POS do need; it is not a cost.
 */
export interface ProductRecipe {
  productId: string
  productName: string
  productCategory: string
  productPrice: number
  productImage?: string
  yieldServings: number
  ingredients: RecipeIngredient[] // Food ingredients
  packagingRequirements: PackagingRequirement[] // Packaging materials per fulfillment channel
  preparationInstructions?: string
  isConfigured: boolean
  updatedAt: string
}

export interface Supplier {
  id: string
  name: string
  contactPerson: string
  contactNumber: string
  email: string
  address: string
  categoriesSupplied: IngredientCategory[]
  /** Hours from order to delivery — hours, so same-day vendors are representable. */
  leadTimeHours: number
  notes?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
}

export type PurchaseOrderStatus =
  | 'PENDING'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CANCELLED'

export interface PurchaseOrderItem {
  id: string
  ingredientId: string
  ingredientName: string
  itemType: InventoryItemType
  category: IngredientCategory
  orderedQuantity: number
  receivedQuantity: number
  /** Always the item's own base unit: stock is held in that unit, so lines are stored in it too. */
  unit: MeasurementUnit
  batchNumber?: string
  expirationDate?: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  supplierName: string
  orderDate: string
  expectedDeliveryDate: string
  status: PurchaseOrderStatus
  items: PurchaseOrderItem[]
  notes?: string
  receivedAt?: string
  receivedBy?: string
  createdAt: string
}

export type TransactionType =
  | 'STOCK_RECEIVED'
  | 'CONSUMPTION'
  | 'WASTE'
  | 'ADJUSTMENT'
  | 'ORDER_RETURN' // stock given back when an order is cancelled

export interface StockTransaction {
  id: string
  referenceNo: string
  timestamp: string
  ingredientId: string
  ingredientName: string
  itemType: InventoryItemType
  category: IngredientCategory
  type: TransactionType
  quantityDelta: number // positive for additions, negative for deductions
  unit: MeasurementUnit
  stockAfter: number
  performedBy: string
  reason?: string
  orderId?: string
  poNumber?: string
}

export interface InventoryKPISummary {
  totalIngredients: number
  totalFoodItems: number
  totalPackagingItems: number
  availableStockCount: number
  lowStockCount: number
  lowStockFoodCount: number
  lowStockPackagingCount: number
  outOfStockCount: number
  pendingPurchasesCount: number
}
