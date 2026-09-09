import { OrdersListScreen } from '@/components/billing/OrdersListScreen';

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Orders</h1>
      <OrdersListScreen />
    </div>
  );
}
