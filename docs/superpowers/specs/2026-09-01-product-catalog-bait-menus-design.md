# Product Catalog Bait Menus Design

## Goal

Make the admin product catalog readable without pagination by splitting products into four product-type menus and shortening SKU labels inside named groups.

## Catalog Menus

The product table has four exclusive menus:

- `소프트베이트`: flexible worm, soft-plastic, shrimp, crab, squid, corn, and dough-style lure products.
- `하드베이트`: egi, minnow, crankbait, metal jig, metal vibration, hard-body topwater, and jointed hard lure products.
- `퀵베이트`: every BEIKO Quick Bait product, including retail bundle listings.
- `기타용품`: hooks, rings, sinkers, snaps, swivels, tools, clothing, and other non-lure accessories.

Classification is based on a centralized name/group-name classifier that follows the reviewed product images and names. Quick Bait wins over all other matches. Accessory terms win next. Hard-bait terms win before soft-bait terms for mixed names such as metal jigs containing `웜`. Unmatched products fall into `기타용품` so they are visible and can be corrected instead of disappearing.

## Data And Loading

The products page loads all products ordered by `sortOrder` and `createdAt`; server-side pagination and page query parameters are removed. The client renders only the active menu, so the DOM does not contain all four categories at once. Each menu displays its product count.

The category is derived rather than persisted because the current schema has no category field and the existing product images/names already provide a stable product-family signal. Keeping one classifier prevents 554 existing rows from requiring a destructive migration or a one-off production backfill. The classifier is isolated and tested so adding an explicit DB override later remains straightforward.

## SKU Labels

Named group headers retain the full common product name. SKU rows inside a named group remove the exact common prefix, optional separator (`:`, `：`, `-`), and extra whitespace. Examples:

- Group `엑스트래커 토부에기 시리즈1` + product `엑스트래커 토부에기 시리즈1 : 금새우` displays `금새우`.
- Group `엑스트래커 글로우 쉐드웜 7cm` + product `엑스트래커 글로우 쉐드웜 7cm : GPS_01 (5개입)` displays `GPS_01 (5개입)`.
- When no meaningful suffix remains, the product code is displayed; otherwise the original product name is the final fallback.

The original full name remains available as the element title and in the edit form. SKU-only view continues to show full names because no group header supplies the missing context.

## Interaction

Switching menus is immediate and preserves the current group/SKU view mode, grade, search text, stock filter, and availability filter. Search and filters apply only within the selected category. Changing menus clears row selection and the selected summary group to prevent actions from targeting hidden products.

Existing bulk edits, grouping, drag/drop, stock history, and product form behavior remain unchanged.

## Verification

- Unit tests cover menu classification priority and compact SKU label extraction.
- Type checking and focused linting cover the changed files.
- Browser verification checks all four menus, menu counts, absence of pagination, compact grouped SKU names, full names in SKU view, and horizontal/mobile layout behavior.

