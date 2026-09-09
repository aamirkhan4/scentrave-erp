'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionStatus } from '@/components/ui/action-status';
import { HeldBillsPanel } from '@/components/billing/HeldBillsPanel';
import { INDIAN_STATES } from '@/lib/constants/indianStates';

interface VariantOption {
  id: string;
  sku: string;
  sizeLabel: string;
  sizeMl: number;
  isTester: boolean;
  sellingPrice: string;
  stockOnHand: number;
  lowStockThreshold: number;
}

interface ProductGroup {
  id: string;
  name: string;
  type: 'PERFUME' | 'OIL';
  variants: VariantOption[];
}

// What addToCart needs — a variant plus the product info it belongs to.
interface VariantResult extends VariantOption {
  productName: string;
  productType: 'PERFUME' | 'OIL';
}

interface CartLine {
  variantId: string;
  sku: string;
  productName: string;
  sizeLabel: string;
  estimatedUnitPrice: number;
  quantity: number;
  isTester: boolean;
  /** A manually-priced line not tied to any catalog product — e.g. an alteration, service fee, or one-off charge. */
  isCustom?: boolean;
}

type PaymentMethod = 'CASH' | 'UPI_DYNAMIC_QR' | 'UPI_STATIC_QR' | 'CARD' | 'BANK_TRANSFER';

interface SettledSummary {
  orderNumber: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  held: boolean;
}

const HOME_STATE_FALLBACK = 'Maharashtra';

