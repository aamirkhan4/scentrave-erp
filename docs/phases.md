# Scentrave ERP — Phases

Status as of 2026-09-09: **Phases 1–11 are built, verified against the real production database, and role-tested live.** This file tracks what shipped and what's left, not a forward-only plan — update the checkboxes as work happens.

## Phase 1 — Schema & auth foundation ✅
- Prisma schema: products/variants, formulas, raw materials, stock ledger, orders/invoices/payments, price lists, discounts, CRM, notifications, `ShopSettings`.
- Supabase Auth (email/password), `middleware.ts` route gating, role-based nav filtering (`AppShell.tsx`).

## Phase 2 — Production & stock integrity ✅
- Single write path for stock (`stockMovement.ts`), edge-triggered low-stock notifications.
- Formula versioning.
- **Two-stage production**: Mix (raw materials → bulk liquid pool) then Bottle (pool → sellable stock), replacing the original single-stage batch model.

## Phase 3 — Billing / POS ✅ (rebuilt/simplified since first ship)
- Cart, "Custom amount" line for non-catalog charges, discount codes, hold/resume, checkout → invoice.
- Tax-inclusive GST (CGST+SGST for Rajasthan, IGST otherwise) — pricing, discount services.
- **Simplified per explicit client feedback**: no customer search/save step (just Name + Phone, auto-linked by phone if it matches an existing customer), single optional payment field (no split-payment UI), state entered via a dropdown of all Indian states/UTs.
- Bills settle as **UNPAID by default**; a separate "Mark as paid" action (Owner/Admin) records the payment with a chosen method.

## Phase 4 — Inventory & reconciliation ✅
- Stock listing (raw materials + bulk liquid + finished SKUs), low-stock flags, physical-count reconciliation.
- Stock movement audit view (`app/api/stock/movements`).

## Phase 5 — Dashboard & realtime ✅
- Live sales/stock/customer metrics, Supabase Realtime with debounce + 5-min fallback poll.

## Phase 6 — Payments & delivery ✅
- Razorpay Dynamic QR + webhook reconciliation (HMAC-signature verified — confirmed correct in a full security audit).
- Static UPI QR fallback.
- Invoice PDF generation (redesigned to match the brand's prior Shopify invoice format) + WhatsApp share link via Supabase Storage (the `invoices` bucket — see Phase 9, this was found missing and created).

## Phase 7 — Reports, CRM, discounts, loyalty ✅ (report rebuilt)
- **Sales Transactions Report** replaced the original product-aggregated report: one row per line item (Date, Order ID, Perfume, Customer, State, Qty, Bank Details, Taxable/CGST/SGST/IGST, Total), filterable by State and Payment Mode, CSV/PDF export.
- Customer profiles, segments, tasks, notes, shipping + billing address (for invoices).
- Flat/percentage/buy-x-get-y discounts, points earn/redeem, auto tier upgrade.

## Phase 8 — Orders, returns, admin completeness ✅
- Order history + detail + return flow with stock reversal.
- Held-bills panel (shop-wide, cross-cashier resume), simplified to one optional payment field.
- Product/raw-material/category/price-list/cost-stock admin screens, all with CSV import/export where relevant.
- Global "Back" button on every page except Billing (the home screen).

## Phase 9 — Hardening & confirmation ✅
- [x] GST model confirmed: flat 18%, tax-inclusive pricing, CGST+SGST for Rajasthan (home state) / IGST otherwise.
- [x] `invoices` Storage bucket created in Supabase (was missing — found during a full "check everything" pass, WhatsApp share had never actually worked until this was fixed).
- [x] Full security audit completed (auth, IDOR, injection, secrets, webhook signature, CSV formula-injection, missing security headers, outdated Next.js dependency advisories) — see the audit findings log in this file's history / ask for the report if not otherwise retained.
- [ ] Loyalty earn/redemption rates and tier thresholds are still using their original defaults — never explicitly reconfirmed against a real program spec.
- [ ] Security header hardening (CSP, X-Frame-Options, HSTS, `poweredByHeader: false`) identified in the audit but not yet applied to `next.config.js`.
- [ ] Next.js 14 → 16 upgrade (several dependency advisories) — flagged as a planned migration, not urgent, needs middleware re-testing afterward.

## Phase 10 — Shopify migration ✅
- [x] Real Shopify data migrated: 665+ products, ~73 customers, ~41+ historical orders.
- [x] Order numbering made continuous with the real Shopify sequence — last Shopify order was #1051, our new orders start at `ORD/26-27/01052`.
- [x] Invoice format redesigned to match the brand's actual prior Shopify invoice layout.

## Phase 11 — Client handoff (in progress)
- [x] Custom-amount billing, guest checkout, unpaid-by-default + Mark as Paid, Reports rebuild, state dropdown, global Back button — all shipped and live-verified across all 4 roles.
- [ ] Monument Extended font (brand wordmark on the invoice PDF) — code is wired to use it automatically once the licensed font file is provided; currently falls back to bold system font.
- [ ] Push to the client's own new GitHub repository (in progress as of this doc update).
- [ ] Admin/Cashier account passwords were reset during testing (currently `Godfather@1234` on both, matching Sales Agent) — flag to the client to rotate these once they're in control.

## Phase 12 — Future (not yet scoped)
- [ ] Multi-state GST if Scentrave expands to a second GSTIN.
- [ ] Multi-location/multi-warehouse inventory if a second physical store opens.
- [ ] Per-transaction UPI payer bank capture, if bank-statement reconciliation needs it (currently the report shows the shop's own receiving UPI/bank details, not the payer's).
