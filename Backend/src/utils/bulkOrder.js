/**
 * Product & Category Quantity Standards and Evaluation Helper
 * Evaluates whether an order or cart requires Kitchen approval before proceeding with payment.
 *
 * Validation Layers:
 * 1. Product Quantity Standard: Individual item quantity meets/exceeds product threshold.
 * 2. Category Quantity Standard: Combined quantities of all products within a category meet/exceed category threshold.
 */

// Category Quantity Standards (Combined Category Thresholds)
export const CATEGORY_QUANTITY_STANDARDS = {
  'Seafoods': 5,
  'Value Meals': 10,
  'Siomai': 20,
  'Add Ons': 10,
  'Shake & Lemonade': 10,
  'Desserts': 10,
  'Drinks': 20,
};

// Individual Product Quantity Standards
export const PRODUCT_QUANTITY_STANDARDS = {
  // Seafoods (Standard: 5)
  'mixed-seafoods-alacarte-99': 5,
  'item-001': 5,
  'mixed-seafoods-tub-189': 5,
  'item-002': 5,
  'all-shrimp-alacarte-199': 5,
  'item-005': 5,
  'all-shrimp-bowl-699': 5,
  'item-006': 5,
  'mixed-seafoods-bowl-699': 5,
  'item-003': 5,
  'all-shrimp-tray-1099': 5,
  'item-007': 5,
  'mixed-seafoods-tray-1199': 5,
  'item-004': 5,

  // Value Meals (Standard: 10)
  'chicken-pastil-35': 10,
  'item-009': 10,
  'fried-noodles-35': 10,
  'item-010': 10,
  'chao-fan-35': 10,
  'item-008': 10,

  // Siomai (Standard: 20)
  'pork-siomai-5': 20,
  'item-011': 20,
  'beef-siomai-5': 20,
  'item-012': 20,
  'chicken-siomai-5': 20,
  'item-013': 20,
  'sharksfin-siomai-5': 20,
  'item-014': 20,
  'japanese-siomai-6': 20,
  'item-015': 20,

  // Add Ons (Standard: 10 or 5)
  'corn-addon-20': 10,
  'item-033': 10,
  'rice-cup-20': 10,
  'item-032': 10,
  'shrimp-regular-addon-20': 5,
  'item-035': 5,
  'shrimp-jumbo-addon-30': 5,
  'item-036': 5,
  'tahong-addon-30': 5,
  'item-037': 5,
  'special-sauce-addon-30': 10,
  'item-038': 10,
  'sausage-addon-50': 10,
  'item-039': 10,

  // Shake & Lemonade (Standard: 10)
  'lemonade-small-40': 10,
  'item-025': 10,
  'lemonade-big-50': 10,
  'item-026': 10,
  'cucumber-lemonade-small-40': 10,
  'item-027': 10,
  'cucumber-lemonade-big-50': 10,
  'item-028': 10,
  'shake-small-40': 10,
  'item-024': 10,
  'shake-big-50': 10,

  // Desserts (Standard: 10)
  'mango-pudding-50': 10,
  'item-031': 10,
  'banana-con-yelo-50': 10,
  'item-029': 10,
  'ice-cream-50': 10,
  'item-030': 10,

  // Drinks (Standard: 20, 10, or 5)
  'mineral-water-15': 20,
  'item-016': 20,
  'black-coffee-30': 10,
  'item-020': 10,
  'coke-mismo-25': 20,
  'item-017': 20,
  'coke-1-5l-110': 5,
  'item-021': 5,
  'sprite-mismo-25': 20,
  'item-018': 20,
  'sprite-1-5l-100': 5,
  'item-022': 5,
  'royal-mismo-25': 20,
  'item-019': 20,
  'royal-1-5l-100': 5,
  'item-023': 5,
  'icetea-glass-20': 10,
  'item-034': 10,
  'icetea-pitcher-100': 5,
  'item-040': 5,
};

