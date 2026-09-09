'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionStatus } from '@/components/ui/action-status';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  isRawMaterialView: boolean;
  sortOrder: number;
  _count: { products: number };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  subcategories: Subcategory[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategory, setNewSubcategory] = useState<Record<string, string>>({});
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [addedSubFor, setAddedSubFor] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load categories');
        return;
      }
      setCategories(data.categories);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addCategory() {
    if (!newCategoryName.trim()) return false;
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName, slug: slugify(newCategoryName), sortOrder: categories.length }),
    });
    if (res.ok) {
      setNewCategoryName('');
      await load();
      return true;
    }
    return false;
  }
  const addCategoryAction = useAsyncAction(addCategory);

  async function addSubcategory(categoryId: string) {
    const name = newSubcategory[categoryId];
    if (!name?.trim()) return;
    setAddingSubFor(categoryId);
    const res = await fetch(`/api/categories/${categoryId}/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug: slugify(name) }),
    });
    setAddingSubFor(null);
    if (res.ok) {
      setNewSubcategory((prev) => ({ ...prev, [categoryId]: '' }));
      setAddedSubFor(categoryId);
      setTimeout(() => setAddedSubFor((cur) => (cur === categoryId ? null : cur)), 1000);
      await load();
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>New category</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="e.g. Perfume" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
          <Button onClick={addCategoryAction.run} disabled={addCategoryAction.loading} className="gap-2">
            <ActionStatus loading={addCategoryAction.loading} success={addCategoryAction.success} />
            Add
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        categories.map((cat) => (
        <Card key={cat.id}>
          <CardHeader>
            <CardTitle>{cat.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cat.subcategories.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
                <span>{sub.name}</span>
                <div className="flex items-center gap-2">
                  {sub.isRawMaterialView && <Badge variant="secondary">Raw material view</Badge>}
                  <span className="text-muted-foreground">{sub._count.products} products</span>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="New subcategory…"
                value={newSubcategory[cat.id] ?? ''}
                onChange={(e) => setNewSubcategory((prev) => ({ ...prev, [cat.id]: e.target.value }))}
              />
              <Button variant="outline" size="sm" onClick={() => addSubcategory(cat.id)} disabled={addingSubFor === cat.id} className="gap-2">
                <ActionStatus loading={addingSubFor === cat.id} success={addedSubFor === cat.id} />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
        ))
      )}
    </div>
  );
}
