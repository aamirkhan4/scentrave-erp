# Scentrave ERP — Memory

Update this file as work happens: what's done, what's in progress, what file is currently being touched. Keep entries short — this is a working log, not a report. **Update it whenever meaningful progress happens, not just at setup** — a memory.md only written once is as good as not having one.

## Current state (2026-09-10)

The ERP is feature-complete against the original build spec plus a large second round of client-requested changes, and is running against the **real production Supabase database** with real Shopify-migrated data (665+ products, ~73 customers). All 4 roles (Owner/Admin/Cashier/Sales Agent) have been verified live — not just read from the code — for nav visibility, API permission boundaries, and real checkout/cancel/mark-paid flows.

**Not currently in progress** — no file is actively being touched. Current task: pushing this repo to a new GitHub repository for client handoff (git init not yet done in this directory — confirm target account/org and public/private before pushing).

## Open items (see `docs/phases.md` Phase 9/11/12 for full detail)

- Monument Extended font file not yet supplied (invoice wordmark falls back to bold Helvetica).
- Security header hardening (CSP, X-Frame-Options, etc.) identified in the audit, not yet applied.
- Next.js 14→16 upgrade planned but not started (dependency advisories, not urgent).
- Admin/Cashier passwords were reset during testing to `Godfather@1234` — flag to client to rotate.
- Loyalty rates/tier thresholds still using original unconfirmed defaults.
- Repo not yet pushed to any GitHub remote.

## Log

- **2026-08-26** — Created the initial `docs/` scaffold, grounded in `README.md` and the schema/config as they stood at that point (pre-migration, pre-simplification).
- **2026-08-23 → 2026-09-05** (reconstructed from git history / session context) — Shopify data migration (665+ products, ~73 customers, ~41 orders); two-stage Mix→Bottle production model added (`MixBatch`, `BULK_LIQUID`); `ShopSettings` singleton added so business identity is Owner-editable instead of hardcoded; full sidebar/UI redesign (`AppShell.tsx`); loading-spinner→success-checkmark pattern (`useAsyncAction` + `ActionStatus`) rolled out across every action button in the app, including a later pass that caught several buttons with no feedback at all (CRM segment/task/note add, price-list save/create, CSV imports).
- **2026-09-01 → 2026-09-05** — Fixed several real user-account bugs: Supabase-dashboard-created accounts stuck in "pending confirmation" forever (fixed by routing all user creation through the app's own pre-confirmed admin-API flow); three seed accounts (`owner@`/`admin@`/`cashier@scentrave.test`) turned out to have a stale `.test` email cached in our DB while Supabase Auth already had them as `.com` — resynced.
- **2026-09-05** — Full role-permission audit across Owner/Admin/Cashier/Sales Agent, verified live via real logins and direct API calls, not just code review — produced the permission table now in `docs/requirements.md`.
- **2026-09-05** — Full security audit (authz, injection, secrets, Razorpay webhook signature, CSV formula-injection, headers, dependency advisories). No critical/high findings in first-party code; found and fixed a genuinely broken feature along the way: the Supabase Storage `invoices` bucket had never been created, so WhatsApp invoice sharing had never actually worked despite being "done."
- **2026-09-05 → 2026-09-06** — Invoice PDF fully redesigned twice against real reference screenshots the client provided (first a two-column card layout, then a single-column receipt style matching the brand's actual prior Shopify invoice). Along the way: fixed a real tax bug where GST was being **added on top** of already-tax-inclusive prices (customers were being overcharged); fixed a CGST/SGST rounding bug where the two halves could sum to a paisa more than the stated total tax.
- **2026-09-06** — Added "Custom amount" checkout lines (non-catalog charges, no stock impact, reserved hidden placeholder variant) and customer address (shipping + billing) capture for invoices.
- **2026-09-06** — Major billing simplification per direct client feedback ("current billing is very complicated, make it easy"): removed the customer-search/save step in favor of two plain Name/Phone fields with quiet auto-link-by-phone; removed split-payment UI in favor of one optional payment field; bills now settle UNPAID by default with a separate "Mark as paid" action; Customer card moved to sit directly below Cart per explicit layout instruction.
- **2026-09-09** — Reports rebuilt from a product-aggregated view into a per-line-item Sales Transactions Report (Date/Order ID/Perfume/Customer/State/Qty/Bank Details/Taxable+CGST+SGST+IGST/Total) with State and Payment Mode filters; fixed a real case-sensitivity bug in the new State filter and a real PDF-generation crash from using the `₹` glyph in a `pdf-lib` standard font. Billing state field changed from free text to a full Indian states/UTs dropdown. Added a global "Back" button to every page except Billing. Confirmed via the connected Shopify store that the last real order is #1051 and set the internal order sequence to continue from `ORD/26-27/01052` onward. Added a payment-method selector to "Mark as paid" (previously hardcoded to Cash).
- **2026-09-10** — Reconciled and rewrote all six `docs/` files against current reality (they had drifted significantly — the 08-26 versions predated almost everything above). Preparing to push the repo to a new GitHub repository for client handoff.
