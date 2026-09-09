# Scentrave ERP

Billing, inventory, and CRM for a perfume/attar D2C + retail brand. Next.js (App Router) + Prisma + Postgres (Supabase).

## Status

All modules from the build spec are implemented and running end-to-end on the local dev server. Every service listed below was exercised against a real (throwaway, local) Postgres instance during development — not just typechecked — including the production/solvent-deduction math, checkout with split payments and returns, the low-stock notification edge-trigger, and report margin calculations.

- **Schema** (`prisma/schema.prisma`) — products/variants, formulas, raw materials, stock ledger, orders/invoices/payments, price lists, discounts, CRM, notifications.
- **Production / solvent deduction** — the domain-specific core everything else depends on:
  - `lib/services/stockMovement.ts` — the single write path for every stock mutation. Also fires an edge-triggered `LOW_STOCK` notification to Owner/Admin the moment a SKU or raw material crosses its threshold (once per crossing, not on every subsequent sale).
  - `lib/services/batch.ts` — `previewProductionBatch` (dry-run) and `createProductionBatch` (atomic: deducts raw materials per formula, adds finished SKU).
  - `app/api/batches`, `app/api/batches/preview` (Owner/Admin only).
- **Billing / POS**:
  - `lib/services/tax.ts`, `discount.ts`, `pricing.ts` — single-state GST, coupon validation, price-list resolution.
  - `lib/services/order.ts` — `checkoutOrder` (direct sale or hold/park) and `resumeHeldOrder`, atomic: price → deduct stock → sequential invoice → split payments → loyalty points (testers excluded).
  - `lib/services/payment.ts`, `returns.ts` — split-payment recording with an overpayment guard; partial/full returns with stock reversal.
  - `app/(billing)/pos` — product search, cart, customer lookup/walk-in creation, discount code, split payment entry, hold or checkout.
- **Inventory**:
  - `lib/services/inventory.ts` — full stock listing (raw materials + finished SKUs) and physical-count reconciliation (`reconcileStock`, writes a single signed `ADJUSTMENT` movement).
  - `app/(admin)/inventory` — stock table with low-stock flags and a reconciliation flow.
- **Live dashboard**:
  - `lib/services/dashboard.ts` — today/week/month sales with prior-period comparison, top-selling SKUs (30d), low-stock alerts, pending payments total, new customers today, 14-day sales trend, category and size revenue breakdowns.
  - `app/(admin)/dashboard` — Recharts line/pie/bar charts, live via Supabase Realtime (debounced refetch on order/stock/notification changes) with a 5-minute fallback poll.
- **Categories & price lists**:
  - `lib/services/catalog.ts` — category/subcategory CRUD.
  - `lib/services/priceListAdmin.ts` — multiple price lists, bulk price editing with change-log auditing (unchanged rows are skipped, not logged), CSV export/import.
  - `app/(admin)/categories`, `app/(admin)/price-lists` — admin screens for both.
- **Notifications & delivery**:
  - `components/notifications/NotificationBell.tsx` — unread-count bell in the nav, live via Realtime.
  - `lib/notify/email.ts`, `lib/notify/whatsapp.ts` — best-effort (fire-and-forget) email/WhatsApp delivery for low-stock alerts, degrading to a console log when unconfigured.
  - `lib/services/invoiceDelivery.ts` — uploads the invoice PDF to Supabase Storage and builds a WhatsApp share link with the customer's total prefilled; POS screen has a "Share invoice via WhatsApp" button after checkout.
- **Reports**:
  - `lib/services/reports.ts` — product-wise sales report with units, revenue, discount, tax, and margin (cost-price gated to Owner/Admin).
  - `lib/pdf/salesReport.ts`, `lib/pdf/invoice.ts` — PDF generation via `pdf-lib`. CSV export via `papaparse`.
  - `app/(admin)/reports` — filterable report table with CSV/PDF export buttons.
- **CRM**:
  - `lib/services/crm.ts` — customer profile: order history, lifetime value, last purchase, loyalty ledger, tasks, notes.
  - `app/api/customers/[id]`, `.../tasks`, `.../notes`, `app/api/segments` (create/assign segments for targeted campaigns).
  - `app/(crm)/customers` — search + detail screen with order history, follow-up tasks, and a notes timeline.
- **Payments**:
  - `lib/payments/razorpay.ts` — creates a single-use Razorpay Dynamic QR per invoice amount; HMAC-verifies webhook signatures.
  - `lib/payments/staticUpiQr.ts` — generates a static UPI QR (PNG) as the offline/no-Razorpay fallback.
  - `app/api/payments/dynamic-qr`, `.../static-qr`, `.../webhook` (marks the matching `Payment` `SUCCESS` and recomputes invoice status on `qr_code.credited`), `.../reconciliation` (matched vs pending report).
  - `app/(admin)/payments` — the reconciliation report as a screen (previously API-only): matched vs pending totals and a per-invoice breakdown.
- **Orders, held bills, and returns**:
  - `app/(billing)/orders` — order list (filterable by status) and detail screen, with a link to the invoice PDF and payment breakdown. Previously there was no way to browse past orders or open an invoice outside the instant after checkout.
  - `components/billing/HeldBillsPanel.tsx`, embedded in the POS screen — lists parked bills shop-wide (not scoped to whoever parked it, since any cashier at the counter should be able to resume one) and lets a cashier enter payment and settle it. Verified: a bill held by one cashier was resumed and paid by a different one.
  - The order detail screen has a "Process a return" panel — per-line returnable quantity inputs, submitting to the existing `processReturn` service. Previously `processReturn` had no UI at all.
- **Auth & access**:
  - `app/login`, `middleware.ts` — email/password sign-in via Supabase Auth; every page except `/login` and the Razorpay webhook redirects unauthenticated visitors to `/login?next=<original path>`.
  - `components/AppNav.tsx` — nav links are filtered by the signed-in user's role (e.g. a Cashier never sees Reports/Dashboard/Products links), with a sign-out button.
- **Production UI**: `app/(admin)/production` — search a product, preview raw-material consumption with per-line sufficiency badges, confirm the batch. This was previously API-only.
- **Product/raw-material/formula admin**:
  - `lib/services/catalog.ts` — product/variant creation, raw material creation, and `setActiveFormula` (publishes a new formula version, deactivating the old one without deleting it, so past batches stay auditable against the formula that actually made them).
  - `app/(admin)/products` — add perfumes/oils, add size variants, edit a product's formula.
  - `app/(admin)/raw-materials` — add raw materials with opening stock, record purchases (goods-in) against the ledger.
- **Discounts & loyalty**:
  - `lib/services/discount.ts` — `computeBuyXGetYDiscountAmount`: for every (buy+get) eligible units in-scope (by product or category), `get` units are free, valued at the quantity-weighted average price of the eligible lines.
  - `lib/services/loyalty.ts` — `redeemLoyaltyPoints`: redeems points for their ₹ value (default 100 pts = ₹50) as a `LOYALTY_POINTS` payment leg, with an insufficient-balance guard. POS screen shows a redeem-points field once a customer with a balance is selected.
  - `updateLoyaltyTierIfEarned`: auto-assigns Silver/Gold/Platinum from lifetime spend (default thresholds ₹5k/₹25k/₹75k) after every settled order. Tiers only ever move up — a later small or returned order never downgrades a customer.
- **Stock audit view**: `app/api/stock/movements` + the "Movement history" panel in `app/(admin)/inventory` — the full ledger, filterable by reason, with actor/batch/order context. This is the "stock reconciliation/audit screen" from the original spec.
- **Discount admin UI**: `app/(admin)/discounts` — create FLAT/PERCENTAGE/BUY_X_GET_Y (product- or category-scoped) discounts and coupon codes (previously only seedable, no UI).
- **CRM completeness**: segment creation and assignment, follow-up task creation (with due date), the loyalty ledger, and now price-list assignment (dropdown on the customer profile, "Assign a price list to a customer" from the spec) are all visible/editable in `components/crm/CustomerListScreen.tsx` and `CustomerDetailScreen.tsx`.
- **Customer creation**: the POS screen now has a "+ New customer" inline form (name/phone/state/email) — previously the create-customer API existed but nothing in the UI could reach it, so staff had no way to onboard a new customer anywhere in the app.
- **POS catalog browsing**: Perfume/Oil/All tabs on the billing screen (`components/billing/PosScreen.tsx`) browse the catalog directly, not just search by name/SKU.
- Shared top nav (`components/AppNav.tsx`) links Billing / Orders / Dashboard / Production / Inventory / Reports / Customers / Products / Raw Materials / Categories / Price Lists / Discounts / Payments, filtered by role.
- Seed script (`prisma/seed.ts`) with realistic demo data: users for all 4 roles, categories/subcategories, raw materials, two products (an alcohol-based perfume with a formula, an oil-based attar without one), price lists, customers, and one real production batch run through the actual service.

## Setup

1. Create a Supabase project (Postgres + Auth).
2. Copy `.env.example` to `.env` and fill in the values.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Push the schema and generate the client:

   ```bash
   npx prisma migrate dev --name init
   ```

5. Seed demo data:

   ```bash
   npm run prisma:seed
   ```

