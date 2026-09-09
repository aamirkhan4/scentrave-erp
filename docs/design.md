# Scentrave ERP — Design

Source of truth: `app/globals.css` (CSS variables) + `tailwind.config.ts` (token mapping). Don't hardcode hex/HSL values in components — always go through the Tailwind color tokens below.

## Theme direction

Earth-tone palette matching the perfume/attar brand context — warm browns, creams, and muted tans rather than a generic SaaS blue. Full light/dark mode via `.dark` class, `next-themes`-style toggle.

## Colors (light mode — `:root`)

| Token | HSL | Use |
|---|---|---|
| `background` | `30 20% 98%` | Page background — warm off-white |
| `foreground` | `20 15% 12%` | Primary text — near-black brown |
| `card` | `30 25% 100%` | Card surfaces |
| `primary` | `20 40% 22%` | Primary actions — deep coffee brown |
| `secondary` / `muted` | `30 15% 92%` | Subtle backgrounds, secondary buttons |
| `accent` | `25 45% 88%` | Highlights, selected states |
| `destructive` | `0 65% 45%` | Delete/error actions |
| `border` / `input` | `30 15% 86%` | Borders, input outlines |
| `ring` | `20 40% 45%` | Focus rings |
| `sidebar` | `20 35% 14%` | Nav sidebar — dark brown, always contrasts against main content |
| `sidebar-foreground` | `30 25% 92%` | Sidebar text |

## Colors (dark mode — `.dark`)

| Token | HSL | Use |
|---|---|---|
| `background` | `20 15% 8%` | Near-black brown |
| `foreground` | `30 20% 96%` | Warm off-white text |
| `primary` | `30 40% 70%` | Lighter tan — inverted for contrast on dark bg |
| `card` | `20 15% 11%` | Slightly raised surface |
| `destructive` | `0 60% 55%` | Softer red for dark backgrounds |

Radius: `--radius: 0.5rem` (mapped to `rounded-lg` = full, `rounded-md` = -2px, `rounded-sm` = -4px).

## Typography

- Font: `var(--font-sans)` → falls back to `ui-sans-serif, system-ui, sans-serif`. Set the actual font (e.g. via `next/font`) in the root layout; no separate serif/display face — one type family throughout for a clean POS/admin feel.
- No custom type scale defined beyond Tailwind defaults — use Tailwind's default `text-sm` / `text-base` / `text-lg` / `text-xl` etc. scale; don't introduce arbitrary font sizes.

## Components

- **shadcn/ui** (Button, Input, Card, Badge, and others as needed) pulled via the shadcn MCP tool — don't hand-roll a component that already exists there.
- **Radix primitives** underneath for accessibility (dialogs, dropdowns, etc.) via the `radix-ui` package.
- **CVA** (`class-variance-authority`) for component variants (e.g. Button intent/size).
- **Recharts** for all dashboard charts — line (trend), pie (category/size breakdown), bar.
- **lucide-react** for icons — one icon library only, don't mix in another.

## Motion

- `framer-motion` is a dependency but usage should stay restrained — this is an operational/POS tool used all day by staff, not a marketing site. Favor fast, subtle transitions (dropdown open/close, toast in/out) over decorative animation. A `shimmer` keyframe exists in Tailwind config for loading-skeleton states.
- **Every async action button follows one pattern**: `Spinner` while in flight → a green `Check` icon that pops in (`pop-in` keyframe, `cubic-bezier(0.34, 1.56, 0.64, 1)`, 300ms) and holds for 1 second on success. Implemented via `lib/hooks/useAsyncAction.ts` + `components/ui/action-status.tsx` (`<ActionStatus loading success />`). This was an explicit, repeated client requirement — apply it to new action buttons by default, not just the ones that already had a spinner.
- Skip the checkmark only when success genuinely unmounts the button (delete-then-navigate, a form that closes on success) — it would never be visible.

## Invoice PDF (separate visual system from the app UI)

- Single-column, receipt-style layout matching the brand's own prior Shopify invoice: `SCENTRAVE` wordmark top-left, Invoice #/date top-right, FROM/BILL TO two-column header block, itemized table (Items / Quantity / Amount), Subtotal/Taxes/Total, centered footer (thank-you line, shop name/address/email).
- **Wordmark font**: intended to be "Monument Extended Regular" (a paid font, not yet supplied) — `lib/pdf/invoice.ts` looks for `assets/fonts/MonumentExtended-Regular.otf` and embeds it via `@pdf-lib/fontkit` if present, falling back to bold Helvetica otherwise. Drop the licensed file in that path when available; no code change needed.
- **Never use the `₹` glyph in a `pdf-lib` `drawText` call** — the standard WinAnsi-encoded fonts can't render it and the page generation throws. Use `"Rs."` instead (already the convention in both `lib/pdf/invoice.ts` and `lib/pdf/salesReport.ts`).
- The Sales Transactions Report PDF uses A4 **landscape** (more columns than the invoice) — don't switch it back to portrait without re-checking column widths fit.

## Layout conventions

- Sidebar nav (`sidebar` tokens) + main content area, role-filtered links (`components/AppShell.tsx`'s `NAV_SECTIONS`).
- A global "Back" button (`ArrowLeft` icon, `router.back()`) sits in the shared header on every page except `/pos` (the default/home screen for all roles).
- Admin screens: table-first layouts with filter bars above.
- POS screen: product-browse (left) / Cart → Customer → Custom amount → Discount → Payment → Checkout (right), in that order — Customer sits directly below Cart per an explicit client layout request, and is deliberately just two plain inputs (Name, Phone) with no search UI.
