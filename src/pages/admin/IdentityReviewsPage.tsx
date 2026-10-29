import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import apiUrl from '@/lib/api';

interface IdentitySubmission {
  id: string;
  user_id: string;
  country_code: string;
  document_type: string;
  identity_number: string;
  document_url: string;
  status: string;
  submitted_at: string;
}

const IdentityReviewsPage = () => {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<IdentitySubmission[]>([]);
  const [riskStatuses, setRiskStatuses] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loadSubmissions = async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      const { data: { session } } = await import('@/integrations/supabase/client').then(module => module.supabase.auth.getSession());
      if (!session?.access_token) throw new Error('Sign in again to review identity submissions.');
      const response = await fetch(apiUrl('/api/identity/admin/pending'), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not load identity submissions');
      setSubmissions(result.submissions || []);
    } catch (error) {
      toast({ title: 'Could not load identity submissions', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
  }, [user, isAdmin]);

  const review = async (submission: IdentitySubmission, status: 'verified' | 'rejected') => {
    setActingOn(submission.id);
    try {
      const { data: { session } } = await import('@/integrations/supabase/client').then(module => module.supabase.auth.getSession());
      if (!session?.access_token) throw new Error('Sign in again to review identity submissions.');
      const response = await fetch(apiUrl(`/api/identity/admin/${submission.id}/review`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status,
          risk_status: riskStatuses[submission.id] || (status === 'verified' ? 'active' : 'review'),
          review_note: reviewNotes[submission.id] || '',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save identity review');
      setSubmissions(current => current.filter(item => item.id !== submission.id));
      toast({ title: status === 'verified' ? 'Identity verified' : 'Submission rejected' });
    } catch (error) {
      toast({ title: 'Review failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setActingOn(null);
    }
  };

  if (adminLoading) return <p className="text-sm text-muted-foreground">Checking administrator access...</p>;
  if (!isAdmin) return <p className="text-sm text-red-600">Administrator access required.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Identity Reviews</h1>
          <p className="text-sm text-muted-foreground">Review submitted identity documents and set AML risk status.</p>
        </div>
        <Button variant="outline" onClick={() => void loadSubmissions()} disabled={loading} aria-label="Refresh identity submissions">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading submissions...</p> : submissions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No pending identity submissions.</Card>
      ) : submissions.map(submission => (
        <Card key={submission.id} className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold">{submission.country_code} · {submission.document_type.replaceAll('_', ' ')}</p>
              <p className="text-sm text-muted-foreground">Identity number: {submission.identity_number}</p>
              <p className="text-xs text-muted-foreground">User {submission.user_id} · Submitted {new Date(submission.submitted_at).toLocaleString()}</p>
            </div>
            <Badge variant="secondary">Pending</Badge>
          </div>
          <Button variant="outline" asChild>
            <a href={submission.document_url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />Open certified document
            </a>
          </Button>
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={riskStatuses[submission.id] || 'active'} onValueChange={value => setRiskStatuses(previous => ({ ...previous, [submission.id]: value }))}>
              <SelectTrigger aria-label="AML risk status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="review">Needs review</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              value={reviewNotes[submission.id] || ''}
              onChange={event => setReviewNotes(previous => ({ ...previous, [submission.id]: event.target.value }))}
              placeholder="Review note (optional)"
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void review(submission, 'rejected')} disabled={actingOn === submission.id}>
              Reject
            </Button>
            <Button onClick={() => void review(submission, 'verified')} disabled={actingOn === submission.id || riskStatuses[submission.id] === 'blocked'}>
              <ShieldCheck className="mr-2 h-4 w-4" />Verify identity
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default IdentityReviewsPage;
