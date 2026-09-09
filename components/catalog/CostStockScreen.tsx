'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ActionStatus } from '@/components/ui/action-status';
import { Pagination } from '@/components/ui/pagination';
import { Search, X, Check } from 'lucide-react';

interface RawMaterialRow {
  id: string;
  name: string;
  unit: string;
  category: string;
  costPerUnit: string;
  lowStockThreshold: string;
  stockLevel: { quantityOnHand: string } | null;
}

interface VariantRow {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  sizeLabel: string;
  costPrice: number | null;
  sellingPrice: number;
  stockOnHand: number;
  lowStockThreshold: number;
}

/** Inline "type a number, hit Enter or blur to save" cell — used for both cost and stock-adjust, so editing feels the same everywhere on this screen. */
function EditableNumber({
  value,
  onSave,
  width = 'w-24',
  prefix,
}: {
  value: number;
  onSave: (next: number) => Promise<void>;
  width?: string;
  prefix?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = Number(draft) !== value && draft.trim() !== '';

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  async function commit() {
    if (!dirty || Number.isNaN(Number(draft))) return;
    setSaving(true);
    try {
      await onSave(Number(draft));
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-muted-foreground">{prefix}</span>}
      <Input
        type="number"
        className={`h-8 text-right ${width}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      {saving && <Spinner className="h-3.5 w-3.5" />}
      {!saving && saved && <Check className="h-3.5 w-3.5 text-green-600" />}
    </div>
  );
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative max-w-sm flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8 pr-8" />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function CostStockScreen() {
  const [tab, setTab] = useState<'RAW' | 'PRODUCT'>('RAW');

  // Raw materials
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRow[]>([]);
  const [rawLoading, setRawLoading] = useState(true);
  const [rawSearch, setRawSearch] = useState('');
  const [rawPage, setRawPage] = useState(1);
  const [rawPageSize, setRawPageSize] = useState(25);

  // Product variants
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(true);
  const [variantSearch, setVariantSearch] = useState('');
  const debouncedVariantSearch = useDebounced(variantSearch, 250);
  const [variantPage, setVariantPage] = useState(1);
  const [variantPageSize, setVariantPageSize] = useState(24);

  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importingRaw, setImportingRaw] = useState(false);
  const [importedRaw, setImportedRaw] = useState(false);
  const [importingVariants, setImportingVariants] = useState(false);
  const [importedVariants, setImportedVariants] = useState(false);
  const rawFileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);

  async function loadRawMaterials() {
    setRawLoading(true);
    try {
      const res = await fetch('/api/raw-materials');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load raw materials');
        return;
      }
      setRawMaterials(data.rawMaterials);
    } finally {
      setRawLoading(false);
    }
  }

  async function loadVariants() {
    setVariantsLoading(true);
    try {
      const res = await fetch('/api/cost-stock/variants');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load products');
        return;
      }
      setVariants(data.variants);
    } finally {
      setVariantsLoading(false);
    }
  }

  useEffect(() => {
    loadRawMaterials();
    loadVariants();
  }, []);

  async function importRawMaterialsCsv(file: File) {
    setImportingRaw(true);
    setImportMessage(null);
    setError(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/raw-materials/csv', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Import failed');
        return;
      }
      setRawMaterials(data.rawMaterials);
      setImportMessage(
        `Imported: ${data.created} added, ${data.updated} updated${data.errors.length ? `, ${data.errors.length} row(s) skipped — ${data.errors[0]}` : ''}`,
      );
      setImportedRaw(true);
      setTimeout(() => setImportedRaw(false), 1000);
    } finally {
      setImportingRaw(false);
    }
  }

  async function importVariantsCsv(file: File) {
    setImportingVariants(true);
    setImportMessage(null);
    setError(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/cost-stock/variants/csv', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Import failed');
        return;
      }
      setVariants(data.variants);
      setImportMessage(`Imported: ${data.updated} updated${data.errors.length ? `, ${data.errors.length} row(s) skipped — ${data.errors[0]}` : ''}`);
      setImportedVariants(true);
      setTimeout(() => setImportedVariants(false), 1000);
    } finally {
      setImportingVariants(false);
    }
  }

  const filteredRaw = useMemo(() => {
    if (!rawSearch.trim()) return rawMaterials;
    const q = rawSearch.trim().toLowerCase();
    return rawMaterials.filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }, [rawMaterials, rawSearch]);
  const rawTotalPages = Math.max(1, Math.ceil(filteredRaw.length / rawPageSize));
  const visibleRaw = filteredRaw.slice((rawPage - 1) * rawPageSize, rawPage * rawPageSize);

  useEffect(() => {
    setRawPage(1);
  }, [rawSearch, rawPageSize]);

  const filteredVariants = useMemo(() => {
    if (!debouncedVariantSearch.trim()) return variants;
    const q = debouncedVariantSearch.trim().toLowerCase();
    return variants.filter((v) => v.productName.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q));
  }, [variants, debouncedVariantSearch]);

  // Sizes are variants of one product, never separate products — group them
  // under a single product header instead of one flat row per SKU, so the
  // screen can't be misread as three different items.
  const productGroups = useMemo(() => {
    const groups = new Map<string, { productId: string; productName: string; variants: VariantRow[] }>();
    for (const v of filteredVariants) {
      if (!groups.has(v.productId)) groups.set(v.productId, { productId: v.productId, productName: v.productName, variants: [] });
      groups.get(v.productId)!.variants.push(v);
    }
    return Array.from(groups.values());
  }, [filteredVariants]);

  const variantTotalPages = Math.max(1, Math.ceil(productGroups.length / variantPageSize));
  const visibleGroups = productGroups.slice((variantPage - 1) * variantPageSize, variantPage * variantPageSize);

  useEffect(() => {
    setVariantPage(1);
  }, [debouncedVariantSearch, variantPageSize]);

  async function saveRawCost(id: string, costPerUnit: number) {
    const res = await fetch(`/api/raw-materials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costPerUnit }),
    });
    if (res.ok) setRawMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, costPerUnit: String(costPerUnit) } : m)));
    else setError((await res.json()).error);
  }

  async function saveRawStock(id: string, actualQuantityOnHand: number) {
    const res = await fetch('/api/inventory/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawMaterialId: id, actualQuantityOnHand }),
    });
    if (res.ok) setRawMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, stockLevel: { quantityOnHand: String(actualQuantityOnHand) } } : m)));
    else setError((await res.json()).error);
  }

  async function saveVariantCost(productId: string, variantId: string, costPrice: number) {
    const res = await fetch(`/api/products/${productId}/variants/${variantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costPrice }),
    });
    if (res.ok) setVariants((prev) => prev.map((v) => (v.id === variantId ? { ...v, costPrice } : v)));
    else setError((await res.json()).error);
  }

  async function saveVariantStock(id: string, actualQuantityOnHand: number) {
    const res = await fetch('/api/inventory/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productVariantId: id, actualQuantityOnHand }),
    });
    if (res.ok) setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, stockOnHand: actualQuantityOnHand } : v)));
    else setError((await res.json()).error);
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {importMessage && <p className="rounded-md bg-accent p-3 text-sm">{importMessage}</p>}

      <div className="flex gap-1">
        <Button size="sm" variant={tab === 'RAW' ? 'default' : 'outline'} onClick={() => setTab('RAW')}>
          Raw Materials
        </Button>
        <Button size="sm" variant={tab === 'PRODUCT' ? 'default' : 'outline'} onClick={() => setTab('PRODUCT')}>
          Products
        </Button>
      </div>

      {tab === 'RAW' ? (
        <Card>
          <CardHeader>
            <CardTitle>Raw material cost &amp; stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open('/api/raw-materials/csv', '_blank')}>
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => rawFileInputRef.current?.click()} disabled={importingRaw} className="gap-2">
                <ActionStatus loading={importingRaw} success={importedRaw} />
                {importingRaw ? 'Importing…' : 'Import CSV'}
              </Button>
              <input
                ref={rawFileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importRawMaterialsCsv(file);
                  e.target.value = '';
                }}
              />
            </div>
            <SearchBox value={rawSearch} onChange={setRawSearch} placeholder="Search raw materials…" />
            <Pagination page={rawPage} totalPages={rawTotalPages} total={filteredRaw.length} pageSize={rawPageSize} onPageChange={setRawPage} onPageSizeChange={setRawPageSize} />
            {rawLoading ? (
              <div className="space-y-2 py-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : visibleRaw.length === 0 ? (
              <p className="text-sm text-muted-foreground">No raw materials match.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1 pr-2">Name</th>
                      <th className="py-1 pr-2">Category</th>
                      <th className="py-1 pr-2 text-right">Cost / unit</th>
                      <th className="py-1 pr-2 text-right">Stock on hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRaw.map((m) => {
                      const qty = m.stockLevel ? Number(m.stockLevel.quantityOnHand) : 0;
                      const low = qty <= Number(m.lowStockThreshold);
                      return (
                        <tr key={m.id} className="border-b border-border last:border-0">
                          <td className="py-1.5 pr-2 font-medium">{m.name}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">
                            {m.category} <span className="text-xs">({m.unit})</span>
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            <EditableNumber value={Number(m.costPerUnit)} onSave={(v) => saveRawCost(m.id, v)} prefix="₹" />
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {low && <Badge variant="destructive">Low</Badge>}
                              <EditableNumber value={qty} onSave={(v) => saveRawStock(m.id, v)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Product cost &amp; stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open('/api/cost-stock/variants/csv', '_blank')}>
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => variantFileInputRef.current?.click()} disabled={importingVariants} className="gap-2">
                <ActionStatus loading={importingVariants} success={importedVariants} />
                {importingVariants ? 'Importing…' : 'Import CSV'}
              </Button>
              <input
                ref={variantFileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importVariantsCsv(file);
                  e.target.value = '';
                }}
              />
            </div>
            <SearchBox value={variantSearch} onChange={setVariantSearch} placeholder="Search by product or SKU…" />
            <Pagination
              page={variantPage}
              totalPages={variantTotalPages}
              total={productGroups.length}
              pageSize={variantPageSize}
              pageSizeOptions={[12, 24, 48, 96]}
              onPageChange={setVariantPage}
              onPageSizeChange={setVariantPageSize}
            />
            {variantsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : visibleGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products match.</p>
            ) : (
              <div className="space-y-4">
                {visibleGroups.map((group) => (
                  <div key={group.productId} className="rounded-md border border-border p-3">
                    <p className="mb-2 font-medium">{group.productName}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="py-1 pr-2">Size</th>
                            <th className="py-1 pr-2">SKU</th>
                            <th className="py-1 pr-2 text-right">Cost price</th>
                            <th className="py-1 pr-2 text-right">Selling price</th>
                            <th className="py-1 pr-2 text-right">Stock on hand</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.variants.map((v) => {
                            const low = v.stockOnHand <= v.lowStockThreshold;
                            return (
                              <tr key={v.id} className="border-b border-border last:border-0">
                                <td className="py-1.5 pr-2 font-medium">{v.sizeLabel}</td>
                                <td className="py-1.5 pr-2 text-muted-foreground">{v.sku}</td>
                                <td className="py-1.5 pr-2 text-right">
                                  <EditableNumber value={v.costPrice ?? 0} onSave={(val) => saveVariantCost(v.productId, v.id, val)} prefix="₹" />
                                </td>
                                <td className="py-1.5 pr-2 text-right text-muted-foreground">₹{v.sellingPrice.toFixed(2)}</td>
                                <td className="py-1.5 pr-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {low && <Badge variant="destructive">Low</Badge>}
                                    <EditableNumber value={v.stockOnHand} onSave={(val) => saveVariantStock(v.id, val)} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