// Canonical Product Category Mappings for all 83 products
export const PRODUCT_CATEGORIES = {
  // Seafoods
  'mixed-seafoods-alacarte-99': 'Seafoods',
  'item-001': 'Seafoods',
  'mixed-seafoods-tub-189': 'Seafoods',
  'item-002': 'Seafoods',
  'all-shrimp-alacarte-199': 'Seafoods',
  'item-005': 'Seafoods',
  'all-shrimp-bowl-699': 'Seafoods',
  'item-006': 'Seafoods',
  'mixed-seafoods-bowl-699': 'Seafoods',
  'item-003': 'Seafoods',
  'all-shrimp-tray-1099': 'Seafoods',
  'item-007': 'Seafoods',
  'mixed-seafoods-tray-1199': 'Seafoods',
  'item-004': 'Seafoods',

  // Value Meals
  'chicken-pastil-35': 'Value Meals',
  'item-009': 'Value Meals',
  'fried-noodles-35': 'Value Meals',
  'item-010': 'Value Meals',
  'chao-fan-35': 'Value Meals',
  'item-008': 'Value Meals',
  'custom-tapsilog-7d8933e3': 'Value Meals',
  'custom-tapsilog-9b9559ae': 'Value Meals',

  // Siomai
  'pork-siomai-5': 'Siomai',
  'item-011': 'Siomai',
  'beef-siomai-5': 'Siomai',
  'item-012': 'Siomai',
  'chicken-siomai-5': 'Siomai',
  'item-013': 'Siomai',
  'sharksfin-siomai-5': 'Siomai',
  'item-014': 'Siomai',
  'japanese-siomai-6': 'Siomai',
  'item-015': 'Siomai',

  // Add Ons
  'corn-addon-20': 'Add Ons',
  'item-033': 'Add Ons',
  'rice-cup-20': 'Add Ons',
  'item-032': 'Add Ons',
  'shrimp-regular-addon-20': 'Add Ons',
  'item-035': 'Add Ons',
  'shrimp-jumbo-addon-30': 'Add Ons',
  'item-036': 'Add Ons',
  'tahong-addon-30': 'Add Ons',
  'item-037': 'Add Ons',
  'special-sauce-addon-30': 'Add Ons',
  'item-038': 'Add Ons',
  'sausage-addon-50': 'Add Ons',
  'item-039': 'Add Ons',

  // Shake & Lemonade
  'lemonade-small-40': 'Shake & Lemonade',
  'item-025': 'Shake & Lemonade',
  'lemonade-big-50': 'Shake & Lemonade',
  'item-026': 'Shake & Lemonade',
  'cucumber-lemonade-small-40': 'Shake & Lemonade',
  'item-027': 'Shake & Lemonade',
  'cucumber-lemonade-big-50': 'Shake & Lemonade',
  'item-028': 'Shake & Lemonade',
  'shake-small-40': 'Shake & Lemonade',
  'item-024': 'Shake & Lemonade',
  'shake-big-50': 'Shake & Lemonade',

  // Desserts
  'mango-pudding-50': 'Desserts',
  'item-031': 'Desserts',
  'banana-con-yelo-50': 'Desserts',
  'item-029': 'Desserts',
  'ice-cream-50': 'Desserts',
  'item-030': 'Desserts',

  // Drinks
  'mineral-water-15': 'Drinks',
  'item-016': 'Drinks',
  'black-coffee-30': 'Drinks',
  'item-020': 'Drinks',
  'coke-mismo-25': 'Drinks',
  'item-017': 'Drinks',
  'coke-1-5l-110': 'Drinks',
  'item-021': 'Drinks',
  'sprite-mismo-25': 'Drinks',
  'item-018': 'Drinks',
  'sprite-1-5l-100': 'Drinks',
  'item-022': 'Drinks',
  'royal-mismo-25': 'Drinks',
  'item-019': 'Drinks',
  'royal-1-5l-100': 'Drinks',
  'item-023': 'Drinks',
  'icetea-glass-20': 'Drinks',
  'item-034': 'Drinks',
  'icetea-pitcher-100': 'Drinks',
  'item-040': 'Drinks',
};

/**
 * Normalizes user-facing or DB category strings into canonical category names
 */
export function normalizeCategoryName(rawCategory) {
  if (!rawCategory) return null;
  const clean = String(rawCategory).trim().toLowerCase();
  if (clean.includes('seafood')) return 'Seafoods';
  if (clean.includes('value') || clean.includes('meal')) return 'Value Meals';
  if (clean.includes('siomai')) return 'Siomai';
  if (clean.includes('addon') || clean.includes('add on') || clean.includes('add-on')) return 'Add Ons';
  if (clean.includes('shake') || clean.includes('lemonade')) return 'Shake & Lemonade';
  if (clean.includes('dessert')) return 'Desserts';
  if (clean.includes('drink') || clean.includes('beverage')) return 'Drinks';
  return null;
}

/**
 * Fallback pattern matching to infer category from a dish name
 */
