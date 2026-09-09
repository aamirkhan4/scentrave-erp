import { PosScreen } from '@/components/billing/PosScreen';

export default function PosPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Billing</h1>
      <PosScreen />
    </div>
  );
}
