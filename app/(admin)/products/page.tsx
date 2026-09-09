import { Suspense } from 'react';
import { ProductsScreen } from '@/components/catalog/ProductsScreen';

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Products</h1>
      <Suspense fallback={null}>
        <ProductsScreen />
      </Suspense>
    </div>
  );
}
