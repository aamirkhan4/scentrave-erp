'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { Search, X } from 'lucide-react';

interface StockRow {
  stockableType: 'RAW_MATERIAL' | 'PRODUCT_VARIANT' | 'BULK_LIQUID';
  id: string;
  name: string;
  quantityOnHand: number;
  threshold: number;
  isLow: boolean;
}

interface Movement {
  id: string;
  quantityDelta: string;
  reason: string;
  createdAt: string;
  actor: { name: string };
  rawMaterial: { name: string; unit: string } | null;
  productVariant: { sku: string; sizeLabel: string; product: { name: string } } | null;
  product: { name: string } | null;
  batch: { batchNumber: string } | null;
  mixBatch: { mixNumber: string } | null;
  order: { orderNumber: string } | null;
}

export function InventoryScreen() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState<StockRow | null>(null);
  const [countedValue, setCountedValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [reasonFilter, setReasonFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [stockSearch, setStockSearch] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [stockPageSize, setStockPageSize] = useState(50);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load inventory');
        return;
      }
      setRows(data.stock);
    } finally {
      setLoading(false);
    }
  }

  async function loadMovements(reason = reasonFilter) {
    setMovementsLoading(true);
    try {
      const res = await fetch(`/api/stock/movements${reason ? `?reason=${reason}` : ''}`);
      const data = await res.json();
      if (res.ok) setMovements(data.movements);
    } finally {
      setMovementsLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (showLowOnly) result = result.filter((r) => r.isLow);
    if (stockSearch.trim()) {
      const q = stockSearch.trim().toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }
    return result;
  }, [rows, stockSearch, showLowOnly]);
  const stockTotalPages = Math.max(1, Math.ceil(filteredRows.length / stockPageSize));
  const visibleRows = filteredRows.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize);

  useEffect(() => {
    setStockPage(1);
  }, [stockSearch, showLowOnly, stockPageSize]);

  async function submitReconciliation() {
    if (!reconciling) return;
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [reconciling.stockableType === 'RAW_MATERIAL' ? 'rawMaterialId' : reconciling.stockableType === 'BULK_LIQUID' ? 'productId' : 'productVariantId']: reconciling.id,
          actualQuantityOnHand: Number(countedValue),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Reconciliation failed');
        return;
      }
      setReconciling(null);
      setCountedValue('');
      await load();
      await loadMovements();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Stock levels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!loading && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <div className="relative max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search…" value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} className="pl-8 pr-8" />
                {stockSearch && (
                  <button
                    type="button"
                    onClick={() => setStockSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button size="sm" variant={showLowOnly ? 'default' : 'outline'} onClick={() => setShowLowOnly((v) => !v)}>
                Low stock only
              </Button>
            </div>
          )}
          {loading ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock records match.</p>
          ) : (
            visibleRows.map((row) => (
            <div key={`${row.stockableType}-${row.id}`} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.stockableType === 'RAW_MATERIAL' ? 'Raw material' : row.stockableType === 'BULK_LIQUID' ? 'Bulk liquid, unbottled' : 'Finished SKU'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {row.isLow && <Badge variant="destructive">Low</Badge>}
                <span className="w-24 text-right">
                  {row.quantityOnHand} / {row.threshold}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReconciling(row);
                    setCountedValue(String(row.quantityOnHand));
                  }}
                >
                  Reconcile
                </Button>
              </div>
            </div>
            ))
          )}
          {!loading && (
            <Pagination
              page={stockPage}
              totalPages={stockTotalPages}
              total={filteredRows.length}
              pageSize={stockPageSize}
              pageSizeOptions={[25, 50, 100, 200]}
              onPageChange={setStockPage}
              onPageSizeChange={setStockPageSize}
            />
          )}
        </CardContent>
      </Card>

      {reconciling && (
        <Card>
          <CardHeader>
            <CardTitle>Reconcile: {reconciling.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Input type="number" value={countedValue} onChange={(e) => setCountedValue(e.target.value)} className="w-40" />
            <Button onClick={submitReconciliation} disabled={saving} className="gap-2">
              {saving && <Spinner />}
              {saving ? 'Saving…' : 'Save count'}
            </Button>
            <Button variant="ghost" onClick={() => setReconciling(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Movement history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              loadMovements(e.target.value);
            }}
          >
            <option value="">All reasons</option>
            <option value="PURCHASE">Purchase</option>
            <option value="MIX_IN">Mix in (bulk liquid)</option>
            <option value="PRODUCTION_CONSUME">Raw material consumed (mixing)</option>
            <option value="BOTTLING_CONSUME">Bulk liquid consumed (bottling)</option>
            <option value="PRODUCTION_IN">Bottled in</option>
            <option value="SALE">Sale</option>
            <option value="RETURN">Return</option>
            <option value="DAMAGE">Damage</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="OPENING_BALANCE">Opening balance</option>
          </select>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {movementsLoading ? (
              <div className="space-y-2 py-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No movements.</p>
            ) : (
              movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
                <span>
                  {m.rawMaterial
                    ? m.rawMaterial.name
                    : m.product
                      ? `${m.product.name} (bulk)`
                      : `${m.productVariant?.product.name} (${m.productVariant?.sizeLabel})`}
                  {' · '}
                  <Badge variant="outline">{m.reason}</Badge>
                </span>
                <span className="text-muted-foreground">
                  {Number(m.quantityDelta) > 0 ? '+' : ''}
                  {m.quantityDelta} · {m.actor.name}
                  {m.batch && ` · ${m.batch.batchNumber}`}
                  {m.mixBatch && ` · ${m.mixBatch.mixNumber}`}
                  {m.order && ` · ${m.order.orderNumber}`} · {new Date(m.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
