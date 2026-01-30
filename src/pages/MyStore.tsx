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
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Package, ShoppingCart, Eye, TrendingUp, Users, CreditCard, Settings, MessageSquare, FileText, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  store_id: string;
  user_id?: string;
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
    totalViews: 0,
    totalCustomers: 0,
    conversionRate: 0
  });
  const [showStoreSetup, setShowStoreSetup] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

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
      await new Promise(res => setTimeout(res, delay));
    }
    if (!found) {
      console.log('No store found after retries, redirecting to create store page', lastError);
      window.location.href = '/create-store';
    }
    setStoreLoading(false);
    setIsInitialLoading(false);
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
      setIsInitialLoading(false);
    }
  };

  const fetchStoreStats = async () => {
    if (!user || !store) return;

    try {
      const productCount = products.length;

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, status, customer_email')
        .eq('store_id', store.id);

      if (ordersError) throw ordersError;

      const totalRevenue = orders?.reduce((sum, order) => 
        order.status === 'completed' ? sum + Number(order.total_amount) : sum, 0) || 0;
      
      const totalSales = orders?.filter(order => order.status === 'completed').length || 0;
      const uniqueCustomers = new Set(orders?.map(order => order.customer_email).filter(Boolean)).size;
      const totalViews = productCount * 50;
      const conversionRate = totalViews > 0 ? Math.round((totalSales / totalViews) * 100) : 0;

      setStats({
        totalRevenue,
        totalProducts: productCount,
        totalSales,
        totalViews,
        totalCustomers: uniqueCustomers,
        conversionRate
      });
    } catch (error) {
      console.error('Error fetching store stats:', error);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditProduct(product);
    setShowEditModal(true);
  };

  const handleSaveEditProduct = async (updatedProduct: Product) => {
    try {
      setSaving(true);
      
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

      if (typeof (updatedProduct as any).is_on_sale !== 'undefined') payload.is_on_sale = !!(updatedProduct as any).is_on_sale;
      if (typeof (updatedProduct as any).is_deals_of_day !== 'undefined') payload.is_deals_of_day = !!(updatedProduct as any).is_deals_of_day;

      const res = await supabase
        .from('store_products')
        .update(payload)
        .eq('id', updatedProduct.id)
        .select()
        .maybeSingle();

      if (res.error) {
        console.error('[MyStore] Update product error:', res.error);
        toast({ title: 'Error', description: `Failed to update product: ${res.error.message}`, variant: 'destructive' });
        return;
      }

      if (res.data) {
        setProducts(prev => prev.map(p => p.id === res.data.id ? { ...p, ...res.data } as Product : p));
      }

      await fetchStoreStats();
      await fetchProducts();

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
      const { error } = await supabase
        .from('store_products')
        .delete()
        .eq('id', productId);

      if (error) {
        console.error('[MyStore] Delete product error:', error);
        toast({ title: 'Error', description: `Failed to delete product: ${error.message}`, variant: 'destructive' });
        return;
      }

      await fetchStoreStats();
      await fetchProducts();
      
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast({ title: 'Success', description: 'Product deleted successfully' });
      
    } catch (error) {
      console.error('[MyStore] Unexpected delete error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to delete product', 
        variant: 'destructive' 
      });
    }
  };

  const handleStoreSetupSuccess = () => {
    setTimeout(() => {
      checkStoreExists();
    }, 1200);
  };

  // Modern Dashboard Component
  const ModernDashboard = () => {
    const statCards = [
      {
        title: "Total Revenue",
        value: `${store?.base_currency || 'ZAR'} ${stats.totalRevenue.toLocaleString()}`,
        change: "+12.5%",
        icon: <TrendingUp className="h-5 w-5" />,
        color: "from-green-500 to-emerald-600"
      },
      {
        title: "Total Products",
        value: stats.totalProducts.toString(),
        change: "+3",
        icon: <Package className="h-5 w-5" />,
        color: "from-blue-500 to-cyan-600"
      },
      {
        title: "Total Sales",
        value: stats.totalSales.toString(),
        change: "+8.2%",
        icon: <ShoppingCart className="h-5 w-5" />,
        color: "from-purple-500 to-violet-600"
      },
      {
        title: "Store Views",
        value: stats.totalViews.toLocaleString(),
        change: "+24.1%",
        icon: <Eye className="h-5 w-5" />,
        color: "from-orange-500 to-amber-600"
      },
      {
        title: "Customers",
        value: stats.totalCustomers.toString(),
        change: "+15",
        icon: <Users className="h-5 w-5" />,
        color: "from-pink-500 to-rose-600"
      },
      {
        title: "Conversion Rate",
        value: `${stats.conversionRate}%`,
        change: "+2.3%",
        icon: <BarChart3 className="h-5 w-5" />,
        color: "from-indigo-500 to-blue-600"
      }
    ];

    const quickActions = [
      {
        title: "Add Product",
        description: "Create new product listing",
        icon: <Package className="h-6 w-6" />,
        action: () => setShowAddForm(true),
        color: "bg-gradient-to-br from-blue-500 to-cyan-500"
      },
      {
        title: "View Orders",
        description: "Manage customer orders",
        icon: <ShoppingCart className="h-6 w-6" />,
        action: () => setActiveSection('orders'),
        color: "bg-gradient-to-br from-purple-500 to-violet-500"
      },
      {
        title: "Analytics",
        description: "View sales reports",
        icon: <BarChart3 className="h-6 w-6" />,
        action: () => setActiveSection('reports'),
        color: "bg-gradient-to-br from-green-500 to-emerald-500"
      },
      {
        title: "Store Settings",
        description: "Update store details",
        icon: <Settings className="h-6 w-6" />,
        action: () => setActiveSection('settings'),
        color: "bg-gradient-to-br from-orange-500 to-amber-500"
      }
    ];

    return (
      <div className="space-y-6">
        {/* Store Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {store?.store_name || 'My Store'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Welcome back! Here's what's happening with your store today.
            </p>
          </div>
          <Badge variant="outline" className="px-4 py-2 text-sm">
            {store?.store_category || 'General Store'}
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="p-5 border-0 shadow-sm dark:shadow-none dark:bg-gray-900/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                      {stat.change}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">vs last month</span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                  {stat.icon}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="lg:col-span-2 p-6 border-0 shadow-sm dark:shadow-none dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                Add Product
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  className="group p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 hover:shadow-md dark:hover:shadow-lg text-left"
                >
                  <div className={`${action.color} w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-105 transition-transform`}>
                    {action.icon}
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{action.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{action.description}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6 border-0 shadow-sm dark:shadow-none dark:bg-gray-900/50 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Recent Activity</h3>
            <div className="space-y-4">
              {products.slice(0, 3).map((product) => (
                <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Added {new Date(product.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    ${product.price}
                  </Badge>
                </div>
              ))}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => setActiveSection('products')}
            >
              View All Products
            </Button>
          </Card>
        </div>

        {/* Store Performance */}
        <Card className="p-6 border-0 shadow-sm dark:shadow-none dark:bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Store Performance</h3>
            <Tabs defaultValue="month" className="w-auto">
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Order Value</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {stats.totalSales > 0 ? `${store?.base_currency || 'ZAR'} ${Math.round(stats.totalRevenue / stats.totalSales)}` : '0'}
                    </p>
                  </div>
                  <CreditCard className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Best Selling</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1 truncate">
                      {products[0]?.title || 'No products yet'}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">Sales chart will appear here</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Connect your analytics platform</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  // Enhanced Products Section
  const ModernProductsSection = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your product inventory</p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
        >
          <Package className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden border-0 shadow-sm dark:shadow-none dark:bg-gray-900/50 backdrop-blur-sm group hover:shadow-lg transition-all duration-300">
            <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 overflow-hidden">
              {product.images?.[0] ? (
                <img 
                  src={product.images[0]} 
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-12 w-12 text-gray-400" />
                </div>
              )}
              <div className="absolute top-3 right-3">
                <Badge variant={product.is_active ? "default" : "secondary"}>
                  {product.is_active ? 'Active' : 'Draft'}
                </Badge>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">{product.title}</h3>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  ${product.price}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{product.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {product.tags.slice(0, 2).map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {product.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{product.tags.length - 2}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEditProduct(product)}
                >
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDeleteProduct(product.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {products.length === 0 && !loading && (
        <Card className="p-12 text-center border-0 shadow-sm dark:shadow-none dark:bg-gray-900/50 backdrop-blur-sm">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No products yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Start by adding your first product to your store</p>
          <Button 
            onClick={() => setShowAddForm(true)}
            className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            <Package className="h-4 w-4" />
            Add Your First Product
          </Button>
        </Card>
      )}
    </div>
  );

  // Modern Store Sections with enhanced mobile UI
  const renderDashboardContent = () => {
    if (isInitialLoading) {
      return (
        <div className="space-y-6">
          {/* Skeleton Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>

          {/* Skeleton Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-5 dark:bg-gray-900/50">
                <div className="flex items-start justify-between">
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
              </Card>
            ))}
          </div>

          {/* Skeleton Quick Actions */}
          <Card className="p-6 dark:bg-gray-900/50">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </Card>
        </div>
      );
    }

    switch (activeSection) {
      case 'dashboard':
        return <ModernDashboard />;
      
      case 'products':
        return (
          <>
            <ModernProductsSection />
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
          <div className="w-full">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Chat</h2>
              <p className="text-gray-600 dark:text-gray-400">Communicate with your customers</p>
            </div>
            <ChatBoard />
          </div>
        );

      case 'orders':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage customer orders</p>
              </div>
              <Button variant="outline" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Export Orders
              </Button>
            </div>
            <ManageOrders storeId={store?.id} storeCurrency={store?.base_currency || 'ZAR'} />
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Reports</h2>
                <p className="text-gray-600 dark:text-gray-400">Analytics and insights</p>
              </div>
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Download Report
              </Button>
            </div>
            <SalesReports storeId={store?.id} storeCurrency={store?.base_currency || 'ZAR'} />
          </div>
        );

      case 'wallet':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Store Wallet</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage your earnings</p>
              </div>
              <Button variant="outline" className="gap-2">
                <Wallet className="h-4 w-4" />
                Withdraw Funds
              </Button>
            </div>
            <StoreWallet storeId={store?.id} storeCurrency={store?.base_currency || 'ZAR'} storeName={store?.store_name || 'My Store'} />
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Store Settings</h2>
                <p className="text-gray-600 dark:text-gray-400">Customize your store</p>
              </div>
            </div>
            <StoreSettings store={store} onStoreUpdate={setStore} />
          </div>
        );

      default:
        return (
          <Card className="p-8 text-center border-0 shadow-sm dark:shadow-none dark:bg-gray-900/50 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Coming Soon
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              This section is under development
            </p>
          </Card>
        );
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 transition-colors overflow-x-hidden">
        <Header />
        
        {/* Mobile Navigation */}
        <MobileStoreNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          storeName={store?.store_name || 'My Store'}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {renderDashboardContent()}
        </div>
        
        <MobileBottomNav />
      </div>
    );
  }

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 transition-colors">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-300 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading your store...</p>
          </div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 transition-colors overflow-x-hidden">
      <Header />
      
      {/* Mobile Store Navigation */}
      <MobileStoreNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        storeName={store?.store_name || 'My Store'}
      />
      
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop Store Navigation */}
        <div className="hidden lg:block w-64 px-4 py-6">
          <StoreNavigation
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            storeName={store?.store_name || 'My Store'}
          />
        </div>
        
        <main className="flex-1 w-full py-4 pb-32 lg:pb-6 overflow-x-hidden">
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