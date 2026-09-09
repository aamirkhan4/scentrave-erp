'use client';

import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

/** Numbered page list with ellipses for large ranges: 1 2 3 … 7, or 1 … 4 5 6 … 12. */
function pageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
    result.push(sorted[i]);
  }
  return result;
}

export function Pagination({ page, totalPages, total, pageSize, pageSizeOptions = [12, 24, 48, 96], onPageChange, onPageSizeChange }: PaginationProps) {
  if (total === 0) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>
          {rangeStart}–{rangeEnd} of {total}
        </span>
        {onPageSizeChange && (
          <>
            <span aria-hidden>·</span>
            <label className="flex items-center gap-1.5">
              Per page
              <select
                className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            ‹
          </Button>
          {pageNumbers(page, totalPages).map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Button key={p} size="sm" variant={p === page ? 'default' : 'outline'} onClick={() => onPageChange(p)} aria-current={p === page ? 'page' : undefined}>
                {p}
              </Button>
            ),
          )}
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            ›
          </Button>
        </div>
      )}
    </div>
  );
}
