'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface NotificationItem {
  recipientId: string;
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function load() {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return; // not signed in — bell stays quiet rather than erroring the whole nav
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Network hiccup (e.g. dev server restart) — bell just stays as-is until the next tick/event.
    }
  }

  useEffect(() => {
    // `cancelled` closes the gap between this effect's cleanup (synchronous)
    // and the channel setup (behind two awaited fetches). Without it, a
    // cleanup that runs before the awaits resolve leaves a zombie channel
    // registered under this topic name — a subsequent effect run (e.g.
    // React StrictMode's dev-mode double-invoke) then creates a second
    // channel with the same topic, and calling .on() on the one supabase-js
    // reuses for that topic after it already .subscribe()'d throws
    // "cannot add postgres_changes callbacks ... after subscribe()".
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    load();

    (async () => {
      const meRes = await fetch('/api/me');
      if (!meRes.ok || cancelled) return;
      const { user } = await meRes.json();
      if (!user || cancelled) return;

      channel = supabase.channel(`notifications-${user.id}`).on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_recipients', filter: `userId=eq.${user.id}` },
        () => load(),
      );

      if (cancelled) {
        supabase.removeChannel(channel);
        return;
      }
      channel.subscribe();
    })();

    // Slow fallback poll in case the Realtime channel drops — the bell should
    // never go silent just because a websocket reconnect was missed.
    const interval = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  async function markRead(recipientId: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId }),
    });
    await load();
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">
            {unreadCount}
          </Badge>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-md border border-border bg-card p-2 shadow-md">
          {notifications.length === 0 && <p className="p-2 text-sm text-muted-foreground">No notifications.</p>}
          {notifications.map((n) => (
            <button
              key={n.recipientId}
              onClick={() => markRead(n.recipientId)}
              className={`block w-full rounded-md p-2 text-left text-sm hover:bg-accent ${n.readAt ? 'opacity-60' : ''}`}
            >
              <p className="font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
