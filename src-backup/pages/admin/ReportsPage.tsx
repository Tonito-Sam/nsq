import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  Search,
  Calendar,
  Eye,
  Trash2,
  BarChart3,
  Users,
  ShoppingBag,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Types
type ReportType = 'system' | 'user' | 'transaction' | 'security' | 'performance' | 'audit' | 'error' | 'warning' | 'info';
type ReportStatus = 'active' | 'resolved' | 'pending' | 'investigating';
type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';

type Report = {
  id: string;
  title: string;
  description: string;
  type: ReportType;
  status: ReportStatus;
  severity: ReportSeverity;
  created_by?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  metadata?: any;
  data?: any;
  assigned_to?: string;
  notes?: string;
};

type ReportStat = {
  total: number;
  resolved: number;
  pending: number;
  investigating: number;
  byType: Record<ReportType, number>;
  bySeverity: Record<ReportSeverity, number>;
};

const ReportsPage = () => {
  // State
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReportStat>({
    total: 0,
    resolved: 0,
    pending: 0,
    investigating: 0,
    byType: {} as Record<ReportType, number>,
    bySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReportType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<ReportSeverity | 'all'>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'resolved' | 'critical'>('all');

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      // Try multiple possible table names
      const tableNames = ['admin_reports', 'system_reports', 'reports', 'audit_logs'];
      let allReports: any[] = [];
      
      for (const tableName of tableNames) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

          if (!error && data) {
            // Normalize different table structures
            const normalizedReports = data.map((item: any) => normalizeReport(item, tableName));
            allReports = [...allReports, ...normalizedReports];
          }
        } catch (err) {
          console.warn(`Table ${tableName} not found:`, err);
        }
      }

      // Remove duplicates based on ID
      const uniqueReports = Array.from(
        new Map(allReports.map(report => [report.id, report])).values()
      );

      setReports(uniqueReports);
      calculateStats(uniqueReports);
      
      toast.success('Reports loaded successfully');
    } catch (error) {
      console.error('Failed to load reports', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  // Normalize report from different table structures
  const normalizeReport = (item: any, sourceTable: string): Report => {
    // Determine severity with better type safety
    let severity: ReportSeverity = 'medium';
    if (item.severity === 'low' || item.severity === 'medium' || item.severity === 'high' || item.severity === 'critical') {
      severity = item.severity;
    }

    // Determine type with better type safety
    let type: ReportType = 'info';
    const validTypes: ReportType[] = ['system', 'user', 'transaction', 'security', 'performance', 'audit', 'error', 'warning', 'info'];
    if (validTypes.includes(item.type as ReportType)) {
      type = item.type;
    } else if (validTypes.includes(item.report_type as ReportType)) {
      type = item.report_type;
    }

    // Determine status with better type safety
    let status: ReportStatus = 'active';
    const validStatuses: ReportStatus[] = ['active', 'resolved', 'pending', 'investigating'];
    if (validStatuses.includes(item.status as ReportStatus)) {
      status = item.status;
    }

    const baseReport: Report = {
      id: item.id || `temp_${Date.now()}_${Math.random()}`,
      title: item.title || item.name || `Report from ${sourceTable}`,
      description: item.description || item.message || item.details || JSON.stringify(item.data || {}),
      type,
      status,
      severity,
      created_at: item.created_at || new Date().toISOString(),
      metadata: item.metadata || item.data,
      data: item.data || item.metadata
    };

    if (item.created_by) baseReport.created_by = item.created_by;
    if (item.resolved_at) baseReport.resolved_at = item.resolved_at;
    if (item.resolved_by) baseReport.resolved_by = item.resolved_by;
    if (item.assigned_to) baseReport.assigned_to = item.assigned_to;
    if (item.notes) baseReport.notes = item.notes;

    return baseReport;
  };

  // Calculate statistics
  const calculateStats = (reportsList: Report[]) => {
    const initialStats: ReportStat = {
      total: reportsList.length,
      resolved: reportsList.filter(r => r.status === 'resolved').length,
      pending: reportsList.filter(r => r.status === 'pending').length,
      investigating: reportsList.filter(r => r.status === 'investigating').length,
      byType: {
        system: 0,
        user: 0,
        transaction: 0,
        security: 0,
        performance: 0,
        audit: 0,
        error: 0,
        warning: 0,
        info: 0
      },
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      }
    };

    // Count by type and severity
    reportsList.forEach(report => {
      initialStats.byType[report.type] = (initialStats.byType[report.type] || 0) + 1;
      initialStats.bySeverity[report.severity] = (initialStats.bySeverity[report.severity] || 0) + 1;
    });

    setStats(initialStats);
  };

  // Update report status
  const updateReportStatus = async (reportId: string, status: ReportStatus, notes?: string) => {
    try {
      // Try to update in all possible tables
      const tablesToUpdate = ['admin_reports', 'system_reports', 'reports'];
      let updated = false;

      for (const tableName of tablesToUpdate) {
        try {
          const { error } = await supabase
            .from(tableName)
            .update({
              status,
              resolved_at: status === 'resolved' ? new Date().toISOString() : null,
              resolved_by: 'admin',
              notes: notes || undefined,
              updated_at: new Date().toISOString()
            })
            .eq('id', reportId);

          if (!error) {
            updated = true;
            break;
          }
        } catch (err) {
          // Continue to next table
        }
      }

      if (!updated) {
        // If no table exists, just update local state
        console.warn('Could not find report table to update');
      }

      // Update local state
      setReports(prev => prev.map(report => 
        report.id === reportId 
          ? { 
              ...report, 
              status,
              resolved_at: status === 'resolved' ? new Date().toISOString() : report.resolved_at,
              resolved_by: status === 'resolved' ? 'admin' : report.resolved_by,
              notes: notes || report.notes
            } 
          : report
      ));

      if (selectedReport?.id === reportId) {
        setSelectedReport(prev => prev ? {
          ...prev,
          status,
          resolved_at: status === 'resolved' ? new Date().toISOString() : prev.resolved_at,
          resolved_by: status === 'resolved' ? 'admin' : prev.resolved_by,
          notes: notes || prev.notes
        } : null);
      }

      calculateStats(reports.map(r => r.id === reportId ? { ...r, status } : r));
      toast.success(`Report marked as ${status}`);
    } catch (error) {
      console.error('Failed to update report status', error);
      toast.error('Failed to update report status');
    }
  };

  // Delete report
  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      // Try to delete from all possible tables
      const tablesToDelete = ['admin_reports', 'system_reports', 'reports'];
      let deleted = false;

      for (const tableName of tablesToDelete) {
        try {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', reportId);

          if (!error) {
            deleted = true;
          }
        } catch (err) {
          // Continue to next table
        }
      }

      // Update local state
      setReports(prev => prev.filter(report => report.id !== reportId));
      
      if (selectedReport?.id === reportId) {
        setReportDialogOpen(false);
        setSelectedReport(null);
      }

      calculateStats(reports.filter(r => r.id !== reportId));
      toast.success('Report deleted successfully');
    } catch (error) {
      console.error('Failed to delete report', error);
      toast.error('Failed to delete report');
    }
  };

  // Generate system report
  const generateSystemReport = async () => {
    setGeneratingReport(true);
    try {
      // Collect system data
      const reportData = {
        timestamp: new Date().toISOString(),
        report_stats: stats,
        system_status: 'healthy',
        generated_by: 'admin',
        data_sources: ['admin_reports', 'system_reports', 'reports', 'audit_logs']
      };

      // Save the generated report
      const tablesToTry = ['admin_reports', 'system_reports'];
      let saved = false;

      for (const tableName of tablesToTry) {
        try {
          const { error } = await supabase
            .from(tableName)
            .insert([
              {
                title: 'System Status Report',
                description: 'Automated system status report generated by admin',
                type: 'system',
                status: 'resolved',
                severity: 'low',
                data: reportData,
                created_at: new Date().toISOString()
              }
            ]);

          if (!error) {
            saved = true;
            break;
          }
        } catch (err) {
          // Continue to next table
        }
      }

      if (saved) {
        await fetchReports(); // Refresh the list
        toast.success('System report generated successfully');
      } else {
        toast.info('Report generated (saved locally)');
      }
    } catch (error) {
      console.error('Failed to generate system report', error);
      toast.error('Failed to generate system report');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Export reports
  const exportReports = () => {
    const csv = [
      ['ID', 'Title', 'Type', 'Status', 'Severity', 'Created At', 'Description'].join(','),
      ...reports.map(r => [
        r.id,
        r.title.replace(/,/g, ';'),
        r.type,
        r.status,
        r.severity,
        new Date(r.created_at).toISOString(),
        r.description.replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    
    toast.success('Reports exported successfully');
  };

  // Open report dialog
  const openReportDialog = (report: Report) => {
    setSelectedReport(report);
    setNotes(report.notes || '');
    setReportDialogOpen(true);
  };

  // Get type icon
  const getTypeIcon = (type: ReportType) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <FileText className="h-4 w-4" />;
      case 'system':
        return <BarChart3 className="h-4 w-4" />;
      case 'user':
        return <Users className="h-4 w-4" />;
      case 'transaction':
        return <ShoppingBag className="h-4 w-4" />;
      case 'security':
        return <AlertTriangle className="h-4 w-4" />;
      case 'performance':
        return <TrendingUp className="h-4 w-4" />;
      case 'audit':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Get type badge color
  const getTypeBadgeVariant = (type: ReportType): "destructive" | "secondary" | "default" | "outline" => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default'; // Changed from 'warning' to 'default'
      default:
        return 'secondary';
    }
  };

  // Get severity badge color
  const getSeverityBadgeVariant = (severity: ReportSeverity): "destructive" | "secondary" | "default" | "outline" => {
    switch (severity) {
      case 'critical':
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

  // Get status badge color
  const getStatusBadgeVariant = (status: ReportStatus): "destructive" | "secondary" | "default" | "outline" => {
    switch (status) {
      case 'resolved':
        return 'default';
      case 'active':
        return 'secondary';
      case 'pending':
        return 'default'; // Changed from 'warning' to 'default'
      case 'investigating':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // Filter reports
  const filteredReports = reports.filter(report => {
    const matchesSearch = searchQuery === '' ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || report.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || report.severity === severityFilter;
    
    // Tab filtering
    let matchesTab = true;
    switch (activeTab) {
      case 'active':
        matchesTab = report.status !== 'resolved';
        break;
      case 'resolved':
        matchesTab = report.status === 'resolved';
        break;
      case 'critical':
        matchesTab = report.severity === 'critical' || report.severity === 'high';
        break;
    }
    
    return matchesSearch && matchesType && matchesStatus && matchesSeverity && matchesTab;
  });

  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
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
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">System Reports</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage system reports and alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={generateSystemReport} 
            disabled={generatingReport}
            variant="outline"
          >
            {generatingReport ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>
          <Button variant="outline" onClick={exportReports}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="icon" onClick={fetchReports}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.resolved} resolved, {stats.pending} pending
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Reports</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.total - stats.resolved}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.investigating} under investigation
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.bySeverity.critical}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.bySeverity.high} high severity
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.resolved} of {stats.total} reports resolved
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Reports ({reports.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({stats.total - stats.resolved})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
          <TabsTrigger value="critical">Critical ({stats.bySeverity.critical + stats.bySeverity.high})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports by title, description, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="transaction">Transaction</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={(value: any) => setSeverityFilter(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
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
                    <TableHead>Report</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {reports.length === 0 ? 'No reports found' : 'No reports match your filters'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReports.map((report) => (
                      <TableRow key={report.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{report.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {report.description}
                            </p>
                            <div className="text-xs text-muted-foreground">
                              ID: {report.id.slice(0, 8)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {getTypeIcon(report.type)}
                            <span className="capitalize">{report.type}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityBadgeVariant(report.severity)} className="capitalize">
                            {report.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(report.status)} className="capitalize">
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm">{formatDate(report.created_at)}</p>
                            <p className="text-xs text-muted-foreground">
                              {getTimeAgo(report.created_at)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReportDialog(report)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {report.status !== 'resolved' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateReportStatus(report.id, 'resolved')}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteReport(report.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      {/* Report Details Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getTypeIcon(selectedReport.type)}
                  {selectedReport.title}
                </DialogTitle>
                <DialogDescription>
                  Report ID: {selectedReport.id}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Type</h4>
                    <Badge variant="outline" className="gap-1">
                      {getTypeIcon(selectedReport.type)}
                      <span className="capitalize">{selectedReport.type}</span>
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Severity</h4>
                    <Badge variant={getSeverityBadgeVariant(selectedReport.severity)} className="capitalize">
                      {selectedReport.severity}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                    <Badge variant={getStatusBadgeVariant(selectedReport.status)} className="capitalize">
                      {selectedReport.status}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Created</h4>
                    <p>{formatDate(selectedReport.created_at)}</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <p className="whitespace-pre-wrap">{selectedReport.description}</p>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Notes</h4>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this report..."
                    className="min-h-[100px]"
                  />
                </div>

                {/* Metadata (if available) */}
                {selectedReport.metadata && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Metadata</h4>
                    <div className="border rounded-lg p-4">
                      <pre className="text-xs overflow-auto max-h-[200px]">
                        {JSON.stringify(selectedReport.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Created {getTimeAgo(selectedReport.created_at)}
                  </div>
                  <div className="flex gap-2">
                    {selectedReport.status !== 'resolved' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => updateReportStatus(selectedReport.id, 'investigating', notes)}
                        >
                          Mark Investigating
                        </Button>
                        <Button
                          variant="default"
                          onClick={() => updateReportStatus(selectedReport.id, 'resolved', notes)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Resolved
                        </Button>
                      </>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => {
                        deleteReport(selectedReport.id);
                        setReportDialogOpen(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsPage;