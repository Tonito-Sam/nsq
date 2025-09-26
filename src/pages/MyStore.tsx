import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { EnhancedAddProductForm } from '@/components/EnhancedAddProductForm';
import { StoreNavigation } from '@/components/StoreNavigation';
import { ChatBoard } from '@/components/ChatBoard';
import { SalesReports } from '@/components/SalesReports';
import { ManageOrders } from '@/components/ManageOrders';
import { StoreWallet } from '@/components/StoreWallet';
import { StoreSettings } from '@/components/StoreSettings';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { StoreDashboard } from '@/components/store/StoreDashboard';
import { StoreProductsSection } from '@/components/store/StoreProductsSection';
import { EditProductModal } from '@/components/EditProductModal';
import { MobileStoreNav } from '@/components/store/MobileStoreNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { EnhancedStoreSetupModal } from '@/components/EnhancedStoreSetupModal';
import { Button } from '@/components/ui/button';



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

interface Store {
  id: string;
  store_name: string;
  store_category: string;
  description: string;
  base_currency: string;
  shipping_partner: string;
  logo_url: string;
  verification_status: string;
  is_active: boolean;
}

const MyStore = () => {
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const handleEditProduct = (product: Product) => {
    setEditProduct(product);
    setShowEditModal(true);
  };

  const handleSaveEditProduct = async (updatedProduct: Product) => {
    try {
      const { error } = await supabase
        .from('store_products')
        .update({
          title: updatedProduct.title,
          description: updatedProduct.description,
          price: updatedProduct.price,
          category: updatedProduct.category,
          // Add more fields as needed
        })
        .eq('id', updatedProduct.id);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p));
      toast({ title: 'Success', description: 'Product updated successfully' });
      setShowEditModal(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update product', variant: 'destructive' });
    }
  };
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storeLoading, setStoreLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProducts: 0,
    totalSales: 0,
    totalViews: 0
  });
  const [showStoreSetup, setShowStoreSetup] = useState(false);

  useEffect(() => {
    if (user) {
      checkStoreExists();
    }
  }, [user]);

  useEffect(() => {
    if (store) {
      fetchProducts();
      fetchStoreStats();
    }
  }, [store]);

  // Retry mechanism for checking store existence
  const checkStoreExists = async (retries = 5, delay = 1000) => {
    if (!user) return;
    let found = false;
    let lastError = null;
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase
          .from('user_stores')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();
        console.log(`[MyStore] checkStoreExists attempt ${i+1}:`, { data, error, userId: user.id });
        if (data && !error) {
          setStore(data);
          found = true;
          break;
        } else {
          lastError = error;
        }
      } catch (error) {
        lastError = error;
      }
      // Wait before retrying
      await new Promise(res => setTimeout(res, delay));
    }
    if (!found) {
      console.log('No store found after retries, redirecting to create store page', lastError);
      window.location.href = '/create-store';
    }
    setStoreLoading(false);
  };

  const fetchProducts = async () => {
    if (!user || !store) return;

    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts((data || []).map((p: any) => ({ ...p, store_id: p.store_id || store.id })));
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreStats = async () => {
    if (!user || !store) return;

    try {
      const productCount = products.length;

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('store_id', store.id);

      if (ordersError) throw ordersError;

      const totalRevenue = orders?.reduce((sum, order) => 
        order.status === 'completed' ? sum + Number(order.total_amount) : sum, 0) || 0;
      
      const totalSales = orders?.filter(order => order.status === 'completed').length || 0;
      const totalViews = productCount * 50;

      setStats({
        totalRevenue,
        totalProducts: productCount,
        totalSales,
        totalViews
      });
    } catch (error) {
      console.error('Error fetching store stats:', error);
    }
  };

  const handleStoreSetupSuccess = () => {
    // Add a short delay to allow DB propagation before checking again
    setTimeout(() => {
      checkStoreExists();
    }, 1200); // 1.2 seconds
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('store_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== productId));
      toast({
        title: "Success",
        description: "Product deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive"
      });
    }
  };

  const renderDashboardContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <StoreDashboard stats={stats} storeCurrency={store?.base_currency || 'ZAR'} />;
      
      case 'products':
        return (
          <>
            <StoreProductsSection
              products={products}
              loading={loading}
              storeCurrency={store?.base_currency || 'ZAR'}
              onAddProduct={() => setShowAddForm(true)}
              onDeleteProduct={handleDeleteProduct}
              onEditProduct={handleEditProduct}
            />
            {/* Edit Product Modal */}
            <EditProductModal
              open={showEditModal}
              product={editProduct}
              onClose={() => setShowEditModal(false)}
              onSave={handleSaveEditProduct}
            />
          </>
        );

      case 'chat':
        return (
          <div className="w-full max-w-full overflow-x-hidden">
            <ChatBoard />
          </div>
        );

      case 'orders':
        return <ManageOrders storeId={store?.id} storeCurrency={store?.base_currency || 'ZAR'} />;

      case 'reports':
        return <SalesReports storeId={store?.id} storeCurrency={store?.base_currency || 'ZAR'} />;

      case 'wallet':
        return <StoreWallet storeId={store?.id} storeCurrency={store?.base_currency || 'ZAR'} storeName={store?.store_name || 'My Store'} />;

      case 'settings':
        return <StoreSettings store={store} onStoreUpdate={setStore} />;

      default:
        return (
          <Card className="dark:bg-[#161616] p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Coming Soon
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              This section is under development
            </p>
          </Card>
        );
    }
  };

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors overflow-x-hidden">
      <Header />
      <MobileStoreNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        storeName={store?.store_name || 'My Store'}
      />
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        {/* Desktop Store Navigation */}
        <div className="hidden lg:block w-80 px-4 py-6">
          <StoreNavigation
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            storeName={store?.store_name || 'My Store'}
          />
        </div>
        <main className="flex-1 w-full px-2 sm:px-4 py-4 pb-32 lg:pb-6 overflow-x-hidden">
          {renderDashboardContent()}
          {/* Add Product Form Modal */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <EnhancedAddProductForm 
                onClose={() => setShowAddForm(false)}
                onSuccess={() => {
                  fetchProducts();
                  fetchStoreStats();
                }}
                storeCurrency={store?.base_currency || 'USD'}
                onChangeCurrency={() => setActiveSection('settings')}
              />
            </div>
          )}
          {/* Edit Store Details Modal */}
          {showStoreSetup && store && (
            <EnhancedStoreSetupModal
              onClose={() => {
                setShowStoreSetup(false);
                window.location.href = '/feed';
              }}
              onSuccess={handleStoreSetupSuccess}
              initialStep={1}
              store={store}
            />
          )}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default MyStore;
