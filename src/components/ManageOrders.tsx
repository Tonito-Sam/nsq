import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Package, Eye, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  shipping_address: any;
  customer?: {
    first_name?: string;
    last_name?: string;
    username: string;
  };
  items?: OrderItem[];
  draft_files?: string[];
  final_files?: string[];
  draft_status?: 'pending' | 'submitted' | 'approved' | 'rejected';
  approval_status?: 'pending' | 'approved' | 'rejected';
  completed_at?: string | null;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: {
    title: string;
    images: string[];
  };
}

interface ManageOrdersProps {
  storeId?: string;
  storeCurrency: string;
}

export const ManageOrders: React.FC<ManageOrdersProps> = ({ storeId, storeCurrency }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (storeId) {
      fetchOrders();
    }
  }, [storeId]);

  const fetchOrders = async () => {
    if (!storeId) return;

    try {
      // Get orders for this store
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Get customer and item details for each order
      const ordersWithDetails = await Promise.all(
        (ordersData || []).map(async (order) => {
          // Get customer info
          const { data: customerData } = await supabase
            .from('users')
            .select('first_name, last_name, username')
            .eq('id', order.user_id)
            .single();

          // Get order items
          const { data: itemsData } = await supabase
            .from('order_items')
            .select(`
              *,
              store_products(title, images)
            `)
            .eq('order_id', order.id);

          return {
            ...order,
            customer: customerData || undefined,
            items: itemsData || []
          };
        })
      );

      setOrders(ordersWithDetails);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => 
        prev.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast({
        title: "Success",
        description: "Order status updated successfully"
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-600';
      case 'processing': return 'bg-blue-600';
      case 'shipped': return 'bg-purple-600';
      case 'completed': return 'bg-green-600';
      case 'cancelled': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getCustomerName = (customer: any) => {
    if (customer?.first_name || customer?.last_name) {
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    return customer?.username || 'Unknown Customer';
  };

  if (loading) {
    return (
      <Card className="dark:bg-[#161616] p-8 text-center">
        <div className="text-gray-600 dark:text-gray-400">Loading orders...</div>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="dark:bg-[#161616] p-8 text-center">
        <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Orders Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Orders from customers will appear here when they purchase your products
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manage Orders</h2>

      <Card className="dark:bg-[#161616]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-sm">
                  {order.id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  {getCustomerName(order.customer)}
                </TableCell>
                <TableCell>
                  {order.items?.length || 0} items
                </TableCell>
                <TableCell className="font-semibold">
                  {storeCurrency} {Number(order.total_amount).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(order.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {order.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'processing')}
                      >
                        Process
                      </Button>
                    )}
                    {order.status === 'processing' && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'shipped')}
                      >
                        Ship
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl dark:bg-[#161616] max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Order Details
                </h3>
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedOrder(null)}
                >
                  ×
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Order ID</p>
                    <p className="font-mono text-sm">{selectedOrder.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Customer</p>
                    <p>{getCustomerName(selectedOrder.customer)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge className={getStatusColor(selectedOrder.status)}>
                      {selectedOrder.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="font-semibold">
                      {storeCurrency} {Number(selectedOrder.total_amount).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Order Items</h4>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item) => (
                      <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden">
                          {item.product?.images?.[0] ? (
                            <img 
                              src={item.product.images[0]} 
                              alt={item.product.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-gray-400 m-3" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{item.product?.title}</p>
                          <p className="text-sm text-gray-500">
                            Qty: {item.quantity} × {storeCurrency} {Number(item.unit_price).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {storeCurrency} {Number(item.total_price).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.shipping_address && (
                  <div>
                    <h4 className="font-semibold mb-2">Shipping Address</h4>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {JSON.stringify(selectedOrder.shipping_address, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Service Workflow Section */}
                {selectedOrder.items?.some(item => item.product?.title && item.product?.title.toLowerCase().includes('service')) && (
                  <div className="mt-6 space-y-4">
                    <h4 className="font-semibold mb-2">Service Workflow</h4>
                    {/* Draft Upload Section */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="font-medium mb-2">Draft Work Upload</p>
                      {/* Show draft files if any */}
                      {selectedOrder.draft_files && selectedOrder.draft_files.length > 0 ? (
                        <ul className="mb-2">
                          {selectedOrder.draft_files.map((url, idx) => (
                            <li key={idx}>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Draft File {idx + 1}</a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 mb-2">No draft uploaded yet.</p>
                      )}
                      {/* Upload draft button (provider only, if not approved) */}
                      <Button size="sm" className="mb-2">Upload Draft Work</Button>
                      {/* Approval status */}
                      <p className="text-xs">Draft Status: <span className="font-semibold">{selectedOrder.draft_status || 'pending'}</span></p>
                    </div>
                    {/* Approval actions (customer) */}
                    {selectedOrder.draft_status === 'submitted' && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="default">Approve Draft</Button>
                        <Button size="sm" variant="destructive">Request Changes</Button>
                      </div>
                    )}
                    {/* Final Work Section */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mt-4">
                      <p className="font-medium mb-2">Final Work Upload</p>
                      {selectedOrder.final_files && selectedOrder.final_files.length > 0 ? (
                        <ul className="mb-2">
                          {selectedOrder.final_files.map((url, idx) => (
                            <li key={idx}>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Final File {idx + 1}</a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 mb-2">No final work uploaded yet.</p>
                      )}
                      {/* Upload final button (provider only, if draft approved) */}
                      {selectedOrder.draft_status === 'approved' && (
                        <Button size="sm" className="mb-2">Upload Final Work</Button>
                      )}
                      {/* Mark as completed (provider only, if final uploaded) */}
                      {selectedOrder.final_files && selectedOrder.final_files.length > 0 && (
                        <Button size="sm" variant="default">Mark as Completed</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
