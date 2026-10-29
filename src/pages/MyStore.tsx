import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { EditProductModal } from '@/components/EditProductModal';
import { MobileStoreNav } from '@/components/store/MobileStoreNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { EnhancedStoreSetupModal } from '@/components/EnhancedStoreSetupModal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  Package,
  ShoppingCart,
  Eye,
  TrendingUp,
  Users,
  CreditCard,
  Settings,
  FileText,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  Pencil,
  Tag,
  MessageCircle,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader = ({
  title,
  subtitle,
  action,
  icon: Icon,
  accent = 'blue',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
  accent?: 'blue' | 'purple' | 'emerald' | 'amber' | 'violet';
}) => {
  const accents = {
    blue: 'from-blue-500/15 to-cyan-500/10 ring-blue-500/20 text-blue-600 dark:text-blue-400',
    purple: 'from-purple-500/15 to-fuchsia-500/10 ring-purple-500/20 text-purple-600 dark:text-purple-400',
    emerald: 'from-emerald-500/15 to-teal-500/10 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber: 'from-amber-500/15 to-orange-500/10 ring-amber-500/20 text-amber-600 dark:text-amber-400',
    violet: 'from-violet-500/15 to-purple-500/10 ring-violet-500/20 text-violet-600 dark:text-violet-400',
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1', accents[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({
  title,
  value,
  change,
  positive,
  icon: Icon,
  gradient,
  delay = 0,
}: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ElementType;
  gradient: string;
  delay?: number;
}) => (
  <Card
    className="group relative overflow-hidden border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/60 p-4 md:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/5 dark:hover:shadow-black/40 animate-in fade-in slide-in-from-bottom-2"
    style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">
          {title}
        </p>
        <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white truncate">
          {value}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full',
              positive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400',
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {change}
          </span>
          <span className="text-[11px] text-gray-400 hidden sm:inline">vs last month</span>
        </div>
      </div>
      <div
        className={cn(
          'shrink-0 h-10 w-10 md:h-11 md:w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-md transition-transform duration-300 group-hover:scale-105',
          gradient,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);

// ─── Main component ───────────────────────────────────────────────────────────

const MyStore = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
    conversionRate: 0,
  });
  const [showStoreSetup, setShowStoreSetup] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (user) checkStoreExists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (store) {
      fetchProducts();
      fetchStoreStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  useEffect(() => {
    const section = new URLSearchParams(location.search).get('section');
    if (section === 'orders') setActiveSection('orders');
  }, [location.search]);

  useEffect(() => {
    const shouldOpenAddProduct = (location.state as { openAddProduct?: boolean } | null)?.openAddProduct;
    if (!store || !shouldOpenAddProduct) return;

    setActiveSection('products');
    setShowAddForm(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, store]);

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
      await new Promise((res) => setTimeout(res, delay));
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
        title: 'Error',
        description: 'Failed to load products',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  };

  const fetchStoreStats = async () => {
    if (!user || !store) return;
    try {
      const { count: productCount, error: productsError } = await supabase
        .from('store_products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id);

      if (productsError) throw productsError;
      const totalProductCount = productCount || 0;

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, status, customer_email')
        .eq('store_id', store.id);

      if (ordersError) console.error('Error fetching store orders for stats:', ordersError);
      const storeOrders = ordersError ? [] : orders || [];

      const totalRevenue =
        storeOrders.reduce(
          (sum, order) => (order.status === 'completed' ? sum + Number(order.total_amount) : sum),
          0,
        ) || 0;

      const totalSales = storeOrders.filter((order) => order.status === 'completed').length || 0;
      const uniqueCustomers = new Set(
        storeOrders.map((order) => order.customer_email).filter(Boolean),
      ).size;
      const totalViews = totalProductCount * 50;
      const conversionRate = totalViews > 0 ? Math.round((totalSales / totalViews) * 100) : 0;

      setStats({
        totalRevenue,
        totalProducts: totalProductCount,
        totalSales,
        totalViews,
        totalCustomers: uniqueCustomers,
        conversionRate,
      });
    } catch (error) {
      console.error('Error fetching store stats:', error);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditProduct(product);
    setShowEditModal(true);
  };

  const handleAddSale = (product: Product) => {
    setEditProduct({ ...product, is_on_sale: true });
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
        updated_at: new Date().toISOString(),
      };
      if (typeof (updatedProduct as any).is_on_sale !== 'undefined')
        payload.is_on_sale = !!(updatedProduct as any).is_on_sale;
      if ('sale_price' in updatedProduct)
        payload.sale_price = updatedProduct.sale_price == null ? null : Number(updatedProduct.sale_price);
      if ('sale_starts' in updatedProduct)
        payload.sale_starts = updatedProduct.sale_starts ? new Date(updatedProduct.sale_starts).toISOString() : null;
      if ('sale_ends' in updatedProduct)
        payload.sale_ends = updatedProduct.sale_ends ? new Date(updatedProduct.sale_ends).toISOString() : null;
      if (typeof (updatedProduct as any).is_deals_of_day !== 'undefined')
        payload.is_deals_of_day = !!(updatedProduct as any).is_deals_of_day;

      const res = await supabase
        .from('store_products')
        .update(payload)
        .eq('id', updatedProduct.id)
        .select()
        .maybeSingle();

      if (res.error) {
        console.error('[MyStore] Update product error:', res.error);
        toast({
          title: 'Error',
          description: `Failed to update product: ${res.error.message}`,
          variant: 'destructive',
        });
        return;
      }
      if (res.data) {
        setProducts((prev) =>
          prev.map((p) => (p.id === res.data.id ? ({ ...p, ...res.data } as Product) : p)),
        );
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
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase.from('store_products').delete().eq('id', productId);
      if (error) {
        console.error('[MyStore] Delete product error:', error);
        toast({
          title: 'Error',
          description: `Failed to delete product: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }
      await fetchStoreStats();
      await fetchProducts();
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      toast({ title: 'Success', description: 'Product deleted successfully' });
    } catch (error) {
      console.error('[MyStore] Unexpected delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    }
  };

  const handleStoreSetupSuccess = () => {
    setTimeout(() => checkStoreExists(), 1200);
  };

  const currency = store?.base_currency || 'ZAR';

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  const ModernDashboard = () => {
    const statCards = [
      {
        title: 'Total Revenue',
        value: `${currency} ${stats.totalRevenue.toLocaleString()}`,
        change: '+12.5%',
        positive: true,
        icon: TrendingUp,
        gradient: 'from-emerald-500 to-green-600',
      },
      {
        title: 'Total Products',
        value: stats.totalProducts.toString(),
        change: '+3',
        positive: true,
        icon: Package,
        gradient: 'from-blue-500 to-cyan-600',
      },
      {
        title: 'Total Sales',
        value: stats.totalSales.toString(),
        change: '+8.2%',
        positive: true,
        icon: ShoppingCart,
        gradient: 'from-violet-500 to-purple-600',
      },
      {
        title: 'Store Views',
        value: stats.totalViews.toLocaleString(),
        change: '+24.1%',
        positive: true,
        icon: Eye,
        gradient: 'from-amber-500 to-orange-600',
      },
      {
        title: 'Customers',
        value: stats.totalCustomers.toString(),
        change: '+15',
        positive: true,
        icon: Users,
        gradient: 'from-rose-500 to-pink-600',
      },
      {
        title: 'Conversion Rate',
        value: `${stats.conversionRate}%`,
        change: '+2.3%',
        positive: true,
        icon: BarChart3,
        gradient: 'from-indigo-500 to-blue-600',
      },
    ];

    const quickActions = [
      {
        title: 'Add Product',
        description: 'Create new listing',
        icon: Package,
        action: () => setShowAddForm(true),
        gradient: 'from-blue-500 to-cyan-500',
      },
      {
        title: 'View Orders',
        description: 'Manage customer orders',
        icon: ShoppingCart,
        action: () => setActiveSection('orders'),
        gradient: 'from-violet-500 to-purple-500',
      },
      {
        title: 'Analytics',
        description: 'View sales reports',
        icon: BarChart3,
        action: () => setActiveSection('reports'),
        gradient: 'from-emerald-500 to-green-500',
      },
      {
        title: 'Store Settings',
        description: 'Update store details',
        icon: Settings,
        action: () => setActiveSection('settings'),
        gradient: 'from-orange-500 to-amber-500',
      },
    ];

    return (
      <div className="space-y-6 md:space-y-8">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-gradient-to-br from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 p-5 sm:p-6 md:p-8">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-14 w-14 md:h-16 md:w-16 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
                {store?.logo_url ? (
                  <img src={store.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <StoreIcon className="h-7 w-7 md:h-8 md:w-8 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
                    {store?.store_name || 'My Store'}
                  </h1>
                  {store?.verification_status === 'verified' && (
                    <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-300 border-0">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {store?.description || 'Manage your store, products, and orders.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="px-3 py-1.5 text-xs font-medium bg-white/60 dark:bg-gray-900/60 backdrop-blur"
              >
                {store?.store_category || 'General'}
              </Badge>
              <Button
                onClick={() => setShowAddForm(true)}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/20 h-10"
              >
                <Plus className="h-4 w-4" />
                New Product
              </Button>
            </div>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {statCards.map((stat, i) => (
            <StatCard key={stat.title} {...stat} delay={i * 40} />
          ))}
        </div>

        {/* Quick actions + recent products */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="lg:col-span-2 border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/60 p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                  Quick Actions
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Shortcuts to common tasks
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.title}
                    onClick={action.action}
                    className="group relative overflow-hidden rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/40 p-4 text-left transition-all duration-300 hover:border-transparent hover:shadow-lg hover:shadow-gray-900/5 dark:hover:shadow-black/40"
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shadow-md mb-3 transition-transform duration-300 group-hover:scale-110',
                        action.gradient,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {action.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {action.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/60 p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                Recent Products
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white gap-1"
                onClick={() => setActiveSection('products')}
              >
                View all
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2">
              {products.slice(0, 4).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                  onClick={() => handleEditProduct(product)}
                >
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center overflow-hidden">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(product.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white shrink-0 tabular-nums">
                    {currency} {product.price}
                  </span>
                </div>
              ))}
              {products.length === 0 && (
                <div className="text-center py-6">
                  <Package className="h-8 w-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">No products yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1.5"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Add Product
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Performance */}
        <Card className="border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/60 p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                Store Performance
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Key metrics at a glance
              </p>
            </div>
            <Tabs defaultValue="month" className="w-auto">
              <TabsList className="bg-gray-100 dark:bg-gray-800 h-9">
                <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Avg. Order Value
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                      {stats.totalSales > 0
                        ? `${currency} ${Math.round(stats.totalRevenue / stats.totalSales)}`
                        : `${currency} 0`}
                    </p>
                  </div>
                  <CreditCard className="h-7 w-7 text-blue-500" />
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-green-500/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Best Selling
                    </p>
                    <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mt-1 truncate">
                      {products[0]?.title || 'No products yet'}
                    </p>
                  </div>
                  <TrendingUp className="h-7 w-7 text-emerald-500 shrink-0" />
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="h-48 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sales chart</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Connect analytics to visualize
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════

  const ModernProductsSection = () => (
    <div className="space-y-6">
      <SectionHeader
        icon={Package}
        accent="blue"
        title="Products"
        subtitle={`${products.length} ${products.length === 1 ? 'item' : 'items'} in your inventory`}
        action={
          <Button
            onClick={() => setShowAddForm(true)}
            className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/20 h-10"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        }
      />

      {products.length === 0 && !loading ? (
        <Card className="border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-12 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No products yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Start selling by adding your first product to the store.
          </p>
          <Button
            onClick={() => setShowAddForm(true)}
            className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="h-4 w-4" />
            Add Your First Product
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product, i) => (
            <Card
              key={product.id}
              className="group overflow-hidden border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-900/5 dark:hover:shadow-black/40 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}
            >
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-12 w-12 text-gray-300 dark:text-gray-700" />
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 flex gap-1.5 flex-wrap max-w-[80%]">
                  <Badge
                    className={cn(
                      'border-0 text-[10px] font-medium backdrop-blur',
                      product.is_active
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-gray-500/90 text-white',
                    )}
                  >
                    {product.is_active ? 'Active' : 'Draft'}
                  </Badge>
                  {product.is_on_sale && (
                    <Badge className="border-0 text-[10px] font-medium bg-gradient-to-r from-pink-500 to-rose-500 text-white">
                      Sale
                    </Badge>
                  )}
                  {product.is_deals_of_day && (
                    <Badge className="border-0 text-[10px] font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      Deal
                    </Badge>
                  )}
                </div>
              </div>

              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                  {product.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 mt-1 h-8">
                  {product.description || 'No description'}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
                    {currency} {product.price}
                  </span>
                  {product.tags.length > 0 && (
                    <div className="flex gap-1">
                      {product.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                      {product.tags.length > 2 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          +{product.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 h-9"
                    onClick={() => handleEditProduct(product)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    title={product.is_on_sale ? 'Edit sale' : 'Add sale'}
                    aria-label={
                      product.is_on_sale
                        ? `Edit sale for ${product.title}`
                        : `Add sale for ${product.title}`
                    }
                    onClick={() => handleAddSale(product)}
                  >
                    <Tag className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT ROUTER
  // ═══════════════════════════════════════════════════════════════════════════

  const renderDashboardContent = () => {
    if (isInitialLoading) {
      return (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/60 p-6 md:p-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="flex-1">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {[...Array(6)].map((_, i) => (
              <Card
                key={i}
                className="p-4 md:p-5 dark:bg-gray-900/60 border border-gray-200/70 dark:border-gray-800/70"
              >
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-7 w-28 mb-3" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </Card>
            ))}
          </div>
          <Card className="p-5 md:p-6 dark:bg-gray-900/60 border border-gray-200/70 dark:border-gray-800/70">
            <Skeleton className="h-5 w-32 mb-5" />
            <div className="grid grid-cols-2 gap-3 md:gap-4">
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
          <div className="space-y-6">
            <SectionHeader
              icon={MessageCircle}
              accent="violet"
              title="Customer Chat"
              subtitle="Communicate with your customers"
            />
            <ChatBoard />
          </div>
        );

      case 'orders':
        return (
          <div className="space-y-6">
            <SectionHeader
              icon={ShoppingCart}
              accent="emerald"
              title="Orders"
              subtitle="Manage customer orders"
              action={
                <Button variant="outline" className="gap-2 h-10">
                  <ShoppingCart className="h-4 w-4" />
                  Export Orders
                </Button>
              }
            />
            <ManageOrders storeId={store?.id} storeCurrency={currency} />
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <SectionHeader
              icon={BarChart3}
              accent="blue"
              title="Sales Reports"
              subtitle="Analytics and insights"
              action={
                <Button variant="outline" className="gap-2 h-10">
                  <FileText className="h-4 w-4" />
                  Download Report
                </Button>
              }
            />
            <SalesReports storeId={store?.id} storeCurrency={currency} />
          </div>
        );

      case 'wallet':
        return (
          <div className="space-y-6">
            <SectionHeader
              icon={Wallet}
              accent="amber"
              title="Store Wallet"
              subtitle="Manage your earnings"
              action={
                <Button variant="outline" className="gap-2 h-10">
                  <Wallet className="h-4 w-4" />
                  Withdraw Funds
                </Button>
              }
            />
            <StoreWallet
              storeId={store?.id}
              storeCurrency={currency}
              storeName={store?.store_name || 'My Store'}
            />
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <SectionHeader
              icon={Settings}
              accent="violet"
              title="Store Settings"
              subtitle="Customize your store"
            />
            <StoreSettings store={store} onStoreUpdate={setStore} />
          </div>
        );

      default:
        return (
          <Card className="p-8 text-center border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/60">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Coming Soon
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This section is under development
            </p>
          </Card>
        );
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors overflow-x-hidden">
        <Header />
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="relative mx-auto mb-4 h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-800" />
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading your store…</p>
          </div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors overflow-x-hidden">
      <Header />

      <MobileStoreNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        storeName={store?.store_name || 'My Store'}
      />

      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop nav */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <StoreNavigation
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              storeName={store?.store_name || 'My Store'}
            />
          </div>
        </aside>

        <main className="flex-1 w-full min-w-0 pb-32 lg:pb-6">
          {renderDashboardContent()}

          {showAddForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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