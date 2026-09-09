'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  customer: { name: string } | null;
  guestName: string | null;
  invoice: { invoiceNumber: string; status: string } | null;
}

const STATUS_FILTERS = ['', 'CONFIRMED', 'PARTIALLY_RETURNED', 'RETURNED'] as const;

function statusBadgeVariant(status: string) {
  if (status === 'CONFIRMED') return 'default';
  if (status === 'RETURNED') return 'destructive';
  if (status === 'PARTIALLY_RETURNED') return 'secondary';
  return 'outline';
}

export function OrdersListScreen() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(status = statusFilter) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders${status ? `?status=${status}` : ''}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load orders');
        return;
      }
      setOrders(data.orders);
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex gap-1">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s || 'all'}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => {
              setStatusFilter(s);
              load(s);
            }}
          >
            {s || 'All'}
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {loading ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders.</p>
          ) : (
            orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0 hover:bg-accent"
            >
              <div>
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {o.customer?.name ?? o.guestName ?? 'Walk-in'} · {new Date(o.createdAt).toLocaleString('en-IN')}
                  {o.invoice && ` · ${o.invoice.invoiceNumber}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {o.invoice && (
                  <Badge variant={o.invoice.status === 'PAID' ? 'default' : o.invoice.status === 'VOID' ? 'outline' : 'secondary'}>
                    {o.invoice.status}
                  </Badge>
                )}
                <Badge variant={statusBadgeVariant(o.status)}>{o.status}</Badge>
                <span className="font-medium">₹{o.total}</span>
              </div>
            </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
