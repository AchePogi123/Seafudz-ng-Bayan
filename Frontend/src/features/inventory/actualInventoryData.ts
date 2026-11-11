import type {
  Ingredient,
  ProductRecipe,
  Supplier,
  StockTransaction,
} from './inventoryTypes'
import { CLIENT_MENU_ITEMS } from '../../components/MenuCard'

// ============================================================================
// SEAFUDZ NG BAYAN — PRODUCTION ACTUAL INVENTORY CATALOG
// ============================================================================

export const ACTUAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-navotas-01',
    name: 'Navotas Seafood Port Distributors',
    contactPerson: 'Mang Rogelio Tan',
    contactNumber: '0917 888 1234',
    email: 'navotas.seafood@ph.example.com',
    address: 'Stall 18, Navotas Fish Port Complex, Navotas City',
    categoriesSupplied: ['Seafoods'],
    leadTimeDays: 1,
    notes: 'Daily early morning delivery (5:00 AM – 7:00 AM) fresh seafood',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sup-balintawak-02',
    name: 'Balintawak Central Wholesale Produce',
    contactPerson: 'Aling Susan Ramos',
    contactNumber: '0922 456 7890',
    email: 'balintawak.wholesale@ph.example.com',
    address: 'Block 4, Balintawak Cloverleaf Market, Quezon City',
    categoriesSupplied: ['Vegetables & Produce', 'Grains & Noodles'],
    leadTimeDays: 1,
    notes: 'Fresh calamansi, lemons, garlic, onions, vegetables and Jasmine rice',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sup-golden-dairy-03',
    name: 'Golden Dairy, Oils & Seasonings Trading',
    contactPerson: 'Eric Villafuerte',
    contactNumber: '0918 333 9988',
    email: 'orders@goldendairy.ph',
    address: '14 Industrial Road, Valenzuela City',
    categoriesSupplied: ['Dairy & Fats', 'Seasonings & Sauces', 'Meat & Poultry'],
    leadTimeDays: 2,
    notes: 'Pure butter, cajun spices, cooking oil, sauces and siomai commissary',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sup-metro-pack-04',
    name: 'Metro Pack & Eco Disposables',
    contactPerson: 'Cynthia Santos',
    contactNumber: '0917 555 4321',
    email: 'cynthia@metropack.ph',
    address: '88 C3 Road, Caloocan City',
    categoriesSupplied: [
      'Trays, Bowls & Containers',
      'Cups, Lids & Straws',
      'Bags, Pouches & Carriers',
      'Cutlery, Napkins & Packets',
      'Boxes & Bilao Packaging',
      'Labels & Sealing Stickers',
    ],
    leadTimeDays: 2,
    notes: 'Primary supplier for food trays, sharing bowls, party trays and cups',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
]

