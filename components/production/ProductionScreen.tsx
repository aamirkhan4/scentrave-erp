'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

interface ProductOption {
  id: string;
  name: string;
}

interface VariantResult {
  id: string;
  sku: string;
  sizeLabel: string;
  productName: string;
  productType: 'PERFUME' | 'OIL';
}

interface MixPreview {
  productId: string;
  productName: string;
  totalMlMixed: number;
  formulaId: string | null;
  consumption: Array<{
    rawMaterialId: string;
    rawMaterialName: string;
    unit: string;
    quantityConsumed: number;
    availableBeforeConsumption: number;
    sufficientStock: boolean;
  }>;
  canProceed: boolean;
}

interface BottlingPreview {
  productVariantId: string;
  productName: string;
  sizeLabel: string;
  quantityProduced: number;
  totalMlNeeded: number;
  hasFormula: boolean;
  bulkMlAvailable: number;
  canProceed: boolean;
}

interface MixRecord {
  id: string;
  mixNumber: string;
  totalMlMixed: string;
  mixDate: string;
  product: { name: string };
  createdBy: { name: string };
}

interface BatchRecord {
  id: string;
  batchNumber: string;
  quantityProduced: number;
  productionDate: string;
  productVariant: { sizeLabel: string; product: { name: string } };
  createdBy: { name: string };
}

