import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  DollarSign,
  User,
  Calendar,
  ExternalLink,
  AlertCircle,
  Clock,
  Shield
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// Types
type WithdrawalStatus = 'pending' | 'approved' | 'declined' | 'processing' | 'completed' | 'failed';

type Withdrawal = {
  id: string;
  user_id: string;
  user_email?: string;
  amount: number;
  amount_usd?: number;
  amountUsd?: number;
  method: string;
  status: WithdrawalStatus;
  created_at: string;
  updated_at: string;
  notes?: string;
  transaction_reference?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
};

const WithdrawalsPage = () => {
  // State
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | 'all'>('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notes, setNotes] = useState('');

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const { data: withdrawalsData, error } = await supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user details for withdrawals
      const enrichedWithdrawals = await enrichWithdrawalsWithUsers(withdrawalsData || []);
      setWithdrawals(enrichedWithdrawals);
      
      toast.success('Withdrawals loaded successfully');
    } catch (error: any) {
      console.error('Failed to load withdrawals', error);
      // If the table does not exist, show a friendly message instead of repeated errors
      const isMissing = (error && (String(error.code) === '42P01' || String(error.message || '').includes('does not exist')));
      if (isMissing) {
        setTableMissing(true);
        setWithdrawals([]);
        toast.warning('Withdrawals table not present in the database');
      } else {
        toast.error('Failed to load withdrawals');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Enrich withdrawals with user data
  const enrichWithdrawalsWithUsers = async (withdrawals: any[]): Promise<Withdrawal[]> => {
    const userIds = [...new Set(withdrawals.map(w => w.user_id).filter(Boolean))];
    
    if (userIds.length === 0) return withdrawals;

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    if (error) {
      console.error('Failed to fetch users', error);
      return withdrawals;
    }

    const usersMap: Record<string, any> = {};
    (users || []).forEach((user: any) => {
      usersMap[user.id] = user;
    });

    return withdrawals.map(withdrawal => ({
      ...withdrawal,
      user: usersMap[String(withdrawal.user_id)] || null
    }));
  };

  // Update withdrawal status
  const updateWithdrawalStatus = async (withdrawalId: string, status: WithdrawalStatus, notes?: string) => {
    setUpdatingStatus(true);
    try {
      const updateData: any = { 
        status, 
        updated_at: new Date().toISOString() 
      };
      
      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('withdrawals')
        .update(updateData)
        .eq('id', withdrawalId);

      if (error) throw error;

      // Update local state
      setWithdrawals(prev => prev.map(w => 
        w.id === withdrawalId ? { ...w, status, ...(notes && { notes }) } : w
      ));

      toast.success(`Withdrawal ${status} successfully`);
      setUpdateDialogOpen(false);
      setNotes('');
    } catch (error) {
      console.error('Update status failed', error);
      toast.error('Failed to update withdrawal status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Bulk approve/decline
  const handleBulkAction = async (status: WithdrawalStatus) => {
    const pendingWithdrawals = filteredWithdrawals.filter(w => w.status === 'pending');
    
    if (pendingWithdrawals.length === 0) {
      toast.info(`No pending withdrawals to ${status}`);
      return;
    }

    if (!confirm(`${status === 'approved' ? 'Approve' : 'Decline'} ${pendingWithdrawals.length} pending withdrawal(s)?`)) {
      return;
    }

    try {
      for (const withdrawal of pendingWithdrawals) {
        await updateWithdrawalStatus(withdrawal.id, status, `Bulk ${status}`);
      }
      toast.success(`${pendingWithdrawals.length} withdrawal(s) ${status}`);
    } catch (error) {
      console.error('Bulk action failed', error);
      toast.error('Failed to process bulk action');
    }
  };

  // Open update dialog
  const openUpdateDialog = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setNotes(withdrawal.notes || '');
    setUpdateDialogOpen(true);
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: WithdrawalStatus) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'default';
      case 'pending':
      case 'processing':
        return 'secondary';
      case 'declined':
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Get status icon
  const getStatusIcon = (status: WithdrawalStatus) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'processing':
        return <AlertCircle className="h-4 w-4" />;
      case 'declined':
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter(withdrawal => {
    const matchesSearch = searchQuery === '' ||
      withdrawal.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      withdrawal.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      withdrawal.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      withdrawal.transaction_reference?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || withdrawal.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Effects
  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Withdrawal Requests</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage and process user withdrawal requests
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchWithdrawals} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, email, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('approved')}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Bulk Approve Pending
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('declined')}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Bulk Decline Pending
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawals Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tableMissing ? (
            <div className="p-6 text-sm text-muted-foreground">
              Withdrawals table not found in the database. No withdrawal requests are available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID / Reference</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No withdrawals found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-mono text-xs text-muted-foreground">
                              {withdrawal.id.slice(0, 8)}...
                            </p>
                            {withdrawal.transaction_reference && (
                              <p className="text-xs">
                                Ref: {withdrawal.transaction_reference}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{withdrawal.user?.email || withdrawal.user_email || 'Unknown'}</span>
                            </div>
                            {withdrawal.account_name && (
                              <p className="text-xs text-muted-foreground">
                                {withdrawal.account_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {(() => {
                              const amt = withdrawal.amount ?? (withdrawal.amount_usd as any) ?? (withdrawal.amountUsd as any) ?? 0;
                              return formatCurrency(Number(amt));
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="capitalize">{withdrawal.method || 'Unknown'}</span>
                            {withdrawal.bank_name && (
                              <p className="text-xs text-muted-foreground">
                                {withdrawal.bank_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(withdrawal.status)} className="gap-1">
                            {getStatusIcon(withdrawal.status)}
                            <span className="capitalize">{withdrawal.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatDate(withdrawal.created_at)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openUpdateDialog(withdrawal)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {withdrawal.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => updateWithdrawalStatus(withdrawal.id, 'approved')}
                                  className="gap-1"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateWithdrawalStatus(withdrawal.id, 'declined')}
                                  className="gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Decline
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedWithdrawal && (
            <>
              <DialogHeader>
                <DialogTitle>Withdrawal Details</DialogTitle>
                <DialogDescription>
                  ID: {selectedWithdrawal.id}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">User</h4>
                    <p>{selectedWithdrawal.user?.email || selectedWithdrawal.user_email || 'Unknown'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Amount</h4>
                    <p className="font-bold">{formatCurrency(selectedWithdrawal.amount)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Method</h4>
                    <p className="capitalize">{selectedWithdrawal.method || 'Unknown'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                    <Badge variant={getStatusBadgeVariant(selectedWithdrawal.status)}>
                      <span className="capitalize">{selectedWithdrawal.status}</span>
                    </Badge>
                  </div>
                </div>

                {/* Bank Details */}
                {(selectedWithdrawal.bank_name || selectedWithdrawal.account_number || selectedWithdrawal.account_name) && (
                  <div className="border rounded-lg p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Bank Details</h4>
                    <div className="space-y-2">
                      {selectedWithdrawal.bank_name && (
                        <div className="flex justify-between">
                          <span className="text-sm">Bank:</span>
                          <span className="text-sm font-medium">{selectedWithdrawal.bank_name}</span>
                        </div>
                      )}
                      {selectedWithdrawal.account_name && (
                        <div className="flex justify-between">
                          <span className="text-sm">Account Name:</span>
                          <span className="text-sm font-medium">{selectedWithdrawal.account_name}</span>
                        </div>
                      )}
                      {selectedWithdrawal.account_number && (
                        <div className="flex justify-between">
                          <span className="text-sm">Account Number:</span>
                          <span className="text-sm font-mono font-medium">{selectedWithdrawal.account_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Timeline</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Requested:</span>
                      <span className="text-sm">{formatDate(selectedWithdrawal.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Last Updated:</span>
                      <span className="text-sm">{formatDate(selectedWithdrawal.updated_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Notes</h4>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[100px] p-3 border rounded-md"
                    placeholder="Add notes about this withdrawal..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setUpdateDialogOpen(false)}
                    disabled={updatingStatus}
                  >
                    Cancel
                  </Button>
                  {selectedWithdrawal.status !== 'approved' && (
                    <Button
                      variant="default"
                      onClick={() => updateWithdrawalStatus(selectedWithdrawal.id, 'approved', notes)}
                      disabled={updatingStatus}
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </Button>
                  )}
                  {selectedWithdrawal.status !== 'declined' && (
                    <Button
                      variant="destructive"
                      onClick={() => updateWithdrawalStatus(selectedWithdrawal.id, 'declined', notes)}
                      disabled={updatingStatus}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </Button>
                  )}
                  {selectedWithdrawal.status === 'approved' && (
                    <Button
                      variant="default"
                      onClick={() => updateWithdrawalStatus(selectedWithdrawal.id, 'completed', notes)}
                      disabled={updatingStatus}
                      className="gap-2"
                    >
                      Mark as Completed
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WithdrawalsPage;