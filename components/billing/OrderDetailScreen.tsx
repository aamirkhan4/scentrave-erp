'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ActionStatus } from '@/components/ui/action-status';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';

interface OrderItem {
  id: string;
  quantity: number;
  returnedQuantity: number;
  unitPrice: string;
  lineTotal: string;
  customLabel: string | null;
  productVariant: { sizeLabel: string; sku: string; product: { name: string } };
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  createdAt: string;
  customer: { name: string; phone: string } | null;
  guestName: string | null;
  guestPhone: string | null;
  items: OrderItem[];
  invoice: { id: string; invoiceNumber: string; status: string; payments: Array<{ method: string; amount: string; status: string }> } | null;
}

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(false);
  const [returnMessage, setReturnMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [canMarkPaid, setCanMarkPaid] = useState(false);
  const [markPaidMethod, setMarkPaidMethod] = useState('CASH');

  async function load() {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load order');
        return;
      }
      setOrder(data.order);
    } catch {
      setError('Could not reach the server');
    }
  }

  useEffect(() => {
    load();
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setCanMarkPaid(d.user?.role === 'OWNER' || d.user?.role === 'ADMIN'))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function markPaid() {
    if (!order?.invoice) return false;
    const res = await fetch(`/api/invoices/${order.invoice.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: markPaidMethod }),
    });
    if (!res.ok) return false;
    await load();
    return true;
  }
  const markPaidAction = useAsyncAction(markPaid);

  async function submitReturn() {
    const lines = Object.entries(returnQuantities)
      .filter(([, v]) => Number(v) > 0)
      .map(([orderItemId, v]) => ({ orderItemId, quantity: Number(v) }));
    if (lines.length === 0) return;

    setSubmitting(true);
    setReturnMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReturnMessage(data.error ?? 'Return failed');
        return;
      }
      setReturnQuantities({});
      setReturnMessage('Return processed — stock reversed.');
      setReturnSuccess(true);
      setTimeout(() => setReturnSuccess(false), 1000);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
  if (!order) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const canReturn = order.status === 'CONFIRMED' || order.status === 'PARTIALLY_RETURNED';
  const returnableItems = order.items.filter((i) => i.quantity - i.returnedQuantity > 0);
  const canDelete = order.status !== 'RETURNED' && order.status !== 'CANCELLED';
  const isHeld = order.status === 'DRAFT';

  async function deleteOrCancel() {
    if (!order) return;
    const message = isHeld
      ? `Delete held bill ${order.orderNumber}? This can't be undone.`
      : `Cancel ${order.orderNumber}? Stock will be reversed and the invoice voided — the order stays on record for the audit trail.`;
    if (!confirm(message)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete/cancel order');
        return;
      }
      if (data.deleted) {
        router.push('/orders');
      } else {
        await load();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            {order.orderNumber} <Badge variant="outline">{order.status}</Badge>
          </CardTitle>
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={deleteOrCancel} disabled={deleting} className="gap-2">
              {deleting && <Spinner />}
              {deleting ? 'Working…' : isHeld ? 'Delete bill' : 'Cancel order'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            {order.customer
              ? `${order.customer.name} · ${order.customer.phone}`
              : order.guestName
                ? `${order.guestName}${order.guestPhone ? ` · ${order.guestPhone}` : ''}`
                : 'Walk-in customer'}{' '}
            · {new Date(order.createdAt).toLocaleString('en-IN')}
          </p>
          {order.invoice && (
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Invoice: {order.invoice.invoiceNumber} <Badge variant={order.invoice.status === 'PAID' ? 'default' : 'secondary'}>{order.invoice.status}</Badge>
              </span>
              <a href={`/api/invoices/${order.invoice.id}/pdf`} target="_blank" rel="noreferrer" className="text-primary underline">
                View PDF
              </a>
              {canMarkPaid && order.invoice.status !== 'PAID' && order.invoice.status !== 'VOID' && (
                <>
                  <select
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={markPaidMethod}
                    onChange={(e) => setMarkPaidMethod(e.target.value)}
                    disabled={markPaidAction.loading}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI_DYNAMIC_QR">UPI (Dynamic QR)</option>
                    <option value="UPI_STATIC_QR">UPI (Static QR)</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <Button size="sm" variant="outline" onClick={markPaidAction.run} disabled={markPaidAction.loading} className="gap-2">
                    <ActionStatus loading={markPaidAction.loading} success={markPaidAction.success} />
                    Mark as paid
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
              <span>
                {item.customLabel ?? `${item.productVariant.product.name} (${item.productVariant.sizeLabel})`} × {item.quantity}
                {item.returnedQuantity > 0 && <span className="text-muted-foreground"> — {item.returnedQuantity} returned</span>}
              </span>
              <span>₹{item.lineTotal}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-sm">
            <span className="text-muted-foreground">Subtotal / Discount / Tax</span>
            <span>
              ₹{order.subtotal} / −₹{order.discountAmount} / ₹{order.taxAmount}
            </span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>₹{order.total}</span>
          </div>
        </CardContent>
      </Card>

      {order.invoice && order.invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {order.invoice.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  {p.method} <Badge variant="outline">{p.status}</Badge>
                </span>
                <span>₹{p.amount}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canReturn && returnableItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Process a return</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {returnableItems.map((item) => {
              const returnable = item.quantity - item.returnedQuantity;
              return (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span>
                    {item.customLabel ?? `${item.productVariant.product.name} (${item.productVariant.sizeLabel})`} — {returnable} returnable
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={returnable}
                    className="w-20"
                    value={returnQuantities[item.id] ?? ''}
                    onChange={(e) => setReturnQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              );
            })}
            {returnMessage && <p className="text-sm text-muted-foreground">{returnMessage}</p>}
            <Button onClick={submitReturn} disabled={submitting} variant="destructive" className="gap-2">
              <ActionStatus loading={submitting} success={returnSuccess} />
              {submitting ? 'Processing…' : 'Process return'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
