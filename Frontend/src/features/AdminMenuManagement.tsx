import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavbarAdmin } from '../components/NavbarAdmin'
import { ProductImage } from '../components/ProductImage'
import { CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { useMenuPrices } from '../utils/menuPriceManager'
import { useProductImages, setCachedProductImage } from '../utils/useProductImages'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { notifyProductCatalogSync, subscribeProductCatalogSync } from '../utils/orderSync'

export const AdminMenuManagement: React.FC = () => {
    const navigate = useNavigate()
    const { getEffectivePrice, updatePrice, resetPrice } = useMenuPrices()
    const { menuItems, refresh: refreshProductImages } = useProductImages()

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Menu')
    const [catalogFeedback, setCatalogFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    // Edit Product & Price Modal State
    const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null)
    const [isPriceEditOpen, setIsPriceEditOpen] = useState(false)
    const [newPriceInput, setNewPriceInput] = useState<number | string>('')
    const [priceUpdateSuccess, setPriceUpdateSuccess] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [imageFeedback, setImageFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [isSavingImage, setIsSavingImage] = useState(false)
    const imagePreviewRef = useRef<string | null>(null)

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

    // Clean up object URLs
    useEffect(() => () => {
        if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current)
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

    // Filtered Products
    const filteredProducts = useMemo(() => {
        return menuItems.filter((item) => {
            const matchesSearch =
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
            const normSelected = selectedCategory.toLowerCase().replace(/[^a-z0-9]/g, '')
            const normItemCat = (item.category || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            const matchesCategory =
                selectedCategory === 'All Menu' || normItemCat === normSelected
            return matchesSearch && matchesCategory
        })
    }, [menuItems, searchQuery, selectedCategory])

    // Category Counts
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { 'All Menu': menuItems.length }
        menuItems.forEach((item) => {
            const cat = item.category || 'Other'
            counts[cat] = (counts[cat] || 0) + 1
        })
        return counts
    }, [menuItems])

    // Handlers: Product Selection & Modal
    const clearProductImageSelection = () => {
        if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current)
        imagePreviewRef.current = null
        setImagePreview(null)
        setImageFile(null)
        setImageFeedback(null)
    }

    const handleCloseProductModal = () => {
        clearProductImageSelection()
        setIsPriceEditOpen(false)
        setSelectedProduct(null)
    }

    const handleSelectProduct = (item: MenuItem) => {
        clearProductImageSelection()
        setSelectedProduct(item)
        setNewPriceInput(getEffectivePrice(item.id, item.price))
        setIsPriceEditOpen(true)
        setPriceUpdateSuccess(false)
    }

    // Handlers: Add Product Form
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

            // If a photo was selected, upload it immediately
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
                    ? `"${name}" was added to the menu with photo.`
                    : `"${name}" was added to the menu.`,
            })
        } catch (error) {
            setProductFormError(error instanceof Error ? error.message : 'Could not add this product.')
        } finally {
            setIsSavingProduct(false)
        }
    }

    const handleDeleteProduct = async (item: MenuItem) => {
        const confirmed = window.confirm(
            `Remove "${item.name}" from the menu? It will no longer be available for new orders. Past orders will be kept.`
        )
        if (!confirmed) return

        setCatalogFeedback(null)
        try {
            const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(item.id)}`, {
                method: 'DELETE',
                headers: await getAuthHeaders(),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.message || 'Could not remove this product.')

            resetPrice(item.id)
            await refreshProductImages()
            notifyProductCatalogSync({
                action: 'DELETE',
                productId: item.id,
                productName: item.name,
            })
            setCatalogFeedback({ type: 'success', message: `"${item.name}" was removed from the menu.` })
        } catch (error) {
            setCatalogFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Could not remove this product.',
            })
        }
    }

    const handleSavePrice = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProduct) return
        const val = Number(newPriceInput)
        if (isNaN(val) || val <= 0) {
            alert('Please provide a valid price greater than 0.')
            return
        }
        updatePrice(selectedProduct.id, val)
        setPriceUpdateSuccess(true)
        setTimeout(() => {
            setPriceUpdateSuccess(false)
            handleCloseProductModal()
        }, 800)
    }

    const handleResetToDefault = () => {
        if (!selectedProduct) return
        resetPrice(selectedProduct.id)
        setNewPriceInput(selectedProduct.price)
        setPriceUpdateSuccess(true)
        setTimeout(() => {
            setPriceUpdateSuccess(false)
            handleCloseProductModal()
        }, 800)
    }

    const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null
        event.target.value = ''
        setImageFeedback(null)
        clearProductImageSelection()
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setImageFeedback({ type: 'error', message: 'Choose a JPEG, PNG, or WebP image.' })
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageFeedback({ type: 'error', message: 'Image must be 5 MB or smaller.' })
            return
        }
        const objectUrl = URL.createObjectURL(file)
        imagePreviewRef.current = objectUrl
        setImagePreview(objectUrl)
        setImageFile(file)
    }

    const handleSaveProductImage = async () => {
        if (!selectedProduct || !imageFile || isSavingImage) return
        setIsSavingImage(true)
        setImageFeedback(null)
        try {
            const headers = await getAuthHeaders({}, { jsonContentType: false })
            const body = new FormData()
            body.append('image', imageFile)
            const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(selectedProduct.id)}/image`, {
                method: 'POST',
                headers,
                body,
            })
            const payload = await response.json()
            if (!response.ok || !payload?.data?.image) {
                throw new Error(payload?.message || 'Could not upload product photo.')
            }
            setCachedProductImage(selectedProduct.id, payload.data.image)
            setSelectedProduct((current) => current ? { ...current, image: payload.data.image } : current)
            clearProductImageSelection()
            await refreshProductImages()
            setImageFeedback({
                type: 'success',
                message: payload.oldImageCleanupPending
                    ? 'Photo updated. The previous storage file needs cleanup.'
                    : 'Product photo updated.',
            })
        } catch (error) {
            setImageFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Could not upload product photo.',
            })
        } finally {
            setIsSavingImage(false)
        }
    }

    const handleRestoreProductImage = async () => {
        if (!selectedProduct || isSavingImage) return
        setIsSavingImage(true)
        setImageFeedback(null)
        try {
            const headers = await getAuthHeaders()
            const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(selectedProduct.id)}/image`, {
                method: 'DELETE',
                headers,
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.message || 'Could not restore the bundled photo.')
            setCachedProductImage(selectedProduct.id, null)
            setSelectedProduct((current) => current
                ? { ...current, image: current.bundledImage || current.image }
                : current)
            clearProductImageSelection()
            await refreshProductImages()
            setImageFeedback({
                type: 'success',
                message: payload.cleanupPending
                    ? 'Bundled photo restored. The old storage file needs cleanup.'
                    : 'Bundled photo restored.',
            })
        } catch (error) {
            setImageFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Could not restore the bundled photo.',
            })
        } finally {
            setIsSavingImage(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 font-sans space-y-6 max-w-7xl mx-auto">
            <NavbarAdmin />

            {/* Breadcrumb & Navigation */}
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
            </div>

            {/* Header Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
                            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M5.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 17.25V6.75A2.25 2.25 0 015.25 4.5zM8 12h3m-3 3h8" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">Menu Management</p>
                            <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Products & pricing</h1>
                            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
                                Manage food items, live POS prices, photos, and categories across customer ordering, POS terminals, and kitchen displays.
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                resetAddProductForm()
                                setIsAddProductOpen(true)
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 cursor-pointer"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                            </svg>
                            Add product
                        </button>
                    </div>
                </div>

                {/* Feedback banner */}
                {catalogFeedback && (
                    <div
                        role="status"
                        className={`mt-5 flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-semibold ${
                            catalogFeedback.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                    >
                        <span>{catalogFeedback.message}</span>
                        <button
                            type="button"
                            onClick={() => setCatalogFeedback(null)}
                            className="ml-3 text-sm font-bold opacity-70 hover:opacity-100 cursor-pointer"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {/* Search Bar & Category Filter */}
                <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
                    {/* Search Input */}
                    <div>
                        <label htmlFor="admin-product-search" className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                            Find a product
                        </label>
                        <div className="relative max-w-2xl">
                            <svg className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                id="admin-product-search"
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder='Try "shrimp" or "drinks"'
                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-sm font-medium text-slate-800 placeholder-slate-400 shadow-2xs outline-none transition-all duration-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="block text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                                Browse category
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                                {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {CLIENT_CATEGORIES.map((cat) => {
                                const isSelected = selectedCategory === cat
                                const count = categoryCounts[cat] || 0
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        aria-pressed={isSelected}
                                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer ${
                                            isSelected
                                                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                                                : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/50'
                                        }`}
                                    >
                                        {cat}
                                        <span className={`ml-1.5 text-[10px] font-extrabold ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
                                            ({count})
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Grid: 4 items per row on desktop */}
            {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 mb-4">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <h3 className="text-base font-black text-slate-800">No products found</h3>
                    <p className="mt-1 text-xs text-slate-400 max-w-sm">
                        We couldn't find any dish matching "{searchQuery}" in category "{selectedCategory}".
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setSearchQuery('')
                            setSelectedCategory('All Menu')
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                        Reset filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredProducts.map((item) => {
                        const currentPrice = getEffectivePrice(item.id, item.price)
                        const isCustom = currentPrice !== item.price
                        return (
                            <div
                                key={item.id}
                                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
                            >
                                {/* Food Image Container - aspect-[16/10] matching customer menu */}
                                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 flex-shrink-0">
                                    <ProductImage
                                        src={item.image}
                                        fallbackSrc={item.bundledImage}
                                        alt={item.name}
                                        className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                                    />
                                    {/* Category Pill Tag */}
                                    <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs text-neutral-800 font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-md border border-neutral-200/60 shadow-2xs">
                                        {item.category}
                                    </span>

                                    {/* Custom Price Indicator */}
                                    {isCustom && (
                                        <span className="absolute top-2.5 right-2.5 bg-amber-500 text-white font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">
                                            Custom Price
                                        </span>
                                    )}
                                </div>

                                {/* Product Body */}
                                <div className="flex flex-1 flex-col p-4 justify-between">
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 group-hover:text-orange-600 transition-colors leading-snug line-clamp-1">
                                            {item.name}
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                                            {item.description || 'Signature seafood specialty cooked with special house seasonings.'}
                                        </p>
                                    </div>

                                    {/* Price & Action Row */}
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                        <div>
                                            <span className="inline-flex items-center rounded-xl border border-orange-100 bg-orange-50 px-2.5 py-1 text-sm font-extrabold tabular-nums text-orange-700">
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
                                                onClick={() => handleSelectProduct(item)}
                                                aria-label={`Edit ${item.name} product & price`}
                                                title="Edit price & details"
                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 cursor-pointer"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 2.651 2.651M5 19l4.2-.84L19.5 7.86a1.875 1.875 0 00-2.65-2.65L6.55 15.51 5 19z" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleDeleteProduct(item)}
                                                aria-label={`Remove ${item.name} from menu`}
                                                title="Remove from menu"
                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
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

            {/* Modal: Add a Product */}
            {isAddProductOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={handleCloseAddProduct}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-7"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 id="add-product-title" className="text-lg font-black text-slate-900">Add a product</h2>
                                    <p className="mt-0.5 text-xs text-slate-500">Add a new item to the menu and POS.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseAddProduct}
                                disabled={isSavingProduct}
                                aria-label="Close add product form"
                                className="rounded-lg p-1 text-xl font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={(event) => void handleCreateProduct(event)} className="space-y-4">
                            <div>
                                <label htmlFor="new-product-name" className="mb-1.5 block text-xs font-bold text-slate-700">Product name</label>
                                <input
                                    id="new-product-name"
                                    type="text"
                                    value={newProductName}
                                    onChange={(event) => setNewProductName(event.target.value)}
                                    maxLength={255}
                                    autoFocus
                                    required
                                    placeholder="e.g. Garlic Butter Crab"
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="new-product-category" className="mb-1.5 block text-xs font-bold text-slate-700">Category</label>
                                    <select
                                        id="new-product-category"
                                        value={newProductCategory}
                                        onChange={(event) => setNewProductCategory(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                                    >
                                        {CLIENT_CATEGORIES.filter((category) => category !== 'All Menu').map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="new-product-price" className="mb-1.5 block text-xs font-bold text-slate-700">Selling price</label>
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
                                            className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3.5 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700">
                                        Product photo <span className="font-medium text-slate-400">(optional)</span>
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
                                            e.stopPropagation()
                                            setIsDraggingNewImage(true)
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setIsDraggingNewImage(false)
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setIsDraggingNewImage(false)
                                            const file = e.dataTransfer.files?.[0] || null
                                            if (file) handleSelectNewProductFile(file)
                                        }}
                                        className={`group flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-dashed p-3.5 transition-all duration-200 ${
                                            isDraggingNewImage
                                                ? 'border-orange-500 bg-orange-50/80 ring-4 ring-orange-500/10 scale-[1.01]'
                                                : 'border-slate-200 bg-slate-50/60 hover:border-orange-400 hover:bg-orange-50/30'
                                        }`}
                                    >
                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-100/70 text-orange-600 transition-transform duration-200 group-hover:scale-105">
                                            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-800 transition-colors group-hover:text-orange-600">
                                                Click to upload photo <span className="font-normal text-slate-400">or drag & drop</span>
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-slate-400">
                                                This photo will be displayed on POS, customer menu, and KDS.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                newProductFileInputRef.current?.click()
                                            }}
                                            disabled={isSavingProduct}
                                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                                        >
                                            Browse
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3.5 rounded-2xl border border-orange-200 bg-orange-50/40 p-3 shadow-2xs">
                                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-2xs">
                                            <img
                                                src={newProductImagePreview}
                                                alt="New product preview"
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                Ready for menu
                                            </span>
                                            <p className="mt-1 truncate text-xs font-bold text-slate-800">
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
                                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}

                                {newProductImageError && (
                                    <p className="mt-1.5 text-xs font-semibold text-rose-600">{newProductImageError}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="new-product-description" className="mb-1.5 block text-xs font-bold text-slate-700">
                                    Description <span className="font-medium text-slate-400">(optional)</span>
                                </label>
                                <textarea
                                    id="new-product-description"
                                    value={newProductDescription}
                                    onChange={(event) => setNewProductDescription(event.target.value)}
                                    maxLength={2000}
                                    rows={3}
                                    placeholder="Describe the product for your menu."
                                    className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                                />
                            </div>

                            {productFormError && (
                                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                                    {productFormError}
                                </p>
                            )}

                            <div className="flex gap-2 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseAddProduct}
                                    disabled={isSavingProduct}
                                    className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingProduct}
                                    className="flex-1 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                >
                                    {isSavingProduct
                                        ? (newProductImageFile ? 'Adding product & photo…' : 'Adding product…')
                                        : 'Add product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Interactive Product Details & Live Price Editor */}
            {isPriceEditOpen && selectedProduct && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={handleCloseProductModal}
                >
                    <div
                        className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 overflow-hidden flex items-center justify-center">
                                    <ProductImage
                                        src={selectedProduct.image}
                                        fallbackSrc={selectedProduct.bundledImage}
                                        alt={selectedProduct.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest">
                                        {selectedProduct.category}
                                    </span>
                                    <h3 className="text-base font-black text-slate-800 leading-tight">
                                        {selectedProduct.name}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">ID: {selectedProduct.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseProductModal}
                                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                            <p className="font-bold text-slate-700 mb-1">Item Description:</p>
                            {selectedProduct.description || 'Signature seafood specialty cooked with special house seasonings.'}
                        </div>

                        {/* Photo Management Section */}
                        <section className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-3">
                            <div className="flex items-center gap-3">
                                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-white border border-orange-100">
                                    <ProductImage
                                        src={imagePreview || selectedProduct.image}
                                        fallbackSrc={selectedProduct.bundledImage}
                                        alt={`${selectedProduct.name} preview`}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800">Product photo</p>
                                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                        JPEG, PNG, or WebP. Maximum 5 MB.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleImageSelection}
                                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-bold file:text-orange-700 hover:file:bg-orange-100"
                                disabled={isSavingImage}
                            />
                            {imageFile && (
                                <p className="truncate text-[11px] text-slate-500">{imageFile.name}</p>
                            )}
                            {imageFeedback && (
                                <p
                                    role="status"
                                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                                        imageFeedback.type === 'success'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-rose-50 text-rose-700'
                                    }`}
                                >
                                    {imageFeedback.message}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => void handleSaveProductImage()}
                                    disabled={!imageFile || isSavingImage}
                                    className="flex-1 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingImage ? 'Saving photo…' : 'Upload photo'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleRestoreProductImage()}
                                    disabled={isSavingImage || selectedProduct.image === selectedProduct.bundledImage}
                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                >
                                    Restore default
                                </button>
                            </div>
                        </section>

                        {priceUpdateSuccess && (
                            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-200 text-xs font-bold text-center animate-in fade-in">
                                Price updated successfully across all POS systems!
                            </div>
                        )}

                        <form onSubmit={handleSavePrice} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Edit Store Selling Price (₱)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-2.5 font-bold text-orange-600 text-sm">₱</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={newPriceInput}
                                        onChange={(e) => setNewPriceInput(e.target.value)}
                                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white font-extrabold text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                                        required
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                                    <span>Default Base Price: ₱{Number(selectedProduct.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    {getEffectivePrice(selectedProduct.id, selectedProduct.price) !== selectedProduct.price && (
                                        <button
                                            type="button"
                                            onClick={handleResetToDefault}
                                            className="text-orange-600 hover:underline font-bold cursor-pointer"
                                        >
                                            Reset to Default
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleCloseProductModal}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 hover:scale-[1.02] transition-transform cursor-pointer"
                                >
                                    Save New Price
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminMenuManagement
