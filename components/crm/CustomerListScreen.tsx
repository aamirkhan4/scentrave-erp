'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionStatus } from '@/components/ui/action-status';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  state: string;
  loyaltyPoints: number;
  loyaltyTier: string | null;
  preferredCategory: string | null;
}

interface Segment {
  id: string;
  name: string;
  _count: { customers: number };
}

export function CustomerListScreen() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [newSegmentName, setNewSegmentName] = useState('');

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setCustomers([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/customers?query=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (res.ok) setCustomers(data.customers);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function loadSegments() {
    const res = await fetch('/api/segments');
    const data = await res.json();
    if (res.ok) setSegments(data.segments);
  }

  useEffect(() => {
    loadSegments();
  }, []);

  async function addSegment() {
    if (!newSegmentName.trim()) return false;
    const res = await fetch('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSegmentName }),
    });
    if (res.ok) {
      setNewSegmentName('');
      await loadSegments();
      return true;
    }
    return false;
  }
  const addSegmentAction = useAsyncAction(addSegment);

  return (
    <div className="space-y-4">
      <Input placeholder="Search by name or phone…" value={query} onChange={(e) => search(e.target.value)} />
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {searching ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{searched ? 'No customers match.' : 'Search to see customers.'}</p>
          ) : (
            customers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0 hover:bg-accent"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.phone} · {c.state} {c.preferredCategory ? `· ${c.preferredCategory}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.loyaltyTier && <Badge variant="secondary">{c.loyaltyTier}</Badge>}
                <span className="text-muted-foreground">{c.loyaltyPoints} pts</span>
              </div>
            </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {segments.map((s) => (
              <Badge key={s.id} variant="outline">
                {s.name} ({s._count.customers})
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="e.g. High-value 50ml perfume buyers" value={newSegmentName} onChange={(e) => setNewSegmentName(e.target.value)} />
            <Button variant="outline" onClick={addSegmentAction.run} disabled={addSegmentAction.loading} className="gap-2">
              <ActionStatus loading={addSegmentAction.loading} success={addSegmentAction.success} />
              Create segment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
