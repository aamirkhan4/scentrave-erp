'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ActionStatus } from '@/components/ui/action-status';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  state: string;
  address: string | null;
  billingAddress: string | null;
  loyaltyPoints: number;
  loyaltyTier: string | null;
  preferredCategory: string | null;
  priceListId: string | null;
  lifetimeValue: number;
  lastPurchaseAt: string | null;
  orders: Array<{ id: string; orderNumber: string; total: string; createdAt: string; status: string }>;
  notes: Array<{ id: string; body: string; createdAt: string; author: { name: string } }>;
  tasks: Array<{ id: string; title: string; dueAt: string | null; isDone: boolean }>;
  segments: Array<{ id: string; name: string }>;
  loyaltyLedger: Array<{ id: string; type: string; points: number; note: string | null; createdAt: string }>;
}

interface Segment {
  id: string;
  name: string;
}

interface PriceList {
  id: string;
  name: string;
  isDefault: boolean;
}

export function CustomerDetailScreen({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [savingPriceList, setSavingPriceList] = useState(false);
  const [priceListSaved, setPriceListSaved] = useState(false);
  const [address, setAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);

  async function load() {
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load customer');
        return;
      }
      setProfile(data.customer);
      setAddress(data.customer.address ?? '');
      setBillingAddress(data.customer.billingAddress ?? '');
      setBillingSameAsShipping(!data.customer.billingAddress);
    } catch {
      setError('Could not reach the server');
    }
  }

  useEffect(() => {
    load();
    fetch('/api/segments')
      .then((r) => (r.ok ? r.json() : { segments: [] }))
      .then((d) => setSegments(d.segments ?? []))
      .catch(() => {});
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setCurrentUserId(d.user?.id ?? null))
      .catch(() => {});
    fetch('/api/price-lists')
      .then((r) => (r.ok ? r.json() : { priceLists: [] }))
      .then((d) => setPriceLists(d.priceLists ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function updatePriceList(priceListId: string) {
    setSavingPriceList(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceListId: priceListId || null }),
      });
      if (res.ok) {
        await load();
        setPriceListSaved(true);
        setTimeout(() => setPriceListSaved(false), 1000);
      }
    } finally {
      setSavingPriceList(false);
    }
  }

  async function saveAddress() {
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address || null,
        billingAddress: billingSameAsShipping ? null : billingAddress || null,
      }),
    });
    if (!res.ok) return false;
    await load();
    return true;
  }
  const saveAddressAction = useAsyncAction(saveAddress);

  async function addNote() {
    if (!noteText.trim()) return false;
    const res = await fetch(`/api/customers/${customerId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: noteText }),
    });
    if (res.ok) {
      setNoteText('');
      await load();
      return true;
    }
    return false;
  }
  const addNoteAction = useAsyncAction(addNote);

  async function assignSegment() {
    if (!selectedSegmentId) return false;
    const res = await fetch(`/api/customers/${customerId}/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segmentId: selectedSegmentId }),
    });
    if (res.ok) {
      setSelectedSegmentId('');
      await load();
      return true;
    }
    return false;
  }
  const assignSegmentAction = useAsyncAction(assignSegment);

  async function removeSegment(segmentId: string) {
    const res = await fetch(`/api/customers/${customerId}/segments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segmentId }),
    });
    if (res.ok) await load();
  }

  async function addTask() {
    if (!taskTitle.trim() || !currentUserId) return false;
    const res = await fetch(`/api/customers/${customerId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: taskTitle,
        assigneeId: currentUserId,
        dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : undefined,
      }),
    });
    if (res.ok) {
      setTaskTitle('');
      setTaskDueAt('');
      await load();
      return true;
    }
    return false;
  }
  const addTaskAction = useAsyncAction(addTask);

  async function toggleTask(taskId: string, isDone: boolean) {
    await fetch(`/api/customers/${customerId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, isDone }),
    });
    await load();
  }

  async function deleteCustomer() {
    if (!profile) return;
    if (!confirm(`Delete ${profile.name}? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete customer');
        return;
      }
      router.push('/customers');
    } finally {
      setDeleting(false);
    }
  }

  if (error) return <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
  if (!profile) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{profile.name}</CardTitle>
          <Button size="sm" variant="destructive" onClick={deleteCustomer} disabled={deleting} className="gap-2">
            {deleting && <Spinner />}
            {deleting ? 'Deleting…' : 'Delete customer'}
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p>{profile.phone}</p>
          </div>
          <div>
            <p className="text-muted-foreground">State</p>
            <p>{profile.state}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lifetime value</p>
            <p className="font-semibold">₹{profile.lifetimeValue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last purchase</p>
            <p>{profile.lastPurchaseAt ? new Date(profile.lastPurchaseAt).toLocaleDateString('en-IN') : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Loyalty</p>
            <p>
              {profile.loyaltyPoints} pts {profile.loyaltyTier && <Badge variant="secondary">{profile.loyaltyTier}</Badge>}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Preferred category</p>
            <p>{profile.preferredCategory ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Price list</p>
            <div className="flex items-center gap-1.5">
              <select
                className="h-8 rounded-md border border-input bg-transparent px-1 text-sm"
                value={profile.priceListId ?? ''}
                disabled={savingPriceList}
                onChange={(e) => updatePriceList(e.target.value)}
              >
                <option value="">Default</option>
                {priceLists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
              <ActionStatus loading={savingPriceList} success={priceListSaved} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address (for invoices)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Shipping address</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House/street, area, city, PIN" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={billingSameAsShipping} onChange={(e) => setBillingSameAsShipping(e.target.checked)} />
            Billing address same as shipping
          </label>
          {!billingSameAsShipping && (
            <div>
              <label className="text-sm text-muted-foreground">Billing address</label>
              <Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="House/street, area, city, PIN" />
            </div>
          )}
          <Button size="sm" onClick={saveAddressAction.run} disabled={saveAddressAction.loading} className="gap-2">
            <ActionStatus loading={saveAddressAction.loading} success={saveAddressAction.success} />
            Save address
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {profile.segments.length === 0 && <p className="text-sm text-muted-foreground">Not in any segment.</p>}
            {profile.segments.map((s) => (
              <Badge key={s.id} variant="secondary" className="cursor-pointer" onClick={() => removeSegment(s.id)} title="Click to remove">
                {s.name} ✕
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              className="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
              value={selectedSegmentId}
              onChange={(e) => setSelectedSegmentId(e.target.value)}
            >
              <option value="">Add to segment…</option>
              {segments
                .filter((s) => !profile.segments.some((ps) => ps.id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <Button size="sm" variant="outline" onClick={assignSegmentAction.run} disabled={assignSegmentAction.loading} className="gap-2">
              <ActionStatus loading={assignSegmentAction.loading} success={assignSegmentAction.success} />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {profile.orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          {profile.orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0 hover:bg-accent"
            >
              <span>{o.orderNumber}</span>
              <span className="text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('en-IN')}</span>
              <Badge variant="outline">{o.status}</Badge>
              <span className="font-medium">₹{o.total}</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loyalty ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {profile.loyaltyLedger.length === 0 && <p className="text-sm text-muted-foreground">No loyalty activity yet.</p>}
          {profile.loyaltyLedger.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm last:border-0">
              <span>
                <Badge variant={entry.type === 'EARNED' ? 'default' : entry.type === 'REDEEMED' ? 'destructive' : 'outline'}>{entry.type}</Badge>{' '}
                {entry.note}
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {entry.points > 0 ? '+' : ''}
                {entry.points} pts · {new Date(entry.createdAt).toLocaleDateString('en-IN')}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profile.tasks.length === 0 && <p className="text-sm text-muted-foreground">No open tasks.</p>}
          {profile.tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={t.isDone} onChange={(e) => toggleTask(t.id, e.target.checked)} />
                <span className={t.isDone ? 'text-muted-foreground line-through' : ''}>{t.title}</span>
              </label>
              {t.dueAt && <span className="text-muted-foreground">{new Date(t.dueAt).toLocaleDateString('en-IN')}</span>}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Input placeholder="e.g. Call for reorder" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <Input type="date" className="w-40" value={taskDueAt} onChange={(e) => setTaskDueAt(e.target.value)} />
            <Button size="sm" onClick={addTaskAction.run} disabled={addTaskAction.loading} className="gap-2">
              <ActionStatus loading={addTaskAction.loading} success={addTaskAction.success} />
              Add task
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes / timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Add a note (call, complaint, feedback)…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <Button onClick={addNoteAction.run} disabled={addNoteAction.loading} className="gap-2">
              <ActionStatus loading={addNoteAction.loading} success={addNoteAction.success} />
              Add
            </Button>
          </div>
          {profile.notes.map((n) => (
            <div key={n.id} className="border-b border-border pb-2 text-sm last:border-0">
              <p>{n.body}</p>
              <p className="text-xs text-muted-foreground">
                {n.author.name} · {new Date(n.createdAt).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
