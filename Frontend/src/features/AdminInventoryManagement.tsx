import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import NavbarAdmin from '../components/NavbarAdmin'
import type {
  Ingredient,
  ProductRecipe,
  Supplier,
  PurchaseOrder,
  StockTransaction,
  MeasurementUnit,
  StockStatus,
} from './inventory/inventoryTypes'
import InventoryDashboardTab from './inventory/InventoryDashboardTab'
import IngredientsTab from './inventory/IngredientsTab'
import RecipesBOMTab from './inventory/RecipesBOMTab'
import SuppliersTab from './inventory/SuppliersTab'
import PurchasesReceivingTab from './inventory/PurchasesReceivingTab'
import StockHistoryTab from './inventory/StockHistoryTab'
import InventoryReportsTab from './inventory/InventoryReportsTab'
import InventoryToast, { type ToastMessage } from './inventory/InventoryToast'
import { CLIENT_MENU_ITEMS } from '../components/MenuCard'
import './inventory/admin-inventory.css'

// Demo sample data (Only activated when user clicks "Load Sample Demo Data" toggle)
const SAMPLE_INGREDIENTS: Ingredient[] = [
  // --- Food Ingredients ---
  {
    id: 'ing-001',
    name: 'Fresh White Shrimp (Large)',
    sku: 'ING-SHR-01',
    itemType: 'FOOD',
    category: 'Seafoods',
    baseUnit: 'g',
    currentStock: 8500,
    minStockLevel: 2500,
    preferredRestockQty: 10000,
    costPerUnit: 0.45,
    supplierId: 'sup-001',
    supplierName: 'Navotas Seafood Port Distributors',
    storageNotes: 'Keep in walk-in freezer at -18°C. Thaw in cold running water.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-002',
    name: 'Garlic Cloves (Peeled)',
    sku: 'ING-GAR-02',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 1200,
    minStockLevel: 1500,
    preferredRestockQty: 3000,
    costPerUnit: 0.18,
    supplierId: 'sup-002',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Chiller storage at 4°C.',
    status: 'LOW_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-003',
    name: 'Pure Butter Blend',
    sku: 'ING-BUT-03',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'g',
    currentStock: 4200,
    minStockLevel: 1000,
    preferredRestockQty: 5000,
    costPerUnit: 0.28,
    supplierId: 'sup-003',
    supplierName: 'Golden Dairy & Oil Trading',
    storageNotes: 'Refrigerate at 2°C to 5°C.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-004',
    name: 'Jasmine Rice (Dinorado)',
    sku: 'ING-RIC-04',
    itemType: 'FOOD',
    category: 'Grains & Noodles',
    baseUnit: 'g',
    currentStock: 35000,
    minStockLevel: 10000,
    preferredRestockQty: 50000,
    costPerUnit: 0.055,
    supplierId: 'sup-002',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Dry storage in sealed food-grade bins.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-005',
    name: 'Cajun Seasoning Spice Mix',
    sku: 'ING-SPICE-05',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 0,
    minStockLevel: 800,
    preferredRestockQty: 2500,
    costPerUnit: 0.65,
    supplierId: 'sup-003',
    supplierName: 'Golden Dairy & Oil Trading',
    storageNotes: 'Cool dry shelf, keep away from humidity.',
    status: 'OUT_OF_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --- Packaging Materials ---
  {
    id: 'pkg-001',
    name: '3-Compartment Bento Food Tray (Microwaveable)',
    sku: 'PKG-TRY-01',
    itemType: 'PACKAGING',
    category: 'Trays, Bowls & Containers',
    baseUnit: 'pcs',
    currentStock: 450,
    minStockLevel: 150,
    preferredRestockQty: 500,
    costPerUnit: 6.5,
    supplierId: 'sup-004',
    supplierName: 'Metro Pack & Green Disposables',
    storageNotes: 'Dry packaging storage shelf B2. Carton packs of 50.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-002',
    name: 'Heavy Duty Takeout Carrier Plastic Bag (Medium)',
    sku: 'PKG-BAG-02',
    itemType: 'PACKAGING',
    category: 'Bags, Pouches & Carriers',
    baseUnit: 'pcs',
    currentStock: 80,
    minStockLevel: 120,
    preferredRestockQty: 400,
    costPerUnit: 1.2,
    supplierId: 'sup-004',
    supplierName: 'Metro Pack & Green Disposables',
    storageNotes: 'Kept in clean dry delivery supply drawer.',
    status: 'LOW_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-003',
    name: 'Individually Wrapped Spoon & Fork Set w/ Napkin',
    sku: 'PKG-CUT-03',
    itemType: 'PACKAGING',
    category: 'Cutlery, Napkins & Packets',
    baseUnit: 'pcs',
    currentStock: 600,
    minStockLevel: 200,
    preferredRestockQty: 1000,
    costPerUnit: 2.2,
    supplierId: 'sup-004',
    supplierName: 'Metro Pack & Green Disposables',
    storageNotes: 'Store in dry cabinet near dispatch counter.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-004',
    name: 'Seafudz Branded Tamper-Evident Sealing Stickers',
    sku: 'PKG-STK-04',
    itemType: 'PACKAGING',
    category: 'Labels & Sealing Stickers',
    baseUnit: 'pcs',
    currentStock: 0,
    minStockLevel: 250,
    preferredRestockQty: 1000,
    costPerUnit: 0.85,
    supplierId: 'sup-004',
    supplierName: 'Metro Pack & Green Disposables',
    storageNotes: 'Dry shelf. Keep away from humidity and heat.',
    status: 'OUT_OF_STOCK',
    updatedAt: new Date().toISOString(),
  },
]

const SAMPLE_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-001',
    name: 'Navotas Seafood Port Distributors',
    contactPerson: 'Mang Rogelio Tan',
    contactNumber: '0917 888 1234',
    email: 'navotasseafood@ph.example.com',
    address: 'Stall 18, Navotas Fish Port Complex, Navotas City',
    categoriesSupplied: ['Seafoods'],
    leadTimeDays: 1,
    notes: 'Daily early morning delivery (5:00 AM – 7:00 AM)',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sup-002',
    name: 'Balintawak Central Wholesale Produce',
    contactPerson: 'Aling Susan Ramos',
    contactNumber: '0922 456 7890',
    email: 'balintawak.wholesale@ph.example.com',
    address: 'Block 4, Balintawak Cloverleaf Market, Quezon City',
    categoriesSupplied: ['Vegetables & Produce', 'Grains & Noodles'],
    leadTimeDays: 2,
    notes: 'Vegetables and rice bulk wholesale',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sup-003',
    name: 'Golden Dairy & Oil Trading',
    contactPerson: 'Eric Villafuerte',
    contactNumber: '0918 333 9988',
    email: 'orders@goldendairy.ph',
    address: '14 Industrial Road, Valenzuela City',
    categoriesSupplied: ['Dairy & Fats', 'Seasonings & Sauces'],
    leadTimeDays: 3,
    notes: 'Butter, cooking oils, and imported seasonings',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sup-004',
    name: 'Metro Pack & Green Disposables',
    contactPerson: 'Cynthia Santos',
    contactNumber: '0917 555 4321',
    email: 'cynthia@metropack.ph',
    address: '88 C3 Road, Caloocan City',
    categoriesSupplied: [
      'Trays, Bowls & Containers',
      'Bags, Pouches & Carriers',
      'Cutlery, Napkins & Packets',
      'Labels & Sealing Stickers',
    ],
    leadTimeDays: 2,
    notes: 'Primary supplier for food trays, takeout carrier bags, and cutlery sets',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
]

