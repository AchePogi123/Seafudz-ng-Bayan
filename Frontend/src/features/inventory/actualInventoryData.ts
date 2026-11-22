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
      },
      {
        ingredientId: 'ing-cajun-butter',
        ingredientName: 'Cajun Butter',
        portionQuantity: 50,
        unit: 'g',
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 2, // 2 pieces (~20g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-paprika',
        ingredientName: 'Paprika Spice Powder',
        portionQuantity: 2.3, // 1 tsp (~2.3g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-cayenne-pepper',
        ingredientName: 'Cayenne Pepper Powder',
        portionQuantity: 0.9, // 1/2 tsp (~0.9g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 1.2, // 1/2 tsp (~1.2g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Sauté 150g fresh whole shrimp in 50g Cajun butter on high heat. Add 30g special cajun sauce, paprika, cayenne, salt, and pepper. Simmer for 3 mins until fragrant and glazed. Serve with 2 calamansi halves.',
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
      },
      {
        ingredientId: 'ing-garlic-butter',
        ingredientName: 'Garlic Butter',
        portionQuantity: 100,
        unit: 'g',
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 60, // 4 tbsp / 2 oz (~60g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 3, // 3 pieces (~30g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 2, // 2 wedges (~30g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-parsley',
        ingredientName: 'Fresh Parsley',
        portionQuantity: 0.5, // 1 pinch (~0.5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 1.2, // 1/2 tsp (~1.2g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Sauté minced garlic in 100g garlic butter until aromatic. Add 300g fresh shrimp, 60g special cajun sauce, salt, and pepper. Toss until shrimp are evenly pink and coated. Garnish with chopped parsley, 3 calamansi, and 2 lemon wedges.',
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
      },
      {
        ingredientId: 'ing-cajun-butter',
        ingredientName: 'Cajun Butter',
        portionQuantity: 250, // 250g butter
        unit: 'g',
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 120, // 8 tbsp / 4 oz (~120g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 6, // 6 pieces (~60g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 4, // 4 wedges (~60g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 10, // 2 tsp (~10g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-paprika',
        ingredientName: 'Paprika Spice Powder',
        portionQuantity: 7, // 1 tbsp (~7g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-cayenne-pepper',
        ingredientName: 'Cayenne Pepper Powder',
        portionQuantity: 1.8, // 1 tsp (~1.8g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 6, // 1 tsp (~6g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 2.4, // 1 tsp (~2.4g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'In large commercial wok, melt 250g Cajun butter and sauté 10g minced garlic. Add 800g fresh shrimp and sear evenly. Pour in 120g special cajun sauce, paprika, cayenne, salt, and black pepper. Simmer until sauce thickens and glazes every shrimp. Neatly arrange in aluminum fiesta party platter and garnish with 6 calamansi and 4 lemon wedges.',
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
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 100, // 100g whole shrimp
        unit: 'g',
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 100, // 100g green mussels
        unit: 'g',
      },
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 2, // 2 mini corn cob slices (approx. 80g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-butter',
        ingredientName: 'Pure Butter Blend',
        portionQuantity: 60, // 60g butter
        unit: 'g',
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 2, // 2 pieces (~20g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 1.2, // 1/2 tsp (~1.2g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Sauté crab halves, whole shrimp, and green mussels in 60g melted butter. Add 2 mini corn cob slices and 30g special cajun sauce. Season with salt and pepper. Toss until sauce coats seafood completely. Serve with 2 calamansi halves.',
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
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 150, // 150g whole shrimp
        unit: 'g',
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 150, // 150g green mussels
        unit: 'g',
      },
      {
        ingredientId: 'ing-shellfish-clams',
        ingredientName: 'Shellfish / Clams',
        portionQuantity: 100, // 100g clams/clams medley
        unit: 'g',
      },
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 3, // 3 mini corn cob slices (approx. 120g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-butter',
        ingredientName: 'Pure Butter Blend',
        portionQuantity: 90, // 90g butter
        unit: 'g',
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 45, // 3 tbsp / 1.5 oz (~45g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 3, // 3 pieces (~30g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 10, // 2 tsp (~10g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 6, // 1 tsp (~6g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 2.4, // 1 tsp (~2.4g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Sauté minced garlic in 90g butter, add crab, shrimp, mussels, clams, and 3 corn slices. Toss with 45g special cajun sauce and seasonings. Pour into clear sealed seafood tub and top with 3 fresh calamansi.',
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
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 300, // 300g whole shrimp
        unit: 'g',
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 250, // 250g green mussels
        unit: 'g',
      },
      {
        ingredientId: 'ing-shellfish-clams',
        ingredientName: 'Shellfish / Clams',
        portionQuantity: 150, // 150g clams/shellfish
        unit: 'g',
      },
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 4, // 4 mini corn cob slices (approx. 160g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-butter',
        ingredientName: 'Pure Butter Blend',
        portionQuantity: 150, // 150g butter
        unit: 'g',
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 90, // 6 tbsp / 3 oz (~90g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 4, // 4 pieces (~40g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 3, // 3 wedges (~45g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 9, // 1.5 tsp (~9g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 3.6, // 1.5 tsp (~3.6g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Wok simmer 300g crab, 300g shrimp, 250g mussels, 150g clams with 4 sweet corn slices in 150g rich butter. Glaze with 90g special cajun sauce and spices. Dish into large sharing bowl with 4 calamansi and 3 lemon wedges.',
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
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 600, // 600g whole premium shrimp
        unit: 'g',
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 500, // 500g green mussels
        unit: 'g',
      },
      {
        ingredientId: 'ing-shellfish-clams',
        ingredientName: 'Shellfish / Clams',
        portionQuantity: 300, // 300g clams/shellfish
        unit: 'g',
      },
      {
        ingredientId: 'ing-sweet-corn',
        ingredientName: 'Sweet Corn Cob (Mini Cob Slices)',
        portionQuantity: 8, // 8 mini corn cob slices (approx. 320g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-butter',
        ingredientName: 'Pure Butter Blend',
        portionQuantity: 300, // 300g butter
        unit: 'g',
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 150, // 10 tbsp / 5 oz (~150g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 8, // 8 pieces (~80g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 6, // 6 wedges (~90g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-paprika',
        ingredientName: 'Paprika Spice Powder',
        portionQuantity: 10.5, // 1.5 tbsp (~10.5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 18, // 1 tbsp (~18g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 7.2, // 1 tbsp (~7.2g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Grand Fiesta portion: Melt 300g butter with 15g minced garlic, saute 600g crab, 600g shrimp, 500g mussels, 300g clams, and 8 corn cobs. Toss in 150g special cajun sauce, paprika, salt, and black pepper. Plate symmetrically into large aluminum fiesta party tray. Garnish with 8 calamansi and 6 lemon wedges.',
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
      },
      {
        ingredientId: 'ing-steamed-white-rice',
        ingredientName: 'Steaming White Rice (Jasmine)',
        portionQuantity: 200,
        unit: 'g',
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 14, // 1 tbsp (~14g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-chopped-onion',
        ingredientName: 'Chopped Onion',
        portionQuantity: 55, // 1/2 medium onion (~55g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-vinegar-dip',
        ingredientName: 'Vinegar Dip / Cane Vinegar',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 0.6, // 1/4 tsp (~0.6g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Sauté garlic and onion in cooking oil. Add 80g shredded chicken with soy sauce, vinegar, salt, and black pepper until savory and slightly crisp. Scoop 200g steaming Jasmine rice into container and generously top with chicken kagikit pastil.',
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
      },
      {
        ingredientId: 'ing-pork-siomai',
        ingredientName: 'Pork Siomai',
        portionQuantity: 3, // 3 pieces (~60g total, ~20g each)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-stirfry-savory-sauce',
        ingredientName: 'Stir-Fry Savory Sauce / Chao Fan Seasoning',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 14, // 1 tbsp (~14g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 0.6, // 1/4 tsp (~0.6g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Wok fry 150g street noodles with 5g garlic and 14g oil. Add 30g savory stir-fry sauce and seasonings on high heat. Plate noodles and top with 3 hot steamed pork siomai.',
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
      },
      {
        ingredientId: 'ing-seasoned-meat-bits',
        ingredientName: 'Seasoned Meat Bits',
        portionQuantity: 50,
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-eggs',
        ingredientName: 'Fresh Eggs (Large)',
        portionQuantity: 1, // 1 large egg (~50g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-mixed-vegetables',
        ingredientName: 'Mixed Vegetables (Cabbage, Carrots, Peas)',
        portionQuantity: 40,
        unit: 'g',
      },
      {
        ingredientId: 'ing-spring-onion',
        ingredientName: 'Chopped Spring Onion',
        portionQuantity: 6, // 1 tbsp (~6g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 4.7, // 1 tsp (~4.7g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-stirfry-savory-sauce',
        ingredientName: 'Stir-Fry Savory Sauce / Chao Fan Seasoning',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 0.6, // 1/4 tsp (~0.6g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Wok scramble 1 egg with minced garlic in oil. Add 50g meat bits, 40g mixed vegetables, and 200g rice. Season with 15g chao fan sauce, salt, and pepper. Toss continuously over high heat until grain-separated and fragrant. Garnish with chopped spring onion.',
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
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5, // 1 tsp (~5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5, // 1/2 tsp (~2.5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1, // 1 piece (~10g)
        unit: 'pcs',
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
      },
    ],
    preparationInstructions: 'Steam fresh pork siomai dumpling. Serve hot with chili garlic sauce, soy sauce, and fresh calamansi.',
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
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5,
        unit: 'g',
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5,
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1,
        unit: 'pcs',
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
      },
    ],
    preparationInstructions: 'Steam beef siomai dumpling. Serve hot with chili garlic sauce, soy sauce, and fresh calamansi.',
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
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5,
        unit: 'g',
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5,
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1,
        unit: 'pcs',
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
      },
    ],
    preparationInstructions: 'Steam chicken siomai dumpling. Serve hot with chili garlic sauce, soy sauce, and fresh calamansi.',
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
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5,
        unit: 'g',
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5,
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1,
        unit: 'pcs',
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
      },
    ],
    preparationInstructions: 'Steam sharksfin dumpling until hot and tender. Serve with chili garlic, soy sauce, and fresh calamansi.',
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
      },
      {
        ingredientId: 'ing-chili-garlic-sauce',
        ingredientName: 'Chili Garlic Sauce',
        portionQuantity: 5,
        unit: 'g',
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 2.5,
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1,
        unit: 'pcs',
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
      },
    ],
    preparationInstructions: 'Steam nori-wrapped Japanese siomai until tender. Serve with chili garlic sauce, soy sauce, and calamansi.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Simmer 1 sweet corn cob slice in cajun butter broth until sweet and tender.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Scoop 1 full cup (200g) of hot steaming white Jasmine rice.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Sauté 1 piece regular shrimp (~20g) in cajun sauce.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Sauté 1 piece premium jumbo shrimp (~37.5g) in hot cajun butter.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Add 3 pieces (~50g) fresh green mussels into sauce simmer.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Pan-sear 50g sliced sausage coin rounds and glaze with cajun butter sauce.',
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
      },
    ],
    preparationInstructions: 'Portion 30g (2 tbsp / 1 fl oz) hot special cajun seafood dipping sauce.',
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
      },
      {
        ingredientId: 'ing-calamansi-juice',
        ingredientName: 'Fresh Calamansi Juice',
        portionQuantity: 15, // 1 tbsp / 15ml (~15g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 30, // 2 tbsp / 30ml (~39g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 150, // 150ml (150g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 220, // 1 cup / 16 oz filled (~220g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 1, // 1 slice (~15g)
        unit: 'pcs',
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
      },
    ],
    preparationInstructions:
      'Combine 22.5ml lemon juice, 15ml calamansi juice, 30ml sugar syrup, and 150ml purified water in a shaker. Shake vigorously with crushed ice. Pour into 16oz cup and float 1 lemon slice.',
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
      },
      {
        ingredientId: 'ing-calamansi-juice',
        ingredientName: 'Fresh Calamansi Juice',
        portionQuantity: 22.5, // 1.5 tbsp / 22.5ml (~22.5g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 45, // 3 tbsp / 45ml (~58.5g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 220, // 220ml (220g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 330, // 1.5 cups / 22 oz filled (~330g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-lemon',
        ingredientName: 'Fresh Lemon (Wedges / Slices)',
        portionQuantity: 2, // 2 slices (~30g)
        unit: 'pcs',
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
      },
    ],
    preparationInstructions:
      'Combine 37.5ml lemon juice, 22.5ml calamansi juice, 45ml sugar syrup, and 220ml water. Shake with 330g crushed ice. Serve in 22oz cup with 2 fresh lemon slices.',
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
      },
      {
        ingredientId: 'ing-lemon-juice',
        ingredientName: 'Fresh Lemon Juice',
        portionQuantity: 22.5, // 1.5 tbsp / 22.5ml (~22.5g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 30, // 2 tbsp / 30ml (~39g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 150, // 150ml (150g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 220, // 1 cup / 16 oz filled (~220g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-cucumber',
        ingredientName: 'Fresh Cucumber (Slices)',
        portionQuantity: 1, // 1 slice (~10g)
        unit: 'pcs',
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
      },
    ],
    preparationInstructions:
      'Blend 30ml cucumber puree with 22.5ml lemon juice, 30ml syrup, and 150ml water. Pour over 220g crushed ice in 16oz cup and garnish with 1 cucumber slice.',
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
      },
      {
        ingredientId: 'ing-lemon-juice',
        ingredientName: 'Fresh Lemon Juice',
        portionQuantity: 37.5, // 2.5 tbsp / 37.5ml (~37.5g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 45, // 3 tbsp / 45ml (~58.5g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 220, // 220ml (220g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 330, // 1.5 cups / 22 oz filled (~330g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-cucumber',
        ingredientName: 'Fresh Cucumber (Slices)',
        portionQuantity: 2, // 2 slices (~20g)
        unit: 'pcs',
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
      },
    ],
    preparationInstructions:
      'Blend 45ml cucumber juice, 37.5ml lemon juice, 45ml syrup, and 220ml water. Shake with 330g crushed ice in 22oz cup. Garnish with 2 cucumber slices.',
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
      },
      {
        ingredientId: 'ing-creamy-condensed-milk',
        ingredientName: 'Creamy Milk Base / Condensed Milk',
        portionQuantity: 39, // 2 tbsp / 30ml (~39g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 15, // 1 tbsp / 15ml (~19.5g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 50, // 50ml (50g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 220, // 1 cup / 16 oz filled (~220g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'In commercial blender, combine 80g fruit puree, 39g creamy milk base, 15ml syrup, 50ml water, and 220g crushed ice. Blend on high speed until smooth and creamy. Pour into 16oz cup.',
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
      },
      {
        ingredientId: 'ing-creamy-condensed-milk',
        ingredientName: 'Creamy Milk Base / Condensed Milk',
        portionQuantity: 58.5, // 3 tbsp / 45ml (~58.5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-sugar-syrup',
        ingredientName: 'Sugar Syrup',
        portionQuantity: 30, // 2 tbsp / 30ml (~39g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-purified-water',
        ingredientName: 'Purified Water',
        portionQuantity: 80, // 80ml (80g)
        unit: 'ml',
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 330, // 1.5 cups / 22 oz filled (~330g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Blend 130g fruit puree, 58.5g milk base, 30ml syrup, 80ml water, and 330g crushed ice. Blend until velvety. Serve in 22oz cup with wide boba straw.',
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
      },
      {
        ingredientId: 'ing-sweet-mango-syrup',
        ingredientName: 'Sweet Mango Syrup',
        portionQuantity: 39, // 2 tbsp / 30ml (~39g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-mango-cubes',
        ingredientName: 'Fresh Mango Cubes',
        portionQuantity: 30, // 30g
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Fill dessert cup with 120g chilled mango custard base. Drizzle with 39g sweet mango coulis syrup and top with 30g freshly diced sweet mango cubes.',
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
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 200, // 1.5 cups (~200g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-evaporated-milk',
        ingredientName: 'Evaporated / Condensed Milk',
        portionQuantity: 58.5, // 3 tbsp / 45ml (~58.5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-ube-halaya',
        ingredientName: 'Ube Halaya Topping',
        portionQuantity: 18, // 1 tbsp optional (~18g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Layer 100g caramelized saba bananas at bottom of cup. Pack 200g finely shaved ice on top. Drizzle with 58.5g evaporated milk and top with 18g sweet ube halaya jam.',
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
      },
    ],
    preparationInstructions: 'Scoop 100g chilled premium ice cream into dessert cup with spoon.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 sealed 500ml bottled mineral water.',
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
      },
      {
        ingredientId: 'ing-sugar',
        ingredientName: 'Refined White Sugar',
        portionQuantity: 4, // 1 packet optional (~4g)
        unit: 'g',
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Pour 240ml freshly brewed hot black coffee into coffee cup. Provide 1 packet of sugar on side.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 250ml Coke Mismo bottle.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 1.5-liter Coca-Cola bottle.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 250ml Sprite Mismo bottle.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 1.5-liter Sprite bottle.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 250ml Royal Tru-Orange Mismo bottle.',
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
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'Serve 1 chilled 1.5-liter Royal Tru-Orange bottle.',
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
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 220, // 1 cup / 16 oz glass filled (~220g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 1, // 1 slice (~12.5g)
        unit: 'pcs',
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
      },
    ],
    preparationInstructions: 'Pour 300ml cold house iced tea over 220g crushed ice in 16oz cup. Garnish with 1 fresh calamansi wheel.',
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
      },
      {
        ingredientId: 'ing-crushed-ice',
        ingredientName: 'Crushed Ice / Shaved Ice',
        portionQuantity: 440, // 2 cups (~440g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 3, // 3 slices (~37.5g)
        unit: 'pcs',
      },
    ],
    packagingRequirements: [],
    preparationInstructions: 'In serving pitcher, combine 1000ml chilled house iced tea, 440g ice cubes, and 3 sliced calamansi.',
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
      },
      {
        ingredientId: 'ing-shrimp-fresh',
        ingredientName: 'Fresh Whole Shrimp',
        portionQuantity: 200, // 200g peeled/whole shrimp
        unit: 'g',
      },
      {
        ingredientId: 'ing-squid-rings',
        ingredientName: 'Squid Rings',
        portionQuantity: 150, // 150g squid rings
        unit: 'g',
      },
      {
        ingredientId: 'ing-green-mussels',
        ingredientName: 'Green Mussels (Tahong)',
        portionQuantity: 100, // 100g green mussels
        unit: 'g',
      },
      {
        ingredientId: 'ing-mixed-vegetables',
        ingredientName: 'Mixed Vegetables (Cabbage, Carrots, Peas)',
        portionQuantity: 150, // 150g (cabbage, carrots, bell peppers)
        unit: 'g',
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 42, // 3 tbsp (~42g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-chopped-onion',
        ingredientName: 'Chopped Onion',
        portionQuantity: 110, // 1 medium onion (~110g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 45, // 3 tbsp (~45g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-oyster-sauce',
        ingredientName: 'Oyster Sauce',
        portionQuantity: 54, // 3 tbsp (~54g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-special-cajun-sauce',
        ingredientName: 'Special Cajun Seafood Sauce',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-calamansi',
        ingredientName: 'Fresh Calamansi',
        portionQuantity: 4, // 4 pieces (~40g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 6, // 1 tsp (~6g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 2.4, // 1 tsp (~2.4g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Sauté garlic and onion in cooking oil. Add 200g shrimp, 150g squid, 100g mussels, and 150g mixed veggies. Add soy sauce, oyster sauce, and special cajun sauce. Add 500g noodles with broth and simmer until absorbed. Serve with 4 fresh calamansi halves.',
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
      },
      {
        ingredientId: 'ing-fried-garlic-rice',
        ingredientName: 'Fried Rice / Garlic Rice',
        portionQuantity: 200, // 200g
        unit: 'g',
      },
      {
        ingredientId: 'ing-fresh-eggs',
        ingredientName: 'Fresh Eggs (Large)',
        portionQuantity: 1, // 1 large egg (~50g)
        unit: 'pcs',
      },
      {
        ingredientId: 'ing-tomato-cucumber-garnish',
        ingredientName: 'Tomato / Cucumber Garnish',
        portionQuantity: 30, // 2 slices (~30g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-vinegar-dip',
        ingredientName: 'Vinegar Dip / Cane Vinegar',
        portionQuantity: 30, // 2 tbsp / 1 oz (~30g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-cooking-oil',
        ingredientName: 'Cooking Oil',
        portionQuantity: 21, // 1.5 tbsp (~21g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-minced-garlic',
        ingredientName: 'Minced Garlic',
        portionQuantity: 15, // 1 tbsp (~15g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: 'Soy Sauce',
        portionQuantity: 22.5, // 1.5 tbsp (~22.5g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-sugar',
        ingredientName: 'Refined White Sugar',
        portionQuantity: 2.1, // 1/2 tsp (~2.1g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: 'Iodized Table Salt',
        portionQuantity: 3, // 1/2 tsp (~3g)
        unit: 'g',
      },
      {
        ingredientId: 'ing-black-pepper',
        ingredientName: 'Cracked Black Pepper',
        portionQuantity: 0.6, // 1/4 tsp (~0.6g)
        unit: 'g',
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
      },
    ],
    preparationInstructions:
      'Pan-fry 100g beef tapa in hot oil until edges caramelize. Fry 1 sunny-side up egg and toss 200g sinangag garlic rice. Plate together with fresh tomato and cucumber slices, served with spiced vinegar dip.',
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

