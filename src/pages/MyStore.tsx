import { useState, useEffect } from 'react';
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
  store_id: string;
  user_id?: string;
  // optional sale/deal fields
  is_on_sale?: boolean;
  sale_price?: number | null;
  sale_starts?: string | null;
  sale_ends?: string | null;
  is_deals_of_day?: boolean;
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
  const [saving, setSaving] = useState(false);
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
      setLoading(true);
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalized = (data || []).map((p: any) => ({ ...p, store_id: p.store_id || store.id }));
      console.debug('[MyStore] fetchProducts returned rows:', normalized.map((r: any) => ({ id: r.id, title: r.title, price: r.price, user_id: r.user_id, updated_at: r.updated_at })));
      setProducts(normalized);
      return normalized as Product[];
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

  const handleEditProduct = (product: Product) => {
    console.debug('[MyStore] Edit product clicked:', { product });
    setEditProduct(product);
    setShowEditModal(true);
  };

  const handleSaveEditProduct = async (updatedProduct: Product) => {
    try {
      setSaving(true);
      
      // Prepare complete payload with all necessary fields
      const payload: any = {
        title: updatedProduct.title.trim(),
        description: updatedProduct.description.trim(),
        price: Number(updatedProduct.price || 0),
        category: updatedProduct.category?.trim() || '',
        product_type: updatedProduct.product_type?.trim() || 'physical',
        tags: updatedProduct.tags || [],
        images: updatedProduct.images || [],
        files: updatedProduct.files || [],
        is_active: updatedProduct.is_active ?? true,
        updated_at: new Date().toISOString()
      };
      // Preserve sale/deal flags when updating
      if (typeof (updatedProduct as any).is_on_sale !== 'undefined') payload.is_on_sale = !!(updatedProduct as any).is_on_sale;
      if (typeof (updatedProduct as any).is_deals_of_day !== 'undefined') payload.is_deals_of_day = !!(updatedProduct as any).is_deals_of_day;

      console.debug('[MyStore] Updating product - preflight:', { 
        productId: updatedProduct.id, 
        payload,
        userId: user?.id,
        original: products.find(p => p.id === updatedProduct.id)
      });

      // Request the updated row back from Supabase so we can verify DB changes
      let updatedRow = null;
      let error = null as any;

      try {
        const res = await supabase
          .from('store_products')
          .update(payload)
          .eq('id', updatedProduct.id)
          .select()
          .maybeSingle();
        updatedRow = (res as any).data;
        error = (res as any).error;
      } catch (err) {
        // supabase client shouldn't throw here, but capture just in case
        console.error('[MyStore] Unexpected exception from supabase.update():', err);
        error = err;
      }

      console.debug('[MyStore] Supabase update response (attempt 1):', { updatedRow, error });

      // If PostgREST returns 406 Not Acceptable when trying to return the updated row
      // (some deployments reject the representation Accept header), retry the update without select()
      const is406 = error && (((error as any)?.status === 406) || ((error as any)?.code === '406') || ((error as any)?.message || '').toLowerCase().includes('not acceptable'));
      if (is406) {
        console.warn('[MyStore] Update returned 406; retrying update without select() to avoid content-negotiation issues');
        const retryRes = await supabase
          .from('store_products')
          .update(payload)
          .eq('id', updatedProduct.id);
        if ((retryRes as any).error) {
          console.error('[MyStore] Retry update error:', (retryRes as any).error);
          const errMsg = (retryRes as any).error.message || JSON.stringify((retryRes as any).error);
          toast({ title: 'Error', description: `Failed to update product: ${errMsg}`, variant: 'destructive' });
          return;
        }

        // After successful retry without select, fetch the authoritative row
        const fetchRes = await supabase
          .from('store_products')
          .select('*')
          .eq('id', updatedProduct.id)
          .maybeSingle();
        updatedRow = (fetchRes as any).data;
        error = (fetchRes as any).error;
      }

      if (error) {
        console.error('[MyStore] Update product error:', error);
        const errMsg = error?.message || (error as any)?.details || JSON.stringify(error);
        toast({ title: 'Error', description: `Failed to update product: ${errMsg}`, variant: 'destructive' });
        return;
      }

      // Update local state with authoritative row returned by the DB
      if (updatedRow) {
        setProducts(prev => prev.map(p => p.id === updatedRow.id ? { ...p, ...updatedRow } as Product : p));
      }

      // Refresh stats and product list to ensure UI reflects DB
      await fetchStoreStats();
      const latest = await fetchProducts();

      // Check whether the authoritative row contains our changes and log mismatch if not
      const found = latest?.find(p => p.id === updatedProduct.id);
      console.debug('[MyStore] authoritative row after update:', found);
      if (found && updatedRow) {
        // compare key fields we expect to change
        const mismatch = (found.title !== (updatedRow.title || payload.title)) || (Number(found.price) !== Number(payload.price));
        if (mismatch) {
          console.warn('[MyStore] MISMATCH: DB row does not reflect updated values', { found, updatedRow, payload });
          toast({ title: 'Warning', description: 'Update appears saved but DB row still shows old values (check console)', variant: 'default' });
        }
      }

      toast({ title: 'Success', description: 'Product updated successfully' });
      setShowEditModal(false);
      
    } catch (error) {
      console.error('[MyStore] Unexpected error saving product:', error);
      toast({ 
        title: 'Error', 
        description: 'An unexpected error occurred while updating the product',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      console.debug('[MyStore] Deleting product id:', productId, { userId: user?.id });
      // Try to delete and request deleted rows back; some servers return 406 when requesting a representation
      let deleteRes: any = null;
      try {
        deleteRes = await supabase
          .from('store_products')
          .delete()
          .eq('id', productId)
          .select();
      } catch (err) {
        console.error('[MyStore] Unexpected exception from supabase.delete():', err);
        deleteRes = { error: err };
      }

      console.debug('[MyStore] delete response (attempt 1):', deleteRes);

      // If we get a 406 (Not Acceptable) retry without select()
      const delErr = deleteRes?.error;
      const is406 = delErr && (((delErr as any)?.status === 406) || ((delErr as any)?.code === '406') || ((delErr as any)?.message || '').toLowerCase().includes('not acceptable'));
      if (is406) {
        console.warn('[MyStore] Delete returned 406; retrying delete without select()');
        const retry = await supabase
          .from('store_products')
          .delete()
          .eq('id', productId);
        if (retry?.error) {
          console.error('[MyStore] Retry delete error:', retry.error);
          toast({ title: 'Error', description: `Failed to delete product: ${retry.error.message || JSON.stringify(retry.error)}`, variant: 'destructive' });
          return;
        }
      } else if (delErr) {
        console.error('[MyStore] Delete product error:', delErr);
        toast({ title: 'Error', description: `Failed to delete product: ${delErr.message || JSON.stringify(delErr)}`, variant: 'destructive' });
        return;
      }

      // Re-fetch authoritative list to ensure deletion persisted
      await fetchStoreStats();
      const latest = await fetchProducts();
      const stillThere = latest?.some(p => p.id === productId);
      if (stillThere) {
        console.warn('[MyStore] Deletion appeared successful but row still exists in DB', { productId });
        toast({ title: 'Warning', description: 'Deletion may have failed; check console for details', variant: 'destructive' });
      } else {
        // Update local state
        setProducts(prev => prev.filter(p => p.id !== productId));
        toast({ title: 'Success', description: 'Product deleted successfully' });
      }
    } catch (error) {
      console.error('[MyStore] Unexpected delete error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to delete product', 
        variant: 'destructive' 
      });
    }
  };

  const handleInspectProduct = async (productId: string) => {
    try {
      console.debug('[MyStore] Inspecting product id:', productId);
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();
      console.debug('[MyStore] inspect result:', { data, error });
      if (error) {
        toast({ title: 'Error', description: `Failed to fetch product: ${error.message}`, variant: 'destructive' });
      } else {
        toast({ title: 'Info', description: 'Product row printed to console', variant: 'default' });
      }
    } catch (err) {
      console.error('[MyStore] unexpected inspect error:', err);
      toast({ title: 'Error', description: 'Failed to inspect product', variant: 'destructive' });
    }
  };

  const handleStoreSetupSuccess = () => {
    // Add a short delay to allow DB propagation before checking again
    setTimeout(() => {
      checkStoreExists();
    }, 1200);
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
              onInspectProduct={handleInspectProduct}
            />
            {/* Edit Product Modal */}
            <EditProductModal
              open={showEditModal}
              product={editProduct}
              onClose={() => setShowEditModal(false)}
              onSave={handleSaveEditProduct}
              isSaving={saving}
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
          <div className="text-gray-600 dark:text-gray-400">Loading your store...</div>
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