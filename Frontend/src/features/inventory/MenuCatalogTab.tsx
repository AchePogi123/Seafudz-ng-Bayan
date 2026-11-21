/**
 * Menu — the dish catalog, as a tab of the inventory hub.
 *
 * Counts and stock health live on Overview, so this tab is only the catalog itself: find a dish,
 * change its price or availability, and keep every dish linked to stock through a recipe.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ProductImage } from '../../components/ProductImage'
import { CLIENT_CATEGORIES } from '../../components/MenuCard'
import type { MenuItem } from '../../components/MenuCard'
import { useMenuPrices } from '../../utils/menuPriceManager'
import { useProductImages, setCachedProductImage } from '../../utils/useProductImages'
import { useMenuAvailability } from '../../utils/menuAvailability'
import { API_BASE_URL, getAuthHeaders } from '../../utils/api'
import { notifyProductCatalogSync, subscribeProductCatalogSync } from '../../utils/orderSync'
import type { Ingredient, IngredientCategory, MeasurementUnit, ProductRecipe, RecipeIngredient } from './inventoryTypes'
import { SearchableSelect } from './SearchableSelect'
import { FOOD_CATEGORIES, MEASUREMENT_UNITS } from './inventoryTypes'
import InventoryConfirmModal from './InventoryConfirmModal'
import type { ToastMessage } from './InventoryToast'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FilterSelect,
  Icon,
  IconButton,
  Modal,
  Notice,
  Pagination,
  RowMenu,
  SearchInput,
  SectionHeader,
  Segmented,
  Toolbar,
  cx,
  fieldAria,
  formatPeso,
  formatQty,
} from './ui'

type ViewMode = 'table' | 'grid'
type StockFilter = 'all' | 'in_stock' | 'out_of_stock'
type PriceFilter = 'all' | 'custom' | 'standard'
type SortOption = 'default' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'

const PAGE_SIZE = 12
const VIEW_MODE_KEY = 'sfb_menu_view_mode'
const DISH_CATEGORIES = CLIENT_CATEGORIES.filter((category) => category !== 'All Menu')
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Compare "Shake & Lemonade" with "shake-lemonade" without tripping on punctuation. */
const normalizeCategoryKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

interface RecipeLineDraft {
  lineId: string
  ingredientId: string
  quantity: string
  unit: MeasurementUnit
}

let recipeLineSeq = 0
const createRecipeLine = (): RecipeLineDraft => ({
  lineId: `rl-${Date.now()}-${recipeLineSeq++}`,
  ingredientId: '',
  quantity: '',
  unit: 'g',
})

/**
 * Cost of one portion. Stock is costed in the item's own base unit, so a portion measured in a
 * sibling unit (g against kg, ml against L) is converted before it is priced.
 */
function portionCost(ingredient: Ingredient, quantity: number, unit: MeasurementUnit): number {
  const perUnit = Number(ingredient.costPerUnit) || 0
  let qtyInBaseUnit = quantity
  if (ingredient.baseUnit === 'kg' && unit === 'g') qtyInBaseUnit = quantity / 1000
  else if (ingredient.baseUnit === 'g' && unit === 'kg') qtyInBaseUnit = quantity * 1000
  else if (ingredient.baseUnit === 'L' && unit === 'ml') qtyInBaseUnit = quantity / 1000
  else if (ingredient.baseUnit === 'ml' && unit === 'L') qtyInBaseUnit = quantity * 1000
  return Math.round(perUnit * qtyInBaseUnit * 100) / 100
}

export interface MenuCatalogTabProps {
  /** Live stockroom catalog — a new dish picks its recipe lines from these items. */
  ingredients: Ingredient[]
  /** Recipes already configured, so the list can flag dishes that are not linked to stock. */
  recipes: ProductRecipe[]
  /** Saves the recipe for a dish; resolves false when the server rejected it. */
  onSaveRecipe: (recipe: ProductRecipe) => Promise<boolean> | boolean
  /** Registers a brand-new stockroom item without leaving the Add dish form. */
  onCreateIngredient: (
    item: Omit<Ingredient, 'id' | 'updatedAt' | 'status'>
  ) => Promise<Ingredient | null> | Ingredient | null
  /** Jumps to another inventory tab (Items, Recipes, …). */
  onNavigateTab: (tabId: string) => void
  /** Raises a toast in the inventory shell, so this tab speaks with the module's voice. */
  onNotify: (toast: Omit<ToastMessage, 'id'>) => void
  /** Tells the inventory shell the product catalog changed, so its state reloads. */
  onCatalogChanged?: () => void
}

