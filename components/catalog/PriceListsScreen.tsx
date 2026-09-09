'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { ActionStatus } from '@/components/ui/action-status';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';
import { Search, X } from 'lucide-react';

interface PriceList {
  id: string;
  name: string;
  isDefault: boolean;
  _count: { items: number; customers: number };
}

interface ItemRow {
  productVariantId: string;
  sku: string;
  productName: string;
  sizeLabel: string;
  defaultPrice: number;
  listPrice: number | null;
}

export function PriceListsScreen() {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemPage, setItemPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadLists() {
    const res = await fetch('/api/price-lists');
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Failed to load price lists');
      return;
    }
    setLists(data.priceLists);
    if (!selectedId && data.priceLists.length > 0) setSelectedId(data.priceLists[0].id);
  }

  async function loadItems(listId: string) {
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/price-lists/${listId}/items`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items);
        setEdited({});
        setItemSearch('');
        setItemPage(1);
      }
    } finally {
      setItemsLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = itemSearch.trim().toLowerCase();
    return items.filter((i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  }, [items, itemSearch]);
  const itemTotalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPageSize));
  const visibleItems = filteredItems.slice((itemPage - 1) * itemsPageSize, itemPage * itemsPageSize);

  useEffect(() => {
    setItemPage(1);
  }, [itemSearch, itemsPageSize]);

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadItems(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function addList() {
    if (!newListName.trim()) return false;
    const res = await fetch('/api/price-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName }),
    });
    if (res.ok) {
      setNewListName('');
      await loadLists();
      return true;
    }
    return false;
  }
  const addListAction = useAsyncAction(addList);

  async function saveChanges() {
    if (!selectedId) return false;
    const rows = Object.entries(edited)
      .filter(([, v]) => v.trim() !== '')
      .map(([productVariantId, v]) => ({ productVariantId, price: Number(v) }));
    if (rows.length === 0) return false;
    setSaving(true);
    try {
      const res = await fetch(`/api/price-lists/${selectedId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items);
        setEdited({});
        setSaved(true);
        setTimeout(() => setSaved(false), 1000);
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function importCsv(file: File) {
    if (!selectedId) return;
    const text = await file.text();
    const res = await fetch(`/api/price-lists/${selectedId}/items/csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: text,
    });
    const data = await res.json();
    if (res.ok) {
      setItems(data.items);
      setEdited({});
    } else {
      setError(data.error ?? 'CSV import failed');
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Lists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => (
              <Button key={l.id} variant={selectedId === l.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedId(l.id)}>
                {l.name} {l.isDefault && '(default)'} · {l._count.items} items
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="New list name (e.g. Wholesale)" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
            <Button variant="outline" onClick={addListAction.run} disabled={addListAction.loading} className="gap-2">
              <ActionStatus loading={addListAction.loading} success={addListAction.success} />
              Create list
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedId && (
        <Card>
          <CardHeader>
            <CardTitle>Prices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveChanges} disabled={saving || Object.keys(edited).length === 0} className="gap-2">
                <ActionStatus loading={saving} success={saved} />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button variant="outline" onClick={() => window.open(`/api/price-lists/${selectedId}/items/csv`, '_blank')}>
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Import CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importCsv(file);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by product or SKU…"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-8 pr-8"
              />
              {itemSearch && (
                <button
                  type="button"
                  onClick={() => setItemSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {itemsLoading ? (
              <div className="space-y-2 py-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-1 pr-2">SKU</th>
                        <th className="py-1 pr-2">Product</th>
                        <th className="py-1 pr-2">Size</th>
                        <th className="py-1 pr-2 text-right">Default</th>
                        <th className="py-1 pr-2 text-right">List price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => (
                        <tr key={item.productVariantId} className="border-b border-border last:border-0">
                          <td className="py-1 pr-2">{item.sku}</td>
                          <td className="py-1 pr-2">{item.productName}</td>
                          <td className="py-1 pr-2">{item.sizeLabel}</td>
                          <td className="py-1 pr-2 text-right text-muted-foreground">₹{item.defaultPrice.toFixed(2)}</td>
                          <td className="py-1 pr-2 text-right">
                            <Input
                              type="number"
                              className="ml-auto h-7 w-24 text-right"
                              value={edited[item.productVariantId] ?? String(item.listPrice ?? item.defaultPrice)}
                              onChange={(e) => setEdited((prev) => ({ ...prev, [item.productVariantId]: e.target.value }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {Object.keys(edited).length > 0 && (
                  <p className="text-sm text-muted-foreground">{Object.keys(edited).length} unsaved change{Object.keys(edited).length === 1 ? '' : 's'}</p>
                )}
                <Pagination
                  page={itemPage}
                  totalPages={itemTotalPages}
                  total={filteredItems.length}
                  pageSize={itemsPageSize}
                  pageSizeOptions={[25, 50, 100, 200]}
                  onPageChange={setItemPage}
                  onPageSizeChange={setItemsPageSize}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