const BASELINE_BY_ID = new Map<string, Ingredient>(ACTUAL_INGREDIENTS.map((item) => [item.id, item]))
const BASELINE_BY_NAME = new Map<string, Ingredient>(
  ACTUAL_INGREDIENTS.map((item) => [item.name.trim().toLowerCase(), item])
)

/**
 * Returns an item's standard full stock quantity (in its `baseUnit`) for quick restocking.
 * Works for all food ingredients and packaging materials (both baseline catalog items and
 * newly registered or packaging-matrix items).
 */
export function getStandardFullStock(
  item: Pick<Ingredient, 'id' | 'name' | 'itemType' | 'baseUnit' | 'minStockLevel' | 'preferredRestockQty'>
): number {
  const baseline = BASELINE_BY_ID.get(item.id) || BASELINE_BY_NAME.get(item.name.trim().toLowerCase())
  const preferred = Number(item.preferredRestockQty) || 0
  const min = Number(item.minStockLevel) || 0

  if (baseline && baseline.baseUnit === item.baseUnit) {
    if (preferred <= 0 || preferred === baseline.preferredRestockQty) {
      return Math.max(baseline.currentStock, preferred, min)
    }
  }

  if (preferred > 0) {
    return Math.max(preferred, min)
  }
  if (min > 0) {
    return min * 2
  }
  return item.itemType === 'PACKAGING' ? 100 : item.baseUnit === 'g' || item.baseUnit === 'ml' ? 1000 : 50
}
