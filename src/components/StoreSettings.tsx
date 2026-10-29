import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Store, Upload, Save, Settings, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { countries } from '@/utils/countries';
import { statesByCountry } from '@/utils/statesByCountry';
import { banksByCountry } from '@/utils/banksByCountry';
import apiUrl from '@/lib/api';
import { getCurrencyByCountry } from '@/utils/currencyByCountry';

interface Store {
  id: string;
  store_name: string;
  store_category: string;
  description: string;
  base_currency: string;
  country?: string;
  shipping_partner: string;
  owner_kyc_status?: string;
  owner_identity_country?: string | null;
  logo_url: string;
  verification_status: string;
  is_active: boolean;
}

interface StoreSettingsProps {
  store: Store | null;
  onStoreUpdate: (store: Store) => void;
}

export const StoreSettings: React.FC<StoreSettingsProps> = ({ store, onStoreUpdate }) => {
  interface FormData {
    store_name: string;
    store_category: string;
    description: string;
    base_currency: string;
    shipping_partner: string;
    business_whatsapp_number: string;
    notify_whatsapp: boolean;
    business_country: string;
    business_state_province: string;
    business_bank_name: string;
    business_account_number: string;
    business_account_holder: string;
    business_branch_name: string;
    store_paypal_enabled: boolean;
    store_paypal_email: string;
  }

  const [formData, setFormData] = useState<FormData>({
    store_name: store?.store_name || '',
    store_category: store?.store_category || '',
    description: store?.description || '',
    base_currency: store?.base_currency || getCurrencyByCountry(store?.country),
    shipping_partner: store?.shipping_partner || '',
    business_whatsapp_number: (store as any)?.business_whatsapp_number || '',
    notify_whatsapp: Boolean(
      (store as any)?.notify_whatsapp &&
      (store as any)?.business_whatsapp_verified_at &&
      (store as any)?.business_whatsapp_verified_phone === (store as any)?.business_whatsapp_number
    ),
    business_country: store?.country || '',
    business_state_province: '',
    business_bank_name: (store as any)?.business_bank_name || '',
    business_account_number: (store as any)?.business_bank_account_number || '',
    business_account_holder: (store as any)?.business_registered_name || '',
    business_branch_name: (store as any)?.business_bank_branch || '',
    store_paypal_enabled: false,
    store_paypal_email: ''
  });
  const [saving, setSaving] = useState(false);
  const [whatsappCode, setWhatsappCode] = useState('');
  const [whatsappCodeSent, setWhatsappCodeSent] = useState(false);
  const [whatsappVerificationLoading, setWhatsappVerificationLoading] = useState(false);
  const isWhatsAppNumberVerified = Boolean(
    (store as any)?.business_whatsapp_verified_at &&
    (store as any)?.business_whatsapp_verified_phone === formData.business_whatsapp_number.trim()
  );

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value } as any));
  };

  const handleSave = async () => {
    if (!store) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to update WhatsApp settings.');

      const resp = await fetch(apiUrl('/api/stores/update-whatsapp-notify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          store_id: store.id,
          business_whatsapp_number: formData.business_whatsapp_number.trim(),
          notify_whatsapp: formData.notify_whatsapp,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || `Server returned ${resp.status}`);
      const serverUpdatedRow: any = json.updated || null;

      // Update other store settings via Supabase (excluding WhatsApp fields which server already handled)
      const { data, error } = await supabase
        .from('user_stores')
        .update({
          store_name: formData.store_name,
          store_category: formData.store_category,
          description: formData.description,
          country: formData.business_country || null,
          business_bank_name: formData.business_bank_name || null,
          business_bank_account_number: formData.business_account_number || null,
          business_registered_name: formData.business_account_holder || null,
          business_bank_branch: formData.business_branch_name || null,
          base_currency: formData.base_currency,
          shipping_partner: formData.shipping_partner,
          updated_at: new Date().toISOString()
        })
        .eq('id', store.id)
        .select()
        .single();

      if (error) throw error;

      // Merge serverUpdatedRow (if any) with the updated supabase data so UI sees the latest values
      const merged = { ...(data || {}), ...(serverUpdatedRow || {}) };
      onStoreUpdate(merged);
      toast({ title: 'Success', description: 'Store settings updated successfully' });
    } catch (error) {
      console.error('Error updating store:', error);
      toast({
        title: "Error",
        description: (error as any)?.message || 'Failed to update store settings',
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const requestWhatsAppVerification = async () => {
    if (!store) return;

    setWhatsappVerificationLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to verify this number.');
      const response = await fetch(apiUrl('/api/stores/whatsapp-verification/start'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          store_id: store.id,
          business_whatsapp_number: formData.business_whatsapp_number.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not send a verification code');
      setWhatsappCodeSent(true);
      setWhatsappCode('');
      toast({ title: 'Code sent', description: 'Check WhatsApp for your six-digit verification code.' });
    } catch (error) {
      toast({
        title: 'WhatsApp verification unavailable',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setWhatsappVerificationLoading(false);
    }
  };

  const confirmWhatsAppVerification = async () => {
    if (!store) return;

    setWhatsappVerificationLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to verify this number.');
      const response = await fetch(apiUrl('/api/stores/whatsapp-verification/confirm'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ store_id: store.id, code: whatsappCode.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not verify this number');

      setWhatsappCodeSent(false);
      setWhatsappCode('');
      setFormData(previous => ({ ...previous, notify_whatsapp: false }));
      if (result.updated) onStoreUpdate({ ...store, ...result.updated });
      toast({ title: 'Number verified', description: 'Turn on the order notification setting and save to opt in.' });
    } catch (error) {
      toast({
        title: 'Verification failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setWhatsappVerificationLoading(false);
    }
  };

  if (!store) {
    return (
      <Card className="dark:bg-[#161616] p-8 text-center">
        <div className="text-gray-600 dark:text-gray-400">No store found</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Store Settings</h2>

      {/* Store Info */}
      <Card className="dark:bg-[#161616] p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Store className="h-6 w-6 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Store Information
          </h3>
          <Badge className={store.verification_status === 'verified' ? 'bg-green-600' : 'bg-yellow-600'}>
            {store.verification_status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="store_name">Store Name</Label>
            <Input
              id="store_name"
              value={formData.store_name}
              onChange={(e) => handleInputChange('store_name', e.target.value)}
              placeholder="Enter store name"
            />
          </div>

          <div>
            <Label htmlFor="store_category">Category</Label>
            <Input
              id="store_category"
              value={formData.store_category}
              onChange={(e) => handleInputChange('store_category', e.target.value)}
              placeholder="e.g., Electronics, Fashion, Books"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your store..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="base_currency">Base Currency</Label>
            <select
              id="base_currency"
              value={formData.base_currency}
              onChange={(e) => handleInputChange('base_currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="ZAR">ZAR - South African Rand</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>

          <div>
            <Label htmlFor="shipping_partner">Shipping Partner</Label>
            <Input
              id="shipping_partner"
              value={formData.shipping_partner}
              onChange={(e) => handleInputChange('shipping_partner', e.target.value)}
              placeholder="e.g., CourierGuy, PostNet"
            />
          </div>

          <div>
            <Label htmlFor="business_whatsapp_number">Business WhatsApp Number</Label>
            <Input
              id="business_whatsapp_number"
              value={formData.business_whatsapp_number}
              onChange={(e) => {
                handleInputChange('business_whatsapp_number', e.target.value);
                handleInputChange('notify_whatsapp', false);
                setWhatsappCodeSent(false);
                setWhatsappCode('');
              }}
              placeholder="+15551234567"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter the WhatsApp number that should receive NexSq order alerts, including country code.</p>
            {isWhatsAppNumberVerified ? (
              <p className="text-sm text-green-700 dark:text-green-400 mt-2">WhatsApp number verified</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={requestWhatsAppVerification}
                  disabled={saving || whatsappVerificationLoading || !formData.business_whatsapp_number.trim()}
                >
                  {whatsappVerificationLoading ? 'Sending...' : 'Verify number on WhatsApp'}
                </Button>
                {whatsappCodeSent && (
                  <div className="flex gap-2">
                    <Input
                      aria-label="WhatsApp verification code"
                      inputMode="numeric"
                      maxLength={6}
                      value={whatsappCode}
                      onChange={event => setWhatsappCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                    />
                    <Button
                      type="button"
                      onClick={confirmWhatsAppVerification}
                      disabled={saving || whatsappVerificationLoading || whatsappCode.length !== 6}
                    >
                      Confirm
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Send order notifications to this number</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">NexSq will send a WhatsApp alert after an order payment is confirmed. Customer address and payment details are not included.</p>
            </div>
            <input
              type="checkbox"
              checked={!!formData.notify_whatsapp && isWhatsAppNumberVerified}
              onChange={e => handleInputChange('notify_whatsapp', e.target.checked)}
              disabled={!isWhatsAppNumberVerified && !formData.notify_whatsapp}
              className="form-checkbox h-5 w-5 text-purple-600"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Card>

      {/* Store Logo */}
      <Card className="dark:bg-[#161616] p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Upload className="h-6 w-6 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Store Logo
          </h3>
        </div>

        <div className="flex items-center space-x-6">
          <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
            {store.logo_url ? (
              <img 
                src={store.logo_url} 
                alt="Store logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <Store className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Upload a logo for your store. Recommended size: 200x200px
            </p>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Logo
            </Button>
          </div>
        </div>
      </Card>

      {/* Store Status */}
      <Card className="dark:bg-[#161616] p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="h-6 w-6 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Store Status
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-2">Store Status</p>
            <Badge className={store.is_active ? 'bg-green-600' : 'bg-red-600'}>
              {store.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">Verification Status</p>
            <Badge className={store.verification_status === 'verified' ? 'bg-green-600' : 'bg-yellow-600'}>
              {store.verification_status}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Owner Identity Verification</p>
            <Badge className={store.owner_kyc_status === 'verified' ? 'bg-green-600' : store.owner_kyc_status === 'pending' ? 'bg-yellow-600' : 'bg-gray-500'}>
              {store.owner_kyc_status || 'unverified'}
            </Badge>
            {store.owner_identity_country && (
              <p className="text-xs text-gray-500 mt-1">Identity country: {countries.find(country => country.code === store.owner_identity_country)?.name || store.owner_identity_country}</p>
            )}
          </div>
        </div>

        {store.verification_status !== 'verified' && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex flex-col gap-2">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Your store is pending verification. This may take 2-3 business days. 
              Verified stores get priority listing and customer trust badges.
            </p>
            <Button
              className="w-fit bg-blue-600 hover:bg-blue-700 mt-2"
              onClick={() => window.location.href = '/create-store?step=3'}
            >
              Complete Verification
            </Button>
          </div>
        )}
      </Card>

      {/* Store Payout Settings - with heading and icon */}
      <Card className="dark:bg-[#161616] p-6">
        <div className="flex items-center space-x-3 mb-6">
          <DollarSign className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Payout & Banking Details
          </h3>
        </div>

        <div className="space-y-4">
          {/* Country Selection */}
          <div>
            <Label htmlFor="business_country">Country</Label>
            <select
              id="business_country"
              value={formData.business_country}
              onChange={e => {
                handleInputChange('business_country', e.target.value);
                handleInputChange('business_state_province', '');
                handleInputChange('business_bank_name', '');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="">Select country</option>
              {countries.sort((a, b) => a.name.localeCompare(b.name)).map(country => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          </div>

          {/* State/Province Selection */}
          {formData.business_country && (
            <div>
              <Label htmlFor="business_state_province">State/Province</Label>
              <select
                id="business_state_province"
                value={formData.business_state_province}
                onChange={e => handleInputChange('business_state_province', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="">Select state/province</option>
                {(statesByCountry[formData.business_country] || []).map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          )}

          {/* Bank Selection */}
          {formData.business_country && (
            <div>
              <Label htmlFor="business_bank_name">Bank</Label>
              <select
                id="business_bank_name"
                value={formData.business_bank_name}
                onChange={e => handleInputChange('business_bank_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="">Select bank</option>
                {(banksByCountry[formData.business_country] || []).map(bank => (
                  <option key={bank.code} value={bank.name}>{bank.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Account Number */}
          <div>
            <Label htmlFor="business_account_number">Account Number</Label>
            <Input
              id="business_account_number"
              value={formData.business_account_number}
              onChange={e => handleInputChange('business_account_number', e.target.value)}
              placeholder="Account Number"
            />
          </div>

          {/* Account Name */}
          <div>
            <Label htmlFor="business_account_holder">Account Name</Label>
            <Input
              id="business_account_holder"
              value={formData.business_account_holder}
              onChange={e => handleInputChange('business_account_holder', e.target.value)}
              placeholder="Account Name"
            />
          </div>

          {/* Branch Name */}
          <div>
            <Label htmlFor="business_branch_name">Branch Name</Label>
            <Input
              id="business_branch_name"
              value={formData.business_branch_name}
              onChange={e => handleInputChange('business_branch_name', e.target.value)}
              placeholder="Branch Name"
            />
          </div>

          {/* PayPal Section */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Receive payments via PayPal
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable this to receive payments through PayPal
                </p>
              </div>
              <input
                type="checkbox"
                checked={!!formData.store_paypal_enabled}
                onChange={e => handleInputChange('store_paypal_enabled', e.target.checked)}
                className="form-checkbox h-5 w-5 text-purple-600"
              />
            </div>
            {formData.store_paypal_enabled && (
              <div>
                <Label htmlFor="store_paypal_email">PayPal Email</Label>
                <Input
                  id="store_paypal_email"
                  value={formData.store_paypal_email}
                  onChange={e => handleInputChange('store_paypal_email', e.target.value)}
                  placeholder="your.paypal@email.com"
                  type="email"
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Payout Settings'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
