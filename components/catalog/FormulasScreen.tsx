'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { Search, X } from 'lucide-react';

interface FormulaLine {
  rawMaterialName: string;
  unit: string;
  quantityPerMl: number;
}

interface ProductFormula {
  id: string;
  name: string;
  category: string;
  formula: { version: number; lines: FormulaLine[] } | null;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function FormulasScreen() {
  const [products, setProducts] = useState<ProductFormula[]>([]);
  const [summary, setSummary] = useState({ totalPerfumes: 0, withFormula: 0, withoutFormula: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [missingOnly, setMissingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (missingOnly) params.set('missingOnly', '1');
      const res = await fetch(`/api/formulas?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load formulas');
        return;
      }
      setProducts(data.products);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, missingOnly]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, missingOnly, pageSize]);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Perfumes</p>
            <p className="text-2xl font-semibold">{summary.totalPerfumes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">With a formula</p>
            <p className="text-2xl font-semibold">{summary.withFormula}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Missing a formula</p>
            <p className={`text-2xl font-semibold ${summary.withoutFormula > 0 ? 'text-destructive' : ''}`}>{summary.withoutFormula}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 pt-4">
          <div className="min-w-64 flex-1">
            <label className="text-xs text-muted-foreground">Search by product name</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search perfumes…" className="pl-8 pr-8" />
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
          <Button size="sm" variant={missingOnly ? 'default' : 'outline'} onClick={() => setMissingOnly((v) => !v)}>
            Missing formula only
          </Button>
        </CardContent>
      </Card>

      {!loading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-56" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No perfumes match these filters.</p>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <Card key={product.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{product.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  {product.formula ? (
                    <Badge variant="secondary">v{product.formula.version}</Badge>
                  ) : (
                    <Badge variant="destructive">No formula</Badge>
                  )}
                  <Link href={`/products?search=${encodeURIComponent(product.name)}`} className="text-xs text-primary underline">
                    {product.formula ? 'Edit in Products' : 'Add formula'}
                  </Link>
                </div>
              </CardHeader>
              {product.formula && (
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-1 pr-2">Raw material</th>
                        <th className="py-1 pr-2 text-right">Qty per ml</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.formula.lines.map((line, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="py-1 pr-2">{line.rawMaterialName}</td>
                          <td className="py-1 pr-2 text-right">
                            {line.quantityPerMl} {line.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {!loading && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}
    </div>
  );
}
