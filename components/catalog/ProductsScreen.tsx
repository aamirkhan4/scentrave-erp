'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { ActionStatus } from '@/components/ui/action-status';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';
import { Search, X } from 'lucide-react';

interface Subcategory {
  id: string;
  name: string;
  category: { name: string };
}
interface Category {
  id: string;
  name: string;
  subcategories: Subcategory[];
}
interface RawMaterial {
  id: string;
  name: string;
  unit: string;
}
interface Variant {
  id: string;
  sku: string;
  sizeLabel: string;
  sizeMl: string;
  sellingPrice: string;
  isTester: boolean;
  isActive: boolean;
}
interface FormulaLine {
  rawMaterialId: string;
  quantityPerMl: string;
  rawMaterial: { name: string; unit: string };
}
interface Product {
  id: string;
  name: string;
  type: 'PERFUME' | 'OIL';
  isActive: boolean;
  subcategory: { name: string; category: { name: string } };
  variants: Variant[];
  formulas: Array<{ id: string; version: number; lines: FormulaLine[] }>;
}

// The only sizes the business actually sells in, split by product type since
// perfumes and oils/attars use different real bottle sizes. A locked list
// instead of freeform text so staff can't create near-duplicate labels
// ("50ml" vs "50 ML" vs "50ml bottle") that would fragment the size
// filters and reporting.
const PERFUME_SIZE_PRESETS = [
  { label: '3ml Tester', sizeMl: 3, isTester: true },
  { label: '10ml Tester', sizeMl: 10, isTester: true },
  { label: '25ml', sizeMl: 25, isTester: false },
  { label: '50ml', sizeMl: 50, isTester: false },
] as const;

const OIL_SIZE_PRESETS = [
  { label: '2ml', sizeMl: 2, isTester: false },
  { label: '3ml', sizeMl: 3, isTester: false },
  { label: '6ml', sizeMl: 6, isTester: false },
] as const;

