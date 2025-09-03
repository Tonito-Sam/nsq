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

interface StoreSettingsProps {
  store: Store | null;
  onStoreUpdate: (store: Store) => void;
}

export const StoreSettings: React.FC<StoreSettingsProps> = ({ store, onStoreUpdate }) => {
  const [formData, setFormData] = useState({
    store_name: store?.store_name || '',
    store_category: store?.store_category || '',
    description: store?.description || '',
    base_currency: store?.base_currency || 'ZAR',
    shipping_partner: store?.shipping_partner || '',
    business_country: '',
    business_state_province: '',
    business_bank_name: '',
    business_account_number: '',
    business_account_holder: '',
    business_branch_name: '',
    store_paypal_enabled: false,
    store_paypal_email: ''
  });
  const [saving, setSaving] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!store) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_stores')
        .update({
          store_name: formData.store_name,
          store_category: formData.store_category,
          description: formData.description,
          base_currency: formData.base_currency,
          shipping_partner: formData.shipping_partner,
          updated_at: new Date().toISOString()
        })
        .eq('id', store.id)
        .select()
        .single();

      if (error) throw error;

      onStoreUpdate(data);
      toast({
        title: "Success",
        description: "Store settings updated successfully"
      });
    } catch (error) {
      console.error('Error updating store:', error);
      toast({
        title: "Error",
        description: "Failed to update store settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
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
