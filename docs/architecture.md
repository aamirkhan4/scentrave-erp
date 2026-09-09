# Scentrave ERP — Architecture

## Tech stack

- **Framework**: Next.js 14 (App Router), React 18, TypeScript
- **DB / ORM**: Postgres via Supabase, Prisma 6.19.3 (pinned)
- **Auth**: Supabase Auth (email/password), `middleware.ts` gates every route except `/login` and the Razorpay webhook — but middleware only checks *session exists*, not role; role enforcement is per-route (`requireRole`), never assume middleware is the security boundary for anything but "is logged in"
- **Styling**: Tailwind CSS + shadcn/ui (Radix primitives), CVA for variants
- **Charts**: Recharts
- **Realtime**: Supabase Realtime (`postgres_changes`) with 5-min fallback poll
- **PDF**: pdf-lib (+ `@pdf-lib/fontkit` for custom font embedding — see design.md), used for invoices and the sales report
- **CSV**: papaparse
- **Payments**: Razorpay (Dynamic QR + webhook, HMAC-signature verified), `qrcode` for static UPI QR fallback
- **Notifications**: Resend (email), Meta Cloud API (WhatsApp) — both fire-and-forget, degrade to console log if unconfigured
- **Validation**: Zod

## High-level workflow

```
Cashier (POS) → checkoutOrder() → [resolve/auto-link customer by phone → price (tax-inclusive) →
                                    deduct stock → sequential invoice (UNPAID by default) →
                                    optional single payment leg → loyalty points]
                                          ↓ (single transaction)
                                    stockMovement.ts (only write path for stock;
                                    skipped entirely for "Custom amount" lines — not real inventory)
                                          ↓
                                 low-stock threshold crossed? → notify Owner/Admin (email/WhatsApp)

Owner/Admin → "Mark as paid" (order detail) → recordPayment() with a chosen method
                                          ↓
                                 recomputeInvoiceStatus() → UNPAID/PARTIALLY_PAID/PAID
                                 (same code path as a normal recorded payment — Payments
                                 Reconciliation stays consistent either way)

Admin (Production) → Mix: previewMixBatch() → createMixBatch() [consumes raw materials
                          per active Formula × ml mixed, adds to a per-product bulk-liquid pool]
                    → Bottle: previewBottling() → createBottlingBatch() [draws bulk liquid down
                          per variant, or bottles directly with no deduction if no formula exists]
```

All stock-affecting actions — sale, return, production, purchase, adjustment — go through `lib/services/stockMovement.ts`. This is the single source of truth for the stock ledger and the low-stock notification trigger. Nothing else is allowed to mutate `StockLevel`. Custom-amount checkout lines are the one deliberate exception: they attach to a hidden, reserved placeholder catalog variant (`lib/services/customCharge.ts`) purely so `OrderItem.productVariantId` can stay a required field, but no stock movement is ever recorded against it.

## Folder structure

```
scentrave-erp/
├── app/
│   ├── (admin)/          # dashboard, products, categories, raw-materials, formulas,
│   │                     # price-lists, discounts, production, inventory, cost-stock,
│   │                     # payments, reports, settings — role-gated per page
│   ├── (billing)/        # pos, orders, orders/[id] — cashier-facing
│   ├── (crm)/            # customers, customers/[id]
│   ├── api/              # route handlers, one folder per resource, mirrors service layer
│   │                     # (batches, categories, cost-stock, customers, dashboard, discounts,
│   │                     #  formulas, inventory, invoices, me, mixes, notifications, orders,
│   │                     #  payments, price-lists, products, raw-materials, reports, segments,
│   │                     #  settings, stock, subcategories, users)
│   └── login/
├── components/
│   ├── AppShell.tsx      # sidebar nav (role-filtered), header with global Back button
│   ├── billing/          # PosScreen, HeldBillsPanel, OrderDetailScreen, OrdersListScreen
│   ├── catalog/          # ProductsScreen, CategoriesScreen, RawMaterialsScreen, FormulasScreen,
│   │                     # DiscountsScreen, PriceListsScreen, CostStockScreen
│   ├── production/       # ProductionScreen (Mix/Bottle tabs)
│   ├── crm/              # CustomerListScreen, CustomerDetailScreen
│   ├── settings/         # SettingsScreen (My Profile / Users / Shop Details tabs)
│   ├── inventory/        # InventoryScreen
│   ├── dashboard/        # DashboardScreen (Recharts)
│   ├── reports/          # ReportsScreen
│   ├── notifications/    # NotificationBell
│   └── ui/               # shadcn primitives + shared ActionStatus/Spinner loading pattern
├── lib/
│   ├── services/         # order, batch, stockMovement, tax, discount, pricing, payment,
│   │                     # paymentReconciliation, returns, inventory, dashboard, catalog,
│   │                     # priceListAdmin, reports, crm, loyalty, invoice, invoiceDelivery,
│   │                     # shopSettings, customCharge, sequence
│   ├── payments/         # razorpay.ts, staticUpiQr.ts
│   ├── notify/           # email.ts, whatsapp.ts
│   ├── pdf/              # invoice.ts, salesReport.ts
│   ├── hooks/            # useAsyncAction.ts (loading→success-checkmark pattern)
│   ├── constants/         # indianStates.ts
│   └── auth/              # session.ts (resolves app User/Role from Supabase session)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/        # applied via manual diff+deploy, not `migrate dev` (see rules.md)
│   └── seed.ts
├── middleware.ts          # session-exists gate on every route (not role)
└── docs/                  # this folder
```