export const MenuCatalogTab: React.FC<MenuCatalogTabProps> = ({
  ingredients,
  recipes,
  onSaveRecipe,
  onCreateIngredient,
  onNavigateTab,
  onNotify,
  onCatalogChanged,
}) => {
  const { getEffectivePrice, updatePrice, resetPrice } = useMenuPrices()
  const { menuItems, refresh: refreshProductImages } = useProductImages()
  const { isAvailable, setAvailability } = useMenuAvailability()

  /* ----------------------------------------------------------------- Browsing */

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'table'
    return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'table'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Menu')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('default')
  const [page, setPage] = useState(1)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
  const [inlinePriceInput, setInlinePriceInput] = useState('')

  /* -------------------------------------------------------------- Edit a dish */

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('Seafoods')
  const [editDescription, setEditDescription] = useState('')
  const [editBasePrice, setEditBasePrice] = useState<number | string>('')
  const [editPosPrice, setEditPosPrice] = useState<number | string>('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editErrors, setEditErrors] = useState<{ name?: string; basePrice?: string }>({})
  const [editError, setEditError] = useState('')
  const editPreviewRef = useRef<string | null>(null)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)

  /* --------------------------------------------------------------- Add a dish */

  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategory, setNewProductCategory] = useState('Seafoods')
  const [newProductDescription, setNewProductDescription] = useState('')
  const [newProductPrice, setNewProductPrice] = useState<number | string>('')
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [addErrors, setAddErrors] = useState<{ name?: string; price?: string }>({})
  const [productFormError, setProductFormError] = useState('')
  const [newProductImageFile, setNewProductImageFile] = useState<File | null>(null)
  const [newProductImagePreview, setNewProductImagePreview] = useState<string | null>(null)
  const [newProductImageError, setNewProductImageError] = useState('')
  const newProductImagePreviewRef = useRef<string | null>(null)
  const newProductFileInputRef = useRef<HTMLInputElement | null>(null)

  // Recipe (required): a new dish reaches stock only through its ingredient lines
  const [recipeLines, setRecipeLines] = useState<RecipeLineDraft[]>([createRecipeLine()])
  const [recipeError, setRecipeError] = useState('')

  // Register a missing ingredient without losing the half-filled dish form
  const [isQuickIngredientOpen, setIsQuickIngredientOpen] = useState(false)
  const [quickIngredientLineId, setQuickIngredientLineId] = useState<string | null>(null)
  const [quickName, setQuickName] = useState('')
  const [quickCategory, setQuickCategory] = useState<IngredientCategory>('Seafoods')
  const [quickUnit, setQuickUnit] = useState<MeasurementUnit>('g')
  const [quickStock, setQuickStock] = useState<number | string>('')
  const [quickMinStock, setQuickMinStock] = useState<number | string>('')
  const [quickCost, setQuickCost] = useState<number | string>('')
  const [quickErrors, setQuickErrors] = useState<{ name?: string; cost?: string }>({})
  const [quickError, setQuickError] = useState('')
  const [isSavingQuickIngredient, setIsSavingQuickIngredient] = useState(false)

  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  /* ------------------------------------------------------------------ Derived */

  // Only food items are portioned into a dish; packaging is configured on the Recipes tab.
  const foodIngredients = useMemo(
    () => ingredients.filter((item) => item.itemType === 'FOOD').sort((a, b) => a.name.localeCompare(b.name)),
    [ingredients]
  )
  const hasStockroomItems = foodIngredients.length > 0

  const configuredRecipeIds = useMemo(
    () => new Set(recipes.filter((r) => r.isConfigured).map((r) => r.productId)),
    [recipes]
  )

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Menu': menuItems.length }
    menuItems.forEach((item) => {
      const cat = item.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [menuItems])

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const selectedKey = normalizeCategoryKey(selectedCategory)

    const result = menuItems.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.category || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query)

      const matchesCategory =
        selectedCategory === 'All Menu' || normalizeCategoryKey(item.category || '') === selectedKey

      const available = isAvailable(item.id)
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in_stock' && available) ||
        (stockFilter === 'out_of_stock' && !available)

      const isCustom = getEffectivePrice(item.id, item.price) !== item.price
      const matchesPrice =
        priceFilter === 'all' || (priceFilter === 'custom' && isCustom) || (priceFilter === 'standard' && !isCustom)

      return matchesSearch && matchesCategory && matchesStock && matchesPrice
    })

    if (sortBy === 'name_asc') result.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'name_desc') result.sort((a, b) => b.name.localeCompare(a.name))
    else if (sortBy === 'price_asc') result.sort((a, b) => getEffectivePrice(a.id, a.price) - getEffectivePrice(b.id, b.price))
    else if (sortBy === 'price_desc') result.sort((a, b) => getEffectivePrice(b.id, b.price) - getEffectivePrice(a.id, a.price))

    return result
  }, [menuItems, searchQuery, selectedCategory, stockFilter, priceFilter, sortBy, isAvailable, getEffectivePrice])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const visibleIds = visibleProducts.map((item) => item.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedItemIds.has(id))

  const unlinkedCount = useMemo(
    () => menuItems.filter((item) => !configuredRecipeIds.has(item.id)).length,
    [menuItems, configuredRecipeIds]
  )

  const hasActiveFilters =
    Boolean(searchQuery) || selectedCategory !== 'All Menu' || stockFilter !== 'all' || priceFilter !== 'all'

  /* ------------------------------------------------------------------ Effects */

  useEffect(() => () => {
    if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
    if (newProductImagePreviewRef.current) URL.revokeObjectURL(newProductImagePreviewRef.current)
  }, [])

  useEffect(() => subscribeProductCatalogSync(() => void refreshProductImages()), [refreshProductImages])

  /* ----------------------------------------------------------------- Browsing */

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode)
    } catch {
      // storage may be full or disabled; the preference is a convenience only
    }
  }

  /** Any change to what is listed starts again from the first page. */
  const applyFilter = (change: () => void) => {
    change()
    setPage(1)
  }

  const resetFilters = () =>
    applyFilter(() => {
      setSearchQuery('')
      setSelectedCategory('All Menu')
      setStockFilter('all')
      setPriceFilter('all')
    })

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshProductImages()
      onNotify({ type: 'success', title: 'Catalog synced', description: 'The menu now matches the server.' })
    } catch {
      onNotify({ type: 'error', title: 'Could not sync the catalog', description: 'Check your connection and try again.' })
    } finally {
      setIsRefreshing(false)
    }
  }

  /* ---------------------------------------------------- Availability & pricing */

  const toggleSelectItem = (id: string) =>
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleSelectAll = () =>
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })

  const clearSelection = () => setSelectedItemIds(new Set())

  const handleBulkAvailability = async (available: boolean) => {
    const ids = Array.from(selectedItemIds)
    if (ids.length === 0) return
    for (const id of ids) await setAvailability(id, available)
    onNotify({
      type: 'success',
      title: `${ids.length} ${ids.length === 1 ? 'dish' : 'dishes'} ${available ? 'back on the menu' : 'marked out of stock'}`,
    })
    clearSelection()
  }

  const handleToggleStock = async (item: MenuItem) => {
    const next = !isAvailable(item.id)
    await setAvailability(item.id, next)
    onNotify({
      type: next ? 'success' : 'info',
      title: next ? `${item.name} is back on the menu` : `${item.name} is out of stock`,
      description: next ? undefined : 'Customers and the POS can no longer order it.',
    })
  }

  const startInlinePrice = (item: MenuItem) => {
    setInlineEditingId(item.id)
    setInlinePriceInput(String(getEffectivePrice(item.id, item.price)))
  }

  const handleSaveInlinePrice = (item: MenuItem) => {
    const value = Number(inlinePriceInput)
    if (!Number.isFinite(value) || value <= 0) {
      onNotify({ type: 'error', title: 'Enter a price above ₱0.00' })
      return
    }
    updatePrice(item.id, value)
    setInlineEditingId(null)
    onNotify({ type: 'success', title: `${item.name} now sells for ${formatPeso(value)}` })
  }

  const handleResetPrice = (item: MenuItem) => {
    resetPrice(item.id)
    setInlineEditingId(null)
    onNotify({ type: 'info', title: `${item.name} back to its catalog price`, description: formatPeso(item.price) })
  }

  /* --------------------------------------------------------------- Edit a dish */

  const handleOpenEditModal = (item: MenuItem) => {
    if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
    editPreviewRef.current = null
    setEditingItem(item)
    setEditName(item.name)
    setEditCategory(item.category || 'Seafoods')
    setEditDescription(item.description || '')
    setEditBasePrice(item.price)
    setEditPosPrice(getEffectivePrice(item.id, item.price))
    setEditImageFile(null)
    setEditImagePreview(null)
    setEditErrors({})
    setEditError('')
  }

  const handleCloseEditModal = () => {
    if (isSavingEdit) return
    if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
    editPreviewRef.current = null
    setEditingItem(null)
  }

  const handleSelectEditFile = (file: File | null) => {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      setEditError('That file is not a JPEG, PNG or WebP image.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setEditError('That photo is over 5 MB. Choose a smaller one.')
      return
    }
    if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
    const url = URL.createObjectURL(file)
    editPreviewRef.current = url
    setEditImagePreview(url)
    setEditImageFile(file)
    setEditError('')
  }

  const handleSaveEditProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingItem) return

    const name = editName.trim()
    const basePrice = Number(editBasePrice)
    const posPrice = Number(editPosPrice)

    const errors: { name?: string; basePrice?: string } = {}
    if (!name) errors.name = 'A dish needs a name.'
    if (!Number.isFinite(basePrice) || basePrice < 0) errors.basePrice = 'Enter ₱0.00 or more.'
    setEditErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSavingEdit(true)
    setEditError('')
    try {
      const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(editingItem.id)}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ name, category: editCategory, description: editDescription.trim(), price: basePrice }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || 'Could not save this dish.')
      }

      // A selling price that matches the catalog price is no override at all
      if (Number.isFinite(posPrice) && posPrice > 0) {
        if (posPrice !== basePrice) updatePrice(editingItem.id, posPrice)
        else resetPrice(editingItem.id)
      }

      let photoUploaded = false
      if (editImageFile) {
        try {
          const body = new FormData()
          body.append('image', editImageFile)
          const imgResponse = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(editingItem.id)}/image`, {
            method: 'POST',
            headers: await getAuthHeaders({}, { jsonContentType: false }),
            body,
          })
          const imgPayload = await imgResponse.json()
          if (imgResponse.ok && imgPayload?.data?.image) {
            setCachedProductImage(editingItem.id, imgPayload.data.image)
            photoUploaded = true
          }
        } catch (imgError) {
          console.error('Image upload failed during dish edit:', imgError)
        }
      }

      await refreshProductImages()
      notifyProductCatalogSync({ action: 'UPDATE', productId: editingItem.id, productName: name })
      onCatalogChanged?.()
      onNotify({
        type: 'success',
        title: `${name} saved`,
        description: photoUploaded ? 'Details and photo updated.' : 'Details updated.',
      })
      handleCloseEditModal()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Could not save this dish.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleRestoreDefaultPhoto = async () => {
    if (!editingItem || isSavingEdit) return
    setIsSavingEdit(true)
    try {
      await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(editingItem.id)}/image`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      })
      setCachedProductImage(editingItem.id, null)
      if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
      editPreviewRef.current = null
      setEditImagePreview(null)
      setEditImageFile(null)
      await refreshProductImages()
      onNotify({ type: 'success', title: 'Bundled photo restored' })
    } catch {
      setEditError('Could not restore the bundled photo.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  /* ---------------------------------------------------------------- Add a dish */

  const clearNewProductImage = () => {
    if (newProductImagePreviewRef.current) URL.revokeObjectURL(newProductImagePreviewRef.current)
    newProductImagePreviewRef.current = null
    setNewProductImagePreview(null)
    setNewProductImageFile(null)
    setNewProductImageError('')
    if (newProductFileInputRef.current) newProductFileInputRef.current.value = ''
  }

  const handleSelectNewProductFile = (file: File | null) => {
    setNewProductImageError('')
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      setNewProductImageError('Choose a JPEG, PNG or WebP image.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setNewProductImageError('That image is over 5 MB. Choose a smaller one.')
      return
    }
    if (newProductImagePreviewRef.current) URL.revokeObjectURL(newProductImagePreviewRef.current)
    const url = URL.createObjectURL(file)
    newProductImagePreviewRef.current = url
    setNewProductImagePreview(url)
    setNewProductImageFile(file)
  }

  function closeQuickIngredient() {
    setIsQuickIngredientOpen(false)
    setQuickIngredientLineId(null)
    setQuickErrors({})
    setQuickError('')
  }

  const resetAddProductForm = () => {
    setNewProductName('')
    setNewProductDescription('')
    setNewProductPrice('')
    setNewProductCategory(selectedCategory === 'All Menu' ? 'Seafoods' : selectedCategory)
    setAddErrors({})
    setProductFormError('')
    setRecipeLines([createRecipeLine()])
    setRecipeError('')
    closeQuickIngredient()
    clearNewProductImage()
  }

  const handleOpenAddProduct = () => {
    resetAddProductForm()
    setIsAddProductOpen(true)
  }

  const handleCloseAddProduct = () => {
    if (isSavingProduct) return
    resetAddProductForm()
    setIsAddProductOpen(false)
  }

  const updateRecipeLine = (lineId: string, patch: Partial<RecipeLineDraft>) => {
    setRecipeError('')
    setRecipeLines((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)))
  }

  const handlePickRecipeIngredient = (lineId: string, ingredientId: string) => {
    if (ingredientId === '__new__') {
      openQuickIngredient(lineId)
      return
    }
    const picked = foodIngredients.find((item) => item.id === ingredientId)
    // default the portion to the item's own unit so the cost estimate lines up with stock
    updateRecipeLine(lineId, { ingredientId, unit: picked ? picked.baseUnit : 'g' })
  }

  const addRecipeLine = () => {
    setRecipeError('')
    setRecipeLines((prev) => [...prev, createRecipeLine()])
  }

  const removeRecipeLine = (lineId: string) => {
    setRecipeError('')
    setRecipeLines((prev) => (prev.length <= 1 ? [createRecipeLine()] : prev.filter((line) => line.lineId !== lineId)))
  }

  const openQuickIngredient = (lineId: string | null) => {
    setQuickIngredientLineId(lineId)
    setQuickName('')
    setQuickCategory('Seafoods')
    setQuickUnit('g')
    setQuickStock('')
    setQuickMinStock('')
    setQuickCost('')
    setQuickErrors({})
    setQuickError('')
    setIsQuickIngredientOpen(true)
  }

  const handleCreateQuickIngredient = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = quickName.trim()
    const cost = Number(quickCost)

    const errors: { name?: string; cost?: string } = {}
    if (!name) errors.name = 'Give the ingredient a name.'
    else if (foodIngredients.some((item) => item.name.trim().toLowerCase() === name.toLowerCase()))
      errors.name = `${name} is already in the stockroom — pick it from the list instead.`
    if (!Number.isFinite(cost) || cost < 0) errors.cost = 'Enter a cost, or 0 if you do not track it yet.'
    setQuickErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSavingQuickIngredient(true)
    setQuickError('')
    try {
      const created = await onCreateIngredient({
        name,
        itemType: 'FOOD',
        category: quickCategory,
        baseUnit: quickUnit,
        currentStock: Number(quickStock) || 0,
        minStockLevel: Number(quickMinStock) || 0,
        preferredRestockQty: 0,
        costPerUnit: cost,
      })
      if (!created) {
        setQuickError('Could not save the ingredient. Please try again.')
        return
      }
      // drop the new item straight onto the line that asked for it
      const targetLineId = quickIngredientLineId
      setRecipeLines((prev) => {
        const target =
          targetLineId && prev.some((line) => line.lineId === targetLineId)
            ? targetLineId
            : prev.find((line) => !line.ingredientId)?.lineId
        if (!target) return [...prev, { ...createRecipeLine(), ingredientId: created.id, unit: created.baseUnit }]
        return prev.map((line) =>
          line.lineId === target ? { ...line, ingredientId: created.id, unit: created.baseUnit } : line
        )
      })
      setRecipeError('')
      closeQuickIngredient()
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : 'Could not save the ingredient.')
    } finally {
      setIsSavingQuickIngredient(false)
    }
  }

  /** Validated recipe lines, or an error message naming what is still missing. */
  const buildRecipeDraft = (): { lines: RecipeIngredient[]; totalFoodCost: number } | { error: string } => {
    const filled = recipeLines.filter((line) => line.ingredientId || line.quantity.trim())
    if (filled.length === 0) return { error: 'A dish needs at least one ingredient before it can go on the menu.' }

    const seen = new Set<string>()
    const lines: RecipeIngredient[] = []
    let totalFoodCost = 0

    for (const line of filled) {
      const ingredient = foodIngredients.find((item) => item.id === line.ingredientId)
      if (!ingredient) return { error: 'Choose a stockroom ingredient on every line.' }
      const quantity = Number(line.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { error: `Enter how much ${ingredient.name} one serving uses.` }
      }
      if (seen.has(ingredient.id)) return { error: `${ingredient.name} is listed twice. Combine it into one line.` }
      seen.add(ingredient.id)

      const estimatedCost = portionCost(ingredient, quantity, line.unit)
      totalFoodCost += estimatedCost
      lines.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        portionQuantity: quantity,
        unit: line.unit,
        estimatedCost,
      })
    }

    return { lines, totalFoodCost: Math.round(totalFoodCost * 100) / 100 }
  }

  const recipeCostPreview = useMemo(() => {
    let total = 0
    recipeLines.forEach((line) => {
      const ingredient = foodIngredients.find((item) => item.id === line.ingredientId)
      const quantity = Number(line.quantity)
      if (ingredient && Number.isFinite(quantity) && quantity > 0) total += portionCost(ingredient, quantity, line.unit)
    })
    return Math.round(total * 100) / 100
  }, [recipeLines, foodIngredients])

  const newPriceValue = Number(newProductPrice)
  const previewMargin =
    Number.isFinite(newPriceValue) && newPriceValue > 0 && recipeCostPreview > 0
      ? Math.round(((newPriceValue - recipeCostPreview) / newPriceValue) * 100)
      : null

  const handleCreateProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = newProductName.trim()
    const price = Number(newProductPrice)

    const errors: { name?: string; price?: string } = {}
    if (!name) errors.name = 'A dish needs a name.'
    if (!Number.isFinite(price) || price < 0) errors.price = 'Enter ₱0.00 or more.'
    setAddErrors(errors)
    if (Object.keys(errors).length > 0) return

    // A dish with no recipe can never run out of stock, so the recipe is part of creating it.
    if (!hasStockroomItems) {
      setRecipeError('There are no stockroom ingredients yet. Add one first, then create the dish.')
      return
    }
    const draft = buildRecipeDraft()
    if ('error' in draft) {
      setRecipeError(draft.error)
      return
    }

    setIsSavingProduct(true)
    setProductFormError('')
    setRecipeError('')
    try {
      const response = await fetch(`${API_BASE_URL}/menu`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          name,
          category: newProductCategory,
          description: newProductDescription.trim(),
          price,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || 'Could not add this dish.')

      const createdProduct = payload?.data
      let photoUploaded = false

      if (newProductImageFile && createdProduct?.id) {
        try {
          const body = new FormData()
          body.append('image', newProductImageFile)
          const imgResponse = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(createdProduct.id)}/image`, {
            method: 'POST',
            headers: await getAuthHeaders({}, { jsonContentType: false }),
            body,
          })
          const imgPayload = await imgResponse.json()
          if (imgResponse.ok && imgPayload?.data?.image) {
            setCachedProductImage(createdProduct.id, imgPayload.data.image)
            photoUploaded = true
          }
        } catch (imgError) {
          console.error('Failed to upload the dish photo on creation:', imgError)
        }
      }

      // Link the dish to stock. The dish exists either way, so a rejected recipe is reported as a
      // follow-up rather than failing the whole creation.
      let recipeSaved = false
      if (createdProduct?.id) {
        const totalRawCost = draft.totalFoodCost
        recipeSaved =
          (await onSaveRecipe({
            productId: String(createdProduct.id),
            productName: name,
            productCategory: newProductCategory,
            productPrice: price,
            yieldServings: 1,
            ingredients: draft.lines,
            packagingRequirements: [],
            preparationInstructions: newProductDescription.trim() || undefined,
            totalFoodCost: draft.totalFoodCost,
            totalPackagingCost: 0,
            totalRawCost,
            grossMarginPercent: price > 0 ? Math.round(((price - totalRawCost) / price) * 10000) / 100 : 0,
            isConfigured: true,
            updatedAt: new Date().toISOString(),
          })) !== false
      }

      await refreshProductImages()
      notifyProductCatalogSync({
        action: 'CREATE',
        product: createdProduct,
        productId: createdProduct?.id,
        productName: name,
      })
      onCatalogChanged?.()

      applyFilter(() => {
        setSearchQuery('')
        setSelectedCategory(newProductCategory)
      })
      resetAddProductForm()
      setIsAddProductOpen(false)

      onNotify(
        recipeSaved
          ? {
              type: 'success',
              title: `${name} added to the menu`,
              description: `${draft.lines.length} ${draft.lines.length === 1 ? 'ingredient' : 'ingredients'} per serving${photoUploaded ? ' · photo uploaded' : ''}.`,
            }
          : {
              type: 'error',
              title: `${name} was added, but its recipe did not save`,
              description: 'Set it up on the Recipes tab, or the dish can never run out of stock.',
            }
      )
    } catch (error) {
      setProductFormError(error instanceof Error ? error.message : 'Could not add this dish.')
    } finally {
      setIsSavingProduct(false)
    }
  }

  /* ------------------------------------------------------------ Remove a dish */

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(itemToDelete.id)}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || 'Could not remove this dish.')

      resetPrice(itemToDelete.id)
      await refreshProductImages()
      notifyProductCatalogSync({ action: 'DELETE', productId: itemToDelete.id, productName: itemToDelete.name })
      onCatalogChanged?.()
      onNotify({ type: 'info', title: `${itemToDelete.name} removed from the menu` })
      setItemToDelete(null)
    } catch (error) {
      onNotify({
        type: 'error',
        title: 'Could not remove the dish',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  /* ------------------------------------------------------------------- Render */

  const rowMenuItems = (item: MenuItem) => [
    { label: 'Edit dish', icon: 'edit' as const, onSelect: () => handleOpenEditModal(item) },
    { label: 'Change selling price', icon: 'doc' as const, onSelect: () => startInlinePrice(item) },
    ...(getEffectivePrice(item.id, item.price) !== item.price
      ? [{ label: 'Reset to catalog price', icon: 'refresh' as const, onSelect: () => handleResetPrice(item) }]
      : []),
    {
      label: configuredRecipeIds.has(item.id) ? 'Open recipe' : 'Set up recipe',
      icon: 'book' as const,
      onSelect: () => onNavigateTab('recipes'),
    },
    {
      label: 'Remove from menu',
      icon: 'trash' as const,
      danger: true,
      separatorBefore: true,
      onSelect: () => setItemToDelete(item),
    },
  ]

  const availabilityButton = (item: MenuItem, available: boolean) => (
    <button
      type="button"
      onClick={() => void handleToggleStock(item)}
      className={cx('inv-status-btn', available ? 'inv-status-btn--on' : 'inv-status-btn--off')}
      aria-pressed={available}
      title={available ? 'Take off the menu' : 'Put back on the menu'}
    >
      <span className="inv-badge-dot" aria-hidden="true" />
      {available ? 'On the menu' : 'Out of stock'}
    </button>
  )

  const priceCell = (item: MenuItem) => {
    const currentPrice = getEffectivePrice(item.id, item.price)
    const isCustom = currentPrice !== item.price

    if (inlineEditingId === item.id) {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <div className="inv-input-group w-28">
            <span className="inv-input-prefix" aria-hidden="true">₱</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              autoFocus
              aria-label={`Selling price for ${item.name}`}
              value={inlinePriceInput}
              onChange={(event) => setInlinePriceInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSaveInlinePrice(item)
                }
                if (event.key === 'Escape') setInlineEditingId(null)
              }}
              className="inv-input inv-input--sm has-prefix"
            />
          </div>
          <IconButton icon="check" label="Save price" onClick={() => handleSaveInlinePrice(item)} />
          <IconButton icon="close" label="Cancel" onClick={() => setInlineEditingId(null)} />
        </div>
      )
    }

    return (
      <div className="flex items-center justify-end gap-2">
        {isCustom && (
          <Badge tone="warning" title={`Catalog price ${formatPeso(item.price)}`}>
            Override
          </Badge>
        )}
        <button
          type="button"
          onClick={() => startInlinePrice(item)}
          className="inv-row-link"
          title="Change the selling price"
        >
          {formatPeso(currentPrice)}
        </button>
      </div>
    )
  }

  const recipeCell = (item: MenuItem) =>
    configuredRecipeIds.has(item.id) ? (
      <Badge tone="success" dot>
        Linked
      </Badge>
    ) : (
      <button
        type="button"
        onClick={() => onNavigateTab('recipes')}
        className="inv-link"
        title="Stock reaches a dish through its recipe. Without one it can never run out."
      >
        Not linked
      </button>
    )

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Menu"
        description="Dishes on the customer menu and the POS — price, availability, and the recipe that ties each one to stock."
        actions={
          <>
            <Button variant="secondary" icon="refresh" loading={isRefreshing} onClick={() => void handleManualRefresh()}>
              {isRefreshing ? 'Syncing' : 'Sync catalog'}
            </Button>
            <Button variant="primary" icon="plus" onClick={handleOpenAddProduct}>
              Add dish
            </Button>
          </>
        }
      />

      {unlinkedCount > 0 && (
        <Notice tone="warning">
          <p className="font-semibold">
            {unlinkedCount} {unlinkedCount === 1 ? 'dish has' : 'dishes have'} no recipe.
          </p>
          <p className="mt-0.5 text-sm">
            Stock reaches a dish only through its recipe, so {unlinkedCount === 1 ? 'it stays' : 'they stay'} orderable
            whatever the stockroom holds. Rows marked <b>Not linked</b> below still need one.
          </p>
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Category rail */}
        <Card className="hidden lg:block lg:sticky lg:top-4">
          <nav className="inv-cat-list" aria-label="Menu categories">
            {CLIENT_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className="inv-cat"
                aria-pressed={selectedCategory === category}
                onClick={() => applyFilter(() => setSelectedCategory(category))}
              >
                <span className="truncate">{category === 'All Menu' ? 'All dishes' : category}</span>
                <span className="inv-cat-count">{categoryCounts[category] || 0}</span>
              </button>
            ))}
          </nav>
        </Card>

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput
              label="Search dishes"
              placeholder="Search by dish, category or description"
              value={searchQuery}
              onChange={(value) => applyFilter(() => setSearchQuery(value))}
            />
            <div className="inv-filters">
              <FilterSelect
                className="lg:hidden"
                label="Category"
                value={selectedCategory}
                neutralValue="All Menu"
                onChange={(value) => applyFilter(() => setSelectedCategory(value))}
                options={CLIENT_CATEGORIES.map((category) => ({
                  value: category,
                  label: category === 'All Menu' ? 'All dishes' : category,
                  count: categoryCounts[category] || 0,
                }))}
              />
              <FilterSelect<StockFilter>
                label="Availability"
                value={stockFilter}
                neutralValue="all"
                onChange={(value) => applyFilter(() => setStockFilter(value))}
                options={[
                  { value: 'all', label: 'Any' },
                  { value: 'in_stock', label: 'On the menu' },
                  { value: 'out_of_stock', label: 'Out of stock' },
                ]}
              />
              <FilterSelect<PriceFilter>
                label="Price"
                value={priceFilter}
                neutralValue="all"
                onChange={(value) => applyFilter(() => setPriceFilter(value))}
                options={[
                  { value: 'all', label: 'Any' },
                  { value: 'standard', label: 'Catalog' },
                  { value: 'custom', label: 'Overridden' },
                ]}
              />
              <FilterSelect<SortOption>
                label="Sort"
                value={sortBy}
                neutralValue="default"
                onChange={setSortBy}
                options={[
                  { value: 'default', label: 'Menu order' },
                  { value: 'name_asc', label: 'Name A\u2013Z' },
                  { value: 'name_desc', label: 'Name Z\u2013A' },
                  { value: 'price_asc', label: 'Price, low to high' },
                  { value: 'price_desc', label: 'Price, high to low' },
                ]}
              />
              {hasActiveFilters && (
                <button type="button" className="inv-filter-reset" onClick={resetFilters}>
                  <Icon name="close" className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
              <span className="inv-filters-sep" aria-hidden="true" />
              <Segmented
                label="View"
                size="sm"
                value={viewMode}
                onChange={handleSetViewMode}
                options={[
                  { value: 'table', label: 'List' },
                  { value: 'grid', label: 'Cards' },
                ]}
              />
            </div>
          </Toolbar>

          {selectedItemIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--inv-border)] bg-[var(--inv-primary-soft)] px-4 py-2.5">
              <p className="text-[13px] font-medium text-[var(--inv-text-2)]">
                <b className="font-semibold text-[var(--inv-text)]">{selectedItemIds.size}</b>{' '}
                {selectedItemIds.size === 1 ? 'dish selected' : 'dishes selected'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" icon="check" onClick={() => void handleBulkAvailability(true)}>
                  Put on the menu
                </Button>
                <Button size="sm" variant="secondary" icon="close" onClick={() => void handleBulkAvailability(false)}>
                  Mark out of stock
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <EmptyState
              icon="search"
              title={hasActiveFilters ? 'No dishes match these filters' : 'No dishes on the menu yet'}
              description={
                hasActiveFilters
                  ? 'Try a different search term, category or availability.'
                  : 'Add your first dish and give it a recipe so stock can keep up with it.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="primary" icon="plus" onClick={handleOpenAddProduct}>
                    Add dish
                  </Button>
                )
              }
            />
          ) : viewMode === 'table' ? (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-10">
                      <input
                        type="checkbox"
                        className="inv-checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select every dish on this page"
                      />
                    </th>
                    <th scope="col">Dish</th>
                    <th scope="col" className="is-num">
                      Selling price
                    </th>
                    <th scope="col">Availability</th>
                    <th scope="col">Recipe</th>
                    <th scope="col" className="is-actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((item) => {
                    const available = isAvailable(item.id)
                    return (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="checkbox"
                            className="inv-checkbox"
                            checked={selectedItemIds.has(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            aria-label={`Select ${item.name}`}
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <ProductImage
                              src={item.image}
                              fallbackSrc={item.bundledImage}
                              alt=""
                              className={cx('inv-thumb', !available && 'is-muted')}
                            />
                            <div className="min-w-0">
                              <p className="inv-cell-primary truncate">{item.name}</p>
                              <p className="inv-cell-secondary truncate">{item.category || 'Uncategorised'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="is-num">{priceCell(item)}</td>
                        <td>{availabilityButton(item, available)}</td>
                        <td>{recipeCell(item)}</td>
                        <td className="is-actions">
                          <RowMenu label={`Actions for ${item.name}`} items={rowMenuItems(item)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((item) => {
                const available = isAvailable(item.id)
                const currentPrice = getEffectivePrice(item.id, item.price)
                return (
                  <article key={item.id} className="inv-dish">
                    <ProductImage
                      src={item.image}
                      fallbackSrc={item.bundledImage}
                      alt=""
                      className={cx('inv-dish-img', !available && 'is-muted')}
                    />
                    <div className="inv-dish-body">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="inv-cell-primary truncate">{item.name}</h3>
                          <p className="inv-cell-secondary truncate">{item.category || 'Uncategorised'}</p>
                        </div>
                        <RowMenu label={`Actions for ${item.name}`} items={rowMenuItems(item)} />
                      </div>
                      <p className="inv-dish-price">{formatPeso(currentPrice)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {availabilityButton(item, available)}
                        {recipeCell(item)}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {filteredProducts.length > 0 && (
            <Pagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredProducts.length}
              onChange={setPage}
              noun="dishes"
            />
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------ Add dish */}

      <Modal
        open={isAddProductOpen}
        onClose={handleCloseAddProduct}
        size="lg"
        title="Add dish"
        description="Name it, price it, and say what one serving takes out of the stockroom."
        onSubmit={(event) => void handleCreateProduct(event)}
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseAddProduct} disabled={isSavingProduct}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSavingProduct}>
              {isSavingProduct ? 'Adding' : 'Add dish'}
            </Button>
          </>
        }
      >
        <div className="inv-form-section space-y-4">
          <Field label="Dish name" htmlFor="dish-name" required error={addErrors.name}>
            <input
              {...fieldAria('dish-name', addErrors.name)}
              type="text"
              className="inv-input"
              autoComplete="off"
              maxLength={255}
              placeholder="e.g. Cajun butter blue crab"
              value={newProductName}
              onChange={(event) => setNewProductName(event.target.value)}
            />
          </Field>

          <div className="inv-grid-2">
            <Field label="Category" htmlFor="dish-category">
              <select
                id="dish-category"
                className="inv-select"
                value={newProductCategory}
                onChange={(event) => setNewProductCategory(event.target.value)}
              >
                {DISH_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Selling price" htmlFor="dish-price" required error={addErrors.price}>
              <div className="inv-input-group">
                <span className="inv-input-prefix" aria-hidden="true">₱</span>
                <input
                  {...fieldAria('dish-price', addErrors.price)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  className="inv-input has-prefix"
                  placeholder="0.00"
                  value={newProductPrice}
                  onChange={(event) => setNewProductPrice(event.target.value)}
                />
              </div>
            </Field>
          </div>

          <Field
            label="Description"
            htmlFor="dish-description"
            optional
            hint="Shown to customers on the online menu."
          >
            <textarea
              id="dish-description"
              className="inv-textarea"
              rows={2}
              maxLength={2000}
              placeholder="Portion, flavour notes, what it comes with."
              value={newProductDescription}
              onChange={(event) => setNewProductDescription(event.target.value)}
            />
          </Field>
        </div>

        <div className="inv-form-section">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--inv-text)]">
                Recipe <span className="inv-required">*</span>
              </p>
              <p className="inv-hint mt-1">What one serving takes out of the stockroom.</p>
            </div>
            {hasStockroomItems && (
              <Button size="sm" variant="ghost" icon="plus" onClick={() => openQuickIngredient(null)}>
                New ingredient
              </Button>
            )}
          </div>

          {!hasStockroomItems ? (
            <Notice tone="warning">
              <p className="font-semibold">The stockroom is empty.</p>
              <p className="mt-0.5 text-sm">
                A dish is tied to stock through its ingredients, so add them first.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => openQuickIngredient(null)}>
                  Add an ingredient
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    handleCloseAddProduct()
                    onNavigateTab('ingredients')
                  }}
                >
                  Go to Items
                </Button>
              </div>
            </Notice>
          ) : (
            <>
              <div className="inv-lines">
                <div className="inv-line-head grid-cols-[minmax(0,1fr)_96px_84px_36px]">
                  <span>Ingredient</span>
                  <span>Per serving</span>
                  <span>Unit</span>
                  <span />
                </div>
                {recipeLines.map((line, index) => {
                  const picked = foodIngredients.find((item) => item.id === line.ingredientId)
                  const quantity = Number(line.quantity)
                  const lineCost =
                    picked && Number.isFinite(quantity) && quantity > 0 ? portionCost(picked, quantity, line.unit) : null
                  return (
                    <div
                      key={line.lineId}
                      className="inv-line grid-cols-[minmax(0,1fr)_36px] sm:grid-cols-[minmax(0,1fr)_96px_84px_36px]"
                    >
                      <label className="col-span-2 sm:col-span-1">
                        <span className="inv-line-label">Ingredient</span>
                        <SearchableSelect
                          ariaLabel={`Ingredient ${index + 1}`}
                          value={line.ingredientId}
                          onChange={(next) => handlePickRecipeIngredient(line.lineId, next)}
                          placeholder="Choose an ingredient"
                          searchPlaceholder="Search the stockroom…"
                          options={[
                            ...foodIngredients.map((item) => ({
                              value: item.id,
                              label: item.name,
                              hint: `${formatQty(item.currentStock)} ${item.baseUnit}`,
                            })),
                            { value: '__new__', label: '+ Not in the stockroom yet…', pinned: true },
                          ]}
                        />
                      </label>
                      <label>
                        <span className="inv-line-label">Per serving</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          className="inv-input inv-input--sm"
                          aria-label={`Amount per serving for ingredient ${index + 1}`}
                          placeholder="0"
                          value={line.quantity}
                          onChange={(event) => updateRecipeLine(line.lineId, { quantity: event.target.value })}
                        />
                      </label>
                      <label>
                        <span className="inv-line-label">Unit</span>
                        <select
                          className="inv-select inv-select--sm"
                          aria-label={`Unit for ingredient ${index + 1}`}
                          value={line.unit}
                          onChange={(event) =>
                            updateRecipeLine(line.lineId, { unit: event.target.value as MeasurementUnit })
                          }
                        >
                          {MEASUREMENT_UNITS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-end justify-end self-end sm:items-center sm:self-center">
                        <IconButton
                          icon="trash"
                          tone="danger"
                          label={`Remove ingredient ${index + 1}`}
                          onClick={() => removeRecipeLine(line.lineId)}
                        />
                      </div>
                      {lineCost !== null && (
                        <p className="inv-line-meta">Costs {formatPeso(lineCost)} a serving</p>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <Button size="sm" variant="secondary" icon="plus" onClick={addRecipeLine}>
                  Add ingredient
                </Button>
                <p className="text-[13px] text-[var(--inv-text-3)]">
                  Ingredient cost{' '}
                  <b className="font-semibold tabular-nums text-[var(--inv-text)]">{formatPeso(recipeCostPreview)}</b>
                  {previewMargin !== null && <> · margin {previewMargin}%</>}
                </p>
              </div>
            </>
          )}

          {recipeError && (
            <p className="inv-field-error mt-3" role="alert">
              <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0" />
              {recipeError}
            </p>
          )}
        </div>

        <div className="inv-form-section">
          <p className="inv-form-section-title">
            Photo <span className="inv-optional">Optional</span>
          </p>
          <input
            ref={newProductFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={isSavingProduct}
            onChange={(event) => handleSelectNewProductFile(event.target.files?.[0] || null)}
          />
          <div className="flex items-center gap-3">
            {newProductImagePreview ? (
              <img src={newProductImagePreview} alt="" className="inv-thumb inv-thumb--lg" />
            ) : (
              <div className="inv-thumb inv-thumb--lg inv-thumb--empty" aria-hidden="true">
                <Icon name="plus" className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-[var(--inv-text-2)]">
                {newProductImageFile ? newProductImageFile.name : 'JPEG, PNG or WebP, up to 5 MB.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => newProductFileInputRef.current?.click()}>
                  {newProductImageFile ? 'Replace photo' : 'Choose photo'}
                </Button>
                {newProductImageFile && (
                  <Button size="sm" variant="ghost" onClick={clearNewProductImage}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
          {newProductImageError && (
            <p className="inv-field-error mt-2" role="alert">
              <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0" />
              {newProductImageError}
            </p>
          )}
        </div>

        {productFormError && (
          <div className="mt-5">
            <Notice tone="danger">{productFormError}</Notice>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------- New ingredient (over Add dish) */}

      <Modal
        open={isQuickIngredientOpen}
        onClose={closeQuickIngredient}
        size="md"
        title="New ingredient"
        description="Registers it on the Items tab and uses it in this recipe straight away."
        onSubmit={(event) => void handleCreateQuickIngredient(event)}
        footer={
          <>
            <Button variant="secondary" onClick={closeQuickIngredient} disabled={isSavingQuickIngredient}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSavingQuickIngredient}>
              {isSavingQuickIngredient ? 'Saving' : 'Save ingredient'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="quick-name" required error={quickErrors.name}>
            <input
              {...fieldAria('quick-name', quickErrors.name)}
              type="text"
              className="inv-input"
              autoComplete="off"
              maxLength={150}
              placeholder="e.g. Blue crab"
              value={quickName}
              onChange={(event) => setQuickName(event.target.value)}
            />
          </Field>

          <div className="inv-grid-2">
            <Field label="Category" htmlFor="quick-category">
              <select
                id="quick-category"
                className="inv-select"
                value={quickCategory}
                onChange={(event) => setQuickCategory(event.target.value as IngredientCategory)}
              >
                {FOOD_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Stock unit" htmlFor="quick-unit" hint="How this item is counted in the stockroom.">
              <select
                id="quick-unit"
                className="inv-select"
                value={quickUnit}
                onChange={(event) => setQuickUnit(event.target.value as MeasurementUnit)}
              >
                {MEASUREMENT_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="inv-grid-2">
            <Field label={`Stock on hand (${quickUnit})`} htmlFor="quick-stock">
              <input
                id="quick-stock"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                className="inv-input"
                placeholder="0"
                value={quickStock}
                onChange={(event) => setQuickStock(event.target.value)}
              />
            </Field>

            <Field label={`Minimum level (${quickUnit})`} htmlFor="quick-min" hint="Flags the item as low below this.">
              <input
                id="quick-min"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                className="inv-input"
                placeholder="0"
                value={quickMinStock}
                onChange={(event) => setQuickMinStock(event.target.value)}
              />
            </Field>
          </div>

          {quickError && <Notice tone="danger">{quickError}</Notice>}

          <Field label={`Cost per ${quickUnit}`} htmlFor="quick-cost" required error={quickErrors.cost}>
            <div className="inv-input-group">
              <span className="inv-input-prefix" aria-hidden="true">₱</span>
              <input
                {...fieldAria('quick-cost', quickErrors.cost)}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="inv-input has-prefix"
                placeholder="0.00"
                value={quickCost}
                onChange={(event) => setQuickCost(event.target.value)}
              />
            </div>
          </Field>
        </div>
      </Modal>

      {/* ----------------------------------------------------------- Edit dish */}

      <Modal
        open={Boolean(editingItem)}
        onClose={handleCloseEditModal}
        size="lg"
        title={editingItem ? `Edit ${editingItem.name}` : 'Edit dish'}
        description="Changes reach the POS, tablets and the customer menu right away."
        onSubmit={(event) => void handleSaveEditProduct(event)}
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseEditModal} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSavingEdit}>
              {isSavingEdit ? 'Saving' : 'Save changes'}
            </Button>
          </>
        }
      >
        {editingItem && (
          <>
            <div className="inv-form-section space-y-4">
              <Field label="Dish name" htmlFor="edit-name" required error={editErrors.name}>
                <input
                  {...fieldAria('edit-name', editErrors.name)}
                  type="text"
                  className="inv-input"
                  maxLength={255}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </Field>

              <div className="inv-grid-2">
                <Field label="Category" htmlFor="edit-category">
                  <select
                    id="edit-category"
                    className="inv-select"
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                  >
                    {DISH_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Catalog price"
                  htmlFor="edit-base-price"
                  required
                  error={editErrors.basePrice}
                  hint="The dish's standard price."
                >
                  <div className="inv-input-group">
                    <span className="inv-input-prefix" aria-hidden="true">₱</span>
                    <input
                      {...fieldAria('edit-base-price', editErrors.basePrice, true)}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="inv-input has-prefix"
                      value={editBasePrice}
                      onChange={(event) => setEditBasePrice(event.target.value)}
                    />
                  </div>
                </Field>
              </div>

              <Field
                label="Selling price"
                htmlFor="edit-pos-price"
                hint="What it actually rings up for. Match the catalog price to drop the override."
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inv-input-group w-40">
                    <span className="inv-input-prefix" aria-hidden="true">₱</span>
                    <input
                      id="edit-pos-price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="inv-input has-prefix"
                      value={editPosPrice}
                      onChange={(event) => setEditPosPrice(event.target.value)}
                    />
                  </div>
                  {getEffectivePrice(editingItem.id, editingItem.price) !== editingItem.price && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="refresh"
                      onClick={() => {
                        resetPrice(editingItem.id)
                        setEditPosPrice(editBasePrice)
                      }}
                    >
                      Reset to catalog price
                    </Button>
                  )}
                </div>
              </Field>

              <Field label="Description" htmlFor="edit-description" optional>
                <textarea
                  id="edit-description"
                  className="inv-textarea"
                  rows={2}
                  maxLength={2000}
                  placeholder="Shown to customers on the online menu."
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </Field>
            </div>

            <div className="inv-form-section">
              <p className="inv-form-section-title">Photo</p>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => handleSelectEditFile(event.target.files?.[0] || null)}
              />
              <div className="flex items-center gap-3">
                <ProductImage
                  src={editImagePreview || editingItem.image}
                  fallbackSrc={editingItem.bundledImage}
                  alt=""
                  className="inv-thumb inv-thumb--lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-[var(--inv-text-2)]">
                    {editImageFile ? editImageFile.name : 'Current photo'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editFileInputRef.current?.click()}>
                      Change photo
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void handleRestoreDefaultPhoto()}>
                      Restore bundled photo
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {editError && (
              <div className="mt-5">
                <Notice tone="danger">{editError}</Notice>
              </div>
            )}
          </>
        )}
      </Modal>

      <InventoryConfirmModal
        isOpen={Boolean(itemToDelete)}
        title="Remove this dish?"
        message={
          itemToDelete
            ? `${itemToDelete.name} comes off the customer menu and the POS. Past orders keep it, and its recipe stays on the Recipes tab.`
            : ''
        }
        confirmText="Remove dish"
        isDestructive
        isLoading={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => !isDeleting && setItemToDelete(null)}
      />
    </div>
  )
}

export default MenuCatalogTab
