import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Upload, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { countries } from '@/utils/countries';
import { banksByCountry } from '@/utils/banksByCountry';

interface EnhancedStoreSetupModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialStep?: number;
  store?: Store | null;
}

// Add Store type for prop
interface Store {
  id: string;
  store_name: string;
  store_category: string;
  description: string;
  base_currency: string;
  shipping_partner: string;
  logo_url?: string;
  verification_status?: string;
  is_active?: boolean;
  country?: string;
  business_registration_number?: string;
  business_registered_name?: string;
  business_bank_name?: string;
  business_bank_account_number?: string;
  business_bank_account_type?: string;
  business_bank_branch?: string;
  business_address?: string;
  business_contact_number?: string;
  business_email?: string;
}

export const EnhancedStoreSetupModal: React.FC<EnhancedStoreSetupModalProps> = ({ onClose, onSuccess, initialStep = 1, store }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [formData, setFormData] = useState({
    store_name: store?.store_name || '',
    description: store?.description || '',
    store_category: store?.store_category || '',
    country: store?.country || '',
    base_currency: store?.base_currency || 'USD',
    shipping_partner: store?.shipping_partner || '',
    business_registration_number: store?.business_registration_number || '',
    business_registered_name: store?.business_registered_name || '',
    business_registration_document: null as File | null,
    business_bank_name: store?.business_bank_name || '',
    business_bank_account_number: store?.business_bank_account_number || '',
    business_bank_account_type: store?.business_bank_account_type || '',
    business_bank_branch: store?.business_bank_branch || '',
    business_address: store?.business_address || '',
    business_contact_number: store?.business_contact_number || '',
    business_email: store?.business_email || '',
    verification_documents: [] as File[]
  });

  // Validation state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const categories = [
    'Fashion & Clothing',
    'Electronics & Tech',
    'Home & Garden',
    'Health & Beauty',
    'Sports & Outdoors',
    'Books & Media',
    'Food & Beverages',
    'Arts & Crafts',
    'Services',
    'Digital Products',
    'Other'
  ];

  const shippingPartners = [
    'DHL',
    'FedEx',
    'UPS',
    'USPS',
    'The Courier Guy',
    'Pudo',
    'Buffalo',
    'Aramex',
    'PostNet',
    'Local Courier',
    'Self Delivery',
    'Other'
  ];

  // Add state for filtered banks
  const [filteredBanks, setFilteredBanks] = useState<{ name: string; code: string }[]>([]);

  // Update banks when country changes
  useEffect(() => {
    if (formData.country && banksByCountry[formData.country]) {
      setFilteredBanks(banksByCountry[formData.country]);
    } else {
      setFilteredBanks([]);
    }
  }, [formData.country]);

  const getCurrencyByCountry = (countryCode: string) => {
    const currencyMap: Record<string, string> = {
      'US': 'USD', 'NG': 'NGN', 'GB': 'GBP', 'CA': 'CAD', 
      'AU': 'AUD', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR',
      'ES': 'EUR', 'NL': 'EUR', 'JP': 'JPY', 'CN': 'CNY',
      'IN': 'INR', 'BR': 'BRL', 'MX': 'MXN', 'ZA': 'ZAR'
    };
    return currencyMap[countryCode] || 'USD';
  };

  const handleCountryChange = (countryCode: string) => {
    setFormData(prev => ({
      ...prev,
      country: countryCode,
      base_currency: getCurrencyByCountry(countryCode)
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async () => {
    if (!user || !logoFile) return null;

    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${user.id}/logo/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('store-assets')
        .upload(fileName, logoFile);

      if (error) {
        console.error('Logo upload error:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('store-assets')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      return null;
    }
  };

  const uploadDocument = async (file: File) => {
    if (!user || !file) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/documents/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('store-assets')
        .upload(fileName, file);

      if (error) {
        console.error('Document upload error:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('store-assets')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading document:', error);
      return null;
    }
  };

  // Validate step 1
  const validateStep1 = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.store_name.trim()) newErrors.store_name = 'Store name is required.';
    if (!formData.store_category) newErrors.store_category = 'Store category is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate step 2
  const validateStep2 = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.country) newErrors.country = 'Country is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper: Validate fields for step 3 (all fields are optional for verification)
  const validateStep3 = () => {
    // Step 3 is optional - no validation needed
    setErrors({});
    return true;
  };

  // On submit, use update if store exists, insert if not
  const handleSubmit = async () => {
    setLoading(true);
    try {
      let logoUrl = store?.logo_url || '';
      let businessRegistrationDocumentUrl = store?.business_registration_document_url || '';
      // Upload logo if provided and new store
      if (!store && logoFile) {
        const uploadedLogoUrl = await uploadLogo();
        if (uploadedLogoUrl) logoUrl = uploadedLogoUrl;
      }
      // Upload business registration document if provided
      if (formData.business_registration_document instanceof File) {
        const uploadedDocUrl = await uploadDocument(formData.business_registration_document);
        if (uploadedDocUrl) businessRegistrationDocumentUrl = uploadedDocUrl;
      }

      // Prepare data for insert/update: exclude file objects
      const {
        business_registration_document, // eslint-disable-line @typescript-eslint/no-unused-vars
        verification_documents, // eslint-disable-line @typescript-eslint/no-unused-vars
        ...restFormData
      } = formData;

      if (store && store.id) {
        // Update existing store
        const { error } = await supabase
          .from('user_stores')
          .update({
            ...restFormData,
            logo_url: logoUrl,
            business_registration_document_url: businessRegistrationDocumentUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', store.id);
        if (error) throw error;
        toast({ title: 'Store updated', description: 'Your store details have been updated.' });
      } else {
        // Create new store
        const { error } = await supabase
          .from('user_stores')
          .insert([
            {
              ...restFormData,
              logo_url: logoUrl,
              business_registration_document_url: businessRegistrationDocumentUrl,
              user_id: user?.id,
              created_at: new Date().toISOString(),
              is_active: true
            }
          ]);
        if (error) throw error;
        toast({ title: 'Store created', description: 'Your store has been created.' });
      }
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to save store details.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Navigation logic
  const nextStep = () => {
    let isValid = true;
    
    if (currentStep === 1) {
      isValid = validateStep1();
    } else if (currentStep === 2) {
      isValid = validateStep2();
    } else if (currentStep === 3) {
      isValid = validateStep3();
    }
    
    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
    setErrors({}); // Clear errors when going back
  };

  // For country dropdown, use countries array sorted alphabetically
  const sortedCountries = [...countries].sort((a, b) => a.name.localeCompare(b.name));

  // Add search state for banks
  const [bankSearch, setBankSearch] = useState('');
  const displayedBanks = filteredBanks.filter(bank => 
    bank.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // Add country search state
  const [countrySearch, setCountrySearch] = useState('');
  const displayedCountries = sortedCountries.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Set Up Your Store
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Progress value={(currentStep / 3) * 100} className="mb-4" />

          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="store_name">Store Name *</Label>
                <Input
                  id="store_name"
                  value={formData.store_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, store_name: e.target.value }))}
                  placeholder="Enter your store name"
                  required
                />
                {errors.store_name && <p className="text-red-500 text-xs mt-1">{errors.store_name}</p>}
              </div>

              <div>
                <Label htmlFor="store_category">Store Category *</Label>
                <Select 
                  value={formData.store_category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, store_category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.store_category && <p className="text-red-500 text-xs mt-1">{errors.store_category}</p>}
              </div>

              <div>
                <Label htmlFor="description">Store Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what your store offers"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="logo">Store Logo</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    id="logo"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('logo')?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Store Logo
                  </Button>
                  {logoPreview && (
                    <div className="mt-3 flex justify-center">
                      <img src={logoPreview} alt="Logo preview" className="h-20 w-20 object-cover rounded" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location & Currency */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="country">Country *</Label>
                <Select 
                  value={formData.country} 
                  onValueChange={handleCountryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder="Search country..."
                        value={countrySearch}
                        onChange={e => setCountrySearch(e.target.value)}
                        className="mb-2"
                      />
                    </div>
                    {displayedCountries.map(country => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
              </div>

              <div>
                <Label htmlFor="base_currency">Base Currency</Label>
                <Input
                  id="base_currency"
                  value={formData.base_currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, base_currency: e.target.value }))}
                  placeholder="USD"
                />
              </div>

              <div>
                <Label htmlFor="shipping_partner">Preferred Shipping Partner</Label>
                <Select 
                  value={formData.shipping_partner} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, shipping_partner: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipping partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingPartners.map((partner) => (
                      <SelectItem key={partner} value={partner}>
                        {partner}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Verification (Optional) */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="font-medium">Store Verification (Optional)</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Get your store verified to build trust with customers and get a verified badge
                </p>
              </div>
              
              <div>
                <Label htmlFor="business_registered_name">Company Registered Name</Label>
                <Input
                  id="business_registered_name"
                  value={formData.business_registered_name}
                  onChange={e => setFormData(prev => ({ ...prev, business_registered_name: e.target.value }))}
                  placeholder="Enter your company registered name"
                />
              </div>
              
              <div>
                <Label htmlFor="business_registration_number">Registration Number</Label>
                <Input
                  id="business_registration_number"
                  value={formData.business_registration_number}
                  onChange={e => setFormData(prev => ({ ...prev, business_registration_number: e.target.value }))}
                  placeholder="Enter your business registration number"
                />
              </div>
              
              <div>
                <Label htmlFor="business_registration_document">Registration Document</Label>
                <Input
                  id="business_registration_document"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={e => setFormData(prev => ({ ...prev, business_registration_document: e.target.files?.[0] || null }))}
                />
              </div>
              
              <div>
                <Label htmlFor="business_bank_name">Bank Name</Label>
                <Select
                  value={formData.business_bank_name}
                  onValueChange={value => setFormData(prev => ({ ...prev, business_bank_name: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder="Search bank..."
                        value={bankSearch}
                        onChange={e => setBankSearch(e.target.value)}
                        className="mb-2"
                      />
                    </div>
                    {displayedBanks.length === 0 ? (
                      <div className="px-3 py-2 text-gray-500">
                        {formData.country ? 'No banks found' : 'Please select a country first'}
                      </div>
                    ) : (
                      displayedBanks.map(bank => (
                        <SelectItem key={bank.code} value={bank.name}>{bank.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="business_bank_account_number">Account Number</Label>
                <Input
                  id="business_bank_account_number"
                  value={formData.business_bank_account_number}
                  onChange={e => setFormData(prev => ({ ...prev, business_bank_account_number: e.target.value }))}
                  placeholder="Enter account number"
                />
              </div>
              
              <div>
                <Label htmlFor="business_bank_account_type">Account Type</Label>
                <Input
                  id="business_bank_account_type"
                  value={formData.business_bank_account_type}
                  onChange={e => setFormData(prev => ({ ...prev, business_bank_account_type: e.target.value }))}
                  placeholder="e.g. Checking, Savings"
                />
              </div>
              
              <div>
                <Label htmlFor="business_bank_branch">Bank Branch</Label>
                <Input
                  id="business_bank_branch"
                  value={formData.business_bank_branch}
                  onChange={e => setFormData(prev => ({ ...prev, business_bank_branch: e.target.value }))}
                  placeholder="Enter branch name or code"
                />
              </div>
              
              <div>
                <Label htmlFor="business_address">Business Address</Label>
                <Textarea
                  id="business_address"
                  value={formData.business_address}
                  onChange={e => setFormData(prev => ({ ...prev, business_address: e.target.value }))}
                  placeholder="Enter business address"
                />
              </div>
              
              <div>
                <Label htmlFor="business_contact_number">Contact Number</Label>
                <Input
                  id="business_contact_number"
                  value={formData.business_contact_number}
                  onChange={e => setFormData(prev => ({ ...prev, business_contact_number: e.target.value }))}
                  placeholder="Enter contact number"
                />
              </div>
              
              <div>
                <Label htmlFor="business_email">Business Email</Label>
                <Input
                  id="business_email"
                  type="email"
                  value={formData.business_email}
                  onChange={e => setFormData(prev => ({ ...prev, business_email: e.target.value }))}
                  placeholder="Enter business email"
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 mt-6 border-t">
            <div>
              {currentStep > 1 && (
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              
              {currentStep < 3 ? (
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {loading ? 'Saving...' : 'Save Store Details'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