export function ProductionScreen() {
  const [tab, setTab] = useState<'MIX' | 'BOTTLE'>('MIX');

  // ── Mix a batch ──────────────────────────────────────────────────────
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [totalMl, setTotalMl] = useState('1000');
  const [mixPreview, setMixPreview] = useState<MixPreview | null>(null);
  const [mixError, setMixError] = useState<string | null>(null);
  const [mixing, setMixing] = useState(false);
  const [mixes, setMixes] = useState<MixRecord[]>([]);

  // ── Bottle a batch ───────────────────────────────────────────────────
  const [variantQuery, setVariantQuery] = useState('');
  const [variantResults, setVariantResults] = useState<VariantResult[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<VariantResult | null>(null);
  const [bottleQuantity, setBottleQuantity] = useState('1');
  const [bottlePreview, setBottlePreview] = useState<BottlingPreview | null>(null);
  const [bottleError, setBottleError] = useState<string | null>(null);
  const [bottling, setBottling] = useState(false);
  const [batches, setBatches] = useState<BatchRecord[]>([]);

  async function loadProducts() {
    const res = await fetch('/api/products/picker');
    const data = await res.json();
    if (res.ok) setProducts(data.products);
  }

  async function loadMixes() {
    const res = await fetch('/api/mixes');
    const data = await res.json();
    if (res.ok) setMixes(data.mixes);
  }

  async function loadBatches() {
    const res = await fetch('/api/batches');
    const data = await res.json();
    if (res.ok) setBatches(data.batches);
  }

  useEffect(() => {
    loadProducts();
    loadMixes();
    loadBatches();
  }, []);

  const filteredProducts = productQuery.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 20)
    : [];

  async function runMixPreview() {
    if (!selectedProduct) return;
    setMixError(null);
    const res = await fetch('/api/mixes/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: selectedProduct.id, totalMlMixed: Number(totalMl) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMixError(data.error ?? 'Preview failed');
      setMixPreview(null);
      return;
    }
    setMixPreview(data.preview);
  }

  async function confirmMix() {
    if (!selectedProduct) return;
    setMixing(true);
    setMixError(null);
    try {
      const res = await fetch('/api/mixes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct.id, totalMlMixed: Number(totalMl) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMixError(data.error ?? 'Mix failed');
        return;
      }
      setMixPreview(null);
      setSelectedProduct(null);
      setProductQuery('');
      setTotalMl('1000');
      await loadMixes();
    } finally {
      setMixing(false);
    }
  }

  async function searchVariants(value: string) {
    setVariantQuery(value);
    setSelectedVariant(null);
    setBottlePreview(null);
    if (value.trim().length < 1) {
      setVariantResults([]);
      return;
    }
    const res = await fetch(`/api/products?query=${encodeURIComponent(value)}`);
    const data = await res.json();
    if (res.ok) {
      const flattened: VariantResult[] = (data.products ?? []).flatMap(
        (p: { id: string; name: string; type: 'PERFUME' | 'OIL'; variants: Array<{ id: string; sku: string; sizeLabel: string }> }) =>
          p.variants.map((v) => ({ id: v.id, sku: v.sku, sizeLabel: v.sizeLabel, productName: p.name, productType: p.type })),
      );
      setVariantResults(flattened);
    }
  }

  async function runBottlePreview() {
    if (!selectedVariant) return;
    setBottleError(null);
    const res = await fetch('/api/batches/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productVariantId: selectedVariant.id, quantityProduced: Number(bottleQuantity) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBottleError(data.error ?? 'Preview failed');
      setBottlePreview(null);
      return;
    }
    setBottlePreview(data.preview);
  }

  async function confirmBottle() {
    if (!selectedVariant) return;
    setBottling(true);
    setBottleError(null);
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productVariantId: selectedVariant.id, quantityProduced: Number(bottleQuantity) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBottleError(data.error ?? 'Bottling failed');
        return;
      }
      setBottlePreview(null);
      setSelectedVariant(null);
      setVariantQuery('');
      setBottleQuantity('1');
      await loadBatches();
    } finally {
      setBottling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        <Button size="sm" variant={tab === 'MIX' ? 'default' : 'outline'} onClick={() => setTab('MIX')}>
          Mix a batch
        </Button>
        <Button size="sm" variant={tab === 'BOTTLE' ? 'default' : 'outline'} onClick={() => setTab('BOTTLE')}>
          Bottle a batch
        </Button>
      </div>

      {tab === 'MIX' ? (
        <Card>
          <CardHeader>
            <CardTitle>Mix a batch</CardTitle>
            <p className="text-sm text-muted-foreground">
              Mixes raw materials per the perfume's formula into a bulk liquid pool, tracked in ml. One mix can later be bottled into any split of
              sizes — 10ml, 25ml, 50ml are just packaging of the same liquid.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedProduct ? (
              <>
                <Input placeholder="Search perfume by name…" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
                <div className="space-y-1">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className="block w-full rounded-md border border-border p-2 text-left text-sm hover:bg-accent"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <span>{selectedProduct.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>
                    Change
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Total ml to mix</label>
                    <Input type="number" min={1} value={totalMl} onChange={(e) => setTotalMl(e.target.value)} className="w-32" />
                  </div>
                  <Button variant="outline" onClick={runMixPreview}>
                    Preview consumption
                  </Button>
                </div>
              </>
            )}

            {mixError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{mixError}</p>}

            {mixPreview && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm">
                  Mixing <strong>{mixPreview.totalMlMixed}ml</strong> of {mixPreview.productName}
                </p>
                {mixPreview.consumption.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This perfume has no active formula yet — add one under Products → Formula before mixing.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1">Raw material</th>
                        <th className="py-1 text-right">Needed</th>
                        <th className="py-1 text-right">Available</th>
                        <th className="py-1 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mixPreview.consumption.map((c) => (
                        <tr key={c.rawMaterialId} className="border-t border-border">
                          <td className="py-1">{c.rawMaterialName}</td>
                          <td className="py-1 text-right">
                            {c.quantityConsumed.toFixed(2)} {c.unit}
                          </td>
                          <td className="py-1 text-right">
                            {c.availableBeforeConsumption.toFixed(2)} {c.unit}
                          </td>
                          <td className="py-1 text-right">
                            <Badge variant={c.sufficientStock ? 'default' : 'destructive'}>{c.sufficientStock ? 'OK' : 'Short'}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <Button onClick={confirmMix} disabled={!mixPreview.canProceed || mixPreview.consumption.length === 0 || mixing} className="w-full gap-2">
                  {mixing && <Spinner />}
                  {mixing ? 'Mixing…' : mixPreview.consumption.length === 0 ? 'No formula to mix' : mixPreview.canProceed ? 'Confirm mix' : 'Insufficient raw material stock'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bottle a batch</CardTitle>
            <p className="text-sm text-muted-foreground">
              Fills sellable bottles from the bulk liquid already mixed. If a perfume has no formula (bottled directly, like some oils), this just
              produces bottles with no bulk-stock check.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedVariant ? (
              <>
                <Input placeholder="Search product by name or SKU…" value={variantQuery} onChange={(e) => searchVariants(e.target.value)} />
                <div className="space-y-1">
                  {variantResults.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVariant(v);
                        setVariantResults([]);
                      }}
                      className="block w-full rounded-md border border-border p-2 text-left text-sm hover:bg-accent"
                    >
                      {v.productName} — {v.sizeLabel} ({v.sku}) <Badge variant="outline">{v.productType}</Badge>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <span>
                    {selectedVariant.productName} — {selectedVariant.sizeLabel} ({selectedVariant.sku})
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedVariant(null)}>
                    Change
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Bottle quantity</label>
                    <Input type="number" min={1} value={bottleQuantity} onChange={(e) => setBottleQuantity(e.target.value)} className="w-32" />
                  </div>
                  <Button variant="outline" onClick={runBottlePreview}>
                    Preview
                  </Button>
                </div>
              </>
            )}

            {bottleError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{bottleError}</p>}

            {bottlePreview && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm">
                  Bottling <strong>{bottlePreview.quantityProduced}</strong> × {bottlePreview.sizeLabel} = {bottlePreview.totalMlNeeded}ml total
                </p>
                {!bottlePreview.hasFormula ? (
                  <p className="text-sm text-muted-foreground">No formula on this product — bottled directly, no bulk liquid deduction.</p>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span>Bulk liquid available: {bottlePreview.bulkMlAvailable}ml</span>
                    <Badge variant={bottlePreview.canProceed ? 'default' : 'destructive'}>{bottlePreview.canProceed ? 'OK' : 'Short — mix more first'}</Badge>
                  </div>
                )}
                <Button onClick={confirmBottle} disabled={!bottlePreview.canProceed || bottling} className="w-full gap-2">
                  {bottling && <Spinner />}
                  {bottling ? 'Bottling…' : bottlePreview.canProceed ? 'Confirm batch' : 'Insufficient bulk liquid'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent mixes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {mixes.length === 0 && <p className="text-sm text-muted-foreground">No mixes yet.</p>}
          {mixes.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
              <span>
                {m.mixNumber} — {m.product.name}
              </span>
              <span className="text-muted-foreground">
                {m.totalMlMixed}ml · {m.createdBy.name} · {new Date(m.mixDate).toLocaleDateString('en-IN')}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent batches (bottled)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {batches.length === 0 && <p className="text-sm text-muted-foreground">No batches yet.</p>}
          {batches.map((b) => (
            <div key={b.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
              <span>
                {b.batchNumber} — {b.productVariant.product.name} ({b.productVariant.sizeLabel})
              </span>
              <span className="text-muted-foreground">
                {b.quantityProduced} bottles · {b.createdBy.name} · {new Date(b.productionDate).toLocaleDateString('en-IN')}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
