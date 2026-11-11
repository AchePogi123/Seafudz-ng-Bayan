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
  costPerUnit: number
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
  estimatedCost: number
}

export type FulfillmentType = 'DINE_IN' | 'TAKEOUT' | 'DELIVERY' | 'ALL'
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
  estimatedCost: number
  notes?: string
}

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
  totalFoodCost: number
  totalPackagingCost: number
  totalRawCost: number // Food + Packaging
  grossMarginPercent: number
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
  leadTimeDays: number
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
  unit: MeasurementUnit
  unitCost: number
  totalCost: number
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
  totalAmount: number
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
  totalValuation: number
  foodValuation: number
  packagingValuation: number
}
