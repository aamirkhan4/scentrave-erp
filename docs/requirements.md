# Scentrave ERP — Project Requirements

## What this is

Billing, inventory, production, and CRM system for Scentrave, a perfume/attar D2C + retail brand. Single Next.js app covering point-of-sale, raw-material-to-finished-goods production tracking, GST invoicing, payments (UPI/cash/card), loyalty, and reporting — now running against **real, live Shopify-migrated data** (665+ products, ~73 customers, order numbering continuing from the real Shopify order sequence), not a demo dataset.

## Targeted users

| Role | Who | What they need |
|---|---|---|
| Owner | Business owner | Full visibility: dashboard, margins/cost prices, reports, all admin screens, Shop Details, user management (including role changes and password resets) |
| Admin | Store/ops manager | Same as Owner minus final authority — cannot edit Shop Details, change another user's role, deactivate a user, or reset another user's password |
| Cashier | Counter staff | POS/billing, order cancel/return, Inventory (view only) — no cost prices, no reports, no dashboard, no catalog/backend screens |
| Sales Agent | Sales/CRM staff | Full CRM (edit customers, tasks, segments), POS/billing — cannot cancel/return orders, no Inventory access, no backend/catalog/reporting screens |

Nav links and cost-sensitive data (cost price, raw material cost, formulas, report margins) are filtered per role — enforced at the API/route layer, not just hidden in the UI. Verified live for all four roles, not just by reading the code.

## Core features

- **Billing / POS** — product search or category browsing, cart, a "Custom amount" line for anything not in the catalog (alterations, services, one-off charges — no stock impact), discount codes, checkout, or hold/resume bills.
- **Customer at checkout, without "saving a customer"** — just type Name + Phone (both optional) directly on the bill. If the phone matches an existing CRM customer, that customer is linked automatically (loyalty points, price list) with no visible search step. No mandatory customer-creation flow blocking a fast walk-in sale.
- **Payments settle as UNPAID by default** — the Payment section at checkout is optional; leaving it blank creates the sale and invoice as UNPAID. A separate **"Mark as paid"** action (Owner/Admin only, order detail screen) records the payment with a chosen method (Cash / UPI Dynamic or Static QR / Card / Bank Transfer / Other) whenever the money actually arrives.
- **Tax-inclusive GST pricing** — listed prices already include GST; tax is never added on top at checkout. CGST+SGST applies when the customer's state matches the shop's home state (Rajasthan); IGST applies otherwise. This is a deliberate, verified business rule — see `lib/services/tax.ts`.
- **Production** — two-stage model: **Mix** (raw materials → bulk liquid, tracked in ml per product) then **Bottle** (bulk liquid → sellable bottle stock per variant). Formula-driven raw-material deduction happens at Mix time; bottling just draws down the bulk pool (or bypasses it entirely for formula-less products, same as before).
- **Inventory** — stock ledger (immutable movements) for raw materials, bulk liquid, and finished SKUs; low-stock alerts; physical-count reconciliation.
- **Orders & returns** — order history, invoice PDF, partial/full returns with stock reversal, order cancel (Owner/Admin/Cashier).
- **Payments** — Razorpay Dynamic QR (auto-reconciled via webhook, signature-verified), static UPI QR fallback, cash/card/bank transfer, loyalty-points redemption, manual "Mark as paid" reconciliation.
- **CRM** — customer profiles (order history, lifetime value, loyalty ledger, shipping + billing address for invoices), segments, follow-up tasks, notes.
- **Discounts & loyalty** — flat/percentage/buy-x-get-y discounts, points earn/redeem, auto tier upgrade (Silver/Gold/Platinum).
- **Sales Transactions Report** (Owner/Admin only) — one row per line item sold: Date, Order ID, Perfume, Customer Name, State, Quantity, Bank Details (shown only when paid by UPI), Taxable Amount, CGST/SGST or IGST (state-dependent), Total Amount. Filterable by date range, State, and Payment Mode (Cash/UPI/Card/Bank Transfer). CSV and PDF export (PDF in landscape given the column count).
- **Dashboard** — live sales/stock/customer metrics via Supabase Realtime, 5-min fallback poll.
- **Invoices** — single-column receipt-style PDF (FROM/BILL TO, itemized table, tax breakdown, footer) matching the brand's prior Shopify invoice format; shop name/address/GSTIN/email all pulled from Settings → Shop Details, not hardcoded.
- **Notifications** — low-stock alerts to Owner/Admin via email (Resend) and WhatsApp (Meta Cloud API), fire-and-forget.
- **Order numbering continuity** — new order numbers continue from the real Shopify order sequence (last Shopify order was **#1051**; our numbering picks up at `ORD/26-27/01052`) rather than restarting from 1, so the business's order history reads as one continuous sequence across the platform migration.
- **Navigation** — every page except Billing (the default/home screen) shows a "Back" button that returns to wherever the user actually came from.

## Explicitly out of scope (for now)

- Multi-state GST (single GSTIN / single home state — Rajasthan — only).
- Multi-location/multi-warehouse inventory.
- Split/multi-leg payments at checkout (deliberately simplified to one optional payment method per sale, per explicit client request — see `docs/memory.md` for the reasoning).
- A payer's actual bank name per UPI transaction (we show the shop's own receiving UPI/bank details on a paid-by-UPI row, not the customer's bank — no per-transaction bank capture exists).

## Success criteria

A cashier can complete a full walk-in sale (search → cart → optional name/phone → checkout) in a few clicks without ever being forced through a "create customer" flow, and without touching cost data. An Owner can mark a bill paid once the money is actually confirmed, run a production Mix then Bottle batch and see it reflected in stock in real time, and pull a Sales Transactions Report filtered to a specific state and payment mode that reconciles cleanly against a bank statement.
