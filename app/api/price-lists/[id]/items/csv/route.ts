import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { requireRole } from '@/lib/auth/session';
import { getPriceListItems, bulkUpsertPriceListItems } from '@/lib/services/priceListAdmin';
import { handleApiError } from '@/lib/api/errors';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('OWNER', 'ADMIN');
    const items = await getPriceListItems(params.id);
    const csv = Papa.unparse(
      items.map((i) => ({
        SKU: i.sku,
        Product: i.productName,
        Size: i.sizeLabel,
        'Default Price': i.defaultPrice,
        'List Price': i.listPrice ?? i.defaultPrice,
      })),
    );
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="price-list.csv"' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Bulk import: expects a CSV with SKU and "List Price" columns (from the export above, edited). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole('OWNER', 'ADMIN');
    const csvText = await request.text();
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: `CSV parse error: ${parsed.errors[0].message}` }, { status: 400 });
    }

    const items = await getPriceListItems(params.id);
    const variantBySku = new Map(items.map((i) => [i.sku, i.productVariantId]));

    const rows: Array<{ productVariantId: string; price: number }> = [];
    for (const row of parsed.data) {
      const sku = row.SKU?.trim();
      const priceRaw = row['List Price'];
      if (!sku || priceRaw === undefined) continue;
      const variantId = variantBySku.get(sku);
      if (!variantId) continue;
      const price = Number(priceRaw);
      if (Number.isNaN(price)) continue;
      rows.push({ productVariantId: variantId, price });
    }

    await bulkUpsertPriceListItems(params.id, rows, user.id);
    const updated = await getPriceListItems(params.id);
    return NextResponse.json({ items: updated, imported: rows.length });
  } catch (error) {
    return handleApiError(error);
  }
}
