/**
 * Product Quantity Standards and Evaluation Helper
 * Evaluates whether an order or cart requires Kitchen approval before proceeding with payment.
 */

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
 * Checks an array of order/cart items against product quantity standards.
 * If at least one item reaches or exceeds (>=) its standard, Kitchen approval is required.
 *
 * @param {Array} items
 * @returns {{ requiresApproval: boolean, flaggedItems: Array<{ id: string, name: string, quantity: number, standard: number }> }}
 */
export function checkProductQuantityStandards(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { requiresApproval: false, flaggedItems: [] };
  }

  const flaggedItems = [];

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
    const rawServings = item.remaining_servings !== undefined ? item.remaining_servings : item.remainingServings;
    const hasEstimatedServings = rawServings !== null && rawServings !== undefined;

    if (quantity >= standard && !hasEstimatedServings) {
      flaggedItems.push({
        id,
        name: name || id || 'Seafood Dish',
        quantity,
        standard,
      });
    }
  }

  return {
    requiresApproval: flaggedItems.length > 0,
    flaggedItems,
  };
}

// Retain backwards compatibility for any legacy callers
export function checkIfBulkOrder(items) {
  return checkProductQuantityStandards(items).requiresApproval;
}
