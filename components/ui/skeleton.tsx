import { cn } from '@/lib/utils';

/** A loading placeholder with a light sweep across it — the shimmer is the
 * loading cue everywhere in the app, so it stays visually consistent instead
 * of each screen inventing its own "Loading…" text. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-muted', className)} {...props}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent motion-reduce:animate-none" />
    </div>
  );
}
