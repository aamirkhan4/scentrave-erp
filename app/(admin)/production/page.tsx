import { ProductionScreen } from '@/components/production/ProductionScreen';

export default function ProductionPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Production</h1>
      <ProductionScreen />
    </div>
  );
}