export const ACTUAL_INGREDIENTS: Ingredient[] = [
  // --------------------------------------------------------------------------
  // 1. SEAFOODS (Portion: grams)
  // --------------------------------------------------------------------------
  {
    id: 'ing-shrimp-fresh',
    name: 'Fresh Whole Shrimp',
    sku: 'ING-SEA-SHR-01',
    itemType: 'FOOD',
    category: 'Seafoods',
    baseUnit: 'g',
    currentStock: 15000,
    minStockLevel: 3000,
    preferredRestockQty: 12000,
    costPerUnit: 0.45, // ₱450/kg
    supplierId: 'sup-navotas-01',
    supplierName: 'Navotas Seafood Port Distributors',
    storageNotes: 'Keep in ice-cold walk-in freezer at -18°C. Thaw in cold running water.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-shrimp-regular-pc',
    name: 'Fresh Regular Shrimp (Piece)',
    sku: 'ING-SEA-SHR-REG',
    itemType: 'FOOD',
    category: 'Seafoods',
    baseUnit: 'pcs',
    currentStock: 120,
    minStockLevel: 30,
    preferredRestockQty: 100,
    costPerUnit: 9.0, // ₱9/piece (~20g)
    supplierId: 'sup-navotas-01',
    supplierName: 'Navotas Seafood Port Distributors',
    storageNotes: '1 piece ≈ 20g portion. Graded medium fresh shrimp.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-shrimp-jumbo-pc',
    name: 'Fresh Jumbo Shrimp (Piece)',
    sku: 'ING-SEA-SHR-JMB',
    itemType: 'FOOD',
    category: 'Seafoods',
    baseUnit: 'pcs',
    currentStock: 80,
    minStockLevel: 25,
    preferredRestockQty: 80,
    costPerUnit: 16.0, // ₱16/piece (~37.5g)
    supplierId: 'sup-navotas-01',
    supplierName: 'Navotas Seafood Port Distributors',
    storageNotes: '1 piece ≈ 37.5g portion. Selected jumbo black tiger / white shrimp.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-crab-halves',
    name: 'Crab (Halves)',
    sku: 'ING-SEA-CRB-01',
    itemType: 'FOOD',
    category: 'Seafoods',
    baseUnit: 'g',
    currentStock: 8000,
    minStockLevel: 2000,
    preferredRestockQty: 8000,
    costPerUnit: 0.55, // ₱550/kg
    supplierId: 'sup-navotas-01',
    supplierName: 'Navotas Seafood Port Distributors',
    storageNotes: 'Cleaned, pre-halved fresh ocean crabs. Store in freezer.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-green-mussels',
    name: 'Green Mussels (Tahong)',
    sku: 'ING-SEA-MUS-01',
    itemType: 'FOOD',
    category: 'Seafoods',
    baseUnit: 'g',
    currentStock: 10000,
    minStockLevel: 2500,
    preferredRestockQty: 10000,
    costPerUnit: 0.22, // ₱220/kg
    supplierId: 'sup-navotas-01',
    supplierName: 'Navotas Seafood Port Distributors',
    storageNotes: 'Fresh green mussels (tahong) cleaned and de-bearded. 3 pcs ≈ 50g.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-shellfish-clams',
    name: 'Shellfish / Clams',
    sku: 'ING-SEA-CLM-01',
    itemType: 'FOOD',
    category: 'Seafoods',
    baseUnit: 'g',
    currentStock: 6000,
    minStockLevel: 1500,
    preferredRestockQty: 6000,
    costPerUnit: 0.25, // ₱250/kg
    supplierId: 'sup-navotas-01',
    supplierName: 'Navotas Seafood Port Distributors',
    storageNotes: 'Purged clams/shellfish medley. Store chilled on crushed ice.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-squid-rings',
    name: 'Squid Rings',
    sku: 'ING-SEA-SQD-01',
    itemType: 'FOOD',
    category: 'Seafoods',
    baseUnit: 'g',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.38, // ₱380/kg
    supplierId: 'sup-navotas-01',
    supplierName: 'Navotas Seafood Port Distributors',
    storageNotes: 'Cleaned squid rings for seafood pancit.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 2. VEGETABLES & PRODUCE
  // --------------------------------------------------------------------------
  {
    id: 'ing-sweet-corn',
    name: 'Sweet Corn Cob (Mini Cob Slices)',
    sku: 'ING-VEG-CRN-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'pcs',
    currentStock: 150,
    minStockLevel: 40,
    preferredRestockQty: 120,
    costPerUnit: 5.0, // ₱5/mini cob slice (~40g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: '1 mini cob slice ≈ 40g. Fresh sweet yellow corn.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-mixed-vegetables',
    name: 'Mixed Vegetables (Cabbage, Carrots, Peas)',
    sku: 'ING-VEG-MIX-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 5000,
    minStockLevel: 1500,
    preferredRestockQty: 5000,
    costPerUnit: 0.12, // ₱120/kg
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Diced crisp carrots, peas, shredded cabbage, bell peppers. Chiller 4°C.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-minced-garlic',
    name: 'Minced Garlic',
    sku: 'ING-VEG-GAR-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 3000,
    minStockLevel: 800,
    preferredRestockQty: 3000,
    costPerUnit: 0.16, // ₱160/kg (1 tsp ≈ 5g, 1 tbsp ≈ 15g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Freshly minced native garlic cloves. Keep refrigerated.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-chopped-onion',
    name: 'Chopped Onion',
    sku: 'ING-VEG-ONN-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.11, // ₱110/kg (1 medium onion ≈ 110g, 1/2 onion ≈ 55g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Diced red/yellow onions. Chiller storage.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-spring-onion',
    name: 'Chopped Spring Onion',
    sku: 'ING-VEG-SPN-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 1000,
    minStockLevel: 300,
    preferredRestockQty: 1000,
    costPerUnit: 0.18, // ₱180/kg (1 tbsp ≈ 6g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Sliced fresh scallions for Chao Fan and garnishing.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-fresh-calamansi',
    name: 'Fresh Calamansi',
    sku: 'ING-VEG-CLM-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'pcs',
    currentStock: 400,
    minStockLevel: 100,
    preferredRestockQty: 300,
    costPerUnit: 1.0, // ₱1/pc (~10g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: '1 piece ≈ 10g whole. Fresh green Philippine lime.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-fresh-lemon',
    name: 'Fresh Lemon (Wedges / Slices)',
    sku: 'ING-VEG-LMN-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'pcs',
    currentStock: 150,
    minStockLevel: 40,
    preferredRestockQty: 100,
    costPerUnit: 4.5, // ₱4.5/wedge (~15g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: '1 wedge ≈ 15g, 1 slice ≈ 10-15g. Fresh yellow lemons.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-fresh-parsley',
    name: 'Fresh Parsley',
    sku: 'ING-VEG-PAR-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 300,
    minStockLevel: 80,
    preferredRestockQty: 300,
    costPerUnit: 0.35, // ₱350/kg (1 pinch ≈ 0.5g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Chopped curly parsley garnish. Store wrapped in damp paper towel.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-fresh-cucumber',
    name: 'Fresh Cucumber (Slices)',
    sku: 'ING-VEG-CUC-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'pcs',
    currentStock: 200,
    minStockLevel: 50,
    preferredRestockQty: 150,
    costPerUnit: 1.5, // ₱1.5/slice (~10g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: '1 slice ≈ 10g. Crisp cucumber slices for lemonade garnish.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-tomato-cucumber-garnish',
    name: 'Tomato / Cucumber Garnish',
    sku: 'ING-VEG-TCG-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 1500,
    minStockLevel: 400,
    preferredRestockQty: 1500,
    costPerUnit: 0.12, // ₱120/kg (2 slices ≈ 30g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Fresh sliced tomato and cucumber garnish for silog meals.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-fresh-mango-cubes',
    name: 'Fresh Mango Cubes',
    sku: 'ING-VEG-MNG-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 2000,
    minStockLevel: 500,
    preferredRestockQty: 2000,
    costPerUnit: 0.28, // ₱280/kg
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Fresh sweet ripe mango cubes for Mango Pudding dessert.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-caramelized-saba',
    name: 'Sweet Caramelized Saba Bananas',
    sku: 'ING-VEG-SAB-01',
    itemType: 'FOOD',
    category: 'Vegetables & Produce',
    baseUnit: 'g',
    currentStock: 3000,
    minStockLevel: 800,
    preferredRestockQty: 3000,
    costPerUnit: 0.18, // ₱180/kg
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Simmered saba banana slices in muscovado syrup for Banana Con Yelo.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 3. MEAT & POULTRY
  // --------------------------------------------------------------------------
  {
    id: 'ing-shredded-chicken',
    name: 'Shredded Chicken (Pastil Filling)',
    sku: 'ING-MET-CHK-01',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'g',
    currentStock: 5000,
    minStockLevel: 1500,
    preferredRestockQty: 5000,
    costPerUnit: 0.28, // ₱280/kg
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Slow simmered flaked seasoned chicken breast for Chicken Pastil.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-beef-tapa',
    name: 'Beef Tapa (Marinated Strips)',
    sku: 'ING-MET-TAP-01',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'g',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.42, // ₱420/kg
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Tender marinated sweet-savory beef strips for Tapsilog.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-seasoned-meat-bits',
    name: 'Seasoned Meat Bits',
    sku: 'ING-MET-BTS-01',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'g',
    currentStock: 3000,
    minStockLevel: 800,
    preferredRestockQty: 3000,
    costPerUnit: 0.26, // ₱260/kg
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Savory minced meat bits for Chao Fan fried rice.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-sliced-sausage',
    name: 'Sliced Sausage (Smoked Rounds)',
    sku: 'ING-MET-SSG-01',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'g',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.32, // ₱320/kg
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Smoked savory sausage coin rounds for seafood boils and add-ons.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-pork-siomai',
    name: 'Pork Siomai',
    sku: 'ING-MET-SIO-PRK',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'pcs',
    currentStock: 250,
    minStockLevel: 50,
    preferredRestockQty: 200,
    costPerUnit: 2.5, // ₱2.5/pc (~20g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: '1 piece ≈ 20g. Frozen steamed pork siomai dumplings.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-beef-siomai',
    name: 'Beef Siomai',
    sku: 'ING-MET-SIO-BEF',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'pcs',
    currentStock: 200,
    minStockLevel: 50,
    preferredRestockQty: 180,
    costPerUnit: 2.7, // ₱2.7/pc (~20g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: '1 piece ≈ 20g. Frozen steamed beef siomai dumplings.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-chicken-siomai',
    name: 'Chicken Siomai',
    sku: 'ING-MET-SIO-CHK',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'pcs',
    currentStock: 200,
    minStockLevel: 50,
    preferredRestockQty: 180,
    costPerUnit: 2.5, // ₱2.5/pc (~20g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: '1 piece ≈ 20g. Frozen steamed chicken siomai dumplings.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-sharksfin-siomai',
    name: 'Sharksfin Siomai',
    sku: 'ING-MET-SIO-SHK',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'pcs',
    currentStock: 180,
    minStockLevel: 40,
    preferredRestockQty: 150,
    costPerUnit: 2.8, // ₱2.8/pc (~20g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: '1 piece ≈ 20g. Cantonese style sharksfin dumplings.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-japanese-siomai',
    name: 'Japanese Siomai',
    sku: 'ING-MET-SIO-JPN',
    itemType: 'FOOD',
    category: 'Meat & Poultry',
    baseUnit: 'pcs',
    currentStock: 180,
    minStockLevel: 40,
    preferredRestockQty: 150,
    costPerUnit: 3.2, // ₱3.2/pc (~20g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: '1 piece ≈ 20g. Nori seaweed-wrapped Japanese pork dumplings.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 4. DAIRY, FATS & EGGS
  // --------------------------------------------------------------------------
  {
    id: 'ing-butter',
    name: 'Pure Butter Blend',
    sku: 'ING-DAR-BUT-01',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'g',
    currentStock: 8000,
    minStockLevel: 2000,
    preferredRestockQty: 8000,
    costPerUnit: 0.28, // ₱280/kg
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Quality unsalted cooking butter. Refrigerate at 2°C to 5°C.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-garlic-butter',
    name: 'Garlic Butter',
    sku: 'ING-DAR-GBU-01',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'g',
    currentStock: 5000,
    minStockLevel: 1500,
    preferredRestockQty: 5000,
    costPerUnit: 0.32, // ₱320/kg
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Savory whipped garlic butter blend for shrimp bowls.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-cajun-butter',
    name: 'Cajun Butter',
    sku: 'ING-DAR-CBU-01',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'g',
    currentStock: 6000,
    minStockLevel: 1500,
    preferredRestockQty: 6000,
    costPerUnit: 0.34, // ₱340/kg
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Signature cajun spiced butter blend for seafood boils.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-cooking-oil',
    name: 'Cooking Oil',
    sku: 'ING-DAR-OIL-01',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'g',
    currentStock: 10000,
    minStockLevel: 3000,
    preferredRestockQty: 10000,
    costPerUnit: 0.12, // ₱120/kg (1 tbsp ≈ 14g, 1 tsp ≈ 4.7g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Refined vegetable cooking oil. Dry cool pantry.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-fresh-eggs',
    name: 'Fresh Eggs (Large)',
    sku: 'ING-DAR-EGG-01',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'pcs',
    currentStock: 200,
    minStockLevel: 50,
    preferredRestockQty: 180,
    costPerUnit: 7.5, // ₱7.5/egg (~50g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: '1 large egg ≈ 50g. Fresh farm eggs. Store in carton trays.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-creamy-condensed-milk',
    name: 'Creamy Milk Base / Condensed Milk',
    sku: 'ING-DAR-MLK-01',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'g',
    currentStock: 5000,
    minStockLevel: 1500,
    preferredRestockQty: 5000,
    costPerUnit: 0.16, // ₱160/kg (1 ml ≈ 1.3g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sweet creamy milk blend for fruit shakes.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-evaporated-milk',
    name: 'Evaporated / Condensed Milk',
    sku: 'ING-DAR-EVP-01',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'g',
    currentStock: 4000,
    minStockLevel: 1200,
    preferredRestockQty: 4000,
    costPerUnit: 0.15, // ₱150/kg (3 tbsp ≈ 58.5g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Rich evaporated milk drizzle for Banana Con Yelo.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-special-ice-cream',
    name: 'Special Ice Cream',
    sku: 'ING-DAR-ICM-01',
    itemType: 'FOOD',
    category: 'Dairy & Fats',
    baseUnit: 'g',
    currentStock: 5000,
    minStockLevel: 1500,
    preferredRestockQty: 5000,
    costPerUnit: 0.22, // ₱220/kg (1 scoop ≈ 100g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: '1 scoop ≈ 100g. Premium ice cream tub in deep freezer.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 5. GRAINS & NOODLES
  // --------------------------------------------------------------------------
  {
    id: 'ing-steamed-white-rice',
    name: 'Steaming White Rice (Jasmine)',
    sku: 'ING-GRN-RIC-01',
    itemType: 'FOOD',
    category: 'Grains & Noodles',
    baseUnit: 'g',
    currentStock: 25000,
    minStockLevel: 6000,
    preferredRestockQty: 25000,
    costPerUnit: 0.055, // ₱55/kg (1 cup = 200g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Cooked fluffy Jasmine white rice. Dry grain bins before steaming.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-fried-garlic-rice',
    name: 'Fried Rice / Garlic Rice',
    sku: 'ING-GRN-GRC-01',
    itemType: 'FOOD',
    category: 'Grains & Noodles',
    baseUnit: 'g',
    currentStock: 15000,
    minStockLevel: 4000,
    preferredRestockQty: 15000,
    costPerUnit: 0.07, // ₱70/kg (1 serving = 200g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Toasted garlic seasoned fried rice for Tapsilog and Chao Fan.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-pancit-noodles',
    name: 'Pancit Noodles (Bihon / Canton)',
    sku: 'ING-GRN-NDL-01',
    itemType: 'FOOD',
    category: 'Grains & Noodles',
    baseUnit: 'g',
    currentStock: 8000,
    minStockLevel: 2000,
    preferredRestockQty: 8000,
    costPerUnit: 0.12, // ₱120/kg
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Bihon and canton noodle blend for Seafood Pancit.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-street-stirfry-noodles',
    name: 'Street Stir-Fry Noodles',
    sku: 'ING-GRN-SND-01',
    itemType: 'FOOD',
    category: 'Grains & Noodles',
    baseUnit: 'g',
    currentStock: 6000,
    minStockLevel: 1500,
    preferredRestockQty: 6000,
    costPerUnit: 0.11, // ₱110/kg
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Fresh yellow stir-fry noodles for Fried Noodles value meal.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 6. SEASONINGS & SAUCES
  // --------------------------------------------------------------------------
  {
    id: 'ing-special-cajun-sauce',
    name: 'Special Cajun Seafood Sauce',
    sku: 'ING-SEA-CAJ-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 10000,
    minStockLevel: 2500,
    preferredRestockQty: 10000,
    costPerUnit: 0.35, // ₱350/kg (1 tbsp ≈ 15g, 1 fl oz / 2 tbsp ≈ 30g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Signature secret cajun seafood sauce blend.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-chili-garlic-sauce',
    name: 'Chili Garlic Sauce',
    sku: 'ING-SEA-CGS-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 3000,
    minStockLevel: 800,
    preferredRestockQty: 3000,
    costPerUnit: 0.25, // ₱250/kg (1 tsp ≈ 5g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Toasted chili garlic oil dipping sauce for siomai.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-soy-sauce',
    name: 'Soy Sauce',
    sku: 'ING-SEA-SOY-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 6000,
    minStockLevel: 1500,
    preferredRestockQty: 6000,
    costPerUnit: 0.08, // ₱80/kg (1 tbsp ≈ 15g, 1/2 tsp ≈ 2.5g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Dark brewed soy sauce for cooking and dipping.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-oyster-sauce',
    name: 'Oyster Sauce',
    sku: 'ING-SEA-OYS-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.16, // ₱160/kg (1 tbsp ≈ 18g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Savory oyster sauce for pancit.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-vinegar-dip',
    name: 'Vinegar Dip / Cane Vinegar',
    sku: 'ING-SEA-VIN-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 5000,
    minStockLevel: 1500,
    preferredRestockQty: 5000,
    costPerUnit: 0.06, // ₱60/kg (1 tsp ≈ 5g, 1 tbsp ≈ 15g, 2 tbsp ≈ 30g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Spiced cane vinegar for chicken pastil and tapsilog dip.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-stirfry-savory-sauce',
    name: 'Stir-Fry Savory Sauce / Chao Fan Seasoning',
    sku: 'ING-SEA-SFS-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.22, // ₱220/kg (1 tbsp ≈ 15g, 2 tbsp ≈ 30g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Rich savory wok glaze sauce for fried noodles & Chao Fan.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-paprika',
    name: 'Paprika Spice Powder',
    sku: 'ING-SEA-PAP-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 2000,
    minStockLevel: 500,
    preferredRestockQty: 2000,
    costPerUnit: 0.45, // ₱450/kg (1 tsp ≈ 2.3g, 1 tbsp ≈ 7g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sweet aromatic ground paprika spice.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-cayenne-pepper',
    name: 'Cayenne Pepper Powder',
    sku: 'ING-SEA-CAY-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 1000,
    minStockLevel: 300,
    preferredRestockQty: 1000,
    costPerUnit: 0.55, // ₱550/kg (1/2 tsp ≈ 0.9g, 1 tsp ≈ 1.8g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Fiery ground red cayenne pepper for cajun heat.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-salt',
    name: 'Iodized Table Salt',
    sku: 'ING-SEA-SLT-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 10000,
    minStockLevel: 2500,
    preferredRestockQty: 10000,
    costPerUnit: 0.035, // ₱35/kg (1/2 tsp ≈ 3g, 1 tsp ≈ 6g, 1 tbsp ≈ 18g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Fine pure iodized salt.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-black-pepper',
    name: 'Cracked Black Pepper',
    sku: 'ING-SEA-BKP-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 3000,
    minStockLevel: 800,
    preferredRestockQty: 3000,
    costPerUnit: 0.38, // ₱380/kg (1/4 tsp ≈ 0.6g, 1/2 tsp ≈ 1.2g, 1 tsp ≈ 2.4g, 1 tbsp ≈ 7.2g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Freshly coarse-ground black pepper.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-sugar',
    name: 'Refined White Sugar',
    sku: 'ING-SEA-SGR-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 8000,
    minStockLevel: 2000,
    preferredRestockQty: 8000,
    costPerUnit: 0.08, // ₱80/kg (1/2 tsp ≈ 2.1g, 1 packet ≈ 4g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Fine granulated white cane sugar.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 7. BEVERAGES & BAR
  // --------------------------------------------------------------------------
  {
    id: 'ing-lemon-juice',
    name: 'Fresh Lemon Juice',
    sku: 'ING-BEV-LMJ-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'ml',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.25, // ₱0.25/ml (1 ml ≈ 1g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Fresh pure squeezed lemon juice. Keep chilled at 4°C.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-calamansi-juice',
    name: 'Fresh Calamansi Juice',
    sku: 'ING-BEV-CLJ-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'ml',
    currentStock: 3000,
    minStockLevel: 800,
    preferredRestockQty: 3000,
    costPerUnit: 0.20, // ₱0.20/ml (1 ml ≈ 1g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Fresh pure calamansi extract. Refrigerated.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-cucumber-juice',
    name: 'Cucumber Juice / Blend',
    sku: 'ING-BEV-CUB-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'ml',
    currentStock: 3000,
    minStockLevel: 800,
    preferredRestockQty: 3000,
    costPerUnit: 0.18, // ₱0.18/ml (1 ml ≈ 1g)
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Fresh blended English cucumber extract.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-fruit-puree',
    name: 'Real Fruit / Fruit Puree',
    sku: 'ING-BEV-FRP-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'g',
    currentStock: 5000,
    minStockLevel: 1500,
    preferredRestockQty: 5000,
    costPerUnit: 0.25, // ₱250/kg
    supplierId: 'sup-balintawak-02',
    supplierName: 'Balintawak Central Wholesale Produce',
    storageNotes: 'Fresh fruit and natural puree for small (80g) and big (130g) fruit shakes.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-sugar-syrup',
    name: 'Sugar Syrup',
    sku: 'ING-BEV-SGS-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'ml',
    currentStock: 5000,
    minStockLevel: 1500,
    preferredRestockQty: 5000,
    costPerUnit: 0.10, // ₱0.10/ml (1 ml ≈ 1.3g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: '100% dissolved simple sugar syrup base for lemonades & shakes.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-purified-water',
    name: 'Purified Water',
    sku: 'ING-BEV-WTR-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'ml',
    currentStock: 20000,
    minStockLevel: 5000,
    preferredRestockQty: 20000,
    costPerUnit: 0.01, // ₱0.01/ml (1 ml = 1g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Reverse-osmosis purified drinking water.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-crushed-ice',
    name: 'Crushed Ice / Shaved Ice',
    sku: 'ING-BEV-ICE-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'g',
    currentStock: 25000,
    minStockLevel: 5000,
    preferredRestockQty: 25000,
    costPerUnit: 0.02, // ₱20/kg (1 cup ≈ 220g, 1.5 cups ≈ 330g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Clean commercial ice maker storage bin.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-house-iced-tea',
    name: 'House Iced Tea Liquid',
    sku: 'ING-BEV-TEA-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'ml',
    currentStock: 10000,
    minStockLevel: 2500,
    preferredRestockQty: 10000,
    costPerUnit: 0.04, // ₱0.04/ml (1 ml ≈ 1g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Signature house brewed citrus black iced tea. Cold drink dispenser.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-brewed-coffee',
    name: 'Hot Brewed Black Coffee',
    sku: 'ING-BEV-COF-01',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'ml',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.05, // ₱0.05/ml (240ml/cup ≈ 240g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Freshly brewed aromatic Batangas barako dark roast.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-mineral-water-bottle',
    name: 'Bottled Mineral Water (500ml)',
    sku: 'ING-BEV-BTL-WTR',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'bottle',
    currentStock: 120,
    minStockLevel: 30,
    preferredRestockQty: 100,
    costPerUnit: 7.0, // ₱7/bottle
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sealed 500ml purified mineral water bottles.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-coke-mismo',
    name: 'Coca-Cola Mismo (250ml)',
    sku: 'ING-BEV-BTL-COK250',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'bottle',
    currentStock: 150,
    minStockLevel: 40,
    preferredRestockQty: 120,
    costPerUnit: 14.0, // ₱14/bottle
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sealed 250ml PET Coke bottles. Keep chilled.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-coke-15l',
    name: 'Coca-Cola (1.5L)',
    sku: 'ING-BEV-BTL-COK15L',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'bottle',
    currentStock: 40,
    minStockLevel: 12,
    preferredRestockQty: 30,
    costPerUnit: 65.0, // ₱65/bottle
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sealed 1.5-liter PET Coke bottles.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-sprite-mismo',
    name: 'Sprite Mismo (250ml)',
    sku: 'ING-BEV-BTL-SPR250',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'bottle',
    currentStock: 120,
    minStockLevel: 30,
    preferredRestockQty: 100,
    costPerUnit: 14.0, // ₱14/bottle
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sealed 250ml PET Sprite bottles.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-sprite-15l',
    name: 'Sprite (1.5L)',
    sku: 'ING-BEV-BTL-SPR15L',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'bottle',
    currentStock: 35,
    minStockLevel: 10,
    preferredRestockQty: 30,
    costPerUnit: 60.0, // ₱60/bottle
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sealed 1.5-liter PET Sprite bottles.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-royal-mismo',
    name: 'Royal Tru-Orange Mismo (250ml)',
    sku: 'ING-BEV-BTL-RYL250',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'bottle',
    currentStock: 120,
    minStockLevel: 30,
    preferredRestockQty: 100,
    costPerUnit: 14.0, // ₱14/bottle
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sealed 250ml PET Royal bottles.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-royal-15l',
    name: 'Royal Tru-Orange (1.5L)',
    sku: 'ING-BEV-BTL-RYL15L',
    itemType: 'FOOD',
    category: 'Beverages & Bar',
    baseUnit: 'bottle',
    currentStock: 35,
    minStockLevel: 10,
    preferredRestockQty: 30,
    costPerUnit: 60.0, // ₱60/bottle
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Sealed 1.5-liter PET Royal Tru-Orange bottles.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 8. DESSERTS & SWEET TOPPINGS
  // --------------------------------------------------------------------------
  {
    id: 'ing-mango-custard-base',
    name: 'Mango Custard Base',
    sku: 'ING-DES-MCB-01',
    itemType: 'FOOD',
    category: 'Other Food',
    baseUnit: 'g',
    currentStock: 4000,
    minStockLevel: 1000,
    preferredRestockQty: 4000,
    costPerUnit: 0.18, // ₱180/kg
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Chilled mango pudding custard base.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-sweet-mango-syrup',
    name: 'Sweet Mango Syrup',
    sku: 'ING-DES-SMS-01',
    itemType: 'FOOD',
    category: 'Seasonings & Sauces',
    baseUnit: 'g',
    currentStock: 3000,
    minStockLevel: 800,
    preferredRestockQty: 3000,
    costPerUnit: 0.22, // ₱220/kg (2 tbsp / 30ml ≈ 39g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Rich sweet mango drizzle coulis for pudding.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-ube-halaya',
    name: 'Ube Halaya Topping',
    sku: 'ING-DES-UBE-01',
    itemType: 'FOOD',
    category: 'Other Food',
    baseUnit: 'g',
    currentStock: 2000,
    minStockLevel: 500,
    preferredRestockQty: 2000,
    costPerUnit: 0.26, // ₱260/kg (1 tbsp ≈ 18g)
    supplierId: 'sup-golden-dairy-03',
    supplierName: 'Golden Dairy, Oils & Seasonings Trading',
    storageNotes: 'Traditional sweet purple yam jam topping for Banana Con Yelo.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 9. PACKAGING MATERIALS (ItemType: PACKAGING)
  // --------------------------------------------------------------------------
  {
    id: 'pkg-bento-tray',
    name: '3-Compartment Bento Food Tray (Microwaveable)',
    sku: 'PKG-TRY-01',
    itemType: 'PACKAGING',
    category: 'Trays, Bowls & Containers',
    baseUnit: 'pcs',
    currentStock: 600,
    minStockLevel: 150,
    preferredRestockQty: 500,
    costPerUnit: 6.5,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'Dry packaging storage shelf B2. Carton packs of 50.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-seafood-bowl',
    name: 'Large Seafood Sharing Bowl w/ Lid',
    sku: 'PKG-BWL-02',
    itemType: 'PACKAGING',
    category: 'Trays, Bowls & Containers',
    baseUnit: 'pcs',
    currentStock: 400,
    minStockLevel: 100,
    preferredRestockQty: 350,
    costPerUnit: 8.5,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'High-grade leakproof plastic sharing bowls for All Shrimp & Mixed Seafood Bowls.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-seafood-tub',
    name: 'Clear Round Seafood Tub w/ Sealed Lid',
    sku: 'PKG-TUB-03',
    itemType: 'PACKAGING',
    category: 'Trays, Bowls & Containers',
    baseUnit: 'pcs',
    currentStock: 450,
    minStockLevel: 120,
    preferredRestockQty: 400,
    costPerUnit: 7.0,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'Durable clear tub for Mixed Seafoods Tub portion.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-fiesta-tray',
    name: 'Aluminum Fiesta Platter Tray w/ Cover',
    sku: 'PKG-TRY-FST',
    itemType: 'PACKAGING',
    category: 'Boxes & Bilao Packaging',
    baseUnit: 'pcs',
    currentStock: 250,
    minStockLevel: 60,
    preferredRestockQty: 200,
    costPerUnit: 18.0,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'Sturdy party tray with snap-on clear cover for All Shrimp & Fiesta Trays.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-cup-16oz',
    name: '16oz Clear Beverage Cup w/ Dome Lid & Straw',
    sku: 'PKG-CUP-16',
    itemType: 'PACKAGING',
    category: 'Cups, Lids & Straws',
    baseUnit: 'pcs',
    currentStock: 700,
    minStockLevel: 200,
    preferredRestockQty: 600,
    costPerUnit: 3.2,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: '16oz cups for Small Lemonade, Small Fruit Shake, and Iced Tea Glass.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-cup-22oz',
    name: '22oz Clear Beverage Cup w/ Dome Lid & Straw',
    sku: 'PKG-CUP-22',
    itemType: 'PACKAGING',
    category: 'Cups, Lids & Straws',
    baseUnit: 'pcs',
    currentStock: 600,
    minStockLevel: 180,
    preferredRestockQty: 500,
    costPerUnit: 4.0,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: '22oz cups for Big Lemonade and Big Fruit Shake.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-dessert-cup',
    name: 'Dessert Cup w/ Sealed Lid & Spoon',
    sku: 'PKG-DES-01',
    itemType: 'PACKAGING',
    category: 'Trays, Bowls & Containers',
    baseUnit: 'pcs',
    currentStock: 500,
    minStockLevel: 150,
    preferredRestockQty: 400,
    costPerUnit: 3.5,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'Cups for Mango Pudding, Banana Con Yelo, and Special Ice Cream.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-cutlery-set',
    name: 'Individually Wrapped Spoon & Fork Set w/ Napkin',
    sku: 'PKG-CUT-01',
    itemType: 'PACKAGING',
    category: 'Cutlery, Napkins & Packets',
    baseUnit: 'pcs',
    currentStock: 1200,
    minStockLevel: 300,
    preferredRestockQty: 1000,
    costPerUnit: 2.2,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'Hygienic wrapped cutlery packs near dispatch station.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-sauce-cup',
    name: 'Sauce Dipping Cup (1oz / 2oz) w/ Lid',
    sku: 'PKG-SCE-01',
    itemType: 'PACKAGING',
    category: 'Trays, Bowls & Containers',
    baseUnit: 'pcs',
    currentStock: 800,
    minStockLevel: 200,
    preferredRestockQty: 600,
    costPerUnit: 1.0,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'Portion cups for Special Cajun Sauce add-on & siomai dip.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-takeout-bag',
    name: 'Heavy Duty Takeout Carrier Plastic Bag',
    sku: 'PKG-BAG-01',
    itemType: 'PACKAGING',
    category: 'Bags, Pouches & Carriers',
    baseUnit: 'pcs',
    currentStock: 900,
    minStockLevel: 250,
    preferredRestockQty: 800,
    costPerUnit: 1.5,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'Sturdy handled plastic carry bags for order bundle dispatch.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pkg-sealing-sticker',
    name: 'Seafudz Branded Tamper-Evident Sealing Stickers',
    sku: 'PKG-STK-01',
    itemType: 'PACKAGING',
    category: 'Labels & Sealing Stickers',
    baseUnit: 'pcs',
    currentStock: 1500,
    minStockLevel: 400,
    preferredRestockQty: 1500,
    costPerUnit: 0.85,
    supplierId: 'sup-metro-pack-04',
    supplierName: 'Metro Pack & Eco Disposables',
    storageNotes: 'Safety seals placed on takeout trays and drink lids.',
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
]

// ============================================================================
// PRODUCTION RECIPES (BOM) FOR ALL MENU PRODUCTS
// ============================================================================

export const ACTUAL_RECIPES: ProductRecipe[] = [
  // --------------------------------------------------------------------------
  // 1. ALL SHRIMP ALACARTE (₱199)
  // --------------------------------------------------------------------------
  {
    productId: 'all-shrimp-alacarte-199',
    productName: 'All Shrimp Alacarte',
    productCategory: 'Seafoods',
    productPrice: 199,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'all-shrimp-alacarte-199')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 150,
        unit: 'g',
        estimatedCost: 67.5, // 150g * 0.45
      },
      {
        ingredientId: 'ing-cajun-butter',
        ingredientName: 'Cajun Butter',
        portionQuantity: 50,
        unit: 'g',
        estimatedCost: 17.0, // 50g * 0.34
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
        estimatedCost: 10.5, // 30g * 0.35
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 2, // 2 pieces (~20g)
        unit: 'pcs',
        estimatedCost: 2.0, // 2 * ₱1.0
      },
      {
        ingredientId: 'ing-paprika',
        ingredientName: 'Paprika Spice Powder',
        portionQuantity: 2.3, // 1 tsp (~2.3g)
        unit: 'g',
        estimatedCost: 1.04, // 2.3 * 0.45
      },
      {
        ingredientId: 'ing-cayenne-pepper',
        ingredientName: 'Cayenne Pepper Powder',
        portionQuantity: 0.9, // 1/2 tsp (~0.9g)
        unit: 'g',
        estimatedCost: 0.5, // 0.9 * 0.55
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
        estimatedCost: 0.11,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 1.2, // 1/2 tsp (~1.2g)
        unit: 'g',
        estimatedCost: 0.46,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-01-tray',
        packagingId: 'pkg-bento-tray',
        packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 6.5,
      },
      {
        id: 'pkg-rec-01-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Sauté 150g fresh whole shrimp in 50g Cajun butter on high heat. Add 30g special cajun sauce, paprika, cayenne, salt, and pepper. Simmer for 3 mins until fragrant and glazed. Serve with 2 calamansi halves.',
    totalFoodCost: 99.11,
    totalPackagingCost: 8.7,
    totalRawCost: 107.81,
    grossMarginPercent: 46,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 2. ALL SHRIMP BOWL (₱699)
  // --------------------------------------------------------------------------
  {
    productId: 'all-shrimp-bowl-699',
    productName: 'All Shrimp Bowl',
    productCategory: 'Seafoods',
    productPrice: 699,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'all-shrimp-bowl-699')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 300,
        unit: 'g',
        estimatedCost: 135.0, // 300g * 0.45
      },
      {
        ingredientId: 'ing-garlic-butter',
        ingredientName: 'Garlic Butter',
        portionQuantity: 100,
        unit: 'g',
        estimatedCost: 32.0, // 100g * 0.32
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 60, // 4 tbsp / 2 oz (~60g)
        unit: 'g',
        estimatedCost: 21.0, // 60g * 0.35
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 3, // 3 pieces (~30g)
        unit: 'pcs',
        estimatedCost: 3.0,
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 2, // 2 wedges (~30g)
        unit: 'pcs',
        estimatedCost: 9.0, // 2 * ₱4.5
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
        estimatedCost: 0.8,
      },
      {
        ingredientId: 'ing-fresh-parsley',
        ingredientName: 'Fresh Parsley',
        portionQuantity: 0.5, // 1 pinch (~0.5g)
        unit: 'g',
        estimatedCost: 0.18,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
        estimatedCost: 0.11,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 1.2, // 1/2 tsp (~1.2g)
        unit: 'g',
        estimatedCost: 0.46,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-02-bwl',
        packagingId: 'pkg-seafood-bowl',
        packagingName: 'Large Seafood Sharing Bowl w/ Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 8.5,
      },
      {
        id: 'pkg-rec-02-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Sauté minced garlic in 100g garlic butter until aromatic. Add 300g fresh shrimp, 60g special cajun sauce, salt, and pepper. Toss until shrimp are evenly pink and coated. Garnish with chopped parsley, 3 calamansi, and 2 lemon wedges.',
    totalFoodCost: 201.55,
    totalPackagingCost: 10.7,
    totalRawCost: 212.25,
    grossMarginPercent: 70,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 3. ALL SHRIMP PARTY TRAY (₱1099)
  // --------------------------------------------------------------------------
  {
    productId: 'all-shrimp-tray-1099',
    productName: 'All Shrimp Party Tray',
    productCategory: 'Seafoods',
    productPrice: 1099,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'all-shrimp-tray-1099')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 800, // 800g fresh whole premium shrimp
        unit: 'g',
        estimatedCost: 360.0, // 800g * 0.45
      },
      {
        ingredientId: 'ing-cajun-butter',
        ingredientName: 'Cajun Butter',
        portionQuantity: 250, // 250g butter
        unit: 'g',
        estimatedCost: 85.0, // 250g * 0.34
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 120, // 8 tbsp / 4 oz (~120g)
        unit: 'g',
        estimatedCost: 42.0, // 120g * 0.35
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 6, // 6 pieces (~60g)
        unit: 'pcs',
        estimatedCost: 6.0,
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 4, // 4 wedges (~60g)
        unit: 'pcs',
        estimatedCost: 18.0, // 4 * ₱4.5
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 10, // 2 tsp (~10g)
        unit: 'g',
        estimatedCost: 1.6,
      },
      {
        ingredientId: 'ing-paprika',
        ingredientName: 'Paprika Spice Powder',
        portionQuantity: 7, // 1 tbsp (~7g)
        unit: 'g',
        estimatedCost: 3.15,
      },
      {
        ingredientId: 'ing-cayenne-pepper',
        ingredientName: 'Cayenne Pepper Powder',
        portionQuantity: 1.8, // 1 tsp (~1.8g)
        unit: 'g',
        estimatedCost: 0.99,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 6, // 1 tsp (~6g)
        unit: 'g',
        estimatedCost: 0.21,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 2.4, // 1 tsp (~2.4g)
        unit: 'g',
        estimatedCost: 0.91,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-03-try',
        packagingId: 'pkg-fiesta-tray',
        packagingName: 'Aluminum Fiesta Platter Tray w/ Cover',
        category: 'Boxes & Bilao Packaging',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 18.0,
      },
      {
        id: 'pkg-rec-03-cut',
        packagingId: 'pkg-cutlery-set',
        packagingName: 'Individually Wrapped Spoon & Fork Set w/ Napkin',
        category: 'Cutlery, Napkins & Packets',
        quantity: 2,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 4.4,
      },
    ],
    preparationInstructions:
      'In large commercial wok, melt 250g Cajun butter and sauté 10g minced garlic. Add 800g fresh shrimp and sear evenly. Pour in 120g special cajun sauce, paprika, cayenne, salt, and black pepper. Simmer until sauce thickens and glazes every shrimp. Neatly arrange in aluminum fiesta party platter and garnish with 6 calamansi and 4 lemon wedges.',
    totalFoodCost: 517.86,
    totalPackagingCost: 22.4,
    totalRawCost: 540.26,
    grossMarginPercent: 51,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 4. MIXED SEAFOODS ALACARTE (MINI) (₱99)
  // --------------------------------------------------------------------------
  {
    productId: 'mixed-seafoods-alacarte-99',
    productName: 'Mixed Seafoods Alacarte (Mini)',
    productCategory: 'Seafoods',
    productPrice: 99,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'mixed-seafoods-alacarte-99')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-crab-halves',
        ingredientName: 'Crab (Halves)',
        portionQuantity: 100, // 100g crab halves
        unit: 'g',
        estimatedCost: 55.0, // 100g * 0.55
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 100, // 100g whole shrimp
        unit: 'g',
        estimatedCost: 45.0, // 100g * 0.45
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 100, // 100g green mussels
        unit: 'g',
        estimatedCost: 22.0, // 100g * 0.22
      },
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 2, // 2 mini corn cob slices (approx. 80g)
        unit: 'pcs',
        estimatedCost: 10.0, // 2 * ₱5.0
      },
      {
        ingredientId: 'ing-butter',
        ingredientName: 'Pure Butter Blend',
        portionQuantity: 60, // 60g butter
        unit: 'g',
        estimatedCost: 16.8, // 60g * 0.28
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
        estimatedCost: 10.5, // 30g * 0.35
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 2, // 2 pieces (~20g)
        unit: 'pcs',
        estimatedCost: 2.0,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
        estimatedCost: 0.11,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 1.2, // 1/2 tsp (~1.2g)
        unit: 'g',
        estimatedCost: 0.46,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-04-try',
        packagingId: 'pkg-bento-tray',
        packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 6.5,
      },
      {
        id: 'pkg-rec-04-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Sauté crab halves, whole shrimp, and green mussels in 60g melted butter. Add 2 mini corn cob slices and 30g special cajun sauce. Season with salt and pepper. Toss until sauce coats seafood completely. Serve with 2 calamansi halves.',
    totalFoodCost: 161.87,
    totalPackagingCost: 8.7,
    totalRawCost: 170.57,
    grossMarginPercent: 35,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 5. MIXED SEAFOODS TUB (₱189)
  // --------------------------------------------------------------------------
  {
    productId: 'mixed-seafoods-tub-189',
    productName: 'Mixed Seafoods Tub',
    productCategory: 'Seafoods',
    productPrice: 189,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'mixed-seafoods-tub-189')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-crab-halves',
        ingredientName: 'Crab (Halves)',
        portionQuantity: 150, // 150g crab halves
        unit: 'g',
        estimatedCost: 82.5,
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 150, // 150g whole shrimp
        unit: 'g',
        estimatedCost: 67.5,
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 150, // 150g green mussels
        unit: 'g',
        estimatedCost: 33.0,
      },
      {
        ingredientId: 'ing-shellfish-clams',
        ingredientName: 'Shellfish / Clams',
        portionQuantity: 100, // 100g clams/clams medley
        unit: 'g',
        estimatedCost: 25.0,
      },
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 3, // 3 mini corn cob slices (approx. 120g)
        unit: 'pcs',
        estimatedCost: 15.0,
      },
      {
        ingredientId: 'ing-butter',
        ingredientName: 'Pure Butter Blend',
        portionQuantity: 90, // 90g butter
        unit: 'g',
        estimatedCost: 25.2,
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 45, // 3 tbsp / 1.5 oz (~45g)
        unit: 'g',
        estimatedCost: 15.75,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 3, // 3 pieces (~30g)
        unit: 'pcs',
        estimatedCost: 3.0,
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 10, // 2 tsp (~10g)
        unit: 'g',
        estimatedCost: 1.6,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 6, // 1 tsp (~6g)
        unit: 'g',
        estimatedCost: 0.21,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 2.4, // 1 tsp (~2.4g)
        unit: 'g',
        estimatedCost: 0.91,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-05-tub',
        packagingId: 'pkg-seafood-tub',
        packagingName: 'Clear Round Seafood Tub w/ Sealed Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 7.0,
      },
      {
        id: 'pkg-rec-05-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Sauté minced garlic in 90g butter, add crab, shrimp, mussels, clams, and 3 corn slices. Toss with 45g special cajun sauce and seasonings. Pour into clear sealed seafood tub and top with 3 fresh calamansi.',
    totalFoodCost: 269.67,
    totalPackagingCost: 9.2,
    totalRawCost: 278.87,
    grossMarginPercent: 42,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 6. MIXED SEAFOODS BOWL (₱699)
  // --------------------------------------------------------------------------
  {
    productId: 'mixed-seafoods-bowl-699',
    productName: 'Mixed Seafoods Bowl',
    productCategory: 'Seafoods',
    productPrice: 699,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'mixed-seafoods-bowl-699')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-crab-halves',
        ingredientName: 'Crab (Halves)',
        portionQuantity: 300, // 300g crab halves
        unit: 'g',
        estimatedCost: 165.0,
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 300, // 300g whole shrimp
        unit: 'g',
        estimatedCost: 135.0,
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 250, // 250g green mussels
        unit: 'g',
        estimatedCost: 55.0,
      },
      {
        ingredientId: 'ing-shellfish-clams',
        ingredientName: 'Shellfish / Clams',
        portionQuantity: 150, // 150g clams/shellfish
        unit: 'g',
        estimatedCost: 37.5,
      },
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 4, // 4 mini corn cob slices (approx. 160g)
        unit: 'pcs',
        estimatedCost: 20.0,
      },
      {
        ingredientId: 'ing-butter',
        ingredientName: 'Pure Butter Blend',
        portionQuantity: 150, // 150g butter
        unit: 'g',
        estimatedCost: 42.0,
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 90, // 6 tbsp / 3 oz (~90g)
        unit: 'g',
        estimatedCost: 31.5,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 4, // 4 pieces (~40g)
        unit: 'pcs',
        estimatedCost: 4.0,
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 3, // 3 wedges (~45g)
        unit: 'pcs',
        estimatedCost: 13.5,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 9, // 1.5 tsp (~9g)
        unit: 'g',
        estimatedCost: 0.32,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 3.6, // 1.5 tsp (~3.6g)
        unit: 'g',
        estimatedCost: 1.37,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-06-bwl',
        packagingId: 'pkg-seafood-bowl',
        packagingName: 'Large Seafood Sharing Bowl w/ Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 8.5,
      },
      {
        id: 'pkg-rec-06-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Wok simmer 300g crab, 300g shrimp, 250g mussels, 150g clams with 4 sweet corn slices in 150g rich butter. Glaze with 90g special cajun sauce and spices. Dish into large sharing bowl with 4 calamansi and 3 lemon wedges.',
    totalFoodCost: 505.19,
    totalPackagingCost: 10.7,
    totalRawCost: 515.89,
    grossMarginPercent: 62,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 7. MIXED SEAFOODS FIESTA TRAY (₱1199)
  // --------------------------------------------------------------------------
  {
    productId: 'mixed-seafoods-tray-1199',
    productName: 'Mixed Seafoods Fiesta Tray',
    productCategory: 'Seafoods',
    productPrice: 1199,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'mixed-seafoods-tray-1199')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-crab-halves',
        ingredientName: 'Crab (Halves)',
        portionQuantity: 600, // 600g crab halves
        unit: 'g',
        estimatedCost: 330.0,
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 600, // 600g whole premium shrimp
        unit: 'g',
        estimatedCost: 270.0,
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 500, // 500g green mussels
        unit: 'g',
        estimatedCost: 110.0,
      },
      {
        ingredientId: 'ing-shellfish-clams',
        ingredientName: 'Shellfish / Clams',
        portionQuantity: 300, // 300g clams/shellfish
        unit: 'g',
        estimatedCost: 75.0,
      },
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 8, // 8 mini corn cob slices (approx. 320g)
        unit: 'pcs',
        estimatedCost: 40.0,
      },
      {
        ingredientId: 'ing-butter',
        ingredientName: 'Pure Butter Blend',
        portionQuantity: 300, // 300g butter
        unit: 'g',
        estimatedCost: 84.0,
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 150, // 10 tbsp / 5 oz (~150g)
        unit: 'g',
        estimatedCost: 52.5,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 8, // 8 pieces (~80g)
        unit: 'pcs',
        estimatedCost: 8.0,
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 6, // 6 wedges (~90g)
        unit: 'pcs',
        estimatedCost: 27.0,
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
        estimatedCost: 2.4,
      },
      {
        ingredientId: 'ing-paprika',
        ingredientName: 'Paprika Spice Powder',
        portionQuantity: 10.5, // 1.5 tbsp (~10.5g)
        unit: 'g',
        estimatedCost: 4.73,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 18, // 1 tbsp (~18g)
        unit: 'g',
        estimatedCost: 0.63,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 7.2, // 1 tbsp (~7.2g)
        unit: 'g',
        estimatedCost: 2.74,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-07-try',
        packagingId: 'pkg-fiesta-tray',
        packagingName: 'Aluminum Fiesta Platter Tray w/ Cover',
        category: 'Boxes & Bilao Packaging',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 18.0,
      },
      {
        id: 'pkg-rec-07-cut',
        packagingId: 'pkg-cutlery-set',
        packagingName: 'Individually Wrapped Spoon & Fork Set w/ Napkin',
        category: 'Cutlery, Napkins & Packets',
        quantity: 2,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 4.4,
      },
    ],
    preparationInstructions:
      'Grand Fiesta portion: Melt 300g butter with 15g minced garlic, saute 600g crab, 600g shrimp, 500g mussels, 300g clams, and 8 corn cobs. Toss in 150g special cajun sauce, paprika, salt, and black pepper. Plate symmetrically into large aluminum fiesta party tray. Garnish with 8 calamansi and 6 lemon wedges.',
    totalFoodCost: 1022.0,
    totalPackagingCost: 22.4,
    totalRawCost: 1044.4,
    grossMarginPercent: 48,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 8. CHICKEN PASTIL (₱35)
  // --------------------------------------------------------------------------
  {
    productId: 'chicken-pastil-35',
    productName: 'Chicken Pastil',
    productCategory: 'Value Meals',
    productPrice: 35,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'chicken-pastil-35')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-shredded-chicken',
        ingredientName: 'Shredded Chicken (Pastil Filling)',
        portionQuantity: 80,
        unit: 'g',
        estimatedCost: 22.4, // 80g * 0.28
      },
      {
        ingredientId: 'ing-steamed-white-rice',
        ingredientName: 'Steaming White Rice (Jasmine)',
        portionQuantity: 200,
        unit: 'g',
        estimatedCost: 11.0, // 200g * 0.055
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 14, // 1 tbsp (~14g)
        unit: 'g',
        estimatedCost: 1.68,
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
        estimatedCost: 0.8,
      },
      {
        ingredientId: 'ing-chopped-onion',
        ingredientName: 'Chopped Onion',
        portionQuantity: 55, // 1/2 medium onion (~55g)
        unit: 'g',
        estimatedCost: 6.05,
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
        estimatedCost: 1.2,
      },
      {
        ingredientId: 'ing-vinegar-dip',
        ingredientName: 'Vinegar Dip / Cane Vinegar',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
        estimatedCost: 0.3,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
        estimatedCost: 0.11,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 0.6, // 1/4 tsp (~0.6g)
        unit: 'g',
        estimatedCost: 0.23,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-08-try',
        packagingId: 'pkg-bento-tray',
        packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 6.5,
      },
      {
        id: 'pkg-rec-08-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Sauté garlic and onion in cooking oil. Add 80g shredded chicken with soy sauce, vinegar, salt, and black pepper until savory and slightly crisp. Scoop 200g steaming Jasmine rice into container and generously top with chicken kagikit pastil.',
    totalFoodCost: 43.77,
    totalPackagingCost: 8.7,
    totalRawCost: 52.47,
    grossMarginPercent: 30,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 9. FRIED NOODLES (₱35)
  // --------------------------------------------------------------------------
  {
    productId: 'fried-noodles-35',
    productName: 'Fried Noodles',
    productCategory: 'Value Meals',
    productPrice: 35,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'fried-noodles-35')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-street-stirfry-noodles',
        ingredientName: 'Street Stir-Fry Noodles',
        portionQuantity: 150,
        unit: 'g',
        estimatedCost: 16.5, // 150g * 0.11
      },
      {
        ingredientId: 'ing-pork-siomai',
        ingredientName: 'Pork Siomai',
        portionQuantity: 3, // 3 pieces (~60g total, ~20g each)
        unit: 'pcs',
        estimatedCost: 7.5, // 3 * ₱2.5
      },
      {
        ingredientId: 'ing-stirfry-savory-sauce',
        ingredientName: 'Stir-Fry Savory Sauce / Chao Fan Seasoning',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
        estimatedCost: 6.6, // 30g * 0.22
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 14, // 1 tbsp (~14g)
        unit: 'g',
        estimatedCost: 1.68,
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
        estimatedCost: 0.8,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
        estimatedCost: 0.11,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 0.6, // 1/4 tsp (~0.6g)
        unit: 'g',
        estimatedCost: 0.23,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-09-try',
        packagingId: 'pkg-bento-tray',
        packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 6.5,
      },
      {
        id: 'pkg-rec-09-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Wok fry 150g street noodles with 5g garlic and 14g oil. Add 30g savory stir-fry sauce and seasonings on high heat. Plate noodles and top with 3 hot steamed pork siomai.',
    totalFoodCost: 33.42,
    totalPackagingCost: 8.7,
    totalRawCost: 42.12,
    grossMarginPercent: 32,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 10. CHAO FAN (₱35)
  // --------------------------------------------------------------------------
  {
    productId: 'chao-fan-35',
    productName: 'Chao Fan',
    productCategory: 'Value Meals',
    productPrice: 35,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'chao-fan-35')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-steamed-white-rice',
        ingredientName: 'Steaming White Rice (Jasmine)',
        portionQuantity: 200,
        unit: 'g',
        estimatedCost: 11.0,
      },
      {
        ingredientId: 'ing-seasoned-meat-bits',
        ingredientName: 'Seasoned Meat Bits',
        portionQuantity: 50,
        unit: 'g',
        estimatedCost: 13.0, // 50g * 0.26
      },
      {
        ingredientId: 'ing-fresh-eggs',
        ingredientName: 'Fresh Eggs (Large)',
        portionQuantity: 1, // 1 large egg (~50g)
        unit: 'pcs',
        estimatedCost: 7.5,
      },
      {
        ingredientId: 'ing-mixed-vegetables',
        ingredientName: 'Mixed Vegetables (Cabbage, Carrots, Peas)',
        portionQuantity: 40,
        unit: 'g',
        estimatedCost: 4.8, // 40g * 0.12
      },
      {
        ingredientId: 'ing-spring-onion',
        ingredientName: 'Chopped Spring Onion',
        portionQuantity: 6, // 1 tbsp (~6g)
        unit: 'g',
        estimatedCost: 1.08,
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 4.7, // 1 tsp (~4.7g)
        unit: 'g',
        estimatedCost: 0.56,
      },
      {
        ingredientId: 'ing-stirfry-savory-sauce',
        ingredientName: 'Stir-Fry Savory Sauce / Chao Fan Seasoning',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
        estimatedCost: 3.3,
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
        estimatedCost: 0.8,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
        estimatedCost: 0.11,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 0.6, // 1/4 tsp (~0.6g)
        unit: 'g',
        estimatedCost: 0.23,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-10-try',
        packagingId: 'pkg-bento-tray',
        packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 6.5,
      },
      {
        id: 'pkg-rec-10-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Wok scramble 1 egg with minced garlic in oil. Add 50g meat bits, 40g mixed vegetables, and 200g rice. Season with 15g chao fan sauce, salt, and pepper. Toss continuously over high heat until grain-separated and fragrant. Garnish with chopped spring onion.',
    totalFoodCost: 42.38,
    totalPackagingCost: 8.7,
    totalRawCost: 51.08,
    grossMarginPercent: 35,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 11. PORK SIOMAI (₱5)
  // --------------------------------------------------------------------------
  {
    productId: 'pork-siomai-5',
    productName: 'Pork Siomai',
    productCategory: 'Siomai',
    productPrice: 5,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'pork-siomai-5')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-pork-siomai',
        ingredientName: 'Pork Siomai',
        portionQuantity: 1, // 1 piece (~20g)
        unit: 'pcs',
        estimatedCost: 2.5,
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
        estimatedCost: 1.25,
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5, // 1/2 tsp (~2.5g)
        unit: 'g',
        estimatedCost: 0.2,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1, // 1 piece (~10g)
        unit: 'pcs',
        estimatedCost: 1.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-sio-sauce',
        packagingId: 'pkg-sauce-cup',
        packagingName: 'Sauce Dipping Cup (1oz / 2oz) w/ Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 1.0,
      },
    ],
    preparationInstructions: 'Steam fresh pork siomai dumpling. Serve hot with chili garlic sauce, soy sauce, and fresh calamansi.',
    totalFoodCost: 4.95,
    totalPackagingCost: 1.0,
    totalRawCost: 5.95,
    grossMarginPercent: 40,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 12. BEEF SIOMAI (₱5)
  // --------------------------------------------------------------------------
  {
    productId: 'beef-siomai-5',
    productName: 'Beef Siomai',
    productCategory: 'Siomai',
    productPrice: 5,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'beef-siomai-5')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-beef-siomai',
        ingredientName: 'Beef Siomai',
        portionQuantity: 1,
        unit: 'pcs',
        estimatedCost: 2.7,
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5,
        unit: 'g',
        estimatedCost: 1.25,
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5,
        unit: 'g',
        estimatedCost: 0.2,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1,
        unit: 'pcs',
        estimatedCost: 1.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-sio-sauce-2',
        packagingId: 'pkg-sauce-cup',
        packagingName: 'Sauce Dipping Cup (1oz / 2oz) w/ Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 1.0,
      },
    ],
    preparationInstructions: 'Steam beef siomai dumpling. Serve hot with chili garlic sauce, soy sauce, and fresh calamansi.',
    totalFoodCost: 5.15,
    totalPackagingCost: 1.0,
    totalRawCost: 6.15,
    grossMarginPercent: 38,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 13. CHICKEN SIOMAI (₱5)
  // --------------------------------------------------------------------------
  {
    productId: 'chicken-siomai-5',
    productName: 'Chicken Siomai',
    productCategory: 'Siomai',
    productPrice: 5,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'chicken-siomai-5')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-chicken-siomai',
        ingredientName: 'Chicken Siomai',
        portionQuantity: 1,
        unit: 'pcs',
        estimatedCost: 2.5,
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5,
        unit: 'g',
        estimatedCost: 1.25,
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5,
        unit: 'g',
        estimatedCost: 0.2,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1,
        unit: 'pcs',
        estimatedCost: 1.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-sio-sauce-3',
        packagingId: 'pkg-sauce-cup',
        packagingName: 'Sauce Dipping Cup (1oz / 2oz) w/ Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 1.0,
      },
    ],
    preparationInstructions: 'Steam chicken siomai dumpling. Serve hot with chili garlic sauce, soy sauce, and fresh calamansi.',
    totalFoodCost: 4.95,
    totalPackagingCost: 1.0,
    totalRawCost: 5.95,
    grossMarginPercent: 40,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 14. SHARKSFIN SIOMAI (₱5)
  // --------------------------------------------------------------------------
  {
    productId: 'sharksfin-siomai-5',
    productName: 'Sharksfin Siomai',
    productCategory: 'Siomai',
    productPrice: 5,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'sharksfin-siomai-5')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-sharksfin-siomai',
        ingredientName: 'Sharksfin Siomai',
        portionQuantity: 1,
        unit: 'pcs',
        estimatedCost: 2.8,
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5,
        unit: 'g',
        estimatedCost: 1.25,
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5,
        unit: 'g',
        estimatedCost: 0.2,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1,
        unit: 'pcs',
        estimatedCost: 1.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-sio-sauce-4',
        packagingId: 'pkg-sauce-cup',
        packagingName: 'Sauce Dipping Cup (1oz / 2oz) w/ Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 1.0,
      },
    ],
    preparationInstructions: 'Steam sharksfin dumpling until hot and tender. Serve with chili garlic, soy sauce, and fresh calamansi.',
    totalFoodCost: 5.25,
    totalPackagingCost: 1.0,
    totalRawCost: 6.25,
    grossMarginPercent: 37,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 15. JAPANESE SIOMAI (₱6)
  // --------------------------------------------------------------------------
  {
    productId: 'japanese-siomai-6',
    productName: 'Japanese Siomai',
    productCategory: 'Siomai',
    productPrice: 6,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'japanese-siomai-6')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-japanese-siomai',
        ingredientName: 'Japanese Siomai',
        portionQuantity: 1,
        unit: 'pcs',
        estimatedCost: 3.2,
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5,
        unit: 'g',
        estimatedCost: 1.25,
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5,
        unit: 'g',
        estimatedCost: 0.2,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1,
        unit: 'pcs',
        estimatedCost: 1.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-sio-sauce-5',
        packagingId: 'pkg-sauce-cup',
        packagingName: 'Sauce Dipping Cup (1oz / 2oz) w/ Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 1.0,
      },
    ],
    preparationInstructions: 'Steam nori-wrapped Japanese siomai until tender. Serve with chili garlic sauce, soy sauce, and calamansi.',
    totalFoodCost: 5.65,
    totalPackagingCost: 1.0,
    totalRawCost: 6.65,
    grossMarginPercent: 45,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 16. SWEET CORN ADD-ON (₱20)
  // --------------------------------------------------------------------------
  {
    productId: 'corn-addon-20',
    productName: 'Sweet Corn',
    productCategory: 'Add Ons',
    productPrice: 20,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'corn-addon-20')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 1, // 1 piece (approx. 40g)
        unit: 'pcs',
        estimatedCost: 5.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Simmer 1 sweet corn cob slice in cajun butter broth until sweet and tender.',
    totalFoodCost: 5.0,
    totalPackagingCost: 0,
    totalRawCost: 5.0,
    grossMarginPercent: 75,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 17. EXTRA STEAMED RICE (1 CUP) (₱20)
  // --------------------------------------------------------------------------
  {
    productId: 'rice-cup-20',
    productName: 'Extra Steamed Rice (1 Cup)',
    productCategory: 'Add Ons',
    productPrice: 20,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'rice-cup-20')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-steamed-white-rice',
        ingredientName: 'Steaming White Rice (Jasmine)',
        portionQuantity: 200, // 1 cup (200g)
        unit: 'g',
        estimatedCost: 11.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Scoop 1 full cup (200g) of hot steaming white Jasmine rice.',
    totalFoodCost: 11.0,
    totalPackagingCost: 0,
    totalRawCost: 11.0,
    grossMarginPercent: 45,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 18. SHRIMP REGULAR ADD-ON (₱20)
  // --------------------------------------------------------------------------
  {
    productId: 'shrimp-regular-addon-20',
    productName: 'Shrimp Regular Add-On',
    productCategory: 'Add Ons',
    productPrice: 20,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'shrimp-regular-addon-20')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-shrimp-regular-pc',
        ingredientName: 'Fresh Regular Shrimp (Piece)',
        portionQuantity: 1, // 1 piece (approx. 20g)
        unit: 'pcs',
        estimatedCost: 9.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Sauté 1 piece regular shrimp (~20g) in cajun sauce.',
    totalFoodCost: 9.0,
    totalPackagingCost: 0,
    totalRawCost: 9.0,
    grossMarginPercent: 55,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 19. SHRIMP JUMBO ADD-ON (₱30)
  // --------------------------------------------------------------------------
  {
    productId: 'shrimp-jumbo-addon-30',
    productName: 'Shrimp Jumbo Add-On',
    productCategory: 'Add Ons',
    productPrice: 30,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'shrimp-jumbo-addon-30')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-shrimp-jumbo-pc',
        ingredientName: 'Fresh Jumbo Shrimp (Piece)',
        portionQuantity: 1, // 1 piece (approx. 37.5g)
        unit: 'pcs',
        estimatedCost: 16.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Sauté 1 piece premium jumbo shrimp (~37.5g) in hot cajun butter.',
    totalFoodCost: 16.0,
    totalPackagingCost: 0,
    totalRawCost: 16.0,
    grossMarginPercent: 47,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 20. TAHONG (MUSSELS) ADD-ON (₱30)
  // --------------------------------------------------------------------------
  {
    productId: 'tahong-addon-30',
    productName: 'Tahong (Mussels) Add-On',
    productCategory: 'Add Ons',
    productPrice: 30,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'tahong-addon-30')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 50, // 3 pieces (approx. 50g)
        unit: 'g',
        estimatedCost: 11.0, // 50g * 0.22
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Add 3 pieces (~50g) fresh green mussels into sauce simmer.',
    totalFoodCost: 11.0,
    totalPackagingCost: 0,
    totalRawCost: 11.0,
    grossMarginPercent: 63,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 21. SLICED SAUSAGE (₱50)
  // --------------------------------------------------------------------------
  {
    productId: 'sausage-addon-50',
    productName: 'Sliced Sausage',
    productCategory: 'Add Ons',
    productPrice: 50,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'sausage-addon-50')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-sliced-sausage',
        ingredientName: 'Sliced Sausage (Smoked Rounds)',
        portionQuantity: 50, // 50g
        unit: 'g',
        estimatedCost: 16.0, // 50g * 0.32
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Pan-sear 50g sliced sausage coin rounds and glaze with cajun butter sauce.',
    totalFoodCost: 16.0,
    totalPackagingCost: 0,
    totalRawCost: 16.0,
    grossMarginPercent: 68,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 22. SPECIAL CAJUN SEAFOOD SAUCE (₱30)
  // --------------------------------------------------------------------------
  {
    productId: 'special-sauce-addon-30',
    productName: 'Special Cajun Seafood Sauce',
    productCategory: 'Add Ons',
    productPrice: 30,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'special-sauce-addon-30')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
        estimatedCost: 10.5,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-sauce-cup-addon',
        packagingId: 'pkg-sauce-cup',
        packagingName: 'Sauce Dipping Cup (1oz / 2oz) w/ Lid',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 1.0,
      },
    ],
    preparationInstructions: 'Portion 30g (2 tbsp / 1 fl oz) hot special cajun seafood dipping sauce.',
    totalFoodCost: 10.5,
    totalPackagingCost: 1.0,
    totalRawCost: 11.5,
    grossMarginPercent: 62,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 23. FRESH LEMONADE (SMALL) (₱40)
  // --------------------------------------------------------------------------
  {
    productId: 'lemonade-small-40',
    productName: 'Fresh Lemonade (Small)',
    productCategory: 'Shake & Lemonade',
    productPrice: 40,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'lemonade-small-40')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-lemon-juice',
        ingredientName: 'Fresh Lemon Juice',
        portionQuantity: 22.5, // 1.5 tbsp / 22.5ml (~22.5g)
        unit: 'ml',
        estimatedCost: 5.63,
      },
      {
        ingredientId: 'ing-calamansi-juice',
        ingredientName: 'Fresh Calamansi Juice',
        portionQuantity: 15, // 1 tbsp / 15ml (~15g)
        unit: 'ml',
        estimatedCost: 3.0,
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 30, // 2 tbsp / 30ml (~39g)
        unit: 'ml',
        estimatedCost: 3.0,
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 150, // 150ml (150g)
        unit: 'ml',
        estimatedCost: 1.5,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 220, // 1 cup / 16 oz filled (~220g)
        unit: 'g',
        estimatedCost: 4.4,
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 1, // 1 slice (~15g)
        unit: 'pcs',
        estimatedCost: 4.5,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-lem-sm-cup',
        packagingId: 'pkg-cup-16oz',
        packagingName: '16oz Clear Beverage Cup w/ Dome Lid & Straw',
        category: 'Cups, Lids & Straws',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 3.2,
      },
    ],
    preparationInstructions:
      'Combine 22.5ml lemon juice, 15ml calamansi juice, 30ml sugar syrup, and 150ml purified water in a shaker. Shake vigorously with crushed ice. Pour into 16oz cup and float 1 lemon slice.',
    totalFoodCost: 22.03,
    totalPackagingCost: 3.2,
    totalRawCost: 25.23,
    grossMarginPercent: 37,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 24. FRESH LEMONADE (BIG) (₱50)
  // --------------------------------------------------------------------------
  {
    productId: 'lemonade-big-50',
    productName: 'Fresh Lemonade (Big)',
    productCategory: 'Shake & Lemonade',
    productPrice: 50,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'lemonade-big-50')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-lemon-juice',
        ingredientName: 'Fresh Lemon Juice',
        portionQuantity: 37.5, // 2.5 tbsp / 37.5ml (~37.5g)
        unit: 'ml',
        estimatedCost: 9.38,
      },
      {
        ingredientId: 'ing-calamansi-juice',
        ingredientName: 'Fresh Calamansi Juice',
        portionQuantity: 22.5, // 1.5 tbsp / 22.5ml (~22.5g)
        unit: 'ml',
        estimatedCost: 4.5,
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 45, // 3 tbsp / 45ml (~58.5g)
        unit: 'ml',
        estimatedCost: 4.5,
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 220, // 220ml (220g)
        unit: 'ml',
        estimatedCost: 2.2,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 330, // 1.5 cups / 22 oz filled (~330g)
        unit: 'g',
        estimatedCost: 6.6,
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 2, // 2 slices (~30g)
        unit: 'pcs',
        estimatedCost: 9.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-lem-bg-cup',
        packagingId: 'pkg-cup-22oz',
        packagingName: '22oz Clear Beverage Cup w/ Dome Lid & Straw',
        category: 'Cups, Lids & Straws',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 4.0,
      },
    ],
    preparationInstructions:
      'Combine 37.5ml lemon juice, 22.5ml calamansi juice, 45ml sugar syrup, and 220ml water. Shake with 330g crushed ice. Serve in 22oz cup with 2 fresh lemon slices.',
    totalFoodCost: 36.18,
    totalPackagingCost: 4.0,
    totalRawCost: 40.18,
    grossMarginPercent: 30,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 25. CUCUMBER LEMONADE (SMALL) (₱40)
  // --------------------------------------------------------------------------
  {
    productId: 'cucumber-lemonade-small-40',
    productName: 'Cucumber Lemonade (Small)',
    productCategory: 'Shake & Lemonade',
    productPrice: 40,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'cucumber-lemonade-small-40')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-cucumber-juice',
        ingredientName: 'Cucumber Juice / Blend',
        portionQuantity: 30, // 2 tbsp / 30ml (~30g)
        unit: 'ml',
        estimatedCost: 5.4,
      },
      {
        ingredientId: 'ing-lemon-juice',
        ingredientName: 'Fresh Lemon Juice',
        portionQuantity: 22.5, // 1.5 tbsp / 22.5ml (~22.5g)
        unit: 'ml',
        estimatedCost: 5.63,
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 30, // 2 tbsp / 30ml (~39g)
        unit: 'ml',
        estimatedCost: 3.0,
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 150, // 150ml (150g)
        unit: 'ml',
        estimatedCost: 1.5,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 220, // 1 cup / 16 oz filled (~220g)
        unit: 'g',
        estimatedCost: 4.4,
      },
      {
        ingredientId: 'ing-fresh-cucumber',
        ingredientName: 'Fresh Cucumber (Slices)',
        portionQuantity: 1, // 1 slice (~10g)
        unit: 'pcs',
        estimatedCost: 1.5,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-cuc-sm-cup',
        packagingId: 'pkg-cup-16oz',
        packagingName: '16oz Clear Beverage Cup w/ Dome Lid & Straw',
        category: 'Cups, Lids & Straws',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 3.2,
      },
    ],
    preparationInstructions:
      'Blend 30ml cucumber puree with 22.5ml lemon juice, 30ml syrup, and 150ml water. Pour over 220g crushed ice in 16oz cup and garnish with 1 cucumber slice.',
    totalFoodCost: 21.43,
    totalPackagingCost: 3.2,
    totalRawCost: 24.63,
    grossMarginPercent: 38,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 26. CUCUMBER LEMONADE (BIG) (₱50)
  // --------------------------------------------------------------------------
  {
    productId: 'cucumber-lemonade-big-50',
    productName: 'Cucumber Lemonade (Big)',
    productCategory: 'Shake & Lemonade',
    productPrice: 50,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'cucumber-lemonade-big-50')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-cucumber-juice',
        ingredientName: 'Cucumber Juice / Blend',
        portionQuantity: 45, // 3 tbsp / 45ml (~45g)
        unit: 'ml',
        estimatedCost: 8.1,
      },
      {
        ingredientId: 'ing-lemon-juice',
        ingredientName: 'Fresh Lemon Juice',
        portionQuantity: 37.5, // 2.5 tbsp / 37.5ml (~37.5g)
        unit: 'ml',
        estimatedCost: 9.38,
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 45, // 3 tbsp / 45ml (~58.5g)
        unit: 'ml',
        estimatedCost: 4.5,
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 220, // 220ml (220g)
        unit: 'ml',
        estimatedCost: 2.2,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 330, // 1.5 cups / 22 oz filled (~330g)
        unit: 'g',
        estimatedCost: 6.6,
      },
      {
        ingredientId: 'ing-fresh-cucumber',
        ingredientName: 'Fresh Cucumber (Slices)',
        portionQuantity: 2, // 2 slices (~20g)
        unit: 'pcs',
        estimatedCost: 3.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-cuc-bg-cup',
        packagingId: 'pkg-cup-22oz',
        packagingName: '22oz Clear Beverage Cup w/ Dome Lid & Straw',
        category: 'Cups, Lids & Straws',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 4.0,
      },
    ],
    preparationInstructions:
      'Blend 45ml cucumber juice, 37.5ml lemon juice, 45ml syrup, and 220ml water. Shake with 330g crushed ice in 22oz cup. Garnish with 2 cucumber slices.',
    totalFoodCost: 33.78,
    totalPackagingCost: 4.0,
    totalRawCost: 37.78,
    grossMarginPercent: 35,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 27. FRUIT SHAKE (SMALL) (₱40)
  // --------------------------------------------------------------------------
  {
    productId: 'shake-small-40',
    productName: 'Fruit Shake (Small)',
    productCategory: 'Shake & Lemonade',
    productPrice: 40,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'shake-small-40')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-fruit-puree',
        ingredientName: 'Real Fruit / Fruit Puree',
        portionQuantity: 80, // 80g
        unit: 'g',
        estimatedCost: 20.0,
      },
      {
        ingredientId: 'ing-creamy-condensed-milk',
        ingredientName: 'Creamy Milk Base / Condensed Milk',
        portionQuantity: 39, // 2 tbsp / 30ml (~39g)
        unit: 'g',
        estimatedCost: 6.24,
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 15, // 1 tbsp / 15ml (~19.5g)
        unit: 'ml',
        estimatedCost: 1.5,
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 50, // 50ml (50g)
        unit: 'ml',
        estimatedCost: 0.5,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 220, // 1 cup / 16 oz filled (~220g)
        unit: 'g',
        estimatedCost: 4.4,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-shk-sm-cup',
        packagingId: 'pkg-cup-16oz',
        packagingName: '16oz Clear Beverage Cup w/ Dome Lid & Straw',
        category: 'Cups, Lids & Straws',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 3.2,
      },
    ],
    preparationInstructions:
      'In commercial blender, combine 80g fruit puree, 39g creamy milk base, 15ml syrup, 50ml water, and 220g crushed ice. Blend on high speed until smooth and creamy. Pour into 16oz cup.',
    totalFoodCost: 32.64,
    totalPackagingCost: 3.2,
    totalRawCost: 35.84,
    grossMarginPercent: 30,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 28. FRUIT SHAKE (BIG) (₱50)
  // --------------------------------------------------------------------------
  {
    productId: 'shake-big-50',
    productName: 'Fruit Shake (Big)',
    productCategory: 'Shake & Lemonade',
    productPrice: 50,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'shake-big-50')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-fruit-puree',
        ingredientName: 'Real Fruit / Fruit Puree',
        portionQuantity: 130, // 130g
        unit: 'g',
        estimatedCost: 32.5,
      },
      {
        ingredientId: 'ing-creamy-condensed-milk',
        ingredientName: 'Creamy Milk Base / Condensed Milk',
        portionQuantity: 58.5, // 3 tbsp / 45ml (~58.5g)
        unit: 'g',
        estimatedCost: 9.36,
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 30, // 2 tbsp / 30ml (~39g)
        unit: 'ml',
        estimatedCost: 3.0,
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 80, // 80ml (80g)
        unit: 'ml',
        estimatedCost: 0.8,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 330, // 1.5 cups / 22 oz filled (~330g)
        unit: 'g',
        estimatedCost: 6.6,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-shk-bg-cup',
        packagingId: 'pkg-cup-22oz',
        packagingName: '22oz Clear Beverage Cup w/ Dome Lid & Straw',
        category: 'Cups, Lids & Straws',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 4.0,
      },
    ],
    preparationInstructions:
      'Blend 130g fruit puree, 58.5g milk base, 30ml syrup, 80ml water, and 330g crushed ice. Blend until velvety. Serve in 22oz cup with wide boba straw.',
    totalFoodCost: 52.26,
    totalPackagingCost: 4.0,
    totalRawCost: 56.26,
    grossMarginPercent: 32,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 29. MANGO PUDDING (₱50)
  // --------------------------------------------------------------------------
  {
    productId: 'mango-pudding-50',
    productName: 'Mango Pudding',
    productCategory: 'Desserts',
    productPrice: 50,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'mango-pudding-50')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-mango-custard-base',
        ingredientName: 'Mango Custard Base',
        portionQuantity: 120, // 120g
        unit: 'g',
        estimatedCost: 21.6,
      },
      {
        ingredientId: 'ing-sweet-mango-syrup',
        ingredientName: 'Sweet Mango Syrup',
        portionQuantity: 39, // 2 tbsp / 30ml (~39g)
        unit: 'g',
        estimatedCost: 8.58,
      },
      {
        ingredientId: 'ing-fresh-mango-cubes',
        ingredientName: 'Fresh Mango Cubes',
        portionQuantity: 30, // 30g
        unit: 'g',
        estimatedCost: 8.4,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-pud-cup',
        packagingId: 'pkg-dessert-cup',
        packagingName: 'Dessert Cup w/ Sealed Lid & Spoon',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 3.5,
      },
    ],
    preparationInstructions:
      'Fill dessert cup with 120g chilled mango custard base. Drizzle with 39g sweet mango coulis syrup and top with 30g freshly diced sweet mango cubes.',
    totalFoodCost: 38.58,
    totalPackagingCost: 3.5,
    totalRawCost: 42.08,
    grossMarginPercent: 32,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 30. BANANA CON YELO (₱50)
  // --------------------------------------------------------------------------
  {
    productId: 'banana-con-yelo-50',
    productName: 'Banana Con Yelo',
    productCategory: 'Desserts',
    productPrice: 50,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'banana-con-yelo-50')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-caramelized-saba',
        ingredientName: 'Sweet Caramelized Saba Bananas',
        portionQuantity: 100, // 100g
        unit: 'g',
        estimatedCost: 18.0,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 200, // 1.5 cups (~200g)
        unit: 'g',
        estimatedCost: 4.0,
      },
      {
        ingredientId: 'ing-evaporated-milk',
        ingredientName: 'Evaporated / Condensed Milk',
        portionQuantity: 58.5, // 3 tbsp / 45ml (~58.5g)
        unit: 'g',
        estimatedCost: 8.78,
      },
      {
        ingredientId: 'ing-ube-halaya',
        ingredientName: 'Ube Halaya Topping',
        portionQuantity: 18, // 1 tbsp optional (~18g)
        unit: 'g',
        estimatedCost: 4.68,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-bcy-cup',
        packagingId: 'pkg-dessert-cup',
        packagingName: 'Dessert Cup w/ Sealed Lid & Spoon',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 3.5,
      },
    ],
    preparationInstructions:
      'Layer 100g caramelized saba bananas at bottom of cup. Pack 200g finely shaved ice on top. Drizzle with 58.5g evaporated milk and top with 18g sweet ube halaya jam.',
    totalFoodCost: 35.46,
    totalPackagingCost: 3.5,
    totalRawCost: 38.96,
    grossMarginPercent: 35,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 31. SPECIAL ICE CREAM (₱50)
  // --------------------------------------------------------------------------
  {
    productId: 'ice-cream-50',
    productName: 'Special Ice Cream',
    productCategory: 'Desserts',
    productPrice: 50,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'ice-cream-50')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-special-ice-cream',
        ingredientName: 'Special Ice Cream',
        portionQuantity: 100, // 1 scoop (approx. 100g)
        unit: 'g',
        estimatedCost: 22.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-icm-cup',
        packagingId: 'pkg-dessert-cup',
        packagingName: 'Dessert Cup w/ Sealed Lid & Spoon',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 3.5,
      },
    ],
    preparationInstructions: 'Scoop 100g chilled premium ice cream into dessert cup with spoon.',
    totalFoodCost: 22.0,
    totalPackagingCost: 3.5,
    totalRawCost: 25.5,
    grossMarginPercent: 55,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 32. MINERAL WATER (500ML) (₱15)
  // --------------------------------------------------------------------------
  {
    productId: 'mineral-water-15',
    productName: 'Mineral Water (500ml)',
    productCategory: 'Drinks',
    productPrice: 15,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'mineral-water-15')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-mineral-water-bottle',
        ingredientName: 'Bottled Mineral Water (500ml)',
        portionQuantity: 1, // 1 bottle / 500ml
        unit: 'bottle',
        estimatedCost: 7.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 sealed 500ml bottled mineral water.',
    totalFoodCost: 7.0,
    totalPackagingCost: 0,
    totalRawCost: 7.0,
    grossMarginPercent: 53,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 33. BLACK COFFEE (₱30)
  // --------------------------------------------------------------------------
  {
    productId: 'black-coffee-30',
    productName: 'Black Coffee',
    productCategory: 'Drinks',
    productPrice: 30,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'black-coffee-30')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-brewed-coffee',
        ingredientName: 'Hot Brewed Black Coffee',
        portionQuantity: 240, // 1 cup / 240ml (240g)
        unit: 'ml',
        estimatedCost: 12.0,
      },
      {
        ingredientId: 'ing-sugar',
        ingredientName: 'Refined White Sugar',
        portionQuantity: 4, // 1 packet optional (~4g)
        unit: 'g',
        estimatedCost: 0.32,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Pour 240ml freshly brewed hot black coffee into coffee cup. Provide 1 packet of sugar on side.',
    totalFoodCost: 12.32,
    totalPackagingCost: 0,
    totalRawCost: 12.32,
    grossMarginPercent: 59,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 34. COKE MISMO (250ML) (₱25)
  // --------------------------------------------------------------------------
  {
    productId: 'coke-mismo-25',
    productName: 'Coke Mismo (250ml)',
    productCategory: 'Drinks',
    productPrice: 25,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'coke-mismo-25')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-coke-mismo',
        ingredientName: 'Coca-Cola Mismo (250ml)',
        portionQuantity: 1, // 1 bottle / 250ml
        unit: 'bottle',
        estimatedCost: 14.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 250ml Coke Mismo bottle.',
    totalFoodCost: 14.0,
    totalPackagingCost: 0,
    totalRawCost: 14.0,
    grossMarginPercent: 44,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 35. COKE (1.5L) (₱110)
  // --------------------------------------------------------------------------
  {
    productId: 'coke-1-5l-110',
    productName: 'Coke (1.5L)',
    productCategory: 'Drinks',
    productPrice: 110,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'coke-1-5l-110')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-coke-15l',
        ingredientName: 'Coca-Cola (1.5L)',
        portionQuantity: 1, // 1 bottle / 1.5L
        unit: 'bottle',
        estimatedCost: 65.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 1.5-liter Coca-Cola bottle.',
    totalFoodCost: 65.0,
    totalPackagingCost: 0,
    totalRawCost: 65.0,
    grossMarginPercent: 41,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 36. SPRITE MISMO (250ML) (₱25)
  // --------------------------------------------------------------------------
  {
    productId: 'sprite-mismo-25',
    productName: 'Sprite Mismo (250ml)',
    productCategory: 'Drinks',
    productPrice: 25,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'sprite-mismo-25')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-sprite-mismo',
        ingredientName: 'Sprite Mismo (250ml)',
        portionQuantity: 1,
        unit: 'bottle',
        estimatedCost: 14.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 250ml Sprite Mismo bottle.',
    totalFoodCost: 14.0,
    totalPackagingCost: 0,
    totalRawCost: 14.0,
    grossMarginPercent: 44,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 37. SPRITE (1.5L) (₱100)
  // --------------------------------------------------------------------------
  {
    productId: 'sprite-1-5l-100',
    productName: 'Sprite (1.5L)',
    productCategory: 'Drinks',
    productPrice: 100,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'sprite-1-5l-100')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-sprite-15l',
        ingredientName: 'Sprite (1.5L)',
        portionQuantity: 1,
        unit: 'bottle',
        estimatedCost: 60.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 1.5-liter Sprite bottle.',
    totalFoodCost: 60.0,
    totalPackagingCost: 0,
    totalRawCost: 60.0,
    grossMarginPercent: 40,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 38. ROYAL MISMO (250ML) (₱25)
  // --------------------------------------------------------------------------
  {
    productId: 'royal-mismo-25',
    productName: 'Royal Mismo (250ml)',
    productCategory: 'Drinks',
    productPrice: 25,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'royal-mismo-25')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-royal-mismo',
        ingredientName: 'Royal Tru-Orange Mismo (250ml)',
        portionQuantity: 1,
        unit: 'bottle',
        estimatedCost: 14.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 250ml Royal Tru-Orange Mismo bottle.',
    totalFoodCost: 14.0,
    totalPackagingCost: 0,
    totalRawCost: 14.0,
    grossMarginPercent: 44,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 39. ROYAL TRU-ORANGE (1.5L) (₱100)
  // --------------------------------------------------------------------------
  {
    productId: 'royal-1-5l-100',
    productName: 'Royal Tru-Orange (1.5L)',
    productCategory: 'Drinks',
    productPrice: 100,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'royal-1-5l-100')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-royal-15l',
        ingredientName: 'Royal Tru-Orange (1.5L)',
        portionQuantity: 1,
        unit: 'bottle',
        estimatedCost: 60.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 1.5-liter Royal Tru-Orange bottle.',
    totalFoodCost: 60.0,
    totalPackagingCost: 0,
    totalRawCost: 60.0,
    grossMarginPercent: 40,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 40. HOUSE ICED TEA (GLASS) (₱20)
  // --------------------------------------------------------------------------
  {
    productId: 'icetea-glass-20',
    productName: 'House Iced Tea (Glass)',
    productCategory: 'Drinks',
    productPrice: 20,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'icetea-glass-20')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-house-iced-tea',
        ingredientName: 'House Iced Tea Liquid',
        portionQuantity: 300, // 300ml (300g)
        unit: 'ml',
        estimatedCost: 12.0,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 220, // 1 cup / 16 oz glass filled (~220g)
        unit: 'g',
        estimatedCost: 4.4,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1, // 1 slice (~12.5g)
        unit: 'pcs',
        estimatedCost: 1.0,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-tea-gl-cup',
        packagingId: 'pkg-cup-16oz',
        packagingName: '16oz Clear Beverage Cup w/ Dome Lid & Straw',
        category: 'Cups, Lids & Straws',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 3.2,
      },
    ],
    preparationInstructions: 'Pour 300ml cold house iced tea over 220g crushed ice in 16oz cup. Garnish with 1 fresh calamansi wheel.',
    totalFoodCost: 17.4,
    totalPackagingCost: 3.2,
    totalRawCost: 20.6,
    grossMarginPercent: 42,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 41. HOUSE ICED TEA (PITCHER) (₱100)
  // --------------------------------------------------------------------------
  {
    productId: 'icetea-pitcher-100',
    productName: 'House Iced Tea (Pitcher)',
    productCategory: 'Drinks',
    productPrice: 100,
    productImage: CLIENT_MENU_ITEMS.find((p) => p.id === 'icetea-pitcher-100')?.image,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-house-iced-tea',
        ingredientName: 'House Iced Tea Liquid',
        portionQuantity: 1000, // 1 liter / 1000ml (1,000g)
        unit: 'ml',
        estimatedCost: 40.0,
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 440, // 2 cups (~440g)
        unit: 'g',
        estimatedCost: 8.8,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 3, // 3 slices (~37.5g)
        unit: 'pcs',
        estimatedCost: 3.0,
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'In serving pitcher, combine 1000ml chilled house iced tea, 440g ice cubes, and 3 sliced calamansi.',
    totalFoodCost: 51.8,
    totalPackagingCost: 0,
    totalRawCost: 51.8,
    grossMarginPercent: 48,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 42. PANCIT SEAFOOD (Catalog Recipe)
  // --------------------------------------------------------------------------
  {
    productId: 'pancit-seafood',
    productName: 'Pancit Seafood',
    productCategory: 'Seafoods',
    productPrice: 220,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-pancit-noodles',
        ingredientName: 'Pancit Noodles (Bihon / Canton)',
        portionQuantity: 500, // 500g (bihon/canton)
        unit: 'g',
        estimatedCost: 60.0,
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 200, // 200g peeled/whole shrimp
        unit: 'g',
        estimatedCost: 90.0,
      },
      {
        ingredientId: 'ing-squid-rings',
        ingredientName: 'Squid Rings',
        portionQuantity: 150, // 150g squid rings
        unit: 'g',
        estimatedCost: 57.0,
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 100, // 100g green mussels
        unit: 'g',
        estimatedCost: 22.0,
      },
      {
        ingredientId: 'ing-mixed-vegetables',
        ingredientName: 'Mixed Vegetables (Cabbage, Carrots, Peas)',
        portionQuantity: 150, // 150g (cabbage, carrots, bell peppers)
        unit: 'g',
        estimatedCost: 18.0,
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 42, // 3 tbsp (~42g)
        unit: 'g',
        estimatedCost: 5.04,
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
        estimatedCost: 2.4,
      },
      {
        ingredientId: 'ing-chopped-onion',
        ingredientName: 'Chopped Onion',
        portionQuantity: 110, // 1 medium onion (~110g)
        unit: 'g',
        estimatedCost: 12.1,
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 45, // 3 tbsp (~45g)
        unit: 'g',
        estimatedCost: 3.6,
      },
      {
        ingredientId: 'ing-oyster-sauce',
        ingredientName: 'Oyster Sauce',
        portionQuantity: 54, // 3 tbsp (~54g)
        unit: 'g',
        estimatedCost: 8.64,
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
        estimatedCost: 5.25,
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 4, // 4 pieces (~40g)
        unit: 'pcs',
        estimatedCost: 4.0,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 6, // 1 tsp (~6g)
        unit: 'g',
        estimatedCost: 0.21,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 2.4, // 1 tsp (~2.4g)
        unit: 'g',
        estimatedCost: 0.91,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-pancit-tray',
        packagingId: 'pkg-bento-tray',
        packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 6.5,
      },
    ],
    preparationInstructions:
      'Sauté garlic and onion in cooking oil. Add 200g shrimp, 150g squid, 100g mussels, and 150g mixed veggies. Add soy sauce, oyster sauce, and special cajun sauce. Add 500g noodles with broth and simmer until absorbed. Serve with 4 fresh calamansi halves.',
    totalFoodCost: 289.15,
    totalPackagingCost: 6.5,
    totalRawCost: 295.65,
    grossMarginPercent: 45,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },

  // --------------------------------------------------------------------------
  // 43. TAPSILOG (Catalog Recipe)
  // --------------------------------------------------------------------------
  {
    productId: 'tapsilog',
    productName: 'Tapsilog',
    productCategory: 'Value Meals',
    productPrice: 95,
    yieldServings: 1,
    ingredients: [
      {
        ingredientId: 'ing-beef-tapa',
        ingredientName: 'Beef Tapa (Marinated Strips)',
        portionQuantity: 100, // 100g marinated beef strips
        unit: 'g',
        estimatedCost: 42.0,
      },
      {
        ingredientId: 'ing-fried-garlic-rice',
        ingredientName: 'Fried Rice / Garlic Rice',
        portionQuantity: 200, // 200g
        unit: 'g',
        estimatedCost: 14.0,
      },
      {
        ingredientId: 'ing-fresh-eggs',
        ingredientName: 'Fresh Eggs (Large)',
        portionQuantity: 1, // 1 large egg (~50g)
        unit: 'pcs',
        estimatedCost: 7.5,
      },
      {
        ingredientId: 'ing-tomato-cucumber-garnish',
        ingredientName: 'Tomato / Cucumber Garnish',
        portionQuantity: 30, // 2 slices (~30g)
        unit: 'g',
        estimatedCost: 3.6,
      },
      {
        ingredientId: 'ing-vinegar-dip',
        ingredientName: 'Vinegar Dip / Cane Vinegar',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
        estimatedCost: 1.8,
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 21, // 1.5 tbsp (~21g)
        unit: 'g',
        estimatedCost: 2.52,
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
        estimatedCost: 2.4,
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 22.5, // 1.5 tbsp (~22.5g)
        unit: 'g',
        estimatedCost: 1.8,
      },
      {
        ingredientId: 'ing-sugar',
        ingredientName: 'Refined White Sugar',
        portionQuantity: 2.1, // 1/2 tsp (~2.1g)
        unit: 'g',
        estimatedCost: 0.17,
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
        estimatedCost: 0.11,
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 0.6, // 1/4 tsp (~0.6g)
        unit: 'g',
        estimatedCost: 0.23,
      },
    ],
    packagingRequirements: [
      {
        id: 'pkg-rec-tap-tray',
        packagingId: 'pkg-bento-tray',
        packagingName: '3-Compartment Bento Food Tray (Microwaveable)',
        category: 'Trays, Bowls & Containers',
        quantity: 1,
        unit: 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        estimatedCost: 6.5,
      },
      {
        id: 'pkg-rec-tap-cut',
        packagingId: 'pkg-cutlery-set',
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
      'Pan-fry 100g beef tapa in hot oil until edges caramelize. Fry 1 sunny-side up egg and toss 200g sinangag garlic rice. Plate together with fresh tomato and cucumber slices, served with spiced vinegar dip.',
    totalFoodCost: 76.13,
    totalPackagingCost: 8.7,
    totalRawCost: 84.83,
    grossMarginPercent: 42,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  },
]

// ============================================================================
// LEGACY BROWSER STORAGE (read-only)
// Inventory used to live in this browser. The server owns it now; these helpers
// only let the admin screen detect and migrate edits made before the switch.
// ============================================================================

const STORAGE_KEYS = {
  INGREDIENTS: 'sfb_inventory_ingredients_v2',
  RECIPES: 'sfb_inventory_recipes_v2',
  SUPPLIERS: 'sfb_inventory_suppliers_v2',
  TRANSACTIONS: 'sfb_inventory_transactions_v2',
  PURCHASE_ORDERS: 'sfb_inventory_purchase_orders_v1',
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

export const loadStoredIngredients = (): Ingredient[] => readStored(STORAGE_KEYS.INGREDIENTS, ACTUAL_INGREDIENTS)
export const loadStoredRecipes = (): ProductRecipe[] => readStored(STORAGE_KEYS.RECIPES, ACTUAL_RECIPES)
export const loadStoredSuppliers = (): Supplier[] => readStored(STORAGE_KEYS.SUPPLIERS, ACTUAL_SUPPLIERS)
export const loadStoredTransactions = (): StockTransaction[] => readStored<StockTransaction[]>(STORAGE_KEYS.TRANSACTIONS, [])

/** Removes the old browser copy once it has been imported or discarded. */
export function clearStoredInventory(): void {
  if (typeof window === 'undefined') return
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
  } catch {
    /* storage unavailable */
  }
}
