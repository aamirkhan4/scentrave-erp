import { getShopSettings } from '@/lib/services/shopSettings';

/**
 * Single-state GST model: one home-state GSTIN. CGST+SGST applies when the
 * customer's billing state matches the shop's home state; IGST applies
 * otherwise. Multi-state/branch GSTIN support is explicitly out of scope.
 * The home state is owner-editable (Settings → Shop Details), not a static
 * env var, so this reads it fresh each time rather than caching.
 */
export const DEFAULT_GST_RATE_PERCENT = 18;

export async function getHomeState(): Promise<string> {
  const settings = await getShopSettings();
  return settings.gstHomeState;
}

export async function isInterState(customerState: string): Promise<boolean> {
  const homeState = await getHomeState();
  return customerState.trim().toLowerCase() !== homeState.trim().toLowerCase();
}

export interface TaxBreakup {
  taxRatePercent: number;
  taxAmount: number;
  igst: number;
  cgst: number;
  sgst: number;
}

/**
 * Extracts the GST portion already contained within a tax-inclusive amount
 * (our listed prices are MRP-style — tax included, never added on top).
 * `grossAmount` is what the customer actually pays for the line (post-discount);
 * the returned `taxAmount` is informational, for GST filing and the invoice
 * breakup — it must never be added again on top of `grossAmount`.
 */
export function computeTaxBreakup(grossAmount: number, isIgst: boolean, taxRatePercent = DEFAULT_GST_RATE_PERCENT): TaxBreakup {
  const taxableBase = grossAmount / (1 + taxRatePercent / 100);
  const taxAmount = round2(grossAmount - taxableBase);
  // cgst + sgst must sum to exactly taxAmount — rounding each half independently
  // can drift by a paisa, which a GST audit would flag. sgst takes the remainder.
  const cgst = isIgst ? 0 : round2(taxAmount / 2);
  const sgst = isIgst ? 0 : round2(taxAmount - cgst);
  return {
    taxRatePercent,
    taxAmount,
    igst: isIgst ? taxAmount : 0,
    cgst,
    sgst,
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
