import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, Globe2, Eye, Shield, Ban, Mail, Calendar, MapPin, User as UserIcon, 
  Search, Filter, RefreshCw, CheckCircle, XCircle, AlertTriangle, DollarSign,
  Crown, ShieldCheck, History, ChevronLeft, ChevronRight, Maximize2, Minimize2, Clock
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { supabase } from '../../integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import WorldMap from '../../components/WorldMap';

// Types
type UserPrivilege = 'user' | 'admin' | 'superadmin' | 'suspended' | 'banned';
type UserStatus = 'active' | 'inactive' | 'pending' | 'verified' | 'unverified';

type User = {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  privilege: UserPrivilege;
  verified: boolean; // Email verification status
  email_confirmed_at?: string | null; // When email was confirmed
  country?: string | null;
  currency?: string | null;
  created_at: string;
  updated_at: string;
  bio?: string;
  phone_number?: string;
  birthday?: string;
  store_count?: number;
  product_count?: number;
  order_count?: number;
};

type AdminAction = {
  id: string;
  admin_id: string | null;
  user_id: string;
  action_type: string;
  reason: string | null;
  created_at: string;
  admin_email?: string;
  user_email?: string;
};

type EmailVerificationStatus = {
  user_id: string;
  is_verified: boolean;
  email_confirmed_at: string | null;
};

const UsersPage = () => {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [privilegeFilter, setPrivilegeFilter] = useState<UserPrivilege | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionHistoryDialogOpen, setActionHistoryDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'ban' | 'promote' | 'demote' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [performingAction, setPerformingAction] = useState(false);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'admins' | 'suspended'>('all');

  // Backend URL for email admin operations
  // Default to the local `email-backend` service (port 3001) used in development
  const EMAIL_BACKEND_URL = (import.meta.env.VITE_EMAIL_BACKEND_URL as string) || 'http://localhost:3001';
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // Fetch current user info on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (data) {
            setCurrentUser(data as User);
          }
        }
      } catch (error) {
        console.error('Failed to fetch current user', error);
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Check if current user has admin privileges
  const hasAdminPrivileges = () => {
    return currentUser?.privilege === 'admin' || currentUser?.privilege === 'superadmin';
  };

  // Check if current user has superadmin privileges
  const hasSuperAdminPrivileges = () => {
    return currentUser?.privilege === 'superadmin';
  };

  // Check if user can perform action on target user
  const canPerformAction = (targetUser: User) => {
    if (!currentUser) return false;
    
    // Superadmin can perform any action
    if (currentUser.privilege === 'superadmin') return true;
    
    // Admin can only act on regular users and suspended/banned users
    if (currentUser.privilege === 'admin') {
      return targetUser.privilege === 'user' || 
             targetUser.privilege === 'suspended' || 
             targetUser.privilege === 'banned';
    }
    
    return false;
  };

  // Format country name for display
  const formatCountry = (country: string | null | undefined) => {
    return country || 'Not set';
  };

  // Format currency with USD as default
  const formatCurrency = (currency: string | null | undefined) => {
    return currency || 'USD';
  };

  // Function to fetch email verification status using PostgreSQL function
  const fetchEmailVerificationStatus = async (userIds: string[]): Promise<Record<string, EmailVerificationStatus>> => {
    if (userIds.length === 0) return {};
    
    try {
      // Call the PostgreSQL function for each user (batch would be better but this works)
      const statusPromises = userIds.map(async (userId) => {
        try {
          const { data, error } = await supabase
            .rpc('get_user_email_status', { user_id: userId });
          
          if (error) {
            console.error(`Error fetching email status for user ${userId}:`, error);
            return { user_id: userId, is_verified: false, email_confirmed_at: null };
          }
          
          // RPC may return an object or an array; normalize both
          const payload = Array.isArray(data) ? data[0] : data;
          return {
            user_id: userId,
            is_verified: !!(payload && (payload.is_verified || payload.is_verified === true)),
            email_confirmed_at: payload?.email_confirmed_at || null
          };
        } catch (error) {
          console.error(`Failed to fetch email status for user ${userId}:`, error);
          return { user_id: userId, is_verified: false, email_confirmed_at: null };
        }
      });
      
      const results = await Promise.all(statusPromises);
      
      // Convert to map
      return results.reduce((acc, status) => {
        acc[status.user_id] = status;
        return acc;
      }, {} as Record<string, EmailVerificationStatus>);
    } catch (error) {
      console.error('Failed to fetch email verification statuses:', error);
      return {};
    }
  };

  // Alternative: Direct query to auth.users (requires proper RLS policies)
  const fetchEmailVerificationStatusDirect = async (userIds: string[]): Promise<Record<string, boolean>> => {
    try {
      // Note: This requires the client to have access to auth.users table
      // You might need to create a secure function instead
      const { data, error } = await supabase
        .from('auth.users')
        .select('id, email_confirmed_at')
        .in('id', userIds);
      
      if (error) {
        console.error('Error fetching auth users:', error);
        return {};
      }
      
      return data?.reduce((acc, user) => {
        acc[user.id] = !!user.email_confirmed_at;
        return acc;
      }, {} as Record<string, boolean>) || {};
    } catch (error) {
      console.error('Failed to fetch verification status directly:', error);
      return {};
    }
  };

  // Fetch users with email verification status
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply search filter
      if (searchQuery) {
        query = query.or(`username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%`);
      }

      // Apply privilege filter
      if (privilegeFilter !== 'all') {
        query = query.eq('privilege', privilegeFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const basicUsers = (data || []).map(user => ({
        ...user,
        country: user.country || null,
        currency: formatCurrency(user.currency),
        // Set temporary verified status - will be updated below
        verified: false,
        email_confirmed_at: null
      })) as User[];

      // Fetch email verification status for all users
      const userIds = basicUsers.map(u => u.id);
      const emailStatusMap = await fetchEmailVerificationStatus(userIds);
      
      // Merge email verification status with user data
      const usersWithEmailStatus = basicUsers.map(user => {
        const emailStatus = emailStatusMap[user.id];
        return {
          ...user,
          verified: emailStatus?.is_verified || false,
          email_confirmed_at: emailStatus?.email_confirmed_at || null
        };
      });

      // Fetch additional stats for users
      const enrichedUsers = await enrichUsersWithStats(usersWithEmailStatus);
      setUsers(enrichedUsers);
      console.log('Loaded users (sample):', enrichedUsers.slice(0, 10));
      console.log('Countries present on loaded users:', enrichedUsers.map(u => u.country).filter(Boolean));
      console.log('Country distribution:', (() => {
        const d = (() => {
          const countryCounts: Record<string, number> = {};
          enrichedUsers.forEach(user => {
            if (user.country) {
              countryCounts[user.country] = (countryCounts[user.country] || 0) + 1;
            }
          });
          return Object.entries(countryCounts).map(([country, count]) => ({ country, value: count }));
        })();
        return d;
      })());
      
      toast.success('Users loaded successfully');
    } catch (error) {
      console.error('Failed to fetch users', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, privilegeFilter]);

  // Resend verification email
  const resendVerification = async (email: string, userId?: string) => {
    if (!email) return;
    setPerformingAction(true);
    try {
      const res = await fetch(`${EMAIL_BACKEND_URL}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          user_id: userId,
          admin_request: true 
        })
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        console.error('Resend verification failed', json);
        toast.error(json?.error || 'Failed to resend verification');
      } else {
        toast.success(`Verification email resent to ${email}`);
        // Refresh verification status for this user
        if (userId) {
          const emailStatus = await fetchEmailVerificationStatus([userId]);
          if (emailStatus[userId]) {
            // Update the user in local state
            setUsers(prev => prev.map(user => 
              user.id === userId 
                ? { ...user, 
                    verified: emailStatus[userId].is_verified,
                    email_confirmed_at: emailStatus[userId].email_confirmed_at 
                  } 
                : user
            ));
            
            // Update selected user if open
            if (selectedUser?.id === userId) {
              setSelectedUser(prev => prev ? { 
                ...prev, 
                verified: emailStatus[userId].is_verified,
                email_confirmed_at: emailStatus[userId].email_confirmed_at 
              } : null);
            }
          }
        }
      }
    } catch (err) {
      console.error('Resend verification error', err);
      toast.error('Failed to resend verification email');
    } finally {
      setPerformingAction(false);
    }
  };

  // Resend verification to all unverified users with batching and retry/backoff
  const resendToAllUnverified = async () => {
    if (!confirm('Resend verification emails to all unverified users?')) return;
    const unverified = users.filter(u => !u.verified);
    if (unverified.length === 0) {
      toast('No unverified users found');
      return;
    }
    setPerformingAction(true);
    const batchSize = parseInt((import.meta.env.VITE_RESEND_BATCH_SIZE as string) || '5', 10) || 5;
    const batchDelayMs = 1000; // delay between batches
    let successCount = 0;
    let failCount = 0;

    // Prefer server-side bulk endpoint to avoid client-side rate limits
    try {
      const emails = unverified.map(u => u.email);
      const res = await fetch(`${EMAIL_BACKEND_URL}/resend-verification-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        successCount = json.successCount || (json.results || []).filter((r: any) => r.success).length;
        failCount = json.failCount || (json.results || []).filter((r: any) => !r.success).length;
      } else {
        // fallback to client-side batching if server bulk failed
        console.warn('Server bulk resend failed, falling back to client batches', json);
        for (let i = 0; i < unverified.length; i += batchSize) {
          const batch = unverified.slice(i, i + batchSize);
          await Promise.all(batch.map(async (u) => {
            try {
              const r = await fetch(`${EMAIL_BACKEND_URL}/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: u.email, user_id: u.id, admin_request: true })
              });
              const j = await r.json().catch(() => ({}));
              if (r.ok && j?.success !== false) successCount++;
              else { failCount++; console.warn('Resend failed for', u.email, j); }
            } catch (err) { failCount++; console.error('Resend error for', u.email, err); }
          }));
          if (i + batchSize < unverified.length) await new Promise(r => setTimeout(r, batchDelayMs));
        }
      }
    } catch (err) {
      console.error('Bulk resend error, falling back to client batches', err);
      for (let i = 0; i < unverified.length; i += batchSize) {
        const batch = unverified.slice(i, i + batchSize);
        await Promise.all(batch.map(async (u) => {
          try {
            const r = await fetch(`${EMAIL_BACKEND_URL}/resend-verification`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: u.email, user_id: u.id, admin_request: true })
            });
            const j = await r.json().catch(() => ({}));
            if (r.ok && j?.success !== false) successCount++;
            else { failCount++; console.warn('Resend failed for', u.email, j); }
          } catch (err2) { failCount++; console.error('Resend error for', u.email, err2); }
        }));
        if (i + batchSize < unverified.length) await new Promise(r => setTimeout(r, batchDelayMs));
      }
    }

    setPerformingAction(false);
    toast.success(`Resent to ${successCount} users (${failCount} failed)`);

    // Refresh verification statuses for all previously unverified users
    try {
      const ids = unverified.map(u => u.id);
      const emailStatus = await fetchEmailVerificationStatus(ids);
      setUsers(prev => prev.map(user => ({
        ...user,
        verified: emailStatus[user.id]?.is_verified || user.verified,
        email_confirmed_at: emailStatus[user.id]?.email_confirmed_at || user.email_confirmed_at
      })));
    } catch (err) {
      console.warn('Failed to refresh verification statuses after bulk resend', err);
    }
  };

  // Enrich users with stats
  const enrichUsersWithStats = async (usersList: User[]): Promise<User[]> => {
    const enrichedUsers = [...usersList];
    const userIds = enrichedUsers.map(u => u.id);
    
    if (userIds.length > 0) {
      try {
        // Fetch store counts
        const { data: stores } = await supabase
          .from('user_stores')
          .select('user_id')
          .in('user_id', userIds);

        if (stores) {
          const storeCounts = stores.reduce((acc: Record<string, number>, store) => {
            acc[store.user_id] = (acc[store.user_id] || 0) + 1;
            return acc;
          }, {});

          enrichedUsers.forEach(user => {
            user.store_count = storeCounts[user.id] || 0;
          });
        }
      } catch (error) {
        console.error('Failed to fetch user stats', error);
      }
    }

    return enrichedUsers;
  };

  // Fetch admin actions for a user
  const fetchAdminActions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_actions')
        .select(`
          *,
          admin:users!admin_actions_admin_id_fkey(email),
          target_user:users!admin_actions_user_id_fkey(email)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const actions = (data || []).map(action => ({
        ...action,
        admin_email: action.admin?.email,
        user_email: action.target_user?.email
      })) as AdminAction[];

      setAdminActions(actions);
    } catch (error) {
      console.error('Failed to fetch admin actions', error);
      toast.error('Failed to fetch action history');
    }
  };

  // Log admin action to database
  const logAdminAction = async (userId: string, actionType: string, reason?: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('admin_actions')
        .insert([{
          admin_id: currentUser.id,
          user_id: userId,
          action_type: actionType,
          reason: reason || null,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to log admin action', error);
    }
  };

  // Update user privilege
  const updateUserPrivilege = async (userId: string, privilege: UserPrivilege, reason?: string) => {
    if (!currentUser || !hasAdminPrivileges()) {
      toast.error('Insufficient permissions');
      return;
    }

    setPerformingAction(true);
    try {
      const targetUser = users.find(u => u.id === userId);
      if (!targetUser) {
        toast.error('User not found');
        return;
      }

      // Check permissions
      if (!canPerformAction(targetUser)) {
        toast.error('You do not have permission to perform this action');
        return;
      }

      // Superadmin check for admin promotions
      if (privilege === 'admin' && !hasSuperAdminPrivileges()) {
        toast.error('Only superadmin can promote users to admin');
        return;
      }

      // Admin cannot demote other admins (only superadmin can)
      if (privilege === 'user' && targetUser.privilege === 'admin' && !hasSuperAdminPrivileges()) {
        toast.error('Only superadmin can demote admins');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ 
          privilege,
          updated_at: new Date().toISOString(),
          ...(privilege === 'suspended' && { suspended_at: new Date().toISOString() }),
          ...(privilege === 'banned' && { banned_at: new Date().toISOString() })
        })
        .eq('id', userId);

      if (error) throw error;

      // Log the action
      const actionMap = {
        'suspended': 'suspend',
        'banned': 'ban',
        'admin': 'promote_to_admin',
        'user': 'demote_to_user',
        'superadmin': 'promote_to_superadmin'
      };

      await logAdminAction(userId, actionMap[privilege] || privilege, reason);

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, privilege } : user
      ));

      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, privilege } : null);
      }

      toast.success(`User ${privilege} successfully`);
      setActionDialogOpen(false);
      setActionReason('');
      setActionType(null);
    } catch (error) {
      console.error('Failed to update user privilege', error);
      toast.error('Failed to update user privilege');
    } finally {
      setPerformingAction(false);
    }
  };

  // Open user dialog
  const openUserDialog = (user: User) => {
    setSelectedUser(user);
    setUserDialogOpen(true);
  };

  // Open action dialog
  const openActionDialog = (user: User, type: 'suspend' | 'ban' | 'promote' | 'demote') => {
    if (!hasAdminPrivileges()) {
      toast.error('Insufficient permissions');
      return;
    }

    if (!canPerformAction(user)) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    setSelectedUser(user);
    setActionType(type);
    setActionReason('');
    setActionDialogOpen(true);
  };

  // Open action history dialog
  const openActionHistoryDialog = async (user: User) => {
    setSelectedUser(user);
    await fetchAdminActions(user.id);
    setActionHistoryDialogOpen(true);
  };

  // Get privilege badge variant
  const getPrivilegeBadgeVariant = (privilege: UserPrivilege) => {
    switch (privilege) {
      case 'superadmin':
        return 'destructive';
      case 'admin':
        return 'default';
      case 'suspended':
        return 'secondary';
      case 'banned':
        return 'destructive';
      case 'user':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // Get privilege icon
  const getPrivilegeIcon = (privilege: UserPrivilege) => {
    switch (privilege) {
      case 'superadmin':
        return <Crown className="h-3 w-3" />;
      case 'admin':
        return <ShieldCheck className="h-3 w-3" />;
      default:
        return null;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format date with time
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format email confirmation date
  const formatEmailConfirmationDate = (user: User) => {
    if (user.email_confirmed_at) {
      return formatDateTime(user.email_confirmed_at);
    }
    return 'Not confirmed';
  };

  // Prepare data for WorldMap
  const getCountryDistribution = () => {
    const countryCounts: Record<string, number> = {};
    
    users.forEach(user => {
      if (user.country) {
        const countryName = user.country;
        countryCounts[countryName] = (countryCounts[countryName] || 0) + 1;
      }
    });
    
    return Object.entries(countryCounts).map(([country, count]) => ({
      country,
      value: count
    }));
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchQuery === '' ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.country?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPrivilege = privilegeFilter === 'all' || user.privilege === privilegeFilter;
    
    // Tab filtering
    let matchesTab = true;
    switch (activeTab) {
      case 'users':
        matchesTab = user.privilege === 'user';
        break;
      case 'admins':
        matchesTab = user.privilege === 'admin' || user.privilege === 'superadmin';
        break;
      case 'suspended':
        matchesTab = user.privilege === 'suspended' || user.privilege === 'banned';
        break;
    }
    
    return matchesSearch && matchesPrivilege && matchesTab;
  });

  // Table scroll handlers
  const scrollTable = (direction: 'left' | 'right') => {
    const tableContainer = document.getElementById('users-table-container');
    if (tableContainer) {
      const scrollAmount = 300;
      const newPosition = direction === 'right' 
        ? tableContainer.scrollLeft + scrollAmount
        : tableContainer.scrollLeft - scrollAmount;
      
      tableContainer.scrollTo({
        left: newPosition,
        behavior: 'smooth'
      });
    }
  };

  // Effects
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (!hasAdminPrivileges()) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-500" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <ShieldCheck className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Insufficient Permissions</h3>
              <p className="text-muted-foreground">
                You need admin or superadmin privileges to access this page.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Your current privilege: {currentUser?.privilege || 'user'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">User Management</h1>
          <div className="text-muted-foreground mt-1 text-sm md:text-base">
            <div className="inline">Manage and monitor all platform users</div>
            {currentUser && (
              <span className="ml-2 inline-block align-middle">
                <Badge variant="outline" className="gap-1">
                  {getPrivilegeIcon(currentUser.privilege)}
                  <span className="capitalize">{currentUser.privilege}</span>
                </Badge>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card className="overflow-hidden bg-card card-border shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 py-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="text-xl md:text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              From {getCountryDistribution().length} countries
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-card card-border shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 py-3">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="text-xl md:text-2xl font-bold">
              {users.filter(u => u.privilege === 'admin' || u.privilege === 'superadmin').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {users.filter(u => u.privilege === 'superadmin').length} superadmin
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-card card-border shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 py-3">
            <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="text-xl md:text-2xl font-bold">
              {users.filter(u => u.verified).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {Math.round((users.filter(u => u.verified).length / users.length) * 100) || 0}% verified rate
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-card card-border shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 py-3">
            <CardTitle className="text-sm font-medium">Unverified Users</CardTitle>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <button
                type="button"
                title="Resend verification to all unverified users"
                onClick={resendToAllUnverified}
                className="p-1 rounded hover:bg-muted/50"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="text-xl md:text-2xl font-bold">
              {users.filter(u => !u.verified).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {Math.round((users.filter(u => !u.verified).length / users.length) * 100) || 0}% unverified
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
          <div className="relative">
            <div className="overflow-x-auto pb-2">
              <TabsList className="inline-flex min-w-max">
                <TabsTrigger value="all" className="whitespace-nowrap">All Users ({users.length})</TabsTrigger>
                <TabsTrigger value="users" className="whitespace-nowrap">Regular Users ({users.filter(u => u.privilege === 'user').length})</TabsTrigger>
                <TabsTrigger value="admins" className="whitespace-nowrap">Administrators ({users.filter(u => u.privilege === 'admin' || u.privilege === 'superadmin').length})</TabsTrigger>
                <TabsTrigger value="suspended" className="whitespace-nowrap">Suspended/Banned ({users.filter(u => u.privilege === 'suspended' || u.privilege === 'banned').length})</TabsTrigger>
              </TabsList>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-card card-border shadow-md">
        <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, username, email, or country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full bg-card border-input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={privilegeFilter} onValueChange={(value: any) => setPrivilegeFilter(value)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Privilege" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Privileges</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader className="pb-3 px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg md:text-xl">Users List</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {filteredUsers.length} users found
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsTableExpanded(!isTableExpanded)}
                className="h-8"
              >
                {isTableExpanded ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 mr-1" />
                    Expand
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="relative">
              {/* Scroll Indicators */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none hidden md:block" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none hidden md:block" />
              
              {/* Scroll Buttons */}
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20 hidden md:flex">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                  onClick={() => scrollTable('left')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20 hidden md:flex">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                  onClick={() => scrollTable('right')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Table Container */}
              <div 
                id="users-table-container"
                className={`overflow-x-auto ${isTableExpanded ? 'max-h-[600px] overflow-y-auto' : ''}`}
                style={{ 
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'hsl(var(--muted)) transparent'
                }}
              >
                <div className="min-w-[1200px] md:min-w-full">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      <TableRow>
                        <TableHead className="sticky left-0 bg-muted z-20 min-w-[180px]">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4" />
                            <span>User</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>Email</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>Country</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[100px]">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span>Currency</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            <span>Privilege</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            <span>Email Verified</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Joined</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[320px] text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span>Actions</span>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            {users.length === 0 ? 'No users found' : 'No users match your filters'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id} className="bg-card hover:bg-muted/40 group">
                            <TableCell className="sticky left-0 bg-card group-hover:bg-muted/40 z-10">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 md:h-10 md:w-10">
                                  {user.avatar_url ? (
                                    <AvatarImage src={user.avatar_url} alt={user.username} />
                                  ) : null}
                                  <AvatarFallback className="text-sm">
                                    {user.username?.charAt(0).toUpperCase() || 
                                     user.email?.charAt(0).toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">
                                    {user.first_name} {user.last_name}
                                  </p>
                                  {user.username && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      @{user.username}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-0">
                                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm truncate">{user.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate">{formatCountry(user.country)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium truncate">{formatCurrency(user.currency)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={getPrivilegeBadgeVariant(user.privilege)} 
                                className="gap-1 capitalize truncate max-w-[120px]"
                              >
                                {getPrivilegeIcon(user.privilege)}
                                <span className="truncate">{user.privilege}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={user.verified ? "default" : "outline"}
                                  className="gap-1 truncate"
                                >
                                  {user.verified ? (
                                    <>
                                      <CheckCircle className="h-3 w-3" />
                                      Verified
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-3 w-3" />
                                      Unverified
                                    </>
                                  )}
                                </Badge>
                                {!user.verified && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      resendVerification(user.email, user.id);
                                    }}
                                    className="h-6 w-6"
                                    title="Resend verification email"
                                    disabled={performingAction}
                                  >
                                    {performingAction ? (
                                      <Clock className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Mail className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm truncate">{formatDate(user.created_at)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openUserDialog(user)}
                                  className="h-8"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openActionHistoryDialog(user)}
                                  className="h-8"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                                {canPerformAction(user) && (
                                  <>
                                    {user.privilege !== 'admin' && user.privilege !== 'superadmin' && user.privilege !== 'suspended' && user.privilege !== 'banned' && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => openActionDialog(user, 'suspend')}
                                        className="h-8"
                                      >
                                        <Shield className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {user.privilege !== 'banned' && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => openActionDialog(user, 'ban')}
                                        className="h-8"
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {hasSuperAdminPrivileges() && user.privilege === 'user' && (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={() => openActionDialog(user, 'promote')}
                                        className="h-8 text-xs"
                                      >
                                        Promote
                                      </Button>
                                    )}
                                    {hasSuperAdminPrivileges() && user.privilege === 'admin' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openActionDialog(user, 'demote')}
                                        className="h-8 text-xs"
                                      >
                                        Demote
                                      </Button>
                                    )}
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
              </div>

              {/* Scroll Indicator Footer */}
              <div className="border-t px-4 py-3 flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
                  <span>Scroll horizontally to see all columns</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4" />
                    <span>Use arrows to scroll</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {filteredUsers.length} of {users.length} users shown
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* World Map Visualization */}
      <div className="mt-6 md:mt-8">
        <Card>
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
              <Globe2 className="h-5 w-5 text-blue-700" />
              <span>User Distribution Map</span>
            </CardTitle>
            <CardDescription className="text-sm md:text-base">
              Visual representation of user locations based on country data
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            <div className="bg-muted/30 rounded-lg p-3 md:p-4 overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[800px] md:min-w-full">
                  <WorldMap />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-lg md:text-2xl font-bold">
                    {Object.keys(getCountryDistribution()).length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Countries</div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-lg md:text-2xl font-bold">
                    {users.filter(u => u.country).length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Users with location</div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-lg md:text-2xl font-bold truncate">
                    {(() => {
                      const dist = getCountryDistribution();
                      const topCountry = dist.sort((a, b) => b.value - a.value)[0];
                      return topCountry ? topCountry.country : 'None';
                    })()}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Top country</div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-lg md:text-2xl font-bold">
                    {users.filter(u => u.verified).length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Verified users</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Details Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Avatar className="h-10 w-10">
                    {selectedUser.avatar_url ? (
                      <AvatarImage src={selectedUser.avatar_url} />
                    ) : null}
                    <AvatarFallback>
                      {selectedUser.username?.charAt(0).toUpperCase() || 
                       selectedUser.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      @{selectedUser.username || 'No username'}
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription className="truncate">
                  User ID: {selectedUser.id}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Email</h4>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{selectedUser.email}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Phone</h4>
                    <p className="truncate">{selectedUser.phone_number || 'Not provided'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Country</h4>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{formatCountry(selectedUser.country)}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Currency</h4>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{formatCurrency(selectedUser.currency)}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Privilege</h4>
                    <Badge variant={getPrivilegeBadgeVariant(selectedUser.privilege)} className="gap-1 capitalize truncate">
                      {getPrivilegeIcon(selectedUser.privilege)}
                      {selectedUser.privilege}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Email Verified</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedUser.verified ? "default" : "outline"} className="gap-1">
                        {selectedUser.verified ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            Unverified
                          </>
                        )}
                      </Badge>
                      {!selectedUser.verified && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resendVerification(selectedUser.email, selectedUser.id)}
                          disabled={performingAction}
                          className="h-7"
                        >
                          {performingAction ? (
                            <Clock className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Mail className="h-3 w-3 mr-1" />
                          )}
                          Resend
                        </Button>
                      )}
                    </div>
                    {selectedUser.email_confirmed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Confirmed: {formatEmailConfirmationDate(selectedUser)}
                      </p>
                    )}
                  </div>
                </div>

                {/* User Stats */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">User Statistics</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-xl font-bold">{selectedUser.store_count || 0}</div>
                      <p className="text-xs text-muted-foreground">Stores</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-xl font-bold">{selectedUser.product_count || 0}</div>
                      <p className="text-xs text-muted-foreground">Products</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-xl font-bold">{selectedUser.order_count || 0}</div>
                      <p className="text-xs text-muted-foreground">Orders</p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Timeline</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Joined:</span>
                      <span className="text-sm">{formatDateTime(selectedUser.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Last Updated:</span>
                      <span className="text-sm">{formatDateTime(selectedUser.updated_at)}</span>
                    </div>
                    {selectedUser.email_confirmed_at && (
                      <div className="flex justify-between">
                        <span className="text-sm">Email Confirmed:</span>
                        <span className="text-sm">{formatDateTime(selectedUser.email_confirmed_at)}</span>
                      </div>
                    )}
                    {selectedUser.birthday && (
                      <div className="flex justify-between">
                        <span className="text-sm">Birthday:</span>
                        <span className="text-sm">{formatDate(selectedUser.birthday)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bio (if available) */}
                {selectedUser.bio && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Bio</h4>
                    <div className="border rounded-lg p-4 bg-muted/50 max-h-[200px] overflow-y-auto">
                      <p className="whitespace-pre-wrap">{selectedUser.bio}</p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  Member since {formatDate(selectedUser.created_at)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(`mailto:${selectedUser.email}`, '_blank');
                    }}
                    className="flex-1 sm:flex-none"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email User
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openActionHistoryDialog(selectedUser)}
                    className="flex-1 sm:flex-none"
                  >
                    <History className="h-4 w-4 mr-2" />
                    Action History
                  </Button>
                  {!selectedUser.verified && (
                    <Button
                      variant="outline"
                      onClick={() => resendVerification(selectedUser.email, selectedUser.id)}
                      disabled={performingAction}
                      className="flex-1 sm:flex-none"
                    >
                      {performingAction ? (
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Resend Verification
                    </Button>
                  )}
                  {canPerformAction(selectedUser) && (
                    <>
                      {selectedUser.privilege !== 'admin' && selectedUser.privilege !== 'superadmin' && selectedUser.privilege !== 'suspended' && (
                        <Button
                          variant="secondary"
                          onClick={() => openActionDialog(selectedUser, 'suspend')}
                          className="flex-1 sm:flex-none"
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Suspend
                        </Button>
                      )}
                      {selectedUser.privilege !== 'banned' && (
                        <Button
                          variant="destructive"
                          onClick={() => openActionDialog(selectedUser, 'ban')}
                          className="flex-1 sm:flex-none"
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Ban User
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          {selectedUser && actionType && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {actionType === 'ban' ? (
                    <Ban className="h-5 w-5 text-destructive" />
                  ) : actionType === 'suspend' ? (
                    <Shield className="h-5 w-5 text-warning" />
                  ) : actionType === 'promote' ? (
                    <Crown className="h-5 w-5 text-primary" />
                  ) : (
                    <UserIcon className="h-5 w-5 text-secondary" />
                  )}
                  <span className="truncate">
                    {actionType === 'ban' ? 'Ban User' : 
                     actionType === 'suspend' ? 'Suspend User' : 
                     actionType === 'promote' ? 'Promote to Admin' : 'Demote to User'}
                  </span>
                </DialogTitle>
                <DialogDescription className="truncate">
                  {actionType === 'ban' ? 
                    'This will permanently ban the user from accessing the platform.' :
                   actionType === 'suspend' ? 
                    'This will temporarily suspend the user account.' :
                   actionType === 'promote' ?
                    'This will grant admin privileges to the user.' :
                    'This will remove admin privileges from the user.'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    {selectedUser.avatar_url ? (
                      <AvatarImage src={selectedUser.avatar_url} />
                    ) : null}
                    <AvatarFallback>
                      {selectedUser.username?.charAt(0).toUpperCase() || 
                       selectedUser.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedUser.email}
                    </p>
                    <div className="flex gap-2 mt-1 overflow-x-auto pb-1">
                      <Badge variant="outline" className="flex-shrink-0">
                        {formatCountry(selectedUser.country)}
                      </Badge>
                      <Badge variant="outline" className="flex-shrink-0">
                        {formatCurrency(selectedUser.currency)}
                      </Badge>
                      <Badge variant={getPrivilegeBadgeVariant(selectedUser.privilege)} className="gap-1 flex-shrink-0">
                        {getPrivilegeIcon(selectedUser.privilege)}
                        <span className="truncate">{selectedUser.privilege}</span>
                      </Badge>
                      <Badge variant={selectedUser.verified ? "default" : "outline"} className="flex-shrink-0">
                        {selectedUser.verified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Reason for this action (required)
                  </label>
                  <Textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Enter reason for this action..."
                    className="min-h-[100px]"
                    required
                  />
                </div>

                <div className="text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 inline mr-1 flex-shrink-0" />
                  {actionType === 'ban' ? 
                    'This action cannot be undone automatically. The user will need to contact support.' :
                   actionType === 'suspend' ? 
                    'User will be unable to login until unsuspended.' :
                   actionType === 'promote' ?
                    'User will gain full admin access to the platform.' :
                    'User will lose admin privileges.'}
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionDialogOpen(false);
                    setActionReason('');
                    setActionType(null);
                  }}
                  disabled={performingAction}
                  className="flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button
                  variant={actionType === 'ban' ? 'destructive' : 
                          actionType === 'suspend' ? 'secondary' : 'default'}
                  onClick={async () => {
                    if (!actionReason.trim()) {
                      toast.error('Please enter a reason for this action');
                      return;
                    }

                    let newPrivilege: UserPrivilege = 'user';
                    if (actionType === 'ban') newPrivilege = 'banned';
                    if (actionType === 'suspend') newPrivilege = 'suspended';
                    if (actionType === 'promote') newPrivilege = 'admin';
                    
                    await updateUserPrivilege(selectedUser.id, newPrivilege, actionReason);
                  }}
                  disabled={performingAction || !actionReason.trim()}
                  className="flex-1 sm:flex-none"
                >
                  {performingAction ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : actionType === 'ban' ? (
                    <Ban className="h-4 w-4 mr-2" />
                  ) : actionType === 'suspend' ? (
                    <Shield className="h-4 w-4 mr-2" />
                  ) : actionType === 'promote' ? (
                    <Crown className="h-4 w-4 mr-2" />
                  ) : (
                    <UserIcon className="h-4 w-4 mr-2" />
                  )}
                  {actionType === 'ban' ? 'Ban User' : 
                   actionType === 'suspend' ? 'Suspend User' : 
                   actionType === 'promote' ? 'Promote to Admin' : 'Demote to User'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action History Dialog */}
      <Dialog open={actionHistoryDialogOpen} onOpenChange={setActionHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <span className="truncate">Action History for {selectedUser.first_name} {selectedUser.last_name}</span>
                </DialogTitle>
                <DialogDescription className="truncate">
                  All administrative actions taken on this user account
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg mb-4">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    {selectedUser.avatar_url ? (
                      <AvatarImage src={selectedUser.avatar_url} />
                    ) : null}
                    <AvatarFallback>
                      {selectedUser.username?.charAt(0).toUpperCase() || 
                       selectedUser.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedUser.email}
                    </p>
                    <div className="flex gap-2 mt-1 overflow-x-auto pb-1">
                      <Badge variant={getPrivilegeBadgeVariant(selectedUser.privilege)} className="gap-1 flex-shrink-0">
                        {getPrivilegeIcon(selectedUser.privilege)}
                        <span className="truncate">{selectedUser.privilege}</span>
                      </Badge>
                      <Badge variant={selectedUser.verified ? "default" : "outline"} className="flex-shrink-0">
                        {selectedUser.verified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {adminActions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No administrative actions recorded for this user.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[180px]">Date & Time</TableHead>
                            <TableHead className="min-w-[150px]">Action</TableHead>
                            <TableHead className="min-w-[200px]">Admin</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminActions.map((action) => (
                            <TableRow key={action.id}>
                              <TableCell>
                                <div className="text-sm truncate">
                                  {formatDateTime(action.created_at)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  action.action_type.includes('ban') ? 'destructive' :
                                  action.action_type.includes('suspend') ? 'secondary' :
                                  action.action_type.includes('promote') ? 'default' : 'outline'
                                } className="capitalize truncate max-w-[140px]">
                                  {action.action_type.replace(/_/g, ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm truncate">
                                  {action.admin_email || 'System'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm truncate">
                                  {action.reason || 'No reason provided'}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setActionHistoryDialogOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;