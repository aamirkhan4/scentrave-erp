'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Receipt,
  ClipboardList,
  Users,
  Package,
  Tags,
  FlaskConical,
  Beaker,
  Tag,
  Percent,
  Factory,
  Boxes,
  IndianRupee,
  Wallet,
  LayoutDashboard,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import { NotificationBell } from '@/components/notifications/NotificationBell';

type Role = 'OWNER' | 'ADMIN' | 'CASHIER' | 'SALES_AGENT';

interface NavLink {
  href: string;
  label: string;
  icon: typeof Receipt;
  roles: Role[];
}

interface NavSection {
  label: string;
  links: NavLink[];
}

// Grouped by function, not by data model — this mirrors how an owner or
// cashier actually thinks about the day (sell, stock the shelf, check the
// numbers), not how the schema is organized.
const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Sales',
    links: [
      { href: '/pos', label: 'Billing', icon: Receipt, roles: ['OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT'] },
      { href: '/orders', label: 'Orders', icon: ClipboardList, roles: ['OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT'] },
      { href: '/customers', label: 'Customers', icon: Users, roles: ['OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT'] },
      { href: '/settings', label: 'Settings', icon: Settings, roles: ['OWNER', 'ADMIN', 'CASHIER', 'SALES_AGENT'] },
    ],
  },
  {
    label: 'Catalog',
    links: [
      { href: '/products', label: 'Products', icon: Package, roles: ['OWNER', 'ADMIN'] },
      { href: '/categories', label: 'Categories', icon: Tags, roles: ['OWNER', 'ADMIN'] },
      { href: '/raw-materials', label: 'Raw Materials', icon: FlaskConical, roles: ['OWNER', 'ADMIN'] },
      { href: '/formulas', label: 'Formulas', icon: Beaker, roles: ['OWNER', 'ADMIN'] },
      { href: '/price-lists', label: 'Price Lists', icon: Tag, roles: ['OWNER', 'ADMIN'] },
      { href: '/discounts', label: 'Discounts', icon: Percent, roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/production', label: 'Production', icon: Factory, roles: ['OWNER', 'ADMIN'] },
      { href: '/inventory', label: 'Inventory', icon: Boxes, roles: ['OWNER', 'ADMIN', 'CASHIER'] },
      { href: '/cost-stock', label: 'Cost & Stock', icon: IndianRupee, roles: ['OWNER', 'ADMIN'] },
      { href: '/payments', label: 'Payments', icon: Wallet, roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    label: 'Insights',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER', 'ADMIN'] },
      { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['OWNER', 'ADMIN'] },
    ],
  },
];

function NavItem({ link, active, onNavigate }: { link: NavLink; active: boolean; onNavigate: () => void }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
        active ? 'text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-md bg-sidebar-accent"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <Icon className="relative z-10 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="relative z-10">{link.label}</span>
    </Link>
  );
}

function SidebarContent({
  user,
  pathname,
  onNavigate,
  onSignOut,
  onClose,
}: {
  user: { name: string; role: Role } | null;
  pathname: string | null;
  onNavigate: () => void;
  onSignOut: () => void;
  onClose?: () => void;
}) {
  const visibleSections = user
    ? NAV_SECTIONS.map((s) => ({ ...s, links: s.links.filter((l) => l.roles.includes(user.role)) })).filter((s) => s.links.length > 0)
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-accent text-sm font-semibold tracking-tight text-sidebar-foreground">
          S
        </span>
        <span className="text-sm font-semibold tracking-[0.12em] text-sidebar-foreground">SCENTRAVE</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {visibleSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/40">{section.label}</p>
            <div className="space-y-0.5">
              {section.links.map((link) => (
                <NavItem key={link.href} link={link} active={pathname?.startsWith(link.href) ?? false} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {user && (
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/50">{user.role.replace('_', ' ')}</p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: Role } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (pathname === '/login') return <>{children}</>;

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:block lg:h-screen">
        <SidebarContent user={user} pathname={pathname} onNavigate={() => {}} onSignOut={signOut} />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 42 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar lg:hidden"
            >
              <SidebarContent
                user={user}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
                onSignOut={signOut}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          {pathname !== '/pos' && (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              Back
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
