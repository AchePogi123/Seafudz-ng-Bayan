/**
 * Unit conversion for inventory quantities.
 *
 * Stock is always held in an item's `baseUnit`. Anywhere a user may enter a quantity in a
 * different-but-related unit (a purchase order line, a stock purchase), the number has to be
 * converted before it reaches stock, or 300 kg lands as 300 g.
 */

/** Factors into each unit's own base. Units not listed here are discrete and never convert. */
const TO_BASE: Record<string, { base: string; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  L: { base: 'ml', factor: 1000 },
}

/** Converts a quantity into `baseUnit` where the two units are related, else returns it unchanged. */
export function toBaseUnit(qty: number, fromUnit: string, baseUnit: string): number {
  if (fromUnit === baseUnit) return qty
  const from = TO_BASE[fromUnit]
  const to = TO_BASE[baseUnit]
  if (!from || !to || from.base !== to.base) return qty
  return (qty * from.factor) / to.factor
}

/** True when the two units are related but not identical, so a quantity changes on conversion. */
export function unitsConvert(fromUnit: string, baseUnit: string): boolean {
  if (fromUnit === baseUnit) return false
  const from = TO_BASE[fromUnit]
  const to = TO_BASE[baseUnit]
  return Boolean(from && to && from.base === to.base)
}

/**
 * True when a quantity entered in `fromUnit` cannot be reconciled with `baseUnit` at all
 * (e.g. "box" into "g"), which means the number would be taken at face value.
 */
export function unitsMismatch(fromUnit: string, baseUnit: string): boolean {
  return fromUnit !== baseUnit && !unitsConvert(fromUnit, baseUnit)
}

/** Trims trailing zeros so 5000 reads as "5,000" and 0.5 as "0.5". */
export function formatQuantity(qty: number): string {
  const rounded = Math.round(qty * 1000) / 1000
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

/**
 * A short "5 kg = 5,000 g" line for the UI, or null when there is nothing to say because the
 * units match or do not relate.
 */
export function describeConversion(qty: number, fromUnit: string, baseUnit: string): string | null {
  if (!(qty > 0) || !unitsConvert(fromUnit, baseUnit)) return null
  return `${formatQuantity(qty)} ${fromUnit} = ${formatQuantity(toBaseUnit(qty, fromUnit, baseUnit))} ${baseUnit}`
}
