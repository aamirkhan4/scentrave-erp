'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionStatus } from '@/components/ui/action-status';
import { createSupabaseBrowserClient } from '@/lib/supabase/browserClient';

type Role = 'OWNER' | 'ADMIN' | 'CASHIER' | 'SALES_AGENT';

interface CurrentUser {
  id: string;
  name: string;
  role: Role;
  email: string;
  phone: string | null;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

interface ShopSettingsData {
  shopName: string;
  address: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  gstHomeState: string;
  invoicePrefix: string;
  upiVpa: string | null;
  upiPayeeName: string | null;
}

function ProfileSection({ me, onUpdated }: { me: CurrentUser; onUpdated: () => void }) {
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      if (res.ok) {
        setProfileMessage('Saved.');
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 1000);
        onUpdated();
      } else {
        setProfileMessage((await res.json()).error ?? 'Failed to save');
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setChangingPassword(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
        return;
      }
      setPasswordMessage('Password changed.');
      setPasswordChanged(true);
      setTimeout(() => setPasswordChanged(false), 1000);
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>My profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <Input value={me.email} disabled />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Role</label>
              <Input value={me.role.replace('_', ' ')} disabled />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={saveProfile} disabled={savingProfile} className="gap-2">
              <ActionStatus loading={savingProfile} success={profileSaved} />
              {savingProfile ? 'Saving…' : 'Save changes'}
            </Button>
            {profileMessage && <span className="text-sm text-muted-foreground">{profileMessage}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">New password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Confirm password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-muted-foreground">{passwordMessage}</p>}
          <Button onClick={changePassword} disabled={changingPassword} variant="outline" className="gap-2">
            <ActionStatus loading={changingPassword} success={passwordChanged} />
            {changingPassword ? 'Changing…' : 'Change password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersSection({ me }: { me: CurrentUser }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', role: 'CASHIER' as Role, password: '' });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
      else setError(data.error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser() {
    setError(null);
    if (!newUser.name.trim() || !newUser.email.trim() || newUser.password.length < 8) {
      setError('Name, email, and an 8+ character password are required.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create user');
        return;
      }
      setNewUser({ name: '', email: '', phone: '', role: 'CASHIER', password: '' });
      setCreated(true);
      setTimeout(() => setCreated(false), 1000);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: UserRow) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) await load();
    else setError((await res.json()).error);
  }

  async function changeRole(user: UserRow, role: Role) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) await load();
    else setError((await res.json()).error);
  }

  async function submitReset() {
    if (!resetTarget || resetPassword.length < 8) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to reset password');
        return;
      }
      setResetDone(true);
      setResetPassword('');
      setTimeout(() => {
        setResetDone(false);
        setResetTarget(null);
      }, 1000);
    } finally {
      setResetting(false);
    }
  }

  const isOwner = me.role === 'OWNER';

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add a user</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input className="w-40" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input className="w-48" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Phone</label>
            <Input className="w-32" value={newUser.phone} onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Role</label>
            <select
              className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={newUser.role}
              onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as Role }))}
            >
              <option value="CASHIER">Cashier</option>
              <option value="SALES_AGENT">Sales Agent</option>
              <option value="ADMIN">Admin</option>
              {isOwner && <option value="OWNER">Owner</option>}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Temporary password</label>
            <Input className="w-36" type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
          </div>
          <Button onClick={createUser} disabled={creating} className="gap-2">
            <ActionStatus loading={creating} success={created} />
            {creating ? 'Creating…' : 'Create user'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {loading ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
                <div>
                  <p className="font-medium">
                    {u.name} {!u.isActive && <Badge variant="destructive">Inactive</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} {u.phone && `· ${u.phone}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner ? (
                    <select
                      className="h-8 rounded-md border border-input bg-transparent px-1.5 text-xs"
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      disabled={u.id === me.id}
                    >
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="CASHIER">Cashier</option>
                      <option value="SALES_AGENT">Sales Agent</option>
                    </select>
                  ) : (
                    <Badge variant="outline">{u.role.replace('_', ' ')}</Badge>
                  )}
                  {isOwner && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(u)} disabled={u.id === me.id}>
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setResetTarget(u)}>
                        Reset password
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {resetTarget && (
        <Card>
          <CardHeader>
            <CardTitle>Reset password — {resetTarget.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">New password</label>
              <Input type="password" className="w-48" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            </div>
            <Button onClick={submitReset} disabled={resetting || resetPassword.length < 8} className="gap-2">
              <ActionStatus loading={resetting} success={resetDone} />
              {resetting ? 'Resetting…' : 'Set new password'}
            </Button>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ShopDetailsSection() {
  const [settings, setSettings] = useState<ShopSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/shop');
      const data = await res.json();
      if (res.ok) setSettings(data.settings);
      else setError(data.error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setSettings(data.settings);
      setMessage('Saved. Used on every new invoice and QR code from now on.');
      setSaved(true);
      setTimeout(() => setSaved(false), 1000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!settings) return <p className="text-sm text-destructive">{error ?? 'Failed to load shop details'}</p>;

  const field = (key: keyof ShopSettingsData, label: string) => (
    <div>
      <label className="text-sm text-muted-foreground">{label}</label>
      <Input value={settings[key] ?? ''} onChange={(e) => setSettings((p) => (p ? { ...p, [key]: e.target.value } : p))} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop details</CardTitle>
        <p className="text-sm text-muted-foreground">Used across Billing — invoices, tax place-of-supply, and the UPI QR code.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('shopName', 'Shop name')}
          {field('gstin', 'GSTIN')}
          {field('address', 'Address')}
          {field('phone', 'Phone')}
          {field('email', 'Email')}
          {field('gstHomeState', 'GST home state')}
          {field('invoicePrefix', 'Invoice prefix')}
          {field('upiVpa', 'UPI VPA (for QR)')}
          {field('upiPayeeName', 'UPI payee name')}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button onClick={save} disabled={saving} className="gap-2">
          <ActionStatus loading={saving} success={saved} />
          {saving ? 'Saving…' : 'Save shop details'}
        </Button>
      </CardContent>
    </Card>
  );
}

export function SettingsScreen() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [tab, setTab] = useState<'PROFILE' | 'USERS' | 'SHOP'>('PROFILE');

  async function loadMe() {
    const res = await fetch('/api/me');
    if (res.ok) setMe((await res.json()).user);
  }

  useEffect(() => {
    loadMe();
  }, []);

  if (!me) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const canManageUsers = me.role === 'OWNER' || me.role === 'ADMIN';
  const canEditShop = me.role === 'OWNER';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant={tab === 'PROFILE' ? 'default' : 'outline'} onClick={() => setTab('PROFILE')}>
          My Profile
        </Button>
        {canManageUsers && (
          <Button size="sm" variant={tab === 'USERS' ? 'default' : 'outline'} onClick={() => setTab('USERS')}>
            Users
          </Button>
        )}
        {canEditShop && (
          <Button size="sm" variant={tab === 'SHOP' ? 'default' : 'outline'} onClick={() => setTab('SHOP')}>
            Shop Details
          </Button>
        )}
      </div>

      {tab === 'PROFILE' && <ProfileSection me={me} onUpdated={loadMe} />}
      {tab === 'USERS' && canManageUsers && <UsersSection me={me} />}
      {tab === 'SHOP' && canEditShop && <ShopDetailsSection />}
    </div>
  );
}
