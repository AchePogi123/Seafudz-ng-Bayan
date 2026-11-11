import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavbarAdmin } from '../components/NavbarAdmin'
import { ProductImage } from '../components/ProductImage'
import { CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { useMenuPrices } from '../utils/menuPriceManager'
import { useProductImages, setCachedProductImage } from '../utils/useProductImages'
import { useMenuAvailability } from '../utils/menuAvailability'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { notifyProductCatalogSync, subscribeProductCatalogSync } from '../utils/orderSync'

type ViewMode = 'table' | 'grid'
type StockFilter = 'all' | 'in_stock' | 'out_of_stock'
type PriceFilter = 'all' | 'custom' | 'standard'
type SortOption = 'default' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'

const getCategoryColor = (category: string) => {
    switch (category) {
        case 'Seafoods':
            return 'bg-blue-50 text-blue-700 border-blue-200/80'
        case 'Value Meals':
            return 'bg-orange-50 text-orange-700 border-orange-200/80'
        case 'Siomai':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
        case 'Add Ons':
            return 'bg-purple-50 text-purple-700 border-purple-200/80'
        case 'Shake & Lemonade':
            return 'bg-amber-50 text-amber-800 border-amber-200/80'
        case 'Desserts':
            return 'bg-pink-50 text-pink-700 border-pink-200/80'
        case 'Drinks':
            return 'bg-cyan-50 text-cyan-700 border-cyan-200/80'
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200'
    }
}

export const AdminMenuManagement: React.FC = () => {
    const navigate = useNavigate()
    const { getEffectivePrice, updatePrice, resetPrice } = useMenuPrices()
    const { menuItems, refresh: refreshProductImages } = useProductImages()
    const { isAvailable, setAvailability } = useMenuAvailability()

    // View Preferences & Filters
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('sfb_menu_view_mode') as ViewMode) || 'table'
        }
        return 'table'
    })
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Menu')
    const [stockFilter, setStockFilter] = useState<StockFilter>('all')
    const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
    const [sortBy, setSortBy] = useState<SortOption>('default')
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Feedback Banner
    const [catalogFeedback, setCatalogFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    // Inline Price Editor State
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
    const [inlinePriceInput, setInlinePriceInput] = useState<string>('')

    // Full Edit Product Modal / Drawer State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
    const [editName, setEditName] = useState('')
    const [editCategory, setEditCategory] = useState('Seafoods')
    const [editDescription, setEditDescription] = useState('')
    const [editBasePrice, setEditBasePrice] = useState<number | string>('')
    const [editPosPrice, setEditPosPrice] = useState<number | string>('')
    const [editImageFile, setEditImageFile] = useState<File | null>(null)
    const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
    const [isSavingEdit, setIsSavingEdit] = useState(false)
    const [editError, setEditError] = useState('')
    const editPreviewRef = useRef<string | null>(null)
    const editFileInputRef = useRef<HTMLInputElement | null>(null)

    // Add Product Modal State
    const [isAddProductOpen, setIsAddProductOpen] = useState(false)
    const [newProductName, setNewProductName] = useState('')
    const [newProductCategory, setNewProductCategory] = useState('Seafoods')
    const [newProductDescription, setNewProductDescription] = useState('')
    const [newProductPrice, setNewProductPrice] = useState<number | string>('')
    const [isSavingProduct, setIsSavingProduct] = useState(false)
    const [productFormError, setProductFormError] = useState('')
    const [newProductImageFile, setNewProductImageFile] = useState<File | null>(null)
    const [newProductImagePreview, setNewProductImagePreview] = useState<string | null>(null)
    const [newProductImageError, setNewProductImageError] = useState('')
    const [isDraggingNewImage, setIsDraggingNewImage] = useState(false)
    const newProductImagePreviewRef = useRef<string | null>(null)
    const newProductFileInputRef = useRef<HTMLInputElement | null>(null)

    // Delete Confirmation Modal State
    const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Persist view mode preference
    const handleSetViewMode = (mode: ViewMode) => {
        setViewMode(mode)
        try {
            localStorage.setItem('sfb_menu_view_mode', mode)
        } catch {
            // storage may be full or disabled
        }
    }

    // Auto-dismiss catalog feedback after 4.5 seconds
    useEffect(() => {
        if (!catalogFeedback) return
        const timer = setTimeout(() => {
            setCatalogFeedback(null)
        }, 4500)
        return () => clearTimeout(timer)
    }, [catalogFeedback])

    // Clean up object URLs
    useEffect(() => () => {
        if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
        if (newProductImagePreviewRef.current) URL.revokeObjectURL(newProductImagePreviewRef.current)
    }, [])

    // Realtime Catalog Synchronization
    useEffect(() => {
        const unsubscribe = subscribeProductCatalogSync(() => {
            void refreshProductImages()
        })
        return () => {
            unsubscribe()
        }
    }, [refreshProductImages])

    // Manual Refresh Handler
    const handleManualRefresh = async () => {
        setIsRefreshing(true)
        try {
            await refreshProductImages()
            setCatalogFeedback({ type: 'success', message: 'Menu catalog synced with server.' })
        } catch {
            setCatalogFeedback({ type: 'error', message: 'Could not refresh catalog.' })
        } finally {
            setIsRefreshing(false)
        }
    }

    // Operational KPI Counts
    const stats = useMemo(() => {
        const total = menuItems.length
        let inStock = 0
        let outOfStock = 0
        let customPriceCount = 0

        menuItems.forEach((item) => {
            const avail = isAvailable(item.id)
            if (avail) inStock++
            else outOfStock++

            const effective = getEffectivePrice(item.id, item.price)
            if (effective !== item.price) customPriceCount++
        })

        return { total, inStock, outOfStock, customPriceCount }
    }, [menuItems, isAvailable, getEffectivePrice])

    // Category Counts for Pills
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { 'All Menu': menuItems.length }
        menuItems.forEach((item) => {
            const cat = item.category || 'Other'
            counts[cat] = (counts[cat] || 0) + 1
        })
        return counts
    }, [menuItems])

    // Filtered & Sorted Products
    const filteredProducts = useMemo(() => {
        const result = menuItems.filter((item) => {
            // Search filter
            const query = searchQuery.trim().toLowerCase()
            const matchesSearch =
                !query ||
                item.name.toLowerCase().includes(query) ||
                (item.category || '').toLowerCase().includes(query) ||
                (item.description || '').toLowerCase().includes(query) ||
                item.id.toLowerCase().includes(query)

            // Category filter
            const normSelected = selectedCategory.toLowerCase().replace(/[^a-z0-9]/g, '')
            const normItemCat = (item.category || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            const matchesCategory =
                selectedCategory === 'All Menu' || normItemCat === normSelected

            // Stock filter
            const avail = isAvailable(item.id)
            const matchesStock =
                stockFilter === 'all' ||
                (stockFilter === 'in_stock' && avail) ||
                (stockFilter === 'out_of_stock' && !avail)

            // Price filter
            const effectivePrice = getEffectivePrice(item.id, item.price)
            const isCustom = effectivePrice !== item.price
            const matchesPrice =
                priceFilter === 'all' ||
                (priceFilter === 'custom' && isCustom) ||
                (priceFilter === 'standard' && !isCustom)

            return matchesSearch && matchesCategory && matchesStock && matchesPrice
        })

        // Sorting
        if (sortBy === 'name_asc') {
            result.sort((a, b) => a.name.localeCompare(b.name))
        } else if (sortBy === 'name_desc') {
            result.sort((a, b) => b.name.localeCompare(a.name))
        } else if (sortBy === 'price_asc') {
            result.sort((a, b) => getEffectivePrice(a.id, a.price) - getEffectivePrice(b.id, b.price))
        } else if (sortBy === 'price_desc') {
            result.sort((a, b) => getEffectivePrice(b.id, b.price) - getEffectivePrice(a.id, a.price))
        }

        return result
    }, [menuItems, searchQuery, selectedCategory, stockFilter, priceFilter, sortBy, isAvailable, getEffectivePrice])

    // Selection Handlers
    const toggleSelectItem = (id: string) => {
        setSelectedItemIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedItemIds.size === filteredProducts.length) {
            setSelectedItemIds(new Set())
        } else {
            setSelectedItemIds(new Set(filteredProducts.map((p) => p.id)))
        }
    }

    const clearSelection = () => {
        setSelectedItemIds(new Set())
    }

    // Bulk Stock Update
    const handleBulkAvailability = async (available: boolean) => {
        if (selectedItemIds.size === 0) return
        const ids = Array.from(selectedItemIds)
        for (const id of ids) {
            await setAvailability(id, available)
        }
        setCatalogFeedback({
            type: 'success',
            message: `Updated ${ids.length} ${ids.length === 1 ? 'item' : 'items'} to ${available ? 'In Stock' : 'Out of Stock'}.`,
        })
        clearSelection()
    }

    // Availability Single Toggle
    const handleToggleStock = async (item: MenuItem, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        const current = isAvailable(item.id)
        const next = !current
        await setAvailability(item.id, next)
        setCatalogFeedback({
            type: 'success',
            message: `"${item.name}" is now ${next ? 'In Stock' : 'Out of Stock (86)'}.`,
        })
    }

    // Inline Price Save
    const handleSaveInlinePrice = (item: MenuItem) => {
        const val = Number(inlinePriceInput)
        if (isNaN(val) || val <= 0) {
            setCatalogFeedback({ type: 'error', message: 'Enter a valid price greater than 0.' })
            setInlineEditingId(null)
            return
        }
        updatePrice(item.id, val)
        setInlineEditingId(null)
        setCatalogFeedback({
            type: 'success',
            message: `Live POS price for "${item.name}" updated to ₱${val.toFixed(2)}.`,
        })
    }

    const handleResetInlinePrice = (item: MenuItem) => {
        resetPrice(item.id)
        setInlineEditingId(null)
        setCatalogFeedback({
            type: 'success',
            message: `Price for "${item.name}" reset to default base price (₱${item.price.toFixed(2)}).`,
        })
    }

    // Open Edit Modal
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
        setEditError('')
        setIsEditModalOpen(true)
    }

    const handleCloseEditModal = () => {
        if (isSavingEdit) return
        if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
        editPreviewRef.current = null
        setIsEditModalOpen(false)
        setEditingItem(null)
    }

    const handleSelectEditFile = (file: File | null) => {
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setEditError('Please select a JPEG, PNG, or WebP image.')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setEditError('Image must be 5 MB or smaller.')
            return
        }
        if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
        const url = URL.createObjectURL(file)
        editPreviewRef.current = url
        setEditImagePreview(url)
        setEditImageFile(file)
        setEditError('')
    }

    // Save Full Edit
    const handleSaveEditProduct = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingItem) return

        const name = editName.trim()
        const basePrice = Number(editBasePrice)
        const posPrice = Number(editPosPrice)

        if (!name || isNaN(basePrice) || basePrice < 0) {
            setEditError('Product name and a valid base price are required.')
            return
        }

        setIsSavingEdit(true)
        setEditError('')

        try {
            // 1. Update Database / Backend Product Info
            const headers = await getAuthHeaders()
            const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(editingItem.id)}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    name,
                    category: editCategory,
                    description: editDescription.trim(),
                    price: basePrice,
                }),
            })

            if (!response.ok) {
                const payload = await response.json().catch(() => null)
                console.warn('Backend PUT /menu/:id non-ok response:', payload?.message)
            }

            // 2. Handle Live POS Price Override
            if (!isNaN(posPrice) && posPrice > 0) {
                if (posPrice !== basePrice) {
                    updatePrice(editingItem.id, posPrice)
                } else {
                    resetPrice(editingItem.id)
                }
            }

            // 3. Handle Image Upload if new file selected
            let photoUploaded = false
            if (editImageFile) {
                try {
                    const imgHeaders = await getAuthHeaders({}, { jsonContentType: false })
                    const body = new FormData()
                    body.append('image', editImageFile)
                    const imgResponse = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(editingItem.id)}/image`, {
                        method: 'POST',
                        headers: imgHeaders,
                        body,
                    })
                    const imgPayload = await imgResponse.json()
                    if (imgResponse.ok && imgPayload?.data?.image) {
                        setCachedProductImage(editingItem.id, imgPayload.data.image)
                        photoUploaded = true
                    }
                } catch (imgError) {
                    console.error('Image upload failed during product edit:', imgError)
                }
            }

            // 4. Refresh & Broadcast Catalog Update
            await refreshProductImages()
            notifyProductCatalogSync({
                action: 'UPDATE',
                productId: editingItem.id,
                productName: name,
            })

            setCatalogFeedback({
                type: 'success',
                message: photoUploaded
                    ? `"${name}" details and photo updated successfully.`
                    : `"${name}" details updated successfully.`,
            })
            handleCloseEditModal()
        } catch (error) {
            setEditError(error instanceof Error ? error.message : 'Could not save product changes.')
        } finally {
            setIsSavingEdit(false)
        }
    }

    // Restore Bundled Photo for Editing Item
    const handleRestoreDefaultPhoto = async () => {
        if (!editingItem || isSavingEdit) return
        setIsSavingEdit(true)
        try {
            const headers = await getAuthHeaders()
            await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(editingItem.id)}/image`, {
                method: 'DELETE',
                headers,
            })
            setCachedProductImage(editingItem.id, null)
            if (editPreviewRef.current) URL.revokeObjectURL(editPreviewRef.current)
            editPreviewRef.current = null
            setEditImagePreview(null)
            setEditImageFile(null)
            await refreshProductImages()
            setCatalogFeedback({ type: 'success', message: 'Original bundled photo restored.' })
        } catch {
            setEditError('Could not restore bundled photo.')
        } finally {
            setIsSavingEdit(false)
        }
    }

    // Add Product Handlers
    const clearNewProductImage = () => {
        if (newProductImagePreviewRef.current) {
            URL.revokeObjectURL(newProductImagePreviewRef.current)
        }
        newProductImagePreviewRef.current = null
        setNewProductImagePreview(null)
        setNewProductImageFile(null)
        setNewProductImageError('')
        if (newProductFileInputRef.current) {
            newProductFileInputRef.current.value = ''
        }
    }

    const handleSelectNewProductFile = (file: File | null) => {
        setNewProductImageError('')
        if (!file) return

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setNewProductImageError('Please select a JPEG, PNG, or WebP image.')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setNewProductImageError('Image must be 5 MB or smaller.')
            return
        }

        if (newProductImagePreviewRef.current) {
            URL.revokeObjectURL(newProductImagePreviewRef.current)
        }
        const url = URL.createObjectURL(file)
        newProductImagePreviewRef.current = url
        setNewProductImagePreview(url)
        setNewProductImageFile(file)
    }

    const resetAddProductForm = () => {
        setNewProductName('')
        setNewProductDescription('')
        setNewProductPrice('')
        setNewProductCategory('Seafoods')
        setProductFormError('')
        clearNewProductImage()
    }

    const handleCloseAddProduct = () => {
        if (isSavingProduct) return
        resetAddProductForm()
        setIsAddProductOpen(false)
    }

    const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const name = newProductName.trim()
        const price = Number(newProductPrice)
        if (!name || !Number.isFinite(price) || price < 0) {
            setProductFormError('Enter a product name and a valid price.')
            return
        }

        setIsSavingProduct(true)
        setProductFormError('')
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
            if (!response.ok) throw new Error(payload?.message || 'Could not add this product.')

            const createdProduct = payload?.data
            let photoUploaded = false

            if (newProductImageFile && createdProduct?.id) {
                try {
                    const headers = await getAuthHeaders({}, { jsonContentType: false })
                    const body = new FormData()
                    body.append('image', newProductImageFile)
                    const imgResponse = await fetch(
                        `${API_BASE_URL}/menu/${encodeURIComponent(createdProduct.id)}/image`,
                        {
                            method: 'POST',
                            headers,
                            body,
                        }
                    )
                    const imgPayload = await imgResponse.json()
                    if (imgResponse.ok && imgPayload?.data?.image) {
                        setCachedProductImage(createdProduct.id, imgPayload.data.image)
                        photoUploaded = true
                    }
                } catch (imgError) {
                    console.error('Failed to upload product image on creation:', imgError)
                }
            }

            await refreshProductImages()
            notifyProductCatalogSync({
                action: 'CREATE',
                product: createdProduct,
                productId: createdProduct?.id,
                productName: name,
            })
            setSearchQuery('')
            setSelectedCategory(newProductCategory)
            resetAddProductForm()
            setIsAddProductOpen(false)
            setCatalogFeedback({
                type: 'success',
                message: photoUploaded
                    ? `"${name}" added to menu with photo.`
                    : `"${name}" added to menu.`,
            })
        } catch (error) {
            setProductFormError(error instanceof Error ? error.message : 'Could not add this product.')
        } finally {
            setIsSavingProduct(false)
        }
    }

    // Delete Product
    const handleConfirmDelete = async () => {
        if (!itemToDelete) return
        setIsDeleting(true)
        try {
            const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(itemToDelete.id)}`, {
                method: 'DELETE',
                headers: await getAuthHeaders(),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.message || 'Could not remove this product.')

            resetPrice(itemToDelete.id)
            await refreshProductImages()
            notifyProductCatalogSync({
                action: 'DELETE',
                productId: itemToDelete.id,
                productName: itemToDelete.name,
            })
            setCatalogFeedback({ type: 'success', message: `"${itemToDelete.name}" removed from the active menu.` })
            setItemToDelete(null)
        } catch (error) {
            setCatalogFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Could not remove this product.',
            })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50/70 pb-20 font-sans text-slate-900">
            {/* Top Navigation */}
            <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 print:hidden">
                <NavbarAdmin />
            </div>

            {/* Main Content Workspace */}
            <main className="w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
                {/* Back to Dashboard Navigation */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate('/admin-dashboard')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors group cursor-pointer"
                    >
                        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        <span>Back to Dashboard</span>
                    </button>

                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                        <span>Realtime POS & Kitchen Catalog</span>
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                </div>

                {/* Primary Operations Header Card */}
                <header className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-4">
                            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                                    Menu & Dish Catalog
                                </h1>
                                <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
                                    Manage food items, stock availability (86 toggle), live POS pricing overrides, and dish photography across the entire restaurant.
                                </p>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={handleManualRefresh}
                                disabled={isRefreshing}
                                title="Sync catalog with database"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer disabled:opacity-50"
                            >
                                <svg className={`h-4 w-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                <span>{isRefreshing ? 'Syncing…' : 'Sync Catalog'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    resetAddProductForm()
                                    setIsAddProductOpen(true)
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span>Add New Dish</span>
                            </button>
                        </div>
                    </div>

                    {/* Operational KPI Metric Strip */}
                    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-100">
                        {/* Metric 1: Total Dishes */}
                        <div
                            onClick={() => {
                                setSelectedCategory('All Menu')
                                setStockFilter('all')
                                setPriceFilter('all')
                                setSearchQuery('')
                            }}
                            className="p-3.5 rounded-2xl border border-slate-200/70 bg-slate-50/60 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group"
                        >
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Total Catalog
                            </span>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-900 tabular-nums">
                                    {stats.total}
                                </span>
                                <span className="text-xs font-semibold text-slate-400">dishes</span>
                            </div>
                        </div>

                        {/* Metric 2: In Stock */}
                        <div
                            onClick={() => {
                                setStockFilter(stockFilter === 'in_stock' ? 'all' : 'in_stock')
                            }}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                                stockFilter === 'in_stock'
                                    ? 'border-emerald-300 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/10'
                                    : 'border-emerald-100/80 bg-emerald-50/40 hover:bg-emerald-50/70'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                                    In Stock
                                </span>
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-800 tabular-nums">
                                    {stats.inStock}
                                </span>
                                <span className="text-xs font-semibold text-emerald-600/80">available</span>
                            </div>
                        </div>

                        {/* Metric 3: Out of Stock (86'd) */}
                        <div
                            onClick={() => {
                                setStockFilter(stockFilter === 'out_of_stock' ? 'all' : 'out_of_stock')
                            }}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                                stockFilter === 'out_of_stock'
                                    ? 'border-rose-300 bg-rose-50/90 shadow-xs ring-2 ring-rose-500/10'
                                    : 'border-rose-100/80 bg-rose-50/40 hover:bg-rose-50/70'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                                    Out of Stock (86'd)
                                </span>
                                <span className={`w-2 h-2 rounded-full ${stats.outOfStock > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-rose-800 tabular-nums">
                                    {stats.outOfStock}
                                </span>
                                <span className="text-xs font-semibold text-rose-600/80">unavailable</span>
                            </div>
                        </div>

                        {/* Metric 4: Custom POS Overrides */}
                        <div
                            onClick={() => {
                                setPriceFilter(priceFilter === 'custom' ? 'all' : 'custom')
                            }}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                                priceFilter === 'custom'
                                    ? 'border-amber-300 bg-amber-50/90 shadow-xs ring-2 ring-amber-500/10'
                                    : 'border-amber-100/80 bg-amber-50/40 hover:bg-amber-50/70'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                                    Price Overrides
                                </span>
                                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded">
                                    POS
                                </span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-amber-900 tabular-nums">
                                    {stats.customPriceCount}
                                </span>
                                <span className="text-xs font-semibold text-amber-700/80">custom rates</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Feedback Notification Banner */}
                {catalogFeedback && (
                    <div
                        role="status"
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-bold shadow-xs animate-in fade-in duration-200 ${
                            catalogFeedback.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            {catalogFeedback.type === 'success' ? (
                                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                            )}
                            <span>{catalogFeedback.message}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCatalogFeedback(null)}
                            className="text-slate-400 hover:text-slate-700 text-sm font-bold ml-4 cursor-pointer"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {/* Filter & Management Toolbar */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
                    {/* Search and Secondary Filter Row */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-xl">
                            <svg className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                id="admin-product-search"
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder='Search dishes, ID, ingredients (e.g. "shrimp", "pastil")…'
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                                >
                                    &times;
                                </button>
                            )}
                        </div>

                        {/* Filter Selects & View Mode Toggle */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Stock Status Filter */}
                            <select
                                value={stockFilter}
                                onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 transition cursor-pointer"
                            >
                                <option value="all">All Stock Status</option>
                                <option value="in_stock">In Stock Only</option>
                                <option value="out_of_stock">Out of Stock Only</option>
                            </select>

                            {/* Price Type Filter */}
                            <select
                                value={priceFilter}
                                onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 transition cursor-pointer"
                            >
                                <option value="all">All Pricing</option>
                                <option value="standard">Standard Price Only</option>
                                <option value="custom">Custom Overrides Only</option>
                            </select>

                            {/* Sort Dropdown */}
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 transition cursor-pointer"
                            >
                                <option value="default">Sort: Default</option>
                                <option value="name_asc">Name: A to Z</option>
                                <option value="name_desc">Name: Z to A</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                            </select>

                            {/* View Switcher: Table vs Grid */}
                            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => handleSetViewMode('table')}
                                    title="Compact Table View"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        viewMode === 'table'
                                            ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                    </svg>
                                    <span className="hidden sm:inline">Table</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetViewMode('grid')}
                                    title="Visual Grid View"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        viewMode === 'grid'
                                            ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                    </svg>
                                    <span className="hidden sm:inline">Grid</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Category Filter Pills Row */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-slate-100 scrollbar-none">
                        {CLIENT_CATEGORIES.map((cat) => {
                            const isSelected = selectedCategory === cat
                            const count = categoryCounts[cat] || 0
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        isSelected
                                            ? 'bg-slate-900 text-white shadow-2xs font-black'
                                            : 'border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <span>{cat}</span>
                                    <span className={`text-[10px] font-extrabold rounded-full px-1.5 py-0.2 ${
                                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Bulk Action Bar (Visible when items are selected) */}
                {selectedItemIds.size > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-xs animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-extrabold text-white">
                                {selectedItemIds.size}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                                {selectedItemIds.size === 1 ? 'item selected' : 'items selected'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void handleBulkAvailability(true)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                <span>Mark In Stock</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => void handleBulkAvailability(false)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                <span>Mark Out of Stock (86)</span>
                            </button>

                            <button
                                type="button"
                                onClick={clearSelection}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Dishes View (Table or Grid) */}
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-14 text-center shadow-xs">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 mb-4">
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h3 className="text-base font-black text-slate-800">No matching dishes found</h3>
                        <p className="mt-1 text-xs text-slate-500 max-w-sm">
                            We couldn't find any dish matching your search filters in "{selectedCategory}".
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('')
                                setSelectedCategory('All Menu')
                                setStockFilter('all')
                                setPriceFilter('all')
                            }}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                        >
                            Reset all filters
                        </button>
                    </div>
                ) : viewMode === 'table' ? (
                    /* ================= COMPACT TABLE VIEW ================= */
                    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                        <th scope="col" className="w-10 px-4 py-3.5 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedItemIds.size === filteredProducts.length && filteredProducts.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 min-w-[240px]">
                                            Dish & Description
                                        </th>
                                        <th scope="col" className="px-4 py-3.5">
                                            Category
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 min-w-[140px]">
                                            Selling Price
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 min-w-[150px]">
                                            Stock Availability
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 text-right min-w-[120px]">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {filteredProducts.map((item) => {
                                        const currentPrice = getEffectivePrice(item.id, item.price)
                                        const isCustom = currentPrice !== item.price
                                        const available = isAvailable(item.id)
                                        const isSelected = selectedItemIds.has(item.id)
                                        const isInlineEditing = inlineEditingId === item.id

                                        return (
                                            <tr
                                                key={item.id}
                                                className={`transition-colors hover:bg-slate-50/70 ${
                                                    isSelected ? 'bg-orange-50/30' : ''
                                                } ${!available ? 'opacity-80 bg-slate-50/30' : ''}`}
                                            >
                                                {/* Selection Checkbox */}
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectItem(item.id)}
                                                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                    />
                                                </td>

                                                {/* Dish Item Thumbnail & Name */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100">
                                                            <ProductImage
                                                                src={item.image}
                                                                fallbackSrc={item.bundledImage}
                                                                alt={item.name}
                                                                className={`h-full w-full object-cover ${!available ? 'grayscale contrast-125' : ''}`}
                                                            />
                                                            {!available && (
                                                                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                                                                    <span className="text-[8px] font-black text-white uppercase tracking-tighter bg-rose-600 px-1 py-0.2 rounded">
                                                                        86'd
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                                                                    {item.name}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 truncate max-w-sm">
                                                                {item.description || 'Special signature recipe cooked with house blend seasonings.'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Category Badge */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${getCategoryColor(item.category)}`}>
                                                        {item.category}
                                                    </span>
                                                </td>

                                                {/* Price / Inline Price Editor */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {isInlineEditing ? (
                                                        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                                                            <span className="font-extrabold text-orange-600 text-xs">₱</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                autoFocus
                                                                value={inlinePriceInput}
                                                                onChange={(e) => setInlinePriceInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleSaveInlinePrice(item)
                                                                    if (e.key === 'Escape') setInlineEditingId(null)
                                                                }}
                                                                className="w-20 rounded-lg border border-orange-400 bg-white px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-500/20"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveInlinePrice(item)}
                                                                title="Save Price"
                                                                className="rounded-lg bg-emerald-600 p-1 text-white hover:bg-emerald-700 transition cursor-pointer"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setInlineEditingId(null)}
                                                                title="Cancel"
                                                                className="rounded-lg bg-slate-200 p-1 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 group/price">
                                                            <span
                                                                onClick={() => {
                                                                    setInlineEditingId(item.id)
                                                                    setInlinePriceInput(String(currentPrice))
                                                                }}
                                                                title="Click to edit live price"
                                                                className="inline-flex items-center rounded-xl border border-orange-100 bg-orange-50/90 px-2.5 py-1 text-xs font-extrabold tabular-nums text-orange-700 hover:bg-orange-100/90 hover:border-orange-300 cursor-pointer transition"
                                                            >
                                                                ₱{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>

                                                            {isCustom && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResetInlinePrice(item)}
                                                                    title={`Reset to default base price (₱${item.price.toFixed(2)})`}
                                                                    className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 hover:bg-amber-100 cursor-pointer"
                                                                >
                                                                    Custom • Reset
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Stock Status Interactive Switch */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => void handleToggleStock(item, e)}
                                                        className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                                                            available
                                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                                                : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                                                        }`}
                                                        title={available ? 'Click to 86 / Mark Out of Stock' : 'Click to Set In Stock'}
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${available ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                        <span>{available ? 'In Stock' : 'Out of Stock (86)'}</span>
                                                    </button>
                                                </td>

                                                {/* Row Actions */}
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditModal(item)}
                                                            title="Edit product details, price, or photo"
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition cursor-pointer"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 2.651 2.651M5 19l4.2-.84L19.5 7.86a1.875 1.875 0 00-2.65-2.65L6.55 15.51 5 19z" />
                                                            </svg>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => setItemToDelete(item)}
                                                            title="Remove from menu"
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16m-10 4v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* ================= VISUAL GRID VIEW ================= */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                        {filteredProducts.map((item) => {
                            const currentPrice = getEffectivePrice(item.id, item.price)
                            const isCustom = currentPrice !== item.price
                            const available = isAvailable(item.id)

                            return (
                                <div
                                    key={item.id}
                                    className={`group flex flex-col overflow-hidden rounded-3xl border bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                                        !available
                                            ? 'border-rose-200 bg-rose-50/10'
                                            : 'border-slate-200/80 hover:border-orange-300'
                                    }`}
                                >
                                    {/* Food Image Container */}
                                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 flex-shrink-0">
                                        <ProductImage
                                            src={item.image}
                                            fallbackSrc={item.bundledImage}
                                            alt={item.name}
                                            className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${
                                                !available ? 'grayscale opacity-75' : ''
                                            }`}
                                        />

                                        {/* Category Badge Top-Left */}
                                        <span className={`absolute top-2.5 left-2.5 backdrop-blur-xs font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-md border shadow-2xs ${getCategoryColor(item.category)}`}>
                                            {item.category}
                                        </span>

                                        {/* Stock Availability Toggle Switch Top-Right */}
                                        <button
                                            type="button"
                                            onClick={(e) => void handleToggleStock(item, e)}
                                            title={available ? 'Click to mark Out of Stock' : 'Click to mark In Stock'}
                                            className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow-xs cursor-pointer transition ${
                                                available
                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                    : 'bg-rose-600 text-white hover:bg-rose-700'
                                            }`}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                            <span>{available ? 'In Stock' : '86’d'}</span>
                                        </button>
                                    </div>

                                    {/* Product Body */}
                                    <div className="flex flex-1 flex-col p-4 justify-between">
                                        <div>
                                            <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-orange-600 transition-colors leading-snug line-clamp-1">
                                                {item.name}
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                                                {item.description || 'Special signature seafood specialty cooked with house seasonings.'}
                                            </p>
                                        </div>

                                        {/* Price & Action Row */}
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                            <div>
                                                <span className="inline-flex items-center rounded-xl border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs sm:text-sm font-extrabold tabular-nums text-orange-700">
                                                    ₱{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                {isCustom && (
                                                    <p className="text-[10px] font-semibold text-amber-700 mt-0.5">
                                                        Base ₱{item.price.toFixed(2)}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(item)}
                                                    aria-label={`Edit ${item.name}`}
                                                    title="Edit details & pricing"
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition cursor-pointer"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 2.651 2.651M5 19l4.2-.84L19.5 7.86a1.875 1.875 0 00-2.65-2.65L6.55 15.51 5 19z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setItemToDelete(item)}
                                                    aria-label={`Remove ${item.name}`}
                                                    title="Remove from menu"
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16m-10 4v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {/* ================= MODAL: EDIT PRODUCT DETAILS & PRICING ================= */}
            {isEditModalOpen && editingItem && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={handleCloseEditModal}
                >
                    <div
                        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-7"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 border border-orange-100">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 2.651 2.651M5 19l4.2-.84L19.5 7.86a1.875 1.875 0 00-2.65-2.65L6.55 15.51 5 19z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Edit Dish Details</h2>
                                    <p className="text-xs text-slate-400">ID: {editingItem.id}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseEditModal}
                                disabled={isSavingEdit}
                                className="rounded-lg p-1 text-xl font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={(e) => void handleSaveEditProduct(e)} className="space-y-4">
                            {/* Dish Name */}
                            <div>
                                <label htmlFor="edit-name" className="mb-1.5 block text-xs font-bold text-slate-700">
                                    Dish Name
                                </label>
                                <input
                                    id="edit-name"
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    maxLength={255}
                                    required
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                />
                            </div>

                            {/* Category & Base Price */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="edit-category" className="mb-1.5 block text-xs font-bold text-slate-700">
                                        Category
                                    </label>
                                    <select
                                        id="edit-category"
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                    >
                                        {CLIENT_CATEGORIES.filter((c) => c !== 'All Menu').map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="edit-base-price" className="mb-1.5 block text-xs font-bold text-slate-700">
                                        Catalog Base Price (₱)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-2.5 text-sm font-bold text-orange-600">₱</span>
                                        <input
                                            id="edit-base-price"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editBasePrice}
                                            onChange={(e) => setEditBasePrice(e.target.value)}
                                            required
                                            className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Live POS Price Override Section */}
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="edit-pos-price" className="text-xs font-bold text-amber-900">
                                        Live POS Selling Rate Override (₱)
                                    </label>
                                    {getEffectivePrice(editingItem.id, editingItem.price) !== editingItem.price && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                resetPrice(editingItem.id)
                                                setEditPosPrice(editBasePrice)
                                            }}
                                            className="text-[10px] font-extrabold text-amber-800 underline hover:text-amber-900 cursor-pointer"
                                        >
                                            Reset to Base Price
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-2.5 text-sm font-bold text-amber-700">₱</span>
                                    <input
                                        id="edit-pos-price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editPosPrice}
                                        onChange={(e) => setEditPosPrice(e.target.value)}
                                        className="w-full rounded-xl border border-amber-300 bg-white py-2.5 pl-8 pr-3.5 text-sm font-black text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                    />
                                </div>
                                <p className="text-[11px] text-amber-700 leading-relaxed">
                                    Adjusting this price updates the price on counter POS, tablets, and customer menus immediately.
                                </p>
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="edit-desc" className="mb-1.5 block text-xs font-bold text-slate-700">
                                    Description
                                </label>
                                <textarea
                                    id="edit-desc"
                                    rows={2}
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    maxLength={2000}
                                    placeholder="Brief customer-facing description of the dish."
                                    className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                />
                            </div>

                            {/* Dish Photo Section */}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-800">Product Photography</label>
                                    <span className="text-[10px] text-slate-400">JPEG, PNG, WebP • Max 5 MB</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                        <ProductImage
                                            src={editImagePreview || editingItem.image}
                                            fallbackSrc={editingItem.bundledImage}
                                            alt={editingItem.name}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="text-xs font-bold text-slate-800 truncate">
                                            {editImageFile ? editImageFile.name : 'Current photo in use'}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => editFileInputRef.current?.click()}
                                                className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                            >
                                                Change photo…
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleRestoreDefaultPhoto()}
                                                className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                            >
                                                Restore bundled default
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <input
                                    ref={editFileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => handleSelectEditFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </div>

                            {editError && (
                                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                                    {editError}
                                </p>
                            )}

                            {/* Modal Action Buttons */}
                            <div className="flex gap-2.5 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseEditModal}
                                    disabled={isSavingEdit}
                                    className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="flex-1 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 transition cursor-pointer disabled:opacity-60"
                                >
                                    {isSavingEdit ? 'Saving Changes…' : 'Save Dish Details'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================= MODAL: ADD A PRODUCT ================= */}
            {isAddProductOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={handleCloseAddProduct}
                >
                    <div
                        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-7"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Add New Dish</h2>
                                    <p className="mt-0.5 text-xs text-slate-500">Create a dish for menu catalog and POS.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseAddProduct}
                                disabled={isSavingProduct}
                                className="rounded-lg p-1 text-xl font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={(event) => void handleCreateProduct(event)} className="space-y-4">
                            <div>
                                <label htmlFor="new-product-name" className="mb-1.5 block text-xs font-bold text-slate-700">
                                    Product Name
                                </label>
                                <input
                                    id="new-product-name"
                                    type="text"
                                    value={newProductName}
                                    onChange={(event) => setNewProductName(event.target.value)}
                                    maxLength={255}
                                    autoFocus
                                    required
                                    placeholder="e.g. Cajun Butter Blue Crab"
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="new-product-category" className="mb-1.5 block text-xs font-bold text-slate-700">
                                        Category
                                    </label>
                                    <select
                                        id="new-product-category"
                                        value={newProductCategory}
                                        onChange={(event) => setNewProductCategory(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                    >
                                        {CLIENT_CATEGORIES.filter((category) => category !== 'All Menu').map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="new-product-price" className="mb-1.5 block text-xs font-bold text-slate-700">
                                        Selling Price (₱)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-2.5 text-sm font-bold text-orange-600">₱</span>
                                        <input
                                            id="new-product-price"
                                            type="number"
                                            min="0"
                                            max="99999999.99"
                                            step="0.01"
                                            value={newProductPrice}
                                            onChange={(event) => setNewProductPrice(event.target.value)}
                                            required
                                            placeholder="0.00"
                                            className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Product Photo Upload */}
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700">
                                        Product Photo <span className="font-normal text-slate-400">(optional)</span>
                                    </label>
                                    <span className="text-[11px] font-medium text-slate-400">
                                        JPEG, PNG, WebP • Max 5 MB
                                    </span>
                                </div>

                                <input
                                    ref={newProductFileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] || null
                                        handleSelectNewProductFile(file)
                                    }}
                                    className="hidden"
                                    disabled={isSavingProduct}
                                />

                                {!newProductImagePreview ? (
                                    <div
                                        onClick={() => !isSavingProduct && newProductFileInputRef.current?.click()}
                                        onDragOver={(e) => {
                                            e.preventDefault()
                                            setIsDraggingNewImage(true)
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault()
                                            setIsDraggingNewImage(false)
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            setIsDraggingNewImage(false)
                                            const file = e.dataTransfer.files?.[0] || null
                                            if (file) handleSelectNewProductFile(file)
                                        }}
                                        className={`flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-dashed p-3.5 transition-all duration-200 ${
                                            isDraggingNewImage
                                                ? 'border-orange-500 bg-orange-50/60'
                                                : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/20'
                                        }`}
                                    >
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-700">Click to upload or drag photo here</p>
                                            <p className="text-[11px] text-slate-400">Crisp photo shown on POS and online menu</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3.5 rounded-2xl border border-orange-200 bg-orange-50/40 p-3 shadow-2xs">
                                        <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl border border-orange-200 bg-white">
                                            <img
                                                src={newProductImagePreview}
                                                alt="New preview"
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-bold text-slate-800">
                                                {newProductImageFile?.name}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {newProductImageFile ? (newProductImageFile.size / (1024 * 1024)).toFixed(2) : '0'} MB
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={clearNewProductImage}
                                            disabled={isSavingProduct}
                                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}

                                {newProductImageError && (
                                    <p className="mt-1.5 text-xs font-bold text-rose-600">{newProductImageError}</p>
                                )}
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="new-product-description" className="mb-1.5 block text-xs font-bold text-slate-700">
                                    Description <span className="font-normal text-slate-400">(optional)</span>
                                </label>
                                <textarea
                                    id="new-product-description"
                                    value={newProductDescription}
                                    onChange={(event) => setNewProductDescription(event.target.value)}
                                    maxLength={2000}
                                    rows={2}
                                    placeholder="Describe the recipe, portion, or flavor notes."
                                    className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                                />
                            </div>

                            {productFormError && (
                                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                                    {productFormError}
                                </p>
                            )}

                            <div className="flex gap-2.5 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseAddProduct}
                                    disabled={isSavingProduct}
                                    className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingProduct}
                                    className="flex-1 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 transition cursor-pointer disabled:opacity-60"
                                >
                                    {isSavingProduct ? 'Adding Dish…' : 'Add to Menu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================= MODAL: CONFIRM DELETE PRODUCT ================= */}
            {itemToDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
                    onClick={() => !isDeleting && setItemToDelete(null)}
                >
                    <div
                        className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3.5 text-rose-600 mb-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">Remove from Menu?</h3>
                                <p className="text-xs text-slate-500">This dish will be archived from active ordering.</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 mb-5 flex items-center gap-3">
                            <div className="h-12 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <ProductImage
                                    src={itemToDelete.image}
                                    fallbackSrc={itemToDelete.bundledImage}
                                    alt={itemToDelete.name}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">{itemToDelete.name}</p>
                                <p className="text-[11px] text-slate-500">
                                    {itemToDelete.category} • ₱{itemToDelete.price.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                            Past orders and historical sales reports will not be altered. The item will no longer appear on POS terminals or online customer checkout.
                        </p>

                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => setItemToDelete(null)}
                                disabled={isDeleting}
                                className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleConfirmDelete()}
                                disabled={isDeleting}
                                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-60"
                            >
                                {isDeleting ? 'Removing…' : 'Remove Dish'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminMenuManagement
