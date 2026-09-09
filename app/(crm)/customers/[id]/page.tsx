import { CustomerDetailScreen } from '@/components/crm/CustomerDetailScreen';

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <CustomerDetailScreen customerId={params.id} />
    </div>
  );
}
