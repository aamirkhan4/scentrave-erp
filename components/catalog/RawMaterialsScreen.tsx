'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionStatus } from '@/components/ui/action-status';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  category: string;
  costPerUnit: string;
  lowStockThreshold: string;
  stockLevel: { quantityOnHand: string } | null;
}

export function RawMaterialsScreen() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMaterial, setNewMaterial] = useState({ name: '', unit: 'ml', category: '', costPerUnit: '', lowStockThreshold: '', openingStock: '' });
  const [purchaseAmounts, setPurchaseAmounts] = useState<Record<string, string>>({});
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchasedId, setPurchasedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/raw-materials');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load raw materials');
        return;
      }
      setMaterials(data.rawMaterials);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addMaterial() {
    if (!newMaterial.name.trim() || !newMaterial.category.trim() || !newMaterial.costPerUnit) return false;
    const res = await fetch('/api/raw-materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newMaterial.name,
        unit: newMaterial.unit,
        category: newMaterial.category,
        costPerUnit: Number(newMaterial.costPerUnit),
        lowStockThreshold: newMaterial.lowStockThreshold ? Number(newMaterial.lowStockThreshold) : undefined,
        openingStock: newMaterial.openingStock ? Number(newMaterial.openingStock) : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewMaterial({ name: '', unit: 'ml', category: '', costPerUnit: '', lowStockThreshold: '', openingStock: '' });
      await load();
      return true;
    }
    setError(data.error);
    return false;
  }
  const addMaterialAction = useAsyncAction(addMaterial);

  async function recordPurchase(id: string) {
    const qty = Number(purchaseAmounts[id]);
    if (!qty || qty <= 0) return;
    setPurchasingId(id);
    const res = await fetch(`/api/raw-materials/${id}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty }),
    });
    setPurchasingId(null);
    if (res.ok) {
      setPurchaseAmounts((prev) => ({ ...prev, [id]: '' }));
      setPurchasedId(id);
      setTimeout(() => setPurchasedId((cur) => (cur === id ? null : cur)), 1000);
      await load();
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>New raw material</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={newMaterial.name} onChange={(e) => setNewMaterial((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Unit</label>
            <Input className="w-20" value={newMaterial.unit} onChange={(e) => setNewMaterial((p) => ({ ...p, unit: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <Input placeholder="Solvent / Concentrate / Packaging" value={newMaterial.category} onChange={(e) => setNewMaterial((p) => ({ ...p, category: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Cost / unit (₹)</label>
            <Input className="w-24" value={newMaterial.costPerUnit} onChange={(e) => setNewMaterial((p) => ({ ...p, costPerUnit: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Low-stock threshold</label>
            <Input className="w-28" value={newMaterial.lowStockThreshold} onChange={(e) => setNewMaterial((p) => ({ ...p, lowStockThreshold: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Opening stock</label>
            <Input className="w-24" value={newMaterial.openingStock} onChange={(e) => setNewMaterial((p) => ({ ...p, openingStock: e.target.value }))} />
          </div>
          <Button onClick={addMaterialAction.run} disabled={addMaterialAction.loading} className="gap-2">
            <ActionStatus loading={addMaterialAction.loading} success={addMaterialAction.success} />
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No raw materials yet.</p>
          ) : (
          materials.map((m) => {
            const qty = m.stockLevel ? Number(m.stockLevel.quantityOnHand) : 0;
            const isLow = qty <= Number(m.lowStockThreshold);
            return (
              <div key={m.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
                <div>
                  <p className="font-medium">
                    {m.name} <Badge variant="outline">{m.category}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ₹{m.costPerUnit}/{m.unit} · threshold {m.lowStockThreshold}
                    {m.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isLow && <Badge variant="destructive">Low</Badge>}
                  <span>
                    {qty} {m.unit}
                  </span>
                  <Input
                    className="w-20"
                    placeholder="qty"
                    value={purchaseAmounts[m.id] ?? ''}
                    onChange={(e) => setPurchaseAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="outline" onClick={() => recordPurchase(m.id)} disabled={purchasingId === m.id} className="gap-2">
                    <ActionStatus loading={purchasingId === m.id} success={purchasedId === m.id} />
                    + Purchase
                  </Button>
                </div>
              </div>
            );
          })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
