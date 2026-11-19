import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import apiUrl from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search,
  RefreshCw,
  Eye,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Mail,
  Calendar,
  FileText,
  Tag,
  Send,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// Types
type TicketStatus = 'open' | 'responded' | 'resolved' | 'closed' | 'pending';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

type Ticket = {
  id: string;
  user_id: string;
  email?: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  created_at: string;
  updated_at: string;
  admin_reply?: string;
  admin_replied_at?: string;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  replies?: TicketReply[];
};

type TicketReply = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
};

type BadgeVariant = "destructive" | "secondary" | "default" | "outline";

async function adminTicketRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in again to manage support tickets.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(apiUrl(path), { ...init, headers });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Support ticket request failed');
  return result;
}

const TicketsPage = () => {
  // State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | TicketStatus>('all');

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminTicketRequest<{ tickets: Ticket[] }>('/api/admin/support-tickets');
      setTickets(result.tickets || []);
      toast.success('Tickets loaded successfully');
    } catch (error) {
      console.error('Failed to load tickets', error);
      toast.error(`Failed to load tickets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update ticket status
  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      await adminTicketRequest<{ ticket: Ticket }>(`/api/admin/support-tickets/${encodeURIComponent(ticketId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      setTickets(prev => prev.map(ticket => 
        ticket.id === ticketId ? { ...ticket, status } : ticket
      ));

      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status } : null);
      }

      toast.success(`Ticket marked as ${status}`);
    } catch (error) {
      console.error('Failed to update ticket status', error);
      toast.error(`Failed to update ticket status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Send reply
  const sendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) {
      toast.error('Please enter a reply message');
      return;
    }

    setSendingReply(true);
    try {
      const result = await adminTicketRequest<{ reply: TicketReply; ticket: Partial<Ticket> }>(
        `/api/admin/support-tickets/${encodeURIComponent(selectedTicket.id)}/replies`,
        { method: 'POST', body: JSON.stringify({ message: replyMessage }) }
      );
      const newReply = result.reply;

      setTickets(prev => prev.map(ticket => 
        ticket.id === selectedTicket.id 
          ? {
              ...ticket,
              ...result.ticket,
              replies: [...(ticket.replies || []), newReply],
            }
          : ticket
      ));

      setSelectedTicket(prev => prev ? {
        ...prev,
        ...result.ticket,
        replies: [...(prev.replies || []), newReply]
      } : null);

      setReplyMessage('');
      toast.success('Reply sent successfully');
    } catch (error) {
      console.error('Failed to send reply', error);
      toast.error(`Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingReply(false);
    }
  };

  // Open ticket dialog
  const openTicketDialog = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyMessage('');
    setTicketDialogOpen(true);
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: TicketStatus): BadgeVariant => {
    switch (status) {
      case 'open':
        return 'default';
      case 'responded':
        return 'secondary';
      case 'resolved':
        return 'default'; // Changed from 'success' to 'default'
      case 'closed':
        return 'outline';
      case 'pending':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Get priority badge variant
  const getPriorityBadgeVariant = (priority: TicketPriority): BadgeVariant => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default'; // Changed from 'warning' to 'default'
      case 'medium':
        return 'default';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = searchQuery === '' ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesTab = activeTab === 'all' || ticket.status === activeTab;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesTab;
  });

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get time ago
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return formatDate(dateString);
    }
  };

  // Effects
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Support Tickets</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage customer support requests and responses
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchTickets} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets, subjects, or users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Tickets ({tickets.length})</TabsTrigger>
              <TabsTrigger value="open">Open ({tickets.filter(t => t.status === 'open').length})</TabsTrigger>
              <TabsTrigger value="responded">Responded ({tickets.filter(t => t.status === 'responded').length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({tickets.filter(t => t.status === 'pending').length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No tickets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{ticket.subject}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {ticket.message}
                            </p>
                            {ticket.category && (
                              <Badge variant="outline" className="mt-1">
                                {ticket.category}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {ticket.user?.avatar_url ? (
                                <AvatarImage src={ticket.user.avatar_url} />
                              ) : null}
                              <AvatarFallback>
                                {ticket.user?.email?.charAt(0).toUpperCase() || 
                                 ticket.email?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {ticket.user?.email || ticket.email || 'Unknown'}
                              </p>
                              {ticket.user?.first_name && (
                                <p className="text-xs text-muted-foreground">
                                  {ticket.user.first_name} {ticket.user.last_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(ticket.status)}>
                            <span className="capitalize">{ticket.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(ticket.priority)} className="gap-1">
                            {getPriorityIcon(ticket.priority)}
                            <span className="capitalize">{ticket.priority}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm">{formatDate(ticket.created_at)}</p>
                            <p className="text-xs text-muted-foreground">
                              {getTimeAgo(ticket.created_at)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm">{formatDate(ticket.updated_at)}</p>
                            <p className="text-xs text-muted-foreground">
                              {getTimeAgo(ticket.updated_at)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openTicketDialog(ticket)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {ticket.status !== 'resolved' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateTicketStatus(ticket.id, 'resolved')}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
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

      {/* Ticket Details Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {selectedTicket.subject}
                </DialogTitle>
                <DialogDescription>
                  Ticket ID: {selectedTicket.id}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Ticket Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">User</h4>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {selectedTicket.user?.avatar_url ? (
                          <AvatarImage src={selectedTicket.user.avatar_url} />
                        ) : null}
                        <AvatarFallback>
                          {selectedTicket.user?.email?.charAt(0).toUpperCase() || 
                           selectedTicket.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {selectedTicket.user?.email || selectedTicket.email || 'Unknown'}
                        </p>
                        {selectedTicket.user?.first_name && (
                          <p className="text-xs text-muted-foreground">
                            {selectedTicket.user.first_name} {selectedTicket.user.last_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Priority & Status</h4>
                    <div className="flex gap-2">
                      <Badge variant={getPriorityBadgeVariant(selectedTicket.priority)}>
                        <span className="capitalize">{selectedTicket.priority}</span>
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(selectedTicket.status)}>
                        <span className="capitalize">{selectedTicket.status}</span>
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Created</h4>
                    <p>{formatDate(selectedTicket.created_at)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Last Updated</h4>
                    <p>{formatDate(selectedTicket.updated_at)}</p>
                  </div>
                </div>

                {/* Original Message */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Original Message</h4>
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <p className="whitespace-pre-wrap">{selectedTicket.message}</p>
                  </div>
                </div>

                {/* Conversation Thread */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Conversation</h4>
                  <div className="space-y-4">
                    {/* User's original message */}
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        {selectedTicket.user?.avatar_url ? (
                          <AvatarImage src={selectedTicket.user.avatar_url} />
                        ) : null}
                        <AvatarFallback>
                          {selectedTicket.user?.email?.charAt(0).toUpperCase() || 
                           selectedTicket.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {selectedTicket.user?.email || selectedTicket.email || 'User'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {getTimeAgo(selectedTicket.created_at)}
                          </span>
                        </div>
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="whitespace-pre-wrap">{selectedTicket.message}</p>
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {selectedTicket.replies?.map((reply) => (
                      <div key={reply.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {reply.is_admin ? 'A' : reply.user?.email?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {reply.is_admin ? 'Admin' : reply.user?.email || 'User'}
                            </span>
                            <Badge variant={reply.is_admin ? 'default' : 'outline'}>
                              {reply.is_admin ? 'Admin' : 'User'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {getTimeAgo(reply.created_at)}
                            </span>
                          </div>
                          <div className={`p-3 rounded-lg ${reply.is_admin ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
                            <p className="whitespace-pre-wrap">{reply.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Admin reply form */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Admin Reply</h4>
                      <Textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply here..."
                        className="min-h-[120px]"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-muted-foreground">
                          Replying as Admin
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setReplyMessage('')}
                            disabled={!replyMessage.trim() || sendingReply}
                          >
                            Clear
                          </Button>
                          <Button
                            onClick={sendReply}
                            disabled={!replyMessage.trim() || sendingReply}
                            className="gap-2"
                          >
                            {sendingReply ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {selectedTicket.replies?.length || 0} replies
                </div>
                <div className="flex gap-2">
                  {selectedTicket.status !== 'resolved' && (
                    <Button
                      variant="default"
                      onClick={() => {
                        updateTicketStatus(selectedTicket.id, 'resolved');
                        setTicketDialogOpen(false);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Resolved
                    </Button>
                  )}
                  {selectedTicket.status !== 'closed' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateTicketStatus(selectedTicket.id, 'closed');
                        setTicketDialogOpen(false);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Close Ticket
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketsPage;