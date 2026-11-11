import { API_BASE_URL, getAuthHeaders } from '../../utils/api'
import type {
  Ingredient,
  ProductRecipe,
  Supplier,
  PurchaseOrder,
  StockTransaction,
  MeasurementUnit,
  TransactionType,
} from './inventoryTypes'

export interface InventoryState {
  ingredients: Ingredient[]
  suppliers: Supplier[]
  recipes: ProductRecipe[]
  transactions: StockTransaction[]
  purchaseOrders: PurchaseOrder[]
}

export class InventoryApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'InventoryApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/inventory${path}`, {
      method,
      headers: await getAuthHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new InventoryApiError('Could not reach the server. Check your connection and try again.', 0)
  }
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    throw new InventoryApiError(json.message || `Request failed (${res.status}).`, res.status, json.error)
  }
  return json.data as T
}

export const inventoryApi = {
  getState: () => request<InventoryState>('GET', '/state'),

  createIngredient: (item: Omit<Ingredient, 'id' | 'updatedAt' | 'status'>) =>
    request<{ ingredient: Ingredient; transaction: StockTransaction | null }>('POST', '/ingredients', item),
  updateIngredient: (item: Ingredient) =>
    request<{ ingredient: Ingredient; transaction: StockTransaction | null }>('PUT', `/ingredients/${encodeURIComponent(item.id)}`, item),
  deleteIngredient: (id: string) => request<void>('DELETE', `/ingredients/${encodeURIComponent(id)}`),

  recordMovement: (m: {
    ingredientId: string
    delta: number
    type?: TransactionType
    reason?: string
    seller?: string
    purchaseDate?: string
  }) => request<{ ingredient: Ingredient; transaction: StockTransaction }>('POST', '/movements', m),

  createSupplier: (s: Omit<Supplier, 'id' | 'createdAt'>) => request<Supplier>('POST', '/suppliers', s),
  updateSupplier: (s: Supplier) => request<Supplier>('PUT', `/suppliers/${encodeURIComponent(s.id)}`, s),
  deleteSupplier: (id: string) => request<void>('DELETE', `/suppliers/${encodeURIComponent(id)}`),

  saveRecipe: (r: ProductRecipe) => request<ProductRecipe>('PUT', `/recipes/${encodeURIComponent(r.productId)}`, r),
  deleteRecipe: (productId: string) => request<void>('DELETE', `/recipes/${encodeURIComponent(productId)}`),

  createPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'createdAt'>) => request<PurchaseOrder>('POST', '/purchase-orders', po),
  receivePurchaseOrder: (
    poId: string,
    payload: {
      items: {
        itemId: string
        ingredientId: string
        receivedQty: number
        unit: MeasurementUnit
        batchNumber?: string
        expirationDate?: string
      }[]
      notes?: string
    }
  ) =>
    request<{ purchaseOrder: PurchaseOrder; ingredients: Ingredient[]; transactions: StockTransaction[] }>(
      'POST',
      `/purchase-orders/${encodeURIComponent(poId)}/receive`,
      payload
    ),
  cancelPurchaseOrder: (poId: string) => request<PurchaseOrder>('POST', `/purchase-orders/${encodeURIComponent(poId)}/cancel`),

  replaceAll: (snapshot: { ingredients: Ingredient[]; recipes: ProductRecipe[]; suppliers: Supplier[] }) =>
    request<InventoryState>('POST', '/replace-all', snapshot),
}
