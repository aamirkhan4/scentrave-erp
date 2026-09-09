'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ReconciliationRow {
  invoiceNumber: string;
  total: number;
  paid: number;
  remaining: number;
  status: string;
  matched: boolean;
  pendingPaymentLegs: number;
}

interface ReconciliationData {
  rows: ReconciliationRow[];
  summary: { matchedCount: number; matchedTotal: number; pendingCount: number; pendingTotal: number };
}

export function PaymentReconciliationScreen() {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/payments/reconciliation');
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Failed to load reconciliation');
          return;
        }
        setData(json);
      } catch {
        setError('Could not reach the server');
      }
    })();
  }, []);

  if (error) return <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="space-y-2 pt-6">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-6">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Matched (fully paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">₹{data.summary.matchedTotal.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{data.summary.matchedCount} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">₹{data.summary.pendingTotal.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{data.summary.pendingCount} invoices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {data.rows.map((r) => (
            <div key={r.invoiceNumber} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
              <span>
                {r.invoiceNumber} <Badge variant={r.matched ? 'default' : 'destructive'}>{r.status}</Badge>
              </span>
              <span className="text-muted-foreground">
                Paid ₹{r.paid.toFixed(2)} / ₹{r.total.toFixed(2)}
                {r.remaining > 0 && ` · ₹${r.remaining.toFixed(2)} remaining`}
                {r.pendingPaymentLegs > 0 && ` · ${r.pendingPaymentLegs} pending leg(s)`}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