## Key architectural decisions

- **Stock integrity**: every mutation goes through `recordStockMovement` — writes an immutable `StockMovement` row, updates the denormalized `StockLevel` cache, checks low-stock threshold, all in one transaction.
- **Formula versioning**: editing a recipe creates a new `Formula` version rather than mutating history, so past batches stay auditable against the formula that actually made them.
- **Two-stage production (Mix → Bottle)**: raw-material consumption happens once, at Mix time, into a bulk-liquid pool tracked per product (`StockableType.BULK_LIQUID`). Bottling only draws down that pool — it never re-touches raw materials. A product with no formula skips the pool entirely and bottles directly, preserving the original single-stage behavior for those SKUs.
- **Tax model is inclusive, not additive**: `computeTaxBreakup()` extracts the GST portion *from within* a price that already includes it — it must never be added on top of a line total. This was a real bug fixed mid-project (customers were being overcharged by the tax amount); any future tax-related change must preserve this direction.
- **Sequential numbers**: invoice/batch/order/mix numbers share one `Sequence` table keyed by `"<kind>-<financialYear>"`, incremented atomically inside the transaction that consumes the number. The `order` sequence was deliberately seeded past its natural count to continue from the real Shopify order number (#1051) — don't "fix" a perceived gap in the order sequence without checking this file first.
- **Guest checkout without a saved Customer**: `Order.guestName`/`Order.guestPhone` hold what was typed at checkout. If `guestPhone` matches an existing `Customer.phone`, `checkoutOrder()` resolves and links that customer automatically (for loyalty/price-list purposes) — no explicit customer-search UI exists in Billing anymore by design.
- **Custom-amount checkout lines**: `OrderItem.customLabel` overrides the display name; the line attaches to one reserved, `isActive: false` placeholder catalog variant (`getOrCreateCustomChargeVariant`) so the required `productVariantId` relation never needs to become nullable. No stock movement is recorded for these lines (checked in `settleOrder`, `processReturn`, and `deleteOrCancelOrder`).
- **Unpaid-by-default billing**: `checkoutOrder()` accepts an optional single payment leg. Zero payments → invoice stays `UNPAID` (its default at creation). "Mark as paid" is a separate, later action that calls the same `recordPayment()`/`recomputeInvoiceStatus()` path a real payment would, so Payments Reconciliation never sees a PAID invoice with no matching Payment row.
- **Role gating**: enforced server-side via `requireRole` in `lib/auth/session.ts` on every route, not just hidden in UI. Verified live against real logins for all 4 roles, not just read from the code.
- **Notifications are never awaited inside a stock transaction** — a slow/failed send can't roll back a sale or block a production batch.
- **Realtime + poll fallback**: dashboard and notification bell subscribe to Supabase Realtime, debounced 500ms, with a 5-min poll in case the Realtime connection drops silently.
- **Migrations are applied by hand**: `prisma migrate dev` fails in this sandboxed dev environment (non-interactive). The working pattern is `prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script`, hand-place the SQL into a timestamped migration folder, then `prisma migrate deploy` (non-interactive-safe) + `prisma generate`. **The running dev server caches the old Prisma Client in memory and must be restarted after any schema change** — this has caused confusing 500s multiple times when skipped.

## Data model (see `prisma/schema.prisma` for full detail)

Core entities: `User` (mirrors Supabase `auth.users`), `Category`/`Subcategory`, `Product`/`ProductVariant`, `Formula`/`FormulaLine`, `MixBatch`, `RawMaterial`, `StockMovement`/`StockLevel`, `Batch`, `Order`/`OrderItem`/`Invoice`/`Payment`, `PriceList`, `Discount`, `Customer`, `LoyaltyLedgerEntry`, `Notification`/`NotificationRecipient`, `ShopSettings` (singleton — business identity used across Billing/invoices, editable by Owner only), `Sequence`.
