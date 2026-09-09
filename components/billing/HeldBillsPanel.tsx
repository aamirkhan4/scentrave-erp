'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface HeldOrder {
  id: string;
  orderNumber: string;
  total: string;
  createdAt: string;
  customer: { name: string } | null;
}

type PaymentMethod = 'CASH' | 'UPI_DYNAMIC_QR' | 'UPI_STATIC_QR' | 'CARD' | 'BANK_TRANSFER';

/** Lists parked/held bills and lets any cashier resume one. Payment is optional — settles as unpaid if left blank, same as a fresh checkout. */
export function HeldBillsPanel({ onResumed }: { onResumed?: () => void }) {
  const [held, setHeld] = useState<HeldOrder[]>([]);
  const [resuming, setResuming] = useState<HeldOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/orders?status=DRAFT');
    const data = await res.json();
    if (res.ok) setHeld(data.orders);
  }

  useEffect(() => {
    load();
  }, []);

  function startResume(order: HeldOrder) {
    setResuming(order);
    setPaymentMethod('CASH');
    setPaymentAmount('');
    setError(null);
  }

  async function confirmResume() {
    if (!resuming) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${resuming.id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: paymentAmount.trim() ? [{ method: paymentMethod, amount: Number(paymentAmount) }] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Resume failed');
        return;
      }
      setResuming(null);
      await load();
      onResumed?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (held.length === 0 && !resuming) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Held bills ({held.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!resuming &&
          held.map((o) => (
            <div key={o.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
              <span>
                {o.orderNumber} — {o.customer?.name ?? 'Walk-in'} · ₹{o.total}
              </span>
              <Button size="sm" variant="outline" onClick={() => startResume(o)}>
                Resume
              </Button>
            </div>
          ))}

        {resuming && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">
              {resuming.orderNumber} — total ₹{resuming.total}
            </p>
            <p className="text-xs text-muted-foreground">Optional — leave blank to settle as unpaid and mark it paid later.</p>
            <div className="flex items-center gap-2">
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmResume} disabled={submitting} className="gap-2">
                {submitting && <Spinner />}
                {submitting ? 'Completing…' : 'Complete sale'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setResuming(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