6. In Supabase Auth, create users matching the seeded emails (`owner@scentrave.test`, `admin@scentrave.test`, `cashier@scentrave.test`, `sales@scentrave.test`) **with a password** — the login page uses email+password sign-in — and update each `User.authId` in the database to match the real Supabase `auth.users.id` (the seed script uses placeholder UUIDs since it doesn't have Supabase Admin API access).
7. Run the dev server:

   ```bash
   npm run dev
   ```

8. To test Razorpay Dynamic QR locally, forward `app/api/payments/webhook` with a tool like `ngrok` and register that URL as the webhook endpoint in the Razorpay dashboard, subscribed to the `qr_code.credited` event. Without Razorpay keys configured, dynamic QR creation fails cleanly (500 with a clear message); the static UPI QR fallback works with just `STATIC_UPI_VPA` set.

## Architecture notes

- **Stock integrity**: every stock-affecting action goes through `recordStockMovement`. It writes an immutable `StockMovement` row, updates the denormalized `StockLevel` cache, and checks for a low-stock threshold crossing — all in the same transaction. Never mutate `StockLevel` from anywhere else.
- **Solvent deduction**: `Formula` is versioned per `Product` (editing a recipe creates a new version rather than mutating history). `createProductionBatch` computes consumption from the active formula's `FormulaLine`s × total ml produced, and fails atomically if any raw material is short — checked once in the preview for fast UX feedback, and again inside the transaction via `recordStockMovement`'s own negative-stock guard, which is the actual safety net against race conditions.
- **Sequential numbers**: invoice, batch, and order numbers all share one `Sequence` table keyed by `"<kind>-<financialYear>"`, incremented atomically inside the same transaction that consumes the number.
- **Role gating**: `lib/auth/session.ts` resolves the app `User`/`Role` from the Supabase session. Cost price, raw material cost, formulas, and report margin columns are Owner/Admin-only — enforced at the API/route layer via `requireRole`, not in the schema.
- **Low-stock notifications**: edge-triggered inside `recordStockMovement` — fires once when a quantity crosses from above- to at-or-below-threshold, not on every subsequent movement while already low. Recipients are every active Owner/Admin user (the spec's "Inventory Manager" recipient maps to Admin here, since that's the closest role in the current `Role` enum). Delivery to email (`lib/notify/email.ts`, via Resend) and WhatsApp (`lib/notify/whatsapp.ts`, via the Meta Cloud API) is fire-and-forget — never awaited inside the stock transaction, so a slow or failed send can't roll back a sale or hold up a production batch. Both degrade to a console log when their API keys aren't configured, so the app runs fully without them.
- **Realtime**: the dashboard (`components/dashboard/DashboardScreen.tsx`) and the notification bell (`components/notifications/NotificationBell.tsx`) subscribe to Supabase Realtime `postgres_changes` on `orders`, `stock_movements`, `notifications`, and `notification_recipients`, debounced 500ms so one checkout's several row changes coalesce into a single refetch. Both also keep a 5-minute fallback poll in case a Realtime connection drops silently. **Setup requirement**: enable Realtime on these tables in the Supabase dashboard (Database → Replication), or run `ALTER PUBLICATION supabase_realtime ADD TABLE orders, stock_movements, notifications, notification_recipients;`.
- **Invoice sharing**: `lib/services/invoiceDelivery.ts` uploads the generated PDF to a `invoices` bucket in Supabase Storage (if `SUPABASE_SERVICE_ROLE_KEY` is set) and returns a public URL plus a `wa.me` deep link prefilled with the invoice total. Without Storage configured, it falls back to the app's own (auth-gated) PDF route via `NEXT_PUBLIC_APP_URL` — fine for internal review, not for sending to a customer, so set up Storage before relying on customer-facing sharing.
- **UI**: shadcn/ui components (Button, Input, Card, Badge) pulled via the shadcn MCP tool, themed with an earth-tone palette matching the perfume/attar brand context. Recharts for the dashboard.

## Known gaps / next steps

- **Shopify migration**: deferred — the Shopify store connected in this environment was confirmed **not** to be Scentrave's; migration will be scripted once the correct store is connected.
- GST: single-state (one GSTIN) — `Order.customerState` vs `GST_HOME_STATE` decides CGST+SGST vs IGST. GST rate is a flat 18% default (`DEFAULT_GST_RATE_PERCENT` in `lib/services/tax.ts`) — worth confirming per-category HSN rates if they differ.
- Loyalty earn rate (1 point per ₹100 spent, `LOYALTY_POINTS_PER_RUPEE_SPENT` in `lib/services/order.ts`), redemption rate (100 pts = ₹50, `LOYALTY_REDEMPTION_RUPEES_PER_POINT`), and tier thresholds (₹5k/₹25k/₹75k lifetime spend, `TIER_THRESHOLDS` in `lib/services/loyalty.ts`) are all defaults — confirm against your actual program.
- The `invoices` Storage bucket needs creating (public, or with a signed-URL policy) in Supabase before invoice sharing can reach customers directly.
