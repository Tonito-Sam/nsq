
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/Header';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Eye, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ContentReport {
  id: string;
  reported_content_id: string;
  reported_content_type: 'post' | 'comment' | 'user';
  reporter_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const ContentModeration = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    try {
      let query = supabase
        .from('content_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReports(data as ContentReport[] || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId: string, status: string, notes?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('content_reports')
        .update({
          status: status,
          reviewed_by: user.id,
          admin_notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      // Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action_type: 'content_moderation',
          description: `Updated report status to ${status}`,
          target_type: 'report',
          target_id: reportId,
          metadata: { status, notes }
        });

      toast({
        title: "Success",
        description: "Report status updated successfully"
      });

      fetchReports();
      setSelectedReport(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        title: "Error",
        description: "Failed to update report status",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'reviewed':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'dismissed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Content Moderation</h1>
          <p className="text-gray-600 dark:text-gray-400">Review and manage reported content</p>
        </div>

        <div className="mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Reports Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {statusFilter === 'all' 
                  ? 'No content reports have been submitted yet.' 
                  : `No ${statusFilter} reports found.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Reports</h2>
              {reports.map((report) => (
                <Card 
                  key={report.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedReport?.id === report.id ? 'ring-2 ring-purple-500' : ''
                  }`}
                  onClick={() => setSelectedReport(report)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getStatusColor(report.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(report.status)}
                          <span className="capitalize">{report.status}</span>
                        </div>
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {report.reported_content_type.charAt(0).toUpperCase() + report.reported_content_type.slice(1)} Report
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Reason:</strong> {report.reason}
                      </p>
                      {report.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <strong>Description:</strong> {report.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedReport && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Review Report</h2>
                <Card>
                  <CardHeader>
                    <CardTitle>Report Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Content Type</label>
                      <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedReport.reported_content_type}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
                      <p className="text-gray-900 dark:text-gray-100">{selectedReport.reason}</p>
                    </div>
                    
                    {selectedReport.description && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                        <p className="text-gray-900 dark:text-gray-100">{selectedReport.description}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Status</label>
                      <Badge className={getStatusColor(selectedReport.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(selectedReport.status)}
                          <span className="capitalize">{selectedReport.status}</span>
                        </div>
                      </Badge>
                    </div>
                    
                    {selectedReport.admin_notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Previous Admin Notes</label>
                        <p className="text-gray-900 dark:text-gray-100">{selectedReport.admin_notes}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin Notes</label>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes about your decision..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => updateReportStatus(selectedReport.id, 'reviewed', adminNotes)}
                        variant="outline"
                        className="flex-1"
                      >
                        Mark as Reviewed
                      </Button>
                      <Button
                        onClick={() => updateReportStatus(selectedReport.id, 'resolved', adminNotes)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        Resolve
                      </Button>
                      <Button
                        onClick={() => updateReportStatus(selectedReport.id, 'dismissed', adminNotes)}
                        variant="destructive"
                        className="flex-1"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default ContentModeration;
