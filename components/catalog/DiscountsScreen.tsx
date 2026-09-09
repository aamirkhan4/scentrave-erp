'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionStatus } from '@/components/ui/action-status';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';

interface Discount {
  id: string;
  name: string;
  code: string | null;
  type: 'FLAT' | 'PERCENTAGE' | 'BUY_X_GET_Y';
  scope: 'ORDER' | 'CATEGORY' | 'PRODUCT';
  value: string | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  usageCount: number;
  usageLimit: number | null;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
}

export function DiscountsScreen() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'PERCENTAGE' as 'FLAT' | 'PERCENTAGE' | 'BUY_X_GET_Y',
    scope: 'CATEGORY' as 'ORDER' | 'CATEGORY' | 'PRODUCT',
    value: '',
    buyQuantity: '',
    getQuantity: '',
    categoryId: '',
    productId: '',
  });

  async function load() {
    setLoading(true);
    try {
      const [discountsRes, categoriesRes, productsRes] = await Promise.all([
        fetch('/api/discounts'),
        fetch('/api/categories'),
        fetch('/api/products/picker'),
      ]);
      const discountsData = await discountsRes.json();
      const categoriesData = await categoriesRes.json();
      const productsData = await productsRes.json();
      if (!discountsRes.ok) {
        setError(discountsData.error ?? 'Failed to load discounts');
        return;
      }
      setDiscounts(discountsData.discounts);
      setCategories(categoriesData.categories ?? []);
      setProducts(productsData.products ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteDiscount(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/discounts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await load();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  async function addDiscount() {
    setError(null);
    const res = await fetch('/api/discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        code: form.code || undefined,
        type: form.type,
        scope: form.type === 'BUY_X_GET_Y' ? form.scope : 'ORDER',
        value: form.type !== 'BUY_X_GET_Y' ? Number(form.value) : undefined,
        buyQuantity: form.type === 'BUY_X_GET_Y' ? Number(form.buyQuantity) : undefined,
        getQuantity: form.type === 'BUY_X_GET_Y' ? Number(form.getQuantity) : undefined,
        categoryId: form.type === 'BUY_X_GET_Y' && form.scope === 'CATEGORY' ? form.categoryId : undefined,
        productId: form.type === 'BUY_X_GET_Y' && form.scope === 'PRODUCT' ? form.productId : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setForm({ name: '', code: '', type: 'PERCENTAGE', scope: 'CATEGORY', value: '', buyQuantity: '', getQuantity: '', categoryId: '', productId: '' });
      await load();
      return true;
    }
    setError(data.error ?? 'Failed to create discount');
    return false;
  }
  const addDiscountAction = useAsyncAction(addDiscount);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>New discount</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Coupon code (optional)</label>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof f.type }))}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FLAT">Flat ₹</option>
              <option value="BUY_X_GET_Y">Buy X Get Y</option>
            </select>
          </div>

          {form.type !== 'BUY_X_GET_Y' ? (
            <div>
              <label className="text-xs text-muted-foreground">{form.type === 'PERCENTAGE' ? 'Percent' : 'Amount ₹'}</label>
              <Input className="w-24" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Scope</label>
                <select
                  className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={form.scope}
                  onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as typeof f.scope }))}
                >
                  <option value="CATEGORY">Category</option>
                  <option value="PRODUCT">Product</option>
                </select>
              </div>
              {form.scope === 'CATEGORY' ? (
                <div>
                  <label className="text-xs text-muted-foreground">Category</label>
                  <select
                    className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground">Product</label>
                  <select
                    className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={form.productId}
                    onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Buy qty</label>
                <Input className="w-16" value={form.buyQuantity} onChange={(e) => setForm((f) => ({ ...f, buyQuantity: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Get qty free</label>
                <Input className="w-16" value={form.getQuantity} onChange={(e) => setForm((f) => ({ ...f, getQuantity: e.target.value }))} />
              </div>
            </>
          )}
          <Button onClick={addDiscountAction.run} disabled={addDiscountAction.loading} className="gap-2">
            <ActionStatus loading={addDiscountAction.loading} success={addDiscountAction.success} />
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {loading ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : discounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No discounts yet.</p>
          ) : (
            discounts.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
                <span>
                  {d.name} {d.code && <Badge variant="secondary">{d.code}</Badge>} <Badge variant="outline">{d.type}</Badge>
                  {!d.isActive && <Badge variant="secondary">Inactive</Badge>}
                </span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <span>
                    {d.type === 'BUY_X_GET_Y' ? `Buy ${d.buyQuantity} get ${d.getQuantity}` : d.type === 'PERCENTAGE' ? `${d.value}%` : `₹${d.value}`} · used{' '}
                    {d.usageCount}
                    {d.usageLimit ? `/${d.usageLimit}` : ''}
                  </span>
                  <button type="button" className="text-xs text-destructive hover:underline" onClick={() => deleteDiscount(d.id, d.name)}>
                    Delete
                  </button>
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