export function inferCategoryFromName(name) {
  if (!name) return 'Other';
  const clean = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');

  // Add Ons (checked before seafoods so 'Cajun Seafood Sauce' / 'Add-On' get Add Ons)
  if (
    clean.includes('addon') ||
    clean.includes('rice') ||
    clean.includes('corn') ||
    clean.includes('sauce') ||
    clean.includes('sausage')
  ) {
    return 'Add Ons';
  }

  // Seafoods
  if (
    clean.includes('shrimp') ||
    clean.includes('mixedseafood') ||
    clean.includes('seafood') ||
    clean.includes('tahong') ||
    clean.includes('mussel') ||
    clean.includes('crab') ||
    clean.includes('squid') ||
    clean.includes('clam') ||
    clean.includes('fish')
  ) {
    return 'Seafoods';
  }

  // Siomai
  if (clean.includes('siomai') || clean.includes('dumpling')) {
    return 'Siomai';
  }

  // Value Meals
  if (
    clean.includes('pastil') ||
    clean.includes('noodle') ||
    clean.includes('chaofan') ||
    clean.includes('tapsilog') ||
    clean.includes('silog') ||
    clean.includes('valuemeal')
  ) {
    return 'Value Meals';
  }

  // Shake & Lemonade
  if (clean.includes('lemonade') || clean.includes('shake') || clean.includes('smoothie')) {
    return 'Shake & Lemonade';
  }

  // Desserts
  if (
    clean.includes('pudding') ||
    clean.includes('yelo') ||
    clean.includes('icecream') ||
    clean.includes('dessert')
  ) {
    return 'Desserts';
  }

  // Drinks
  if (
    clean.includes('water') ||
    clean.includes('coffee') ||
    clean.includes('coke') ||
    clean.includes('sprite') ||
    clean.includes('royal') ||
    clean.includes('icetea') ||
    clean.includes('tea') ||
    clean.includes('soda') ||
    clean.includes('beverage') ||
    clean.includes('drink')
  ) {
    return 'Drinks';
  }

  return 'Other';
}

/**
 * Resolves the canonical category of an item using explicit category, ID lookup, or name
 */
export function getItemCategory(item) {
  if (!item) return 'Other';
  const explicit = normalizeCategoryName(
    item.category || item.category_name || item.categoryName || item.item?.category || item.item?.category_name
  );
  if (explicit) return explicit;

  const id = String(item.productId || item.product_id || item.item?.id || item.id || '').trim().toLowerCase();
  if (id && PRODUCT_CATEGORIES[id]) {
    return PRODUCT_CATEGORIES[id];
  }

  const name = String(item.name || item.product_name_snapshot || item.item?.name || '').trim().toLowerCase();
  if (name && PRODUCT_CATEGORIES[name]) {
    return PRODUCT_CATEGORIES[name];
  }

  return inferCategoryFromName(name || id);
}

/**
 * Returns the quantity standard for a category
 */
export function getCategoryQuantityStandard(category, fallback = 10) {
  if (!category) return fallback;
  const normalized = normalizeCategoryName(category) || category;
  return CATEGORY_QUANTITY_STANDARDS[normalized] !== undefined
    ? CATEGORY_QUANTITY_STANDARDS[normalized]
    : fallback;
}

/**
 * Returns the quantity standard for a given product ID or Name
 */
export function getProductQuantityStandard(identifier, fallback = 10) {
  if (!identifier) return fallback;
  const raw = String(identifier).trim().toLowerCase();

  // 1. Direct ID match
  if (PRODUCT_QUANTITY_STANDARDS[raw] !== undefined) {
    return PRODUCT_QUANTITY_STANDARDS[raw];
  }

  // 2. Normalized Name Pattern Matching
  const clean = raw.replace(/[^a-z0-9]/g, '');

  // Drinks (5 vs 10 vs 20)
  if (clean.includes('15l') || clean.includes('15liters') || clean.includes('pitcher')) return 5;
  if (clean.includes('mismo') || clean.includes('250ml') || clean.includes('mineralwater') || clean.includes('water500ml')) return 20;
  if (clean.includes('blackcoffee') || (clean.includes('icetea') && clean.includes('glass'))) return 10;

  // Add Ons (10) - checked before seafoods so 'Special Cajun Seafood Sauce' correctly gets 10 instead of 5
  if (clean.includes('corn') || clean.includes('rice') || clean.includes('sauce') || clean.includes('sausage')) return 10;

  // Seafoods (5)
  if (
    clean.includes('shrimp') ||
    clean.includes('mixedseafood') ||
    clean.includes('seafood') ||
    clean.includes('tahong') ||
    clean.includes('mussel')
  ) {
    return 5;
  }

  // Siomai (20)
  if (clean.includes('siomai')) return 20;

  // Value Meals (10)
  if (clean.includes('pastil') || clean.includes('noodle') || clean.includes('chaofan')) return 10;

  // Shake & Lemonade (10)
  if (clean.includes('lemonade') || clean.includes('shake')) return 10;

  // Desserts (10)
  if (clean.includes('pudding') || clean.includes('yelo') || clean.includes('icecream')) return 10;

  return fallback;
}