function sizePresetsFor(type: 'PERFUME' | 'OIL') {
  return type === 'OIL' ? OIL_SIZE_PRESETS : PERFUME_SIZE_PRESETS;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function ProductCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-56" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

export function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [sizeOptions, setSizeOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initialSearch = useSearchParams().get('search') ?? '';
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounced(search, 300);
  const [sizeFilter, setSizeFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newProduct, setNewProduct] = useState({ name: '', type: 'PERFUME' as 'PERFUME' | 'OIL', subcategoryId: '' });
  const [variantForms, setVariantForms] = useState<Record<string, { sizeMl: string; sizeLabel: string; sku: string; sellingPrice: string; isTester: boolean }>>({});
  const [formulaForms, setFormulaForms] = useState<Record<string, Array<{ rawMaterialId: string; quantityPerMl: string }>>>({});
  const [savingVariantFor, setSavingVariantFor] = useState<string | null>(null);
  const [savedVariantFor, setSavedVariantFor] = useState<string | null>(null);
  const [savingFormulaFor, setSavingFormulaFor] = useState<string | null>(null);
  const [savedFormulaFor, setSavedFormulaFor] = useState<string | null>(null);

  async function loadStatic() {
    const [categoriesRes, rawMaterialsRes] = await Promise.all([fetch('/api/categories'), fetch('/api/raw-materials')]);
    const categoriesData = await categoriesRes.json();
    const rawMaterialsData = await rawMaterialsRes.json();
    setSubcategories((categoriesData.categories as Category[]).flatMap((c) => c.subcategories.map((s) => ({ ...s, category: { name: c.name } }))));
    setRawMaterials(rawMaterialsData.rawMaterials ?? []);
  }

  async function loadProducts() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sizeFilter) params.set('sizeLabel', sizeFilter);
    if (subcategoryFilter) params.set('subcategoryId', subcategoryFilter);

    const res = await fetch(`/api/products/admin?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Failed to load products');
      return;
    }
    setProducts(data.products);
    setTotalPages(data.totalPages);
    setTotal(data.total);
    setSizeOptions(data.sizeOptions ?? []);

    // Arrived via a deep link (e.g. "add formula" from the Formulas screen)
    // — expand the matching product automatically instead of making the
    // owner search then click it again.
    if (initialSearch) {
      setExpanded((prev) => {
        const next = { ...prev };
        for (const p of data.products as Array<{ id: string }>) next[p.id] = true;
        return next;
      });
    }
  }

  useEffect(() => {
    loadStatic();
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, sizeFilter, subcategoryFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sizeFilter, subcategoryFilter, pageSize]);

  async function addProduct() {
    if (!newProduct.name.trim() || !newProduct.subcategoryId) return false;
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    });
    const data = await res.json();
    if (res.ok) {
      setNewProduct({ name: '', type: 'PERFUME', subcategoryId: '' });
      await loadProducts();
      return true;
    }
    setError(data.error);
    return false;
  }
  const addProductAction = useAsyncAction(addProduct);

  async function deleteProduct(productId: string, name: string) {
    if (!confirm(`Delete "${name}"? This hides it from the catalog and POS everywhere. Sale/production history is kept.`)) return;
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadProducts();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  async function deleteVariant(productId: string, variantId: string, label: string) {
    if (!confirm(`Delete the ${label} size? This hides it from the catalog and POS. Sale/production history is kept.`)) return;
    const res = await fetch(`/api/products/${productId}/variants/${variantId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadProducts();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  function variantFormFor(productId: string) {
    return variantForms[productId] ?? { sizeMl: '', sizeLabel: '', sku: '', sellingPrice: '', isTester: false };
  }

  async function addVariant(productId: string) {
    const form = variantFormFor(productId);
    if (!form.sizeMl || !form.sizeLabel || !form.sku || !form.sellingPrice) return;
    setSavingVariantFor(productId);
    try {
      const res = await fetch(`/api/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sizeMl: Number(form.sizeMl),
          sizeLabel: form.sizeLabel,
          sku: form.sku,
          sellingPrice: Number(form.sellingPrice),
          isTester: form.isTester,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setVariantForms((prev) => ({ ...prev, [productId]: { sizeMl: '', sizeLabel: '', sku: '', sellingPrice: '', isTester: false } }));
        await loadProducts();
        setSavedVariantFor(productId);
        setTimeout(() => setSavedVariantFor((cur) => (cur === productId ? null : cur)), 1000);
      } else {
        setError(data.error);
      }
    } finally {
      setSavingVariantFor(null);
    }
  }

  function formulaLinesFor(product: Product) {
    return formulaForms[product.id] ?? product.formulas[0]?.lines.map((l) => ({ rawMaterialId: l.rawMaterialId, quantityPerMl: l.quantityPerMl })) ?? [];
  }

  function addFormulaLine(productId: string) {
    setFormulaForms((prev) => ({
      ...prev,
      [productId]: [...(prev[productId] ?? []), { rawMaterialId: rawMaterials[0]?.id ?? '', quantityPerMl: '' }],
    }));
  }

  function updateFormulaLine(productId: string, index: number, patch: Partial<{ rawMaterialId: string; quantityPerMl: string }>) {
    setFormulaForms((prev) => {
      const lines = [...(prev[productId] ?? [])];
      lines[index] = { ...lines[index], ...patch };
      return { ...prev, [productId]: lines };
    });
  }

  async function saveFormula(productId: string) {
    const lines = (formulaForms[productId] ?? []).filter((l) => l.rawMaterialId && l.quantityPerMl);
    if (lines.length === 0) return;
    setSavingFormulaFor(productId);
    try {
      const res = await fetch(`/api/products/${productId}/formula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: lines.map((l) => ({ rawMaterialId: l.rawMaterialId, quantityPerMl: Number(l.quantityPerMl) })) }),
      });
      const data = await res.json();
      if (res.ok) {
        setFormulaForms((prev) => {
          const { [productId]: _drop, ...rest } = prev;
          return rest;
        });
        await loadProducts();
        setSavedFormulaFor(productId);
        setTimeout(() => setSavedFormulaFor((cur) => (cur === productId ? null : cur)), 1000);
      } else {
        setError(data.error);
      }
    } finally {
      setSavingFormulaFor(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>New product</CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Name</label>
            <Input value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Category</label>
            <select
              className="block h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={newProduct.subcategoryId}
              onChange={(e) => setNewProduct((p) => ({ ...p, subcategoryId: e.target.value }))}
            >
              <option value="">Select…</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category.name} → {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Type</label>
            <select
              className="block h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={newProduct.type}
              onChange={(e) => setNewProduct((p) => ({ ...p, type: e.target.value as 'PERFUME' | 'OIL' }))}
            >
              <option value="PERFUME">Perfume</option>
              <option value="OIL">Oil</option>
            </select>
          </div>
          <Button onClick={addProductAction.run} disabled={addProductAction.loading} className="gap-2">
            <ActionStatus loading={addProductAction.loading} success={addProductAction.success} />
            {addProductAction.loading ? 'Adding…' : 'Add product'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 pt-4">
          <div className="min-w-64 flex-1">
            <label className="text-xs text-muted-foreground">Search by name or SKU</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-8 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Size</label>
            <select
              className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
            >
              <option value="">All sizes</option>
              {sizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={subcategoryFilter}
              onChange={(e) => setSubcategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category.name} → {s.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {!loading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No products match these filters.</p>
      ) : (
        products.map((product) => {
          const isOpen = expanded[product.id] ?? false;
          return (
            <Card key={product.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <button
                  type="button"
                  className="flex flex-1 flex-col items-start gap-1 text-left"
                  onClick={() => setExpanded((p) => ({ ...p, [product.id]: !isOpen }))}
                >
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span className="text-muted-foreground">{isOpen ? '▾' : '▸'}</span>
                    {product.name} <Badge variant="outline">{product.type}</Badge>
                  </CardTitle>
                  <span className="pl-4 text-sm text-muted-foreground">
                    {product.subcategory.category.name} → {product.subcategory.name}
                  </span>
                  <span className="flex flex-wrap gap-1 pl-4">
                    {product.variants.map((v) => (
                      <Badge key={v.id} variant="secondary" className="text-[10px]">
                        {v.sizeLabel}
                      </Badge>
                    ))}
                  </span>
                </button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteProduct(product.id, product.name)}>
                  Delete
                </Button>
              </CardHeader>
              {isOpen && (
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    {product.variants.map((v) => (
                      <div key={v.id} className="flex items-center justify-between border-b border-border py-1 text-sm last:border-0">
                        <span>
                          {v.sizeLabel} — {v.sku} {v.isTester && <Badge variant="secondary">Tester</Badge>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">₹{v.sellingPrice}</span>
                          <button
                            type="button"
                            className="text-xs text-destructive hover:underline"
                            onClick={() => deleteVariant(product.id, v.id, v.sizeLabel)}
                          >
                            Delete
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Size</label>
                      <select
                        className="block h-9 w-32 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={variantFormFor(product.id).sizeLabel}
                        onChange={(e) => {
                          const preset = sizePresetsFor(product.type).find((s) => s.label === e.target.value);
                          if (!preset) return;
                          setVariantForms((p) => ({
                            ...p,
                            [product.id]: { ...variantFormFor(product.id), sizeLabel: preset.label, sizeMl: String(preset.sizeMl), isTester: preset.isTester },
                          }));
                        }}
                      >
                        <option value="">Select…</option>
                        {sizePresetsFor(product.type).map((s) => (
                          <option key={s.label} value={s.label}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">SKU</label>
                      <Input
                        className="w-28"
                        value={variantFormFor(product.id).sku}
                        onChange={(e) => setVariantForms((p) => ({ ...p, [product.id]: { ...variantFormFor(product.id), sku: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Price ₹</label>
                      <Input
                        className="w-24"
                        value={variantFormFor(product.id).sellingPrice}
                        onChange={(e) => setVariantForms((p) => ({ ...p, [product.id]: { ...variantFormFor(product.id), sellingPrice: e.target.value } }))}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addVariant(product.id)} disabled={savingVariantFor === product.id} className="gap-2">
                      <ActionStatus loading={savingVariantFor === product.id} success={savedVariantFor === product.id} />
                      Add variant
                    </Button>
                  </div>

                  {product.type === 'PERFUME' && (
                    <div className="rounded-md border border-border p-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Formula {product.formulas[0] ? `(v${product.formulas[0].version})` : '(none yet)'}
                      </p>
                      {formulaLinesFor(product).map((line, i) => (
                        <div key={i} className="mb-1 flex items-center gap-2">
                          <select
                            className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
                            value={line.rawMaterialId}
                            onChange={(e) => updateFormulaLine(product.id, i, { rawMaterialId: e.target.value })}
                          >
                            {rawMaterials.map((rm) => (
                              <option key={rm.id} value={rm.id}>
                                {rm.name} ({rm.unit})
                              </option>
                            ))}
                          </select>
                          <Input
                            className="w-28"
                            placeholder="qty per ml"
                            value={line.quantityPerMl}
                            onChange={(e) => updateFormulaLine(product.id, i, { quantityPerMl: e.target.value })}
                          />
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => addFormulaLine(product.id)}>
                          + Line
                        </Button>
                        <Button size="sm" onClick={() => saveFormula(product.id)} disabled={savingFormulaFor === product.id} className="gap-2">
                          <ActionStatus loading={savingFormulaFor === product.id} success={savedFormulaFor === product.id} />
                          Save formula (new version)
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {!loading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}
    </div>
  );
}
