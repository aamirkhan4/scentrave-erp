import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Inline spinner for buttons and small in-progress areas — pairs with Skeleton so every loading state in the app reads the same way. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin motion-reduce:animate-none', className)} aria-hidden="true" />;
}