export function PosScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductGroup[]>([]);
  const [searching, setSearching] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  // Just Name + Phone, typed directly on the bill — no search, no save. If the
  // phone happens to match an existing CRM customer, the server links them
  // automatically (so loyalty/price list still apply) without any UI for it here.
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [customerState, setCustomerState] = useState(HOME_STATE_FALLBACK);

  const [discountCode, setDiscountCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');

  const [pendingAction, setPendingAction] = useState<'hold' | 'checkout' | null>(null);
  const submitting = pendingAction !== null;
  const [lastSuccess, setLastSuccess] = useState<'hold' | 'checkout' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<SettledSummary | null>(null);
  const [shareLink, setShareLink] = useState<{ pdfUrl: string; whatsappLink: string | null } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [heldBillsKey, setHeldBillsKey] = useState(0);

  const [catalogTab, setCatalogTab] = useState<'ALL' | 'PERFUME' | 'OIL'>('ALL');
  const [sizeFilter, setSizeFilter] = useState('');
  const [sizeOptions, setSizeOptions] = useState<string[]>([]);

  const estimatedSubtotal = cart.reduce((sum, l) => sum + l.estimatedUnitPrice * l.quantity, 0);

  async function runProductSearch(query: string, tab: 'ALL' | 'PERFUME' | 'OIL' = catalogTab, size: string = sizeFilter) {
    setSearchQuery(query);
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('query', query);
      if (tab !== 'ALL') params.set('type', tab);
      if (size) params.set('sizeLabel', size);
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      setProductResults(res.ok ? data.products : []);
      if (res.ok && data.sizeOptions) setSizeOptions(data.sizeOptions);
    } finally {
      setSearching(false);
    }
  }

  function selectTab(tab: 'ALL' | 'PERFUME' | 'OIL') {
    setCatalogTab(tab);
    runProductSearch(searchQuery, tab, sizeFilter);
  }

  function selectSize(size: string) {
    setSizeFilter(size);
    runProductSearch(searchQuery, catalogTab, size);
  }

  useEffect(() => {
    runProductSearch('', 'ALL', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addToCart(variant: VariantResult) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        return prev.map((l) => (l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          sizeLabel: variant.sizeLabel,
          estimatedUnitPrice: Number(variant.sellingPrice),
          quantity: 1,
          isTester: variant.isTester,
        },
      ];
    });
  }

  function addCustomItemToCart() {
    setCustomError(null);
    const label = customLabel.trim();
    const amount = Number(customAmount);
    if (!label) {
      setCustomError('Enter a description for this charge');
      return;
    }
    if (!customAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setCustomError('Enter a valid amount greater than 0');
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        variantId: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sku: 'CUSTOM',
        productName: label,
        sizeLabel: '',
        estimatedUnitPrice: amount,
        quantity: 1,
        isTester: false,
        isCustom: true,
      },
    ]);
    setCustomLabel('');
    setCustomAmount('');
  }

  function updateQuantity(variantId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.variantId !== variantId));
      return;
    }
    setCart((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)));
  }

  async function submitOrder(hold: boolean) {
    setError(null);
    if (cart.length === 0) {
      setError('Cart is empty');
      return;
    }
    setPendingAction(hold ? 'hold' : 'checkout');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: guestName.trim() || undefined,
          guestPhone: guestPhone.trim() || undefined,
          customerState,
          items: cart.map((l) =>
            l.isCustom
              ? { custom: true, label: l.productName, unitPrice: l.estimatedUnitPrice, quantity: l.quantity }
              : { productVariantId: l.variantId, quantity: l.quantity },
          ),
          discountCode: discountCode.trim() || undefined,
          // Payment is optional — leaving it blank settles the sale as UNPAID, marked paid later.
          payments: hold || !paymentAmount.trim() ? [] : [{ method: paymentMethod, amount: Number(paymentAmount) }],
          hold,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Checkout failed');
        return;
      }

      setSettled({
        orderNumber: data.order.orderNumber,
        invoiceId: data.invoice?.id,
        invoiceNumber: data.invoice?.invoiceNumber,
        invoiceStatus: data.invoice?.status,
        subtotal: data.order.subtotal,
        discountAmount: data.order.discountAmount,
        taxAmount: data.order.taxAmount,
        total: data.order.total,
        held: hold,
      });
      setLastSuccess(hold ? 'hold' : 'checkout');
      setTimeout(() => setLastSuccess(null), 1000);
      setShareLink(null);
      setCart([]);
      if (hold) setHeldBillsKey((k) => k + 1);
      setGuestName('');
      setGuestPhone('');
      setPaymentAmount('');
      setDiscountCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPendingAction(null);
    }
  }

  async function shareInvoice() {
    if (!settled?.invoiceId) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/invoices/${settled.invoiceId}/share`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) setShareLink(data);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Find product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1">
              {(['ALL', 'PERFUME', 'OIL'] as const).map((tab) => (
                <Button key={tab} size="sm" variant={catalogTab === tab ? 'default' : 'outline'} onClick={() => selectTab(tab)}>
                  {tab === 'ALL' ? 'All' : tab === 'PERFUME' ? 'Perfumes' : 'Oils'}
                </Button>
              ))}
            </div>
            {sizeOptions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={sizeFilter === '' ? 'secondary' : 'ghost'} onClick={() => selectSize('')}>
                  All sizes
                </Button>
                {sizeOptions.map((size) => (
                  <Button key={size} size="sm" variant={sizeFilter === size ? 'secondary' : 'ghost'} onClick={() => selectSize(size)}>
                    {size}
                  </Button>
                ))}
              </div>
            )}
            <Input placeholder="Search by name or SKU…" value={searchQuery} onChange={(e) => runProductSearch(e.target.value)} />
            {searching ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : productResults.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No products match.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {productResults.map((product) => (
                  <div key={product.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{product.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {product.type === 'PERFUME' ? 'Perfume' : 'Oil'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {product.variants.map((v) => {
                        const low = v.stockOnHand <= v.lowStockThreshold;
                        return (
                          <button
                            key={v.id}
                            onClick={() => addToCart({ ...v, productName: product.name, productType: product.type })}
                            title={`${v.sku} · ${v.stockOnHand} in stock`}
                            className={`flex flex-col items-center rounded-md border px-2.5 py-1.5 text-left transition hover:bg-accent ${
                              low ? 'border-destructive/40' : 'border-border'
                            }`}
                          >
                            <span className="flex items-center gap-1 text-xs font-medium">
                              {v.sizeLabel}
                              {v.isTester && <Badge variant="secondary" className="px-1 py-0 text-[9px]">T</Badge>}
                            </span>
                            <span className="text-xs text-muted-foreground">₹{v.sellingPrice}</span>
                            {low && <span className="text-[10px] text-destructive">{v.stockOnHand} left</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <HeldBillsPanel key={heldBillsKey} onResumed={() => setHeldBillsKey((k) => k + 1)} />
        <Card>
          <CardHeader>
            <CardTitle>Cart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 && <p className="text-sm text-muted-foreground">No items yet — search and click a product to add it.</p>}
            {cart.map((line) => (
              <div key={line.variantId} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {line.productName}
                    {line.sizeLabel && <span className="text-muted-foreground"> ({line.sizeLabel})</span>}
                    {line.isCustom && <Badge variant="secondary" className="ml-1.5 align-middle">Custom</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">₹{line.estimatedUnitPrice} × {line.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-7" onClick={() => updateQuantity(line.variantId, line.quantity - 1)}>
                    −
                  </Button>
                  <span className="w-6 text-center text-sm">{line.quantity}</span>
                  <Button variant="outline" size="icon" className="size-7" onClick={() => updateQuantity(line.variantId, line.quantity + 1)}>
                    +
                  </Button>
                </div>
              </div>
            ))}
            {cart.length > 0 && (
              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="text-muted-foreground">Estimated subtotal (pre-discount, tax included)</span>
                <span className="font-medium">₹{estimatedSubtotal.toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Input placeholder="Name (optional)" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            <Input placeholder="Phone (optional)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">State (for GST)</label>
              <select
                className="block h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={customerState}
                onChange={(e) => setCustomerState(e.target.value)}
              >
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custom amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">For anything not in the catalog — alterations, services, one-off charges.</p>
            <Input placeholder="Description (e.g. Gift wrapping)" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount ₹"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomItemToCart()}
              />
              <Button variant="outline" onClick={addCustomItemToCart}>
                Add to cart
              </Button>
            </div>
            {customError && <p className="text-sm text-destructive">{customError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discount</CardTitle>
          </CardHeader>
          <CardContent>
            <Input placeholder="Coupon code (optional)" value={discountCode} onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Optional — leave blank to settle as unpaid and mark it paid later.</p>
            <div className="flex gap-2">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI_DYNAMIC_QR">UPI (Dynamic QR)</option>
                <option value="UPI_STATIC_QR">UPI (Static QR)</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </select>
              <Input type="number" placeholder="Amount paid (optional)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {settled && (
          <Card>
            <CardHeader>
              <CardTitle>{settled.held ? 'Bill held' : 'Sale complete'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Order: {settled.orderNumber}</p>
              {settled.invoiceNumber && (
                <p>
                  Invoice: {settled.invoiceNumber}{' '}
                  <Badge variant={settled.invoiceStatus === 'PAID' ? 'default' : 'secondary'}>{settled.invoiceStatus}</Badge>
                </p>
              )}
              <p>Subtotal: ₹{settled.subtotal}</p>
              <p>Discount: −₹{settled.discountAmount}</p>
              <p>Tax (included in total): ₹{settled.taxAmount}</p>
              <p className="font-semibold">Total: ₹{settled.total}</p>

              {settled.invoiceId && !shareLink && (
                <Button variant="outline" size="sm" className="mt-2" onClick={shareInvoice} disabled={sharing}>
                  {sharing ? 'Preparing…' : 'Share invoice via WhatsApp'}
                </Button>
              )}
              {shareLink?.whatsappLink && (
                <a href={shareLink.whatsappLink} target="_blank" rel="noreferrer" className="mt-2 block">
                  <Button size="sm" className="w-full">
                    Open WhatsApp
                  </Button>
                </a>
              )}
              {shareLink && !shareLink.whatsappLink && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No phone on file for this customer — PDF ready at{' '}
                  <a href={shareLink.pdfUrl} target="_blank" rel="noreferrer" className="underline">
                    {shareLink.pdfUrl}
                  </a>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" disabled={submitting || cart.length === 0} onClick={() => submitOrder(true)}>
            <ActionStatus loading={pendingAction === 'hold'} success={lastSuccess === 'hold'} />
            Hold bill
          </Button>
          <Button className="flex-1 gap-2" disabled={submitting || cart.length === 0} onClick={() => submitOrder(false)}>
            <ActionStatus loading={pendingAction === 'checkout'} success={lastSuccess === 'checkout'} />
            {pendingAction === 'checkout' ? 'Processing…' : 'Checkout'}
          </Button>
        </div>
      </div>
    </div>
  );
}