export const AdminInventoryManagement: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Active Tab: dashboard, ingredients, recipes, suppliers, purchases, history, reports
  const currentTab = searchParams.get('tab') || 'dashboard'

  // Application Data States (Default: 100% clean empty states as requested)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<ProductRecipe[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [isDemoDataLoaded, setIsDemoDataLoaded] = useState(false)

  // Toast Notification System
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { ...toast, id }])
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Handle Tab Switch
  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId })
  }

  // Toggle Demo Data vs Clean Blank State
  const toggleDemoData = () => {
    if (!isDemoDataLoaded) {
      setIngredients(SAMPLE_INGREDIENTS)
      setSuppliers(SAMPLE_SUPPLIERS)
      setRecipes([
        {
          productId: CLIENT_MENU_ITEMS[0]?.id || 'all-shrimp-alacarte-199',
          productName: 'All Shrimp Alacarte',
          productCategory: 'Seafoods',
          productPrice: 199,
          productImage: CLIENT_MENU_ITEMS[0]?.image,
          yieldServings: 1,
          ingredients: [
            {
              ingredientId: 'ing-001',
              ingredientName: 'Fresh White Shrimp (Large)',
              portionQuantity: 150,
              unit: 'g',
              estimatedCost: 67.5,
            },
            {
              ingredientId: 'ing-002',
              ingredientName: 'Garlic Cloves (Peeled)',
              portionQuantity: 15,
              unit: 'g',
              estimatedCost: 2.7,
            },
            {
              ingredientId: 'ing-003',
              ingredientName: 'Pure Butter Blend',
              portionQuantity: 20,
              unit: 'g',
              estimatedCost: 5.6,
            },
          ],
          packagingRequirements: [
            {
              id: 'pkg-req-1',
              packagingId: 'pkg-001',
              packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
              category: 'Trays, Bowls & Containers',
              quantity: 1,
              unit: 'pcs',
              fulfillmentType: 'TAKEOUT',
              scope: 'PER_ITEM',
              estimatedCost: 6.5,
            },
            {
              id: 'pkg-req-2',
              packagingId: 'pkg-002',
              packagingName: 'Heavy Duty Takeout Carrier Plastic Bag (Medium)',
              category: 'Bags, Pouches & Carriers',
              quantity: 1,
              unit: 'pcs',
              fulfillmentType: 'TAKEOUT',
              scope: 'SHARED_ORDER',
              sharedCapacity: 3,
              estimatedCost: 0.4,
            },
            {
              id: 'pkg-req-3',
              packagingId: 'pkg-003',
              packagingName: 'Individually Wrapped Spoon & Fork Set w/ Napkin',
              category: 'Cutlery, Napkins & Packets',
              quantity: 1,
              unit: 'pcs',
              fulfillmentType: 'TAKEOUT',
              scope: 'PER_ITEM',
              estimatedCost: 2.2,
            },
          ],
          preparationInstructions:
            'Sauté garlic and butter until golden, add shrimp on high heat for 3 mins. For takeout, pack inside 3-compartment bento tray and bundle with cutlery set.',
          totalFoodCost: 75.8,
          totalPackagingCost: 9.1,
          totalRawCost: 84.9,
          grossMarginPercent: 57,
          isConfigured: true,
          updatedAt: new Date().toISOString(),
        },
        {
          productId: CLIENT_MENU_ITEMS[1]?.id || 'all-shrimp-bowl-699',
          productName: 'All Shrimp Bowl',
          productCategory: 'Seafoods',
          productPrice: 699,
          productImage: CLIENT_MENU_ITEMS[1]?.image,
          yieldServings: 1,
          ingredients: [
            {
              ingredientId: 'ing-001',
              ingredientName: 'Fresh White Shrimp (Large)',
              portionQuantity: 350,
              unit: 'g',
              estimatedCost: 157.5,
            },
            {
              ingredientId: 'ing-002',
              ingredientName: 'Garlic Cloves (Peeled)',
              portionQuantity: 25,
              unit: 'g',
              estimatedCost: 4.5,
            },
            {
              ingredientId: 'ing-003',
              ingredientName: 'Pure Butter Blend',
              portionQuantity: 35,
              unit: 'g',
              estimatedCost: 9.8,
            },
            {
              ingredientId: 'ing-004',
              ingredientName: 'Jasmine Rice (Dinorado)',
              portionQuantity: 200,
              unit: 'g',
              estimatedCost: 11.0,
            },
          ],
          packagingRequirements: [
            {
              id: 'pkg-req-4',
              packagingId: 'pkg-001',
              packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
              category: 'Trays, Bowls & Containers',
              quantity: 1,
              unit: 'pcs',
              fulfillmentType: 'TAKEOUT',
              scope: 'PER_ITEM',
              estimatedCost: 6.5,
            },
          ],
          preparationInstructions: 'Cook garlic butter shrimp until pink and aromatic. Serve in large sharing bowl with steamed Jasmine rice.',
          totalFoodCost: 182.8,
          totalPackagingCost: 6.5,
          totalRawCost: 189.3,
          grossMarginPercent: 73,
          isConfigured: true,
          updatedAt: new Date().toISOString(),
        },
        {
          productId: CLIENT_MENU_ITEMS[2]?.id || 'all-shrimp-tray-1099',
          productName: 'All Shrimp Party Tray',
          productCategory: 'Seafoods',
          productPrice: 1099,
          productImage: CLIENT_MENU_ITEMS[2]?.image,
          yieldServings: 1,
          ingredients: [
            {
              ingredientId: 'ing-001',
              ingredientName: 'Fresh White Shrimp (Large)',
              portionQuantity: 800,
              unit: 'g',
              estimatedCost: 360.0,
            },
            {
              ingredientId: 'ing-002',
              ingredientName: 'Garlic Cloves (Peeled)',
              portionQuantity: 50,
              unit: 'g',
              estimatedCost: 9.0,
            },
            {
              ingredientId: 'ing-003',
              ingredientName: 'Pure Butter Blend',
              portionQuantity: 70,
              unit: 'g',
              estimatedCost: 19.6,
            },
          ],
          packagingRequirements: [
            {
              id: 'pkg-req-5',
              packagingId: 'pkg-002',
              packagingName: 'Heavy Duty Takeout Carrier Plastic Bag (Medium)',
              category: 'Bags, Pouches & Carriers',
              quantity: 2,
              unit: 'pcs',
              fulfillmentType: 'TAKEOUT',
              scope: 'PER_ITEM',
              estimatedCost: 2.4,
            },
          ],
          preparationInstructions: 'Fiesta party tray portion. Sauté in double batches and arrange neatly in aluminum party tray.',
          totalFoodCost: 388.6,
          totalPackagingCost: 2.4,
          totalRawCost: 391.0,
          grossMarginPercent: 64,
          isConfigured: true,
          updatedAt: new Date().toISOString(),
        },
        {
          productId: CLIENT_MENU_ITEMS[7]?.id || 'chicken-pastil-35',
          productName: 'Chicken Pastil',
          productCategory: 'Value Meals',
          productPrice: 35,
          productImage: CLIENT_MENU_ITEMS[7]?.image,
          yieldServings: 1,
          ingredients: [
            {
              ingredientId: 'ing-004',
              ingredientName: 'Jasmine Rice (Dinorado)',
              portionQuantity: 150,
              unit: 'g',
              estimatedCost: 8.25,
            },
            {
              ingredientId: 'ing-002',
              ingredientName: 'Garlic Cloves (Peeled)',
              portionQuantity: 10,
              unit: 'g',
              estimatedCost: 1.8,
            },
            {
              ingredientId: 'ing-003',
              ingredientName: 'Pure Butter Blend',
              portionQuantity: 10,
              unit: 'g',
              estimatedCost: 2.8,
            },
          ],
          packagingRequirements: [
            {
              id: 'pkg-req-6',
              packagingId: 'pkg-003',
              packagingName: 'Individually Wrapped Spoon & Fork Set w/ Napkin',
              category: 'Cutlery, Napkins & Packets',
              quantity: 1,
              unit: 'pcs',
              fulfillmentType: 'TAKEOUT',
              scope: 'PER_ITEM',
              estimatedCost: 2.2,
            },
          ],
          preparationInstructions: 'Top steaming Jasmine rice with shredded chicken pastil filling.',
          totalFoodCost: 12.85,
          totalPackagingCost: 2.2,
          totalRawCost: 15.05,
          grossMarginPercent: 57,
          isConfigured: true,
          updatedAt: new Date().toISOString(),
        },
        {
          productId: CLIENT_MENU_ITEMS[3]?.id || 'mixed-seafoods-alacarte-99',
          productName: 'Mixed Seafoods Alacarte (Mini)',
          productCategory: 'Seafoods',
          productPrice: 99,
          productImage: CLIENT_MENU_ITEMS[3]?.image,
          yieldServings: 1,
          ingredients: [
            {
              ingredientId: 'ing-001',
              ingredientName: 'Fresh White Shrimp (Large)',
              portionQuantity: 80,
              unit: 'g',
              estimatedCost: 36.0,
            },
            {
              ingredientId: 'ing-002',
              ingredientName: 'Garlic Cloves (Peeled)',
              portionQuantity: 10,
              unit: 'g',
              estimatedCost: 1.8,
            },
            {
              ingredientId: 'ing-003',
              ingredientName: 'Pure Butter Blend',
              portionQuantity: 15,
              unit: 'g',
              estimatedCost: 4.2,
            },
            {
              ingredientId: 'ing-005',
              ingredientName: 'Cajun Seasoning Spice Mix',
              portionQuantity: 10,
              unit: 'g',
              estimatedCost: 6.5,
            },
          ],
          packagingRequirements: [
            {
              id: 'pkg-req-7',
              packagingId: 'pkg-001',
              packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
              category: 'Trays, Bowls & Containers',
              quantity: 1,
              unit: 'pcs',
              fulfillmentType: 'TAKEOUT',
              scope: 'PER_ITEM',
              estimatedCost: 6.5,
            },
          ],
          preparationInstructions: 'Cajun seafood mini mix. Requires Cajun Seasoning Spice Mix.',
          totalFoodCost: 48.5,
          totalPackagingCost: 6.5,
          totalRawCost: 55.0,
          grossMarginPercent: 44,
          isConfigured: true,
          updatedAt: new Date().toISOString(),
        },
      ])
      setPurchaseOrders([
        {
          id: 'po-001',
          poNumber: 'PO-2026-001',
          supplierId: 'sup-001',
          supplierName: 'Navotas Seafood Port Distributors',
          orderDate: new Date(Date.now() - 86400000).toISOString(),
          expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'PENDING',
          items: [
            {
              id: 'poi-1',
              ingredientId: 'ing-001',
              ingredientName: 'Fresh White Shrimp (Large)',
              itemType: 'FOOD',
              category: 'Seafoods',
              orderedQuantity: 10000,
              receivedQuantity: 0,
              unit: 'g',
              unitCost: 0.45,
              totalCost: 4500,
            },
          ],
          totalAmount: 4500,
          notes: 'Deliver early morning batch in ice insulated tubs.',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'po-002',
          poNumber: 'PO-2026-002',
          supplierId: 'sup-004',
          supplierName: 'Metro Pack & Green Disposables',
          orderDate: new Date(Date.now() - 86400000 * 2).toISOString(),
          expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'PENDING',
          items: [
            {
              id: 'poi-2',
              ingredientId: 'pkg-001',
              ingredientName: '3-Compartment Bento Food Tray (Microwaveable)',
              itemType: 'PACKAGING',
              category: 'Trays, Bowls & Containers',
              orderedQuantity: 500,
              receivedQuantity: 0,
              unit: 'pcs',
              unitCost: 6.5,
              totalCost: 3250,
            },
            {
              id: 'poi-3',
              ingredientId: 'pkg-002',
              ingredientName: 'Heavy Duty Takeout Carrier Plastic Bag (Medium)',
              itemType: 'PACKAGING',
              category: 'Bags, Pouches & Carriers',
              orderedQuantity: 400,
              receivedQuantity: 0,
              unit: 'pcs',
              unitCost: 1.2,
              totalCost: 480,
            },
          ],
          totalAmount: 3730,
          notes: 'Sturdy carton boxes for delivery food trays.',
          createdAt: new Date().toISOString(),
        },
      ])
      setTransactions([
        {
          id: 'tx-001',
          referenceNo: 'REC-2026-001',
          timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
          ingredientId: 'ing-001',
          ingredientName: 'Fresh White Shrimp (Large)',
          itemType: 'FOOD',
          category: 'Seafoods',
          type: 'STOCK_RECEIVED',
          quantityDelta: 8500,
          unit: 'g',
          stockAfter: 8500,
          performedBy: 'Store Admin',
          reason: 'Initial intake for flagship branch launch',
        },
        {
          id: 'tx-002',
          referenceNo: 'REC-2026-002',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
          ingredientId: 'pkg-001',
          ingredientName: '3-Compartment Bento Food Tray (Microwaveable)',
          itemType: 'PACKAGING',
          category: 'Trays, Bowls & Containers',
          type: 'STOCK_RECEIVED',
          quantityDelta: 450,
          unit: 'pcs',
          stockAfter: 450,
          performedBy: 'Store Admin',
          reason: 'Initial intake of food trays from Metro Pack',
        },
        {
          id: 'tx-003',
          referenceNo: 'ORD-2026-089',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          ingredientId: 'ing-001',
          ingredientName: 'Fresh White Shrimp (Large)',
          itemType: 'FOOD',
          category: 'Seafoods',
          type: 'CONSUMPTION',
          quantityDelta: -450,
          unit: 'g',
          stockAfter: 8050,
          performedBy: 'Kitchen Cook',
          reason: 'Cooked 3x All Shrimp Bowls',
        },
        {
          id: 'tx-004',
          referenceNo: 'ORD-2026-089',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          ingredientId: 'pkg-001',
          ingredientName: '3-Compartment Bento Food Tray (Microwaveable)',
          itemType: 'PACKAGING',
          category: 'Trays, Bowls & Containers',
          type: 'CONSUMPTION',
          quantityDelta: -3,
          unit: 'pcs',
          stockAfter: 447,
          performedBy: 'Dispatch Rider',
          reason: 'Takeout packaging consumed for 3x dishes',
        },
      ])
      setIsDemoDataLoaded(true)
      addToast({
        type: 'success',
        title: 'Demo Sample Data Loaded',
        description:
          'Sample food ingredients, packaging materials, BOM recipes, and POs are now visible for testing.',
      })
    } else {
      setIngredients([])
      setRecipes([])
      setSuppliers([])
      setPurchaseOrders([])
      setTransactions([])
      setIsDemoDataLoaded(false)
      addToast({
        type: 'info',
        title: 'Catalog Cleared to Empty State',
        description: 'Returned to blank, clean UI-ready inventory tables.',
      })
    }
  }

  // --- Handlers: Ingredients & Packaging ---
  const handleAddIngredient = (item: Omit<Ingredient, 'id' | 'updatedAt' | 'status'>) => {
    const id = `${item.itemType === 'PACKAGING' ? 'pkg' : 'ing'}-${Date.now()}`
    let status: StockStatus = 'IN_STOCK'
    if (item.currentStock <= 0) status = 'OUT_OF_STOCK'
    else if (item.currentStock <= item.minStockLevel) status = 'LOW_STOCK'

    const newIng: Ingredient = {
      ...item,
      id,
      status,
      updatedAt: new Date().toISOString(),
    }

    setIngredients((prev) => [newIng, ...prev])

    if (item.currentStock > 0) {
      setTransactions((prev) => [
        {
          id: `tx-${Date.now()}`,
          referenceNo: `INTAKE-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString(),
          ingredientId: id,
          ingredientName: item.name,
          itemType: item.itemType || 'FOOD',
          category: item.category,
          type: 'STOCK_RECEIVED',
          quantityDelta: item.currentStock,
          unit: item.baseUnit,
          stockAfter: item.currentStock,
          performedBy: 'Store Admin',
          reason: `Initial stock intake upon ${item.itemType === 'PACKAGING' ? 'packaging' : 'ingredient'} registration`,
        },
        ...prev,
      ])
    }

    addToast({
      type: 'success',
      title: item.itemType === 'PACKAGING' ? 'Packaging Material Registered' : 'Ingredient Registered',
      description: `"${item.name}" has been added to the catalog.`,
    })
  }

  const handleEditIngredient = (updated: Ingredient) => {
    setIngredients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    addToast({
      type: 'success',
      title: updated.itemType === 'PACKAGING' ? 'Packaging Material Updated' : 'Ingredient Updated',
      description: `Changes to "${updated.name}" have been saved.`,
    })
  }

  const handleDeleteIngredient = (id: string) => {
    const target = ingredients.find((i) => i.id === id)
    setIngredients((prev) => prev.filter((item) => item.id !== id))
    addToast({
      type: 'info',
      title: 'Item Removed',
      description: target ? `"${target.name}" was deleted from the catalog.` : 'Item deleted.',
    })
  }

  const handleAdjustStock = (
    id: string,
    delta: number,
    reason: string,
    details?: { seller?: string; purchaseDate?: string }
  ) => {
    let affectedItemName = ''
    let affectedItemUnit = ''

    setIngredients((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        affectedItemName = item.name
        affectedItemUnit = item.baseUnit
        const newStock = Math.max(0, item.currentStock + delta)
        let status: StockStatus = 'IN_STOCK'
        if (newStock <= 0) status = 'OUT_OF_STOCK'
        else if (newStock <= item.minStockLevel) status = 'LOW_STOCK'

        // Log transaction
        const isDeduction = delta < 0
        setTransactions((txs) => [
          {
            id: `tx-${Date.now()}`,
            referenceNo: isDeduction
              ? `ADJ-${Date.now().toString().slice(-4)}`
              : `RCV-${Date.now().toString().slice(-4)}`,
            timestamp: details?.purchaseDate
              ? new Date(`${details.purchaseDate}T12:00:00`).toISOString()
              : new Date().toISOString(),
            ingredientId: item.id,
            ingredientName: item.name,
            itemType: item.itemType || 'FOOD',
            category: item.category,
            type: isDeduction ? 'ADJUSTMENT' : 'STOCK_RECEIVED',
            quantityDelta: delta,
            unit: item.baseUnit,
            stockAfter: newStock,
            performedBy: 'Store Admin',
            reason,
          },
          ...txs,
        ])

        return {
          ...item,
          currentStock: newStock,
          status,
          supplierName: details?.seller || item.supplierName,
          lastRestockedAt: delta > 0 ? new Date().toISOString() : item.lastRestockedAt,
          updatedAt: new Date().toISOString(),
        }
      })
    )

    addToast({
      type: 'success',
      title: delta > 0 ? 'Stock Intake Recorded' : 'Stock Adjusted',
      description:
        delta > 0
          ? `Added +${delta.toLocaleString()} ${affectedItemUnit || ''} to ${affectedItemName || 'item'}.`
          : `Deducted ${Math.abs(delta).toLocaleString()} ${affectedItemUnit || ''} from ${affectedItemName || 'item'}.`,
    })
  }

  // --- Handlers: Recipes ---
  const handleSaveRecipe = (recipe: ProductRecipe) => {
    setRecipes((prev) => {
      const filtered = prev.filter((r) => r.productId !== recipe.productId)
      return [recipe, ...filtered]
    })
    addToast({
      type: 'success',
      title: 'Recipe (BOM) Saved',
      description: `Food portions and packaging requirements configured for "${recipe.productName}".`,
    })
  }

  const handleDeleteRecipe = (productId: string) => {
    setRecipes((prev) => prev.filter((r) => r.productId !== productId))
    addToast({
      type: 'info',
      title: 'Recipe Configuration Cleared',
      description: 'Raw consumption tracking unlinked for this menu item.',
    })
  }

  // --- Handlers: Suppliers ---
  const handleAddSupplier = (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
    const newSup: Supplier = {
      ...supplier,
      id: `sup-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setSuppliers((prev) => [newSup, ...prev])
    addToast({
      type: 'success',
      title: 'Supplier Registered',
      description: `"${supplier.name}" added to authorized vendor list.`,
    })
  }

  const handleEditSupplier = (supplier: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? supplier : s)))
    addToast({
      type: 'success',
      title: 'Supplier Updated',
      description: `Contact and delivery details for "${supplier.name}" saved.`,
    })
  }

  const handleDeleteSupplier = (id: string) => {
    const target = suppliers.find((s) => s.id === id)
    setSuppliers((prev) => prev.filter((s) => s.id !== id))
    addToast({
      type: 'info',
      title: 'Supplier Removed',
      description: target ? `"${target.name}" removed from vendor directory.` : 'Supplier deleted.',
    })
  }

  // --- Handlers: Purchases & Receiving ---
  const handleCreatePO = (po: Omit<PurchaseOrder, 'id' | 'createdAt'>) => {
    const newPO: PurchaseOrder = {
      ...po,
      id: `po-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setPurchaseOrders((prev) => [newPO, ...prev])
    addToast({
      type: 'success',
      title: 'Purchase Order Created',
      description: `${newPO.poNumber} has been submitted with total value ₱${newPO.totalAmount.toFixed(2)}.`,
    })
  }

  const handleReceiveStock = (
    poId: string,
    receivedItems: {
      itemId: string
      ingredientId: string
      receivedQty: number
      unit: MeasurementUnit
      batchNumber?: string
      expirationDate?: string
    }[],
    isFullyReceived: boolean,
    notes?: string
  ) => {
    // 1. Update PO records
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id !== poId) return po
        const updatedItems = po.items.map((it) => {
          const matched = receivedItems.find((r) => r.itemId === it.id)
          if (!matched) return it
          return {
            ...it,
            receivedQuantity: it.receivedQuantity + matched.receivedQty,
            batchNumber: matched.batchNumber || it.batchNumber,
            expirationDate: matched.expirationDate || it.expirationDate,
          }
        })
        return {
          ...po,
          items: updatedItems,
          status: isFullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED',
          receivedAt: new Date().toISOString(),
          receivedBy: 'Store Admin',
        }
      })
    )

    // 2. Increment ingredient stocks and log transactions
    receivedItems.forEach((r) => {
      if (r.receivedQty <= 0) return
      setIngredients((prev) =>
        prev.map((ing) => {
          if (ing.id !== r.ingredientId) return ing
          const newStock = ing.currentStock + r.receivedQty
          let status: StockStatus = 'IN_STOCK'
          if (newStock <= 0) status = 'OUT_OF_STOCK'
          else if (newStock <= ing.minStockLevel) status = 'LOW_STOCK'
          return {
            ...ing,
            currentStock: newStock,
            status,
            lastRestockedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        })
      )

      const targetIng = ingredients.find((i) => i.id === r.ingredientId)
      const ingName = targetIng ? targetIng.name : 'Raw Material / Packaging'
      const ingCategory = targetIng ? targetIng.category : 'Packaging & Disposables'
      const ingType = targetIng ? targetIng.itemType : 'FOOD'

      setTransactions((prev) => [
        {
          id: `tx-${Date.now()}-${Math.random()}`,
          referenceNo: `RCV-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString(),
          ingredientId: r.ingredientId,
          ingredientName: ingName,
          itemType: ingType,
          category: ingCategory,
          type: 'STOCK_RECEIVED',
          quantityDelta: r.receivedQty,
          unit: r.unit,
          stockAfter: (targetIng ? targetIng.currentStock : 0) + r.receivedQty,
          performedBy: 'Store Admin',
          reason: `Goods received against PO. Batch: ${r.batchNumber || 'N/A'}${notes ? ` • ${notes}` : ''}`,
        },
        ...prev,
      ])
    })

    addToast({
      type: 'success',
      title: 'Inbound Stock Intake Confirmed',
      description: `Delivered items successfully received and added to physical inventory balance.`,
    })
  }

  const handleCancelPO = (poId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === poId ? { ...po, status: 'CANCELLED' } : po))
    )
    addToast({
      type: 'info',
      title: 'Purchase Order Cancelled',
      description: 'Order marked as cancelled. No inventory was updated.',
    })
  }

  // --- Handlers: Stock History & Audit ---
  const handleAddTransaction = (
    tx: Omit<StockTransaction, 'id' | 'timestamp' | 'referenceNo' | 'stockAfter'>
  ) => {
    const targetIng = ingredients.find((i) => i.id === tx.ingredientId)
    const currentStock = targetIng ? targetIng.currentStock : 0
    const newStock = Math.max(0, currentStock + tx.quantityDelta)

    // Update ingredient
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id !== tx.ingredientId) return ing
        let status: StockStatus = 'IN_STOCK'
        if (newStock <= 0) status = 'OUT_OF_STOCK'
        else if (newStock <= ing.minStockLevel) status = 'LOW_STOCK'
        return {
          ...ing,
          currentStock: newStock,
          status,
          updatedAt: new Date().toISOString(),
        }
      })
    )

    // Add transaction
    const newTx: StockTransaction = {
      ...tx,
      id: `tx-${Date.now()}`,
      referenceNo: `MAN-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      stockAfter: newStock,
    }
    setTransactions((prev) => [newTx, ...prev])

    addToast({
      type: 'success',
      title: 'Stock Movement Logged',
      description: `${tx.type.replace('_', ' ')} of ${Math.abs(tx.quantityDelta)} ${tx.unit} committed to ledger.`,
    })
  }

  // --- Handlers: Reports ---
  const handleExportReport = (type: 'EXCEL' | 'PDF') => {
    addToast({
      type: 'success',
      title: `${type === 'EXCEL' ? 'Excel Spreadsheet' : 'PDF Document'} Generated`,
      description: 'Inventory audit export compiled successfully for download.',
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      <div className="px-4 sm:px-6 lg:px-10 pt-4 sm:pt-5 print:hidden">
        <NavbarAdmin />
      </div>

      {/* Full Width Body Container */}
      <main className="admin-inventory-workspace w-full px-4 sm:px-6 lg:px-10 pt-6 space-y-6">
        {/* Header row: Back link + Title + Location & Actions */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => navigate('/admin-dashboard')}
                className="group inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-orange-600 transition-colors cursor-pointer"
              >
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                <span>Back to Dashboard</span>
              </button>
              <span className="text-slate-300">/</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-slate-600 text-[11px] font-medium shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Caloocan Flagship Hub
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Inventory
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage food ingredients, packaging, recipes, suppliers, purchasing and stock records
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Interactive Demo Toggle */}
            <button
              type="button"
              onClick={toggleDemoData}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                isDemoDataLoaded
                  ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isDemoDataLoaded ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`} />
              <span>{isDemoDataLoaded ? 'Reset Demo Data' : 'Load Sample Demo Data'}</span>
            </button>
          </div>
        </div>

        {/* Master 7-Tab Navigation Bar - Sleek Segmented Pills matching AdminDashboard */}
        <nav
          className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar border border-slate-200/60"
          aria-label="Inventory sections"
        >
          {(
            [
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'ingredients', label: 'Ingredients & Packaging' },
              { id: 'recipes', label: 'Recipes (BOM)' },
              { id: 'suppliers', label: 'Suppliers' },
              { id: 'purchases', label: 'Purchases & Receiving' },
              { id: 'history', label: 'Stock History' },
              { id: 'reports', label: 'Reports' },
            ] as const
          ).map((tab) => {
            const isActive = currentTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                id={`inventory-tab-${tab.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Tab Content Panels */}
        <section
          id="inventory-tab-panel"
          className="min-w-0 outline-none"
          role="region"
          aria-labelledby={`inventory-tab-${currentTab}`}
          tabIndex={0}
        >
        {currentTab === 'dashboard' && (
          <InventoryDashboardTab
            ingredients={ingredients}
            purchaseOrders={purchaseOrders}
            transactions={transactions}
            onNavigateTab={handleTabChange}
            onOpenAddIngredient={() => handleTabChange('ingredients')}
            onOpenCreatePO={() => handleTabChange('purchases')}
          />
        )}

        {currentTab === 'ingredients' && (
          <IngredientsTab
            ingredients={ingredients}
            suppliers={suppliers}
            onAddIngredient={handleAddIngredient}
            onEditIngredient={handleEditIngredient}
            onDeleteIngredient={handleDeleteIngredient}
            onAdjustStock={handleAdjustStock}
          />
        )}

        {currentTab === 'recipes' && (
          <RecipesBOMTab
            ingredients={ingredients}
            recipes={recipes}
            onSaveRecipe={handleSaveRecipe}
            onDeleteRecipe={handleDeleteRecipe}
          />
        )}

        {currentTab === 'suppliers' && (
          <SuppliersTab
            suppliers={suppliers}
            onAddSupplier={handleAddSupplier}
            onEditSupplier={handleEditSupplier}
            onDeleteSupplier={handleDeleteSupplier}
          />
        )}

        {currentTab === 'purchases' && (
          <PurchasesReceivingTab
            purchaseOrders={purchaseOrders}
            suppliers={suppliers}
            ingredients={ingredients}
            onCreatePO={handleCreatePO}
            onReceiveStock={handleReceiveStock}
            onCancelPO={handleCancelPO}
          />
        )}

        {currentTab === 'history' && (
          <StockHistoryTab
            transactions={transactions}
            ingredients={ingredients}
            onAddTransaction={handleAddTransaction}
          />
        )}

        {currentTab === 'reports' && (
          <InventoryReportsTab
            ingredients={ingredients}
            purchaseOrders={purchaseOrders}
            transactions={transactions}
            onExportReport={handleExportReport}
          />
        )}
        </section>
      </main>

      {/* Global Toast Alerts */}
      <InventoryToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default AdminInventoryManagement
