# Scentrave ERP — Rules

## Use

- **Prisma** for all DB access — no raw SQL unless a query genuinely can't be expressed in Prisma (and if so, wrap it in a service function, never inline in a route).
- **`lib/services/stockMovement.ts`** for any stock mutation, always. Never write to `StockLevel` from anywhere else. Custom-amount checkout lines are the one intentional exception — they skip stock movement entirely (see architecture.md).
- **`requireRole`** (`lib/auth/session.ts`) as the first statement of every API route method — this is the real security boundary, not `middleware.ts` (which only checks a session exists) and not UI nav filtering (`AppShell.tsx`).
- **Zod** to validate all API route input before it reaches a service function.
- **shadcn/ui + Radix** primitives for new UI — pull via the shadcn MCP tool rather than hand-rolling components that already exist in the library.
- **Server-side transactions** (`prisma.$transaction`) for any operation with more than one write that must succeed or fail together (checkout, production batch, returns, mark-as-paid).
- **Fire-and-forget** for non-critical side effects (email, WhatsApp) — never `await` them inside a transaction.
- **`lib/hooks/useAsyncAction.ts` + `components/ui/action-status.tsx`** for any button that triggers an async request — loading spinner while in flight, a 1-second green checkmark on success. This is an explicit, repeated client requirement ("the client must know when the process is done") — apply it to every new action button, not just the obvious ones. Skip it only when success genuinely unmounts the button/form immediately (e.g. delete-then-navigate-away, or a form that closes on success) — a checkmark that can never render is wasted code.
- **The manual diff+deploy migration workflow** (see architecture.md) for any schema change in this sandboxed environment — `prisma migrate dev` will fail.

## Avoid

- Don't mutate `StockLevel` directly. Don't bypass `recordStockMovement`.
- Don't hide role-gated data in the UI only — always enforce at the API/route layer too.
- Don't mutate a `Formula` in place — create a new version so past batches remain auditable.
- Don't add a new payment method without a `PaymentStatus` reconciliation path (see `lib/payments/razorpay.ts` webhook handling as the template).
- Don't introduce a second GST/tax calculation path outside `lib/services/tax.ts` — and don't make tax additive again (see the "AI boundaries" note below).
- Don't add client-side-only auth checks — `middleware.ts` and `requireRole` are the only gates that count.
- No raw SQL migrations outside the documented `prisma migrate diff` → hand-placed folder → `migrate deploy` workflow.
- Don't reintroduce multi-leg/split payments at checkout or a mandatory "create customer" step before billing — both were deliberately removed at the client's explicit request to simplify the counter workflow. If a future request seems to want either back, confirm it's intentional before building it.
- Don't restart the dev server casually mid-session if the user is also running their own — check whether a server is already bound to the port before spawning a competing one.

## Error handling

- Service functions throw; API routes catch and map to HTTP status + a clear message (`lib/api/errors.ts` — `handleApiError`).
- Negative-stock and overpayment guards live inside the transaction (`recordStockMovement`, `payment.ts`) — this is the actual race-condition safety net, not the preview/dry-run checks (which are UX-only, for fast feedback).
- Notification delivery failures degrade to a console log — never surface as a user-facing error, never block the transaction they're attached to.
- `pdf-lib`'s standard fonts (WinAnsi encoding) **cannot render `₹`** — this has caused a real crash before. Use `"Rs."` in any PDF text, never the rupee glyph. This doesn't apply to on-screen React/HTML text, only to `pdf-lib` `drawText` calls.

## AI boundaries

- Don't change the stock ledger's single-write-path invariant (`stockMovement.ts`) without flagging it explicitly — it's the integrity backbone of the whole system.
- **Never make tax additive again.** `computeTaxBreakup()` extracts GST from a price that already includes it; a prior version added tax on top and overcharged real customers. If a change to `lib/services/tax.ts` or `lib/services/order.ts` would make `Total > Subtotal - Discount`, stop and re-check against this note before shipping it.
- Don't change the `order` sequence's starting number without checking why it's set where it is (continuity with the real Shopify order history, currently picking up at #1052) — see architecture.md.
- Don't silently reintroduce a mandatory customer-creation step, split payments, or "invoice auto-marks paid at checkout" — all three were explicit, considered simplifications requested by the client; treat them as settled decisions, not oversights, unless the user asks to revisit them.
- Invoice/order numbering is legally/financially meaningful (GST sequential invoice numbers especially) — never renumber, backfill, or "clean up" existing `Invoice.invoiceNumber` or `Order.orderNumber` values without explicit user confirmation.
- Don't create real user accounts, reset real passwords, or push to a remote/GitHub repo without confirming scope first (which account/org, public vs. private) — this project connects to the client's real production Supabase database and, per the current task, is being handed off to the client's own GitHub.
- When adding a new admin screen or nav entry, check `components/AppShell.tsx`'s `NAV_SECTIONS` role arrays — new links must be role-scoped, not shown to everyone by default.
- Keep `docs/memory.md` updated as work progresses (see that file for the update discipline).
