import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Package } from 'lucide-react';
import { ProductsTable } from '@/components/ProductsTable';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  product_type: string;
  category: string;
  tags: string[];
  images: string[];
  files: string[];
  is_active: boolean;
  created_at: string;
  store_id: string; // Added for consistency
}

interface StoreProductsSectionProps {
  products: Product[];
  loading: boolean;
  storeCurrency: string;
  onAddProduct: () => void;
  onDeleteProduct: (productId: string) => void;
}

export const StoreProductsSection: React.FC<StoreProductsSectionProps> = ({
  products,
  loading,
  storeCurrency,
  onAddProduct,
  onDeleteProduct
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manage Products</h2>
        <Button 
          className="bg-gradient-to-r from-purple-600 to-pink-600"
          onClick={onAddProduct}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <Card className="dark:bg-[#161616] p-8 text-center">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Products Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Start by adding your first product to your store
          </p>
          <Button onClick={onAddProduct}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Product
          </Button>
        </Card>
      ) : (
        <ProductsTable 
          products={products} 
          onDeleteProduct={onDeleteProduct}
          storeCurrency={storeCurrency}
        />
      )}
    </div>
  );
};
