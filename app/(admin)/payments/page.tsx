import { PaymentReconciliationScreen } from '@/components/payments/PaymentReconciliationScreen';

export default function PaymentsPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Payment Reconciliation</h1>
      <PaymentReconciliationScreen />
    </div>
  );
}
