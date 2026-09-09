import { OrderDetailScreen } from '@/components/billing/OrderDetailScreen';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <OrderDetailScreen orderId={params.id} />
    </div>
  );
}
