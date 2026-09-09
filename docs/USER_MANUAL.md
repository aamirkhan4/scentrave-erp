# SCENTRAVE ERP — Beginner's Guide

If you've never used a system like this before, start here. This walks you through what everything means and does, in plain language — no assumed experience.

## What is this, really?

"ERP" just means one system that runs the whole shop instead of juggling a cash register, a notebook for stock, and a phone contacts list separately. In SCENTRAVE, everything connects:

**Raw materials** (your ingredients) → get turned into **Products** through **Production** → which become sellable **stock** → which you sell through **Billing** → which creates **Orders** and **Payments** → all tied to **Customers** you can look up anytime.

Keep that chain in your head — almost every screen in this app is one link in it.

## Signing in

Go to the login page, type your email and password, click **Sign in**. That's it — you'll land on the Billing screen.

If it says "Not signed in" after you've been away for a while, that's just your session timing out for security. Sign in again — nothing was lost.

Can't sign in at all? Someone with an Owner or Admin account needs to set your account up first — you can't create your own.

## Your role decides what you can do

Everyone has one of four roles. This matters because a screen might *open* for you but a *button on it* might not work — that's not a bug, it's your permission level:

| Role | What you can do |
|---|---|
| **Owner** | Everything |
| **Admin** | Everything |
| **Cashier** | Sell (Billing), view/process orders and returns, look up customers, view stock |
| **Sales Agent** | Sell (Billing), view orders (no returns), full customer/CRM work |

Anything about the catalog (products, pricing, discounts), production, stock counts, or the reports/dashboard is **Owner/Admin only**.

## Finding your way around

Everything lives in the left-hand menu, grouped by what you're actually doing, not by technical category:

- **Sales** — Billing, Orders, Customers (what you'll use every single day)
- **Catalog** — Products, Categories, Raw Materials, Price Lists, Discounts (setting up *what* you sell)
- **Operations** — Production, Inventory, Payments (keeping stock and money accurate)
- **Insights** — Dashboard, Reports (seeing how the business is doing)

On a phone or small screen, tap the ☰ icon top-left to open this menu.

---

## The screen you'll use the most: Billing

This is the checkout counter. Here's the whole flow, in order:

1. **Find the product.** Type a name or SKU (a SKU is just the unique code for one specific bottle size, like `SHF-1-MILLION-ROYAL-50`) in the search box, or use the All/Perfumes/Oils buttons to browse. Each product shows up as **one card** with its available sizes as buttons inside it (25ml, 50ml, Tester, etc.) — just like tapping a size on a shopping site before adding to cart.
2. **Click a size** to add it to the cart. Click it again to add another one; there are +/− controls in the cart to adjust quantity.
3. **Attach a customer** (optional, but recommended). Search their phone number or name, or add them fresh if they're new. Their **state** matters — it decides whether tax is charged as CGST+SGST (same state) or IGST (different state). If you skip this, it's a walk-in sale and you can just type in a state.
4. **Loyalty points** — if the customer has any, you can redeem some here, worth ₹0.50 each.
5. **Discount code** — type it in if they have one. Doesn't matter if you type it in capitals or not.
6. **Take payment.** Pick Cash, UPI, Card, or Bank transfer, and type the amount. If they're paying part-cash part-UPI, click **+ Split payment** to add a second method.
7. Two ways to finish:
   - **Hold bill** — parks the sale with nothing charged, for when a customer needs to step away and come back.
   - **Checkout** — finalizes the sale. You need at least one payment method entered first.
8. After checkout, you can send the invoice to the customer over WhatsApp, or just grab the PDF link.

**Picking up a held bill:** anyone can resume anyone else's held bill — it's shared across the whole counter, not locked to who created it.

## Orders — your sales history

Every sale ever made lives here. Filter by status (All / Confirmed / Partially Returned / Returned) and click any row to see the full detail: what was bought, the invoice, and any payments recorded.

**Processing a return:** open the order, type how many units of each item are coming back, and submit. Stock goes back into inventory automatically — you never have to manually adjust it.

**Deleting a bill:** a bill still on hold (never checked out) can be deleted outright. A completed sale gets **cancelled** instead of deleted — stock is put back and the invoice is voided, but the record stays, because a real invoice number was already issued and needs to stay traceable (this is a legal/accounting thing, not a limitation of the app).

## Customers — your CRM

Search by name or phone. Every customer's profile shows their spend history, loyalty points, and lets you:
- See every order they've placed
- Log **notes** (a running diary — useful for remembering a complaint, a preference, anything worth knowing next time they call)
- Set **follow-up tasks** with a due date
- Add them to a **segment** (a named group, e.g. "Regulars who only buy 50ml")
- Assign them a special **price list** if they get different pricing (see below)

## Setting up what you sell: the Catalog

This is where a product actually gets created before it can ever be sold. Think of it as four layers, built in this order:

1. **Categories** — the big shelves (e.g. "Perfume", "Oil") and the smaller shelves inside them (e.g. "Woody", "Floral").
2. **Products** — one entry per perfume/oil, e.g. "1 Million Royal". Give it a name, pick its category, pick Perfume or Oil.
3. **Variants (sizes)** — each product then gets its actual sellable sizes added underneath it: 25ml, 50ml, a 10ml tester, etc. Each size has its own SKU and price. The size dropdown only offers your real standard sizes, so nobody accidentally creates a weird "50 ML" vs "50ml" mismatch.
4. **Formula** (Perfumes only) — the actual recipe: which raw materials go into it, and how much. This is what **Production** (below) uses to know what to consume when you make a batch.

Everything here can be searched, filtered by size, and paged through — with delete buttons everywhere: deleting a product or size just hides it (your sales history is never lost), deleting a discount code removes it if it's never been used or turns it off if it has.

**Raw Materials** is a separate list — your actual ingredients (concentrate, alcohol, bottles, caps, boxes). ⚠️ **Right now this list is empty** and no formulas exist yet — you'll need to add your real ingredients here first before Production can track consumption properly.

**Price Lists** let you charge a different price to certain customers (e.g. a "Wholesale" list) — set it once, assign it to a customer, done.

## Production — turning ingredients into stock

This is where a batch actually gets made:

1. Search for the product + size you're producing.
2. Type how many bottles.
3. Click **Preview consumption** — it tells you exactly how much of each raw material is needed, and whether you have enough (each ingredient shows OK or Short).
4. If everything's OK, click **Confirm batch**. This does three things at once: takes the raw materials out of stock, adds the finished bottles into sellable stock, and logs the batch for your records.

If a product has no formula yet (like right now, since Raw Materials is empty), it'll just say so and skip the check — meaning right now, Production isn't tracking real consumption. Add your ingredients and formulas first.

## Inventory — your stock room

One list showing both raw materials and finished bottles, with a red "Low" badge for anything running out. Two things you can do:
- **Reconcile** — if you physically count stock and it doesn't match what the system says, type in the real number here and it corrects itself (and logs why).
- **Movement history** — a full log of every single stock change (a sale, a return, a production batch, a manual fix) so you can always trace *why* a number changed.

## Payments — making sure money adds up

A simple dashboard: how much is fully paid vs. still pending, invoice by invoice. Useful for spotting a sale where, say, a bank transfer leg hasn't cleared yet.

## Dashboard — the big picture

Today/week/month sales (with a % up or down vs. the period before), a 14-day trend chart, your best-selling sizes, low-stock warnings, and pending payments — all in one glance. This one can take a few seconds to load; that's normal for the amount of data it pulls together.

## Reports — pulling numbers out

Pick a date range, click **Run report**, get a full sales breakdown (units sold, revenue, discounts, tax, margin) per product. Export as CSV (for Excel) or PDF (for printing/sharing).

---

## Common beginner questions

**"I clicked something and got a permission error."**
Check the role table near the top — some things are locked to Owner/Admin no matter what the screen shows you.

**"A product isn't showing up when I search in Billing."**
Make sure it's marked active and has at least one size (variant) added — a product with no sizes has nothing to sell.

**"Why does Production say 'no formula, bottled directly'?"**
Either that product genuinely doesn't need mixing (some oils are sold as-is), or nobody's added a formula for it yet under Products → Formula.

**"The discount code isn't applying."**
Check it hasn't hit its usage limit (shown on the Discounts screen), and double check the spelling — case doesn't matter, but the actual code has to match.

**"I got signed out for no reason."**
Sessions expire automatically after a while of inactivity, for security. Just sign back in — you won't lose anything you already saved.

**"Everything feels slow."**
A few screens (like the Dashboard) pull together a lot of numbers at once and can take a few seconds — that's expected, not broken. If a whole page won't load at all, that's different — worth flagging.
