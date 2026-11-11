/**
 * Servings deduction module deprecated as part of Estimated Servings removal.
 * Preserved as no-op stubs for safe backwards compatibility.
 */

export async function deductOrderRemainingServings(client, orderId) {
  return { success: true, alreadyDeducted: true, updatedProducts: [] };
}

export async function restoreOrderRemainingServings(client, orderId) {
  return { success: true, restored: false };
}