/**
 * Checks an array of order/cart items against both Product and Category Quantity Standards.
 *
 * Layer 1 (Product Standard): If an item's quantity >= individual standard, it is flagged.
 * Layer 2 (Category Standard): If the combined unapproved quantities of all products in a
 * category >= category standard, the category is flagged.
 *
 * If either layer flags an item/category, Kitchen approval is required before payment.
 *
 * @param {Array} items
 * @returns {{
 *   requiresApproval: boolean,
 *   flaggedItems: Array<{ id: string, name: string, quantity: number, standard: number, type?: string, category?: string }>,
 *   flaggedCategories: Array<{ category: string, quantity: number, standard: number }>,
 *   categoryTotals: Record<string, number>
 * }}
 */
export function checkProductQuantityStandards(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      requiresApproval: false,
      flaggedItems: [],
      flaggedCategories: [],
      categoryTotals: {},
    };
  }

  const flaggedItems = [];
  const categoryTotals = {};
  const categoryItemsMap = {};

  for (const item of items) {
    const id = item.productId || item.product_id || item.item?.id || item.id || '';
    const name = item.name || item.product_name_snapshot || item.item?.name || '';
    const quantity = Number(item.quantity) || 1;

    // Check if id is a known key in standards, else evaluate name, else fallback
    const rawId = String(id).trim().toLowerCase();
    const standard = (rawId && PRODUCT_QUANTITY_STANDARDS[rawId] !== undefined)
      ? PRODUCT_QUANTITY_STANDARDS[rawId]
      : (name ? getProductQuantityStandard(name) : (id ? getProductQuantityStandard(id) : 10));

    // When kitchen has explicitly set estimated servings on an item, the portion capacity
    // has already been pre-evaluated and approved by the kitchen. It does NOT require kitchen confirmation.
    const rawServings = item.remaining_servings !== undefined
      ? item.remaining_servings
      : (item.remainingServings !== undefined
          ? item.remainingServings
          : (item.item ? (item.item.remaining_servings !== undefined ? item.item.remaining_servings : item.item.remainingServings) : undefined));
    const hasEstimatedServings = rawServings !== null && rawServings !== undefined;

    const category = getItemCategory(item);

    // Layer 1: Individual product quantity standard
    if (quantity >= standard && !hasEstimatedServings) {
      flaggedItems.push({
        id: String(id),
        name: name || id || 'Seafood Dish',
        quantity,
        standard,
        type: 'item',
        category,
      });
    }

    // Accumulate unapproved quantities by category for Layer 2
    if (!hasEstimatedServings && category && category !== 'Other') {
      categoryTotals[category] = (categoryTotals[category] || 0) + quantity;
      if (!categoryItemsMap[category]) {
        categoryItemsMap[category] = [];
      }
      categoryItemsMap[category].push({ id: String(id), name, quantity });
    }
  }

  // Layer 2: Category combined quantity standards
  const flaggedCategories = [];
  for (const [category, totalQty] of Object.entries(categoryTotals)) {
    const catStandard = CATEGORY_QUANTITY_STANDARDS[category];
    if (catStandard !== undefined && totalQty >= catStandard) {
      flaggedCategories.push({
        category,
        quantity: totalQty,
        standard: catStandard,
      });

      const itemsInCat = categoryItemsMap[category] || [];
      const hasMultipleItems = itemsInCat.length > 1;
      const hasIndividualFlag = flaggedItems.some(
        (fi) => fi.type === 'item' && (fi.category === category || getItemCategory(fi) === category)
      );

      // Flag category if multiple items combined to hit the limit, OR if no single item was flagged individually
      if (hasMultipleItems || !hasIndividualFlag) {
        flaggedItems.push({
          id: `cat-${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: `${category} (Category Combined)`,
          quantity: totalQty,
          standard: catStandard,
          type: 'category',
          category,
        });
      }
    }
  }

  return {
    requiresApproval: flaggedItems.length > 0,
    flaggedItems,
    flaggedCategories,
    categoryTotals,
  };
}

// Retain backwards compatibility for any legacy callers
export function checkIfBulkOrder(items) {
  return checkProductQuantityStandards(items).requiresApproval;
}
