'use client';

import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { createSupabaseBrowserClient } from '@/lib/supabase/browserClient';

interface DashboardData {
  sales: { today: number; yesterday: number; week: number; lastWeek: number; month: number; lastMonth: number };
  topSelling: Array<{ sku: string; label: string; unitsSold: number; revenue: number }>;
  lowStockAlerts: Array<{ id: string; name: string; quantityOnHand: number; threshold: number }>;
  pendingPayments: { count: number; total: number };
  newCustomersToday: number;
  salesTrend: Array<{ date: string; total: number }>;
  categoryBreakdown: Array<{ name: string; value: number }>;
  sizeBreakdown: Array<{ name: string; value: number }>;
}

const PIE_COLORS = ['#8a6a4f', '#c9a877', '#e0c9a6', '#5f4632'];

function ChangeBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const positive = pct >= 0;
  return (
    <Badge variant={positive ? 'default' : 'destructive'} className="ml-2">
      {positive ? '+' : ''}
      {pct.toFixed(1)}%
    </Badge>
  );
}

export function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dashboard');
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? 'Failed to load dashboard');
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError('Could not reach the server');
      }
    }

    function scheduleReload() {
      // Debounced: a single checkout can fire several row changes (order +
      // several stock movements) in quick succession — coalesce into one refetch.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(load, 500);
    }

    load();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, scheduleReload)
      .subscribe();

    // Slow fallback poll in case the Realtime connection drops silently.
    const fallbackInterval = setInterval(load, 5 * 60_000);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  if (error) return <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 pt-6">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Today&apos;s sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">₹{data.sales.today.toFixed(0)}</p>
            <ChangeBadge current={data.sales.today} previous={data.sales.yesterday} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">This week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">₹{data.sales.week.toFixed(0)}</p>
            <ChangeBadge current={data.sales.week} previous={data.sales.lastWeek} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">This month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">₹{data.sales.month.toFixed(0)}</p>
            <ChangeBadge current={data.sales.month} previous={data.sales.lastMonth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">New customers today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.newCustomersToday}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales trend (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.salesTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#8a6a4f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by category (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.categoryBreakdown} dataKey="value" nameKey="name" outerRadius={80} label>
                  {data.categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue by size (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.sizeBreakdown}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8a6a4f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top-selling SKUs (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topSelling.length === 0 && <p className="text-sm text-muted-foreground">No sales yet.</p>}
            {data.topSelling.map((s) => (
              <div key={s.sku} className="flex items-center justify-between text-sm">
                <span>{s.label}</span>
                <span className="text-muted-foreground">
                  {s.unitsSold} units · ₹{s.revenue.toFixed(0)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low-stock alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.lowStockAlerts.length === 0 && <p className="text-sm text-muted-foreground">Nothing low right now.</p>}
            {data.lowStockAlerts.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.name}</span>
                <Badge variant="destructive">
                  {item.quantityOnHand} / {item.threshold}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">₹{data.pendingPayments.total.toFixed(0)}</p>
            <p className="text-sm text-muted-foreground">{data.pendingPayments.count} invoice(s) unpaid/partial</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
