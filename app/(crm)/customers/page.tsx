import { CustomerListScreen } from '@/components/crm/CustomerListScreen';

export default function CustomersPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Customers</h1>
      <CustomerListScreen />
    </div>
  );
}
