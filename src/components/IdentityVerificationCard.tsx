import { useEffect, useState } from 'react';
import { BadgeCheck, FileCheck2, ShieldCheck, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import apiUrl from '@/lib/api';
import { countries } from '@/utils/countries';

interface VerificationStatus {
  status: 'unverified' | 'pending' | 'verified' | 'rejected';
  country_code?: string;
  document_type?: string;
  review_note?: string | null;
  submitted_at?: string;
}

const statusVariant: Record<VerificationStatus['status'], string> = {
  unverified: 'bg-gray-100 text-gray-700',
  pending: 'bg-amber-100 text-amber-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusLabel: Record<VerificationStatus['status'], string> = {
  unverified: 'Not submitted',
  pending: 'Submitted',
  verified: 'Approved',
  rejected: 'Needs update',
};

export const IdentityVerificationCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<VerificationStatus>({ status: 'unverified' });
  const [countryCode, setCountryCode] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [certifiedCopy, setCertifiedCopy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const response = await fetch(apiUrl('/api/identity/status'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Could not load identity status');
        if (active) {
          setStatus(result);
          setCountryCode(result.country_code || '');
          setDocumentType(result.document_type || '');
        }
      } catch (error) {
        if (active) console.error('Could not load identity verification status:', error);
      } finally {
        if (active) setFetching(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user]);

  const documentOptions = countryCode === 'NG'
    ? [
        { value: 'nigerian_nin', label: 'Nigerian National Identification Number (NIN)' },
        { value: 'passport', label: 'Nigerian passport' },
      ]
    : countryCode === 'ZA'
      ? [{ value: 'south_african_id', label: 'South African identity number' }]
      : [{ value: 'national_id', label: 'National identity number' }];

  const submit = async () => {
    if (!user || !countryCode || !documentType || !identityNumber.trim() || !documentFile || !certifiedCopy) {
      toast({
        title: 'Complete identity details',
        description: 'Select your country and document, enter the number, upload a certified copy, and confirm it is certified.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to submit verification.');
      const objectPath = `${user.id}/kyc/${crypto.randomUUID()}-${documentFile.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;
      const { data: uploaded, error: uploadError } = await supabase.storage
        .from('identity-documents')
        .upload(objectPath, documentFile, { contentType: documentFile.type, upsert: false });
      if (uploadError) throw uploadError;

      const response = await fetch(apiUrl('/api/identity/submit'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          country_code: countryCode,
          document_type: documentType,
          identity_number: identityNumber,
          document_path: uploaded.path,
          certified_copy: certifiedCopy,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not submit identity verification');

      setStatus({ status: 'pending', country_code: countryCode, document_type: documentType, submitted_at: new Date().toISOString() });
      setIdentityNumber('');
      setDocumentFile(null);
      setCertifiedCopy(false);
      toast({ title: 'Submission received', description: 'Your identity details have been submitted.' });
    } catch (error) {
      toast({
        title: 'Could not submit details',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isLocked = fetching || status.status === 'pending' || status.status === 'verified';

  return (
    <Card className="p-6 dark:bg-[#161616]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Identity details</h2>
        </div>
        <Badge className={statusVariant[status.status]}>{fetching ? 'Loading' : statusLabel[status.status]}</Badge>
      </div>

      {status.status === 'verified' ? (
        <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <BadgeCheck className="h-4 w-4" /> Your identity details have been approved for {countries.find(country => country.code === status.country_code)?.name || status.country_code}.
        </p>
      ) : status.status === 'pending' ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Your submission has been received.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Your identity number is encrypted, and your certified document is stored securely and privately.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="identity-country">Country of identity document</Label>
              <Select value={countryCode} onValueChange={value => { setCountryCode(value); setDocumentType(''); }}>
                <SelectTrigger id="identity-country"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {countries.map(country => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="identity-document-type">Document type</Label>
              <Select value={documentType} onValueChange={setDocumentType} disabled={!countryCode}>
                <SelectTrigger id="identity-document-type"><SelectValue placeholder="Select document" /></SelectTrigger>
                <SelectContent>
                  {documentOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="identity-number">Identity number</Label>
            <Input
              id="identity-number"
              autoComplete="off"
              value={identityNumber}
              onChange={event => setIdentityNumber(event.target.value)}
              placeholder={countryCode === 'NG' ? 'NIN or passport number' : countryCode === 'ZA' ? '13-digit identity number' : 'National identity number'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="identity-certified-copy">Certified copy of identity document</Label>
            <Input
              id="identity-certified-copy"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={event => setDocumentFile(event.target.files?.[0] || null)}
            />
            {documentFile && <p className="text-xs text-gray-500">{documentFile.name}</p>}
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={certifiedCopy} onChange={event => setCertifiedCopy(event.target.checked)} className="mt-1" />
            <span><FileCheck2 className="inline h-4 w-4 mr-1" />I confirm this is a certified copy of my identity document.</span>
          </label>
          {status.status === 'rejected' && status.review_note && (
            <p className="text-sm text-red-600">Review note: {status.review_note}</p>
          )}
          <Button type="button" onClick={submit} disabled={loading || fetching || isLocked}>
            <Upload className="h-4 w-4 mr-2" />{loading ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      )}
    </Card>
  );
};
