import { InventoryScreen } from '@/components/inventory/InventoryScreen';

export default function InventoryPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Inventory</h1>
      <InventoryScreen />
    </div>
  );
}
