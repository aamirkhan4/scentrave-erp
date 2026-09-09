'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ActionStatus } from '@/components/ui/action-status';
import { INDIAN_STATES } from '@/lib/constants/indianStates';

interface ReportRow {
  date: string;
  orderNumber: string;
  productName: string;
  customerName: string;
  state: string;
  quantity: number;
  bankDetails: string | null;
  isIgst: boolean;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

const PAYMENT_MODES = [
  { value: '', label: 'All methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
] as const;

export function ReportsScreen() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [state, setState] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  function buildParams(format?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', new Date(startDate).toISOString());
    if (endDate) params.set('endDate', new Date(endDate).toISOString());
    if (state) params.set('state', state);
    if (paymentMode) params.set('paymentMode', paymentMode);
    if (format) params.set('format', format);
    return params;
  }

  async function runReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/sales?${buildParams().toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to run report');
        return;
      }
      setRows(data.rows);
      setRan(true);
      setTimeout(() => setRan(false), 1000);
    } finally {
      setLoading(false);
    }
  }

  function downloadExport(format: 'csv' | 'pdf') {
    window.open(`/api/reports/sales?${buildParams(format).toString()}`, '_blank');
  }

  const totals = rows.reduce(
    (acc, r) => ({
      quantity: acc.quantity + r.quantity,
      taxable: acc.taxable + r.taxableAmount,
      cgst: acc.cgst + r.cgst,
      sgst: acc.sgst + r.sgst,
      igst: acc.igst + r.igst,
      total: acc.total + r.totalAmount,
    }),
    { quantity: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm text-muted-foreground">Start date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">End date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">State</label>
            <select
              className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">All states</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Mode of payment</label>
            <select
              className="block h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              {PAYMENT_MODES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={runReport} disabled={loading} className="gap-2">
            <ActionStatus loading={loading} success={ran} />
            {loading ? 'Running…' : 'Run report'}
          </Button>
          <Button variant="outline" onClick={() => downloadExport('csv')} disabled={rows.length === 0}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => downloadExport('pdf')} disabled={rows.length === 0}>
            Export PDF
          </Button>
        </CardContent>
      </Card>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sales transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1 pr-2">Date</th>
                    <th className="py-1 pr-2">Order ID</th>
                    <th className="py-1 pr-2">Perfume</th>
                    <th className="py-1 pr-2">Customer Name</th>
                    <th className="py-1 pr-2">State</th>
                    <th className="py-1 pr-2 text-right">Qty</th>
                    <th className="py-1 pr-2">Bank Details (UPI)</th>
                    <th className="py-1 pr-2 text-right">Taxable ₹</th>
                    <th className="py-1 pr-2 text-right">CGST ₹</th>
                    <th className="py-1 pr-2 text-right">SGST ₹</th>
                    <th className="py-1 pr-2 text-right">IGST ₹</th>
                    <th className="py-1 pr-2 text-right">Total ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.orderNumber}-${i}`} className="border-b border-border last:border-0">
                      <td className="py-1 pr-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">{r.orderNumber}</td>
                      <td className="py-1 pr-2">{r.productName}</td>
                      <td className="py-1 pr-2">{r.customerName}</td>
                      <td className="py-1 pr-2">{r.state}</td>
                      <td className="py-1 pr-2 text-right">{r.quantity}</td>
                      <td className="py-1 pr-2 text-muted-foreground">{r.bankDetails ?? '—'}</td>
                      <td className="py-1 pr-2 text-right">₹{r.taxableAmount.toFixed(2)}</td>
                      <td className="py-1 pr-2 text-right">{r.isIgst ? '—' : `₹${r.cgst.toFixed(2)}`}</td>
                      <td className="py-1 pr-2 text-right">{r.isIgst ? '—' : `₹${r.sgst.toFixed(2)}`}</td>
                      <td className="py-1 pr-2 text-right">{r.isIgst ? `₹${r.igst.toFixed(2)}` : '—'}</td>
                      <td className="py-1 pr-2 text-right font-medium">₹{r.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-1 pr-2" colSpan={5}>
                      Total
                    </td>
                    <td className="py-1 pr-2 text-right">{totals.quantity}</td>
                    <td className="py-1 pr-2"></td>
                    <td className="py-1 pr-2 text-right">₹{totals.taxable.toFixed(2)}</td>
                    <td className="py-1 pr-2 text-right">₹{totals.cgst.toFixed(2)}</td>
                    <td className="py-1 pr-2 text-right">₹{totals.sgst.toFixed(2)}</td>
                    <td className="py-1 pr-2 text-right">₹{totals.igst.toFixed(2)}</td>
                    <td className="py-1 pr-2 text-right">₹{totals.total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
