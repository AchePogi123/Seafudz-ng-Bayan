# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The inventory screen's primary user is assumed to be a restaurant administrator or manager who tracks ingredients and packaging, replenishes stock, and coordinates inventory with kitchen and POS activity. This audience and job are inferred from the requested screen and remain unconfirmed.

## Product Purpose

Seafudz ng Bayan is a point-of-sale, kitchen display, order management, and delivery tracking platform for seafood restaurants. Its inventory area brings food ingredients, packaging materials, recipes and bills of materials, purchasing, receiving, and stock movement into one workflow. The inventory-specific purpose is inferred from the existing screen and remains unconfirmed.

## Positioning

No distinct inventory-specific positioning has been confirmed. The existing screen presents inventory as connected to kitchen and dispatch fulfillment.

## Operating Context

The inventory view is an administrator-facing web screen with dashboard, ingredient and packaging catalog, recipes/BOM, supplier, purchase and receiving, stock history, and reports sections. The screenshot identifies the location as the Caloocan Flagship Hub; whether the product supports multiple locations is unconfirmed.

## Capabilities and Constraints

- The existing UI distinguishes food ingredients from packaging materials and reports stock health, low-stock alerts, recent movements, and stock valuation.
- The screen includes ingredient and packaging entry points, purchase-order creation, and recipes/BOM access.
- Preserve the existing inventory functionality, terms, and data behavior; do not imply capabilities that are not implemented.
- Currency is shown as Philippine pesos in the existing UI.
- Whether stock updates are currently synchronized with POS consumption is unconfirmed.

## Evidence on Hand

- `README.md` describes the seafood-restaurant POS, kitchen display, order management, and delivery platform.
- The supplied inventory screenshot shows the inventory dashboard and its current navigation, summaries, actions, and empty states.
- The current inventory UI and sample data are in `Frontend/src/features/AdminInventoryManagement.tsx` and `Frontend/src/features/inventory/`.
- No user-provided inventory benchmarks, testimonials, or performance claims were supplied.

## Product Principles

- Make inventory state and replenishment needs easy to understand at a glance.
- Keep food and packaging distinct where their units and workflows differ.
- Preserve the connection between inventory, kitchen fulfillment, and purchasing without implying unsupported automation.
- Treat stock quantities and valuation as operational information, not decorative metrics.
