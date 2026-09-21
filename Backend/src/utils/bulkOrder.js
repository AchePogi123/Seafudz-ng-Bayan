/**
 * Helper function to check if an order or cart qualifies as a Bulk Order based on product item quantities:
 * - Trays, Bowls, Tubs, 1.5L Bottles, Pitchers: >= 5
 * - Siomai items (Pork, Beef, Chicken, Sharksfin, Japanese): >= 30
 * - All other menu items (Alacarte, Meals, Add-ons, Drinks, Desserts): >= 10
 */
export function checkIfBulkOrder(items) {
  if (!items) return false;

  let itemsArray = [];

  if (typeof items === 'string') {
    itemsArray = items.split(',').map((part) => {
      const match = part.trim().match(/^(.*?)\s*x(\d+)$/i);
      return {
        name: match ? match[1].trim() : part.trim(),
        quantity: match ? parseInt(match[2], 10) : 1,
      };
    });
  } else if (Array.isArray(items)) {
    itemsArray = items;
  } else {
    return false;
  }

  let totalCombinedMainQuantity = 0;

  for (const it of itemsArray) {
    const rawName = (it?.name || it?.item?.name || it?.product_name_snapshot || '').toLowerCase().trim();
    const qty = Number(it?.quantity || 1);

    if (!rawName || qty <= 0) continue;

    // 1. Siomai items: 30 pieces
    if (rawName.includes('siomai')) {
      if (qty >= 30) return true;
      continue;
    }

    // 2. Trays, Bowls, Tubs, 1.5L Bottles, Pitchers: 5 orders
    if (
      rawName.includes('party tray') ||
      rawName.includes('fiesta tray') ||
      rawName.includes('all shrimp bowl') ||
      rawName.includes('mixed seafoods bowl') ||
      rawName.includes('seafoods bowl') ||
      rawName.includes('seafoods tub') ||
      rawName.includes('1.5') ||
      rawName.includes('pitcher')
    ) {
      if (qty >= 5) return true;
      totalCombinedMainQuantity += qty;
      continue;
    }

    // 3. All other menu items: 10 orders/servings
    if (qty >= 10) return true;
    totalCombinedMainQuantity += qty;
  }

  if (totalCombinedMainQuantity >= 10) return true;

  return false;
}
