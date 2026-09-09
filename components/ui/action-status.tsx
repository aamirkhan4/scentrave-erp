import { Check } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

/** The spinner-then-checkmark pair every action button uses — pass the state from useAsyncAction. */
export function ActionStatus({ loading, success }: { loading: boolean; success: boolean }) {
  if (loading) return <Spinner />;
  if (success) return <Check className="h-4 w-4 animate-pop-in text-green-600 motion-reduce:animate-none" />;
  return null;
}
