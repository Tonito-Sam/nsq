
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Store, MapPin, CreditCard, Upload, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { countries } from '@/utils/countries';

interface StoreSetupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const StoreSetupModal: React.FC<StoreSetupModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    store_name: '',
    description: '',
    store_category: '',
    
    // Step 2: Location & Currency
    country: '',
    base_currency: 'USD',
    shipping_partner: '',
    
    // Step 3: Verification (Optional)
    business_registration_number: '',
    business_bank_account: '',
    verification_documents: [] as File[]
  });

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
    'Local Courier',
    'Self Delivery',
    'Other'
  ];

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({
      ...prev,
      verification_documents: [...prev.verification_documents, ...files]
    }));
  };

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      verification_documents: prev.verification_documents.filter((_, i) => i !== index)
    }));
  };

  const uploadVerificationDocuments = async () => {
    if (!user || formData.verification_documents.length === 0) return [];

    const uploadedUrls: string[] = [];

    for (const file of formData.verification_documents) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/verification/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('verification-docs')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('verification-docs')
          .getPublicUrl(data.path);

        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Upload verification documents if any
      const documentUrls = await uploadVerificationDocuments();

      // Create store
      const { error } = await supabase
        .from('user_stores')
        .insert({
          user_id: user.id,
          store_name: formData.store_name,
          description: formData.description,
          store_category: formData.store_category,
          country: formData.country,
          base_currency: formData.base_currency,
          shipping_partner: formData.shipping_partner,
          business_registration_number: formData.business_registration_number || null,
          business_bank_account: formData.business_bank_account || null,
          verification_documents: documentUrls.length > 0 ? documentUrls : null,
          verification_status: documentUrls.length > 0 ? 'pending' : 'unverified'
        });

      if (error) throw error;

      // Create user preferences
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          base_currency: formData.base_currency,
          country: formData.country
        });

      toast({
        title: "Store Created Successfully!",
        description: "Your store has been set up and is ready to use"
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating store:', error);
      toast({
        title: "Error",
        description: "Failed to create store. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const getStepIcon = (step: number) => {
    if (step === 1) return <Store className="h-5 w-5" />;
    if (step === 2) return <MapPin className="h-5 w-5" />;
    return <CreditCard className="h-5 w-5" />;
  };

  const isStepValid = (step: number) => {
    if (step === 1) {
      return formData.store_name && formData.store_category;
    }
    if (step === 2) {
      return formData.country && formData.base_currency;
    }
    return true; // Step 3 is optional
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Set Up Your Store
            </h2>
            <Progress value={(currentStep / 3) * 100} className="mb-4" />
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : ''}`}>
                {getStepIcon(1)}
                <span className="ml-2">Basic Info</span>
              </span>
              <span className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : ''}`}>
                {getStepIcon(2)}
                <span className="ml-2">Location & Currency</span>
              </span>
              <span className={`flex items-center ${currentStep >= 3 ? 'text-blue-600' : ''}`}>
                {getStepIcon(3)}
                <span className="ml-2">Verification</span>
              </span>
            </div>
          </div>

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
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="base_currency">Base Currency</Label>
                <Input
                  id="base_currency"
                  value={formData.base_currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, base_currency: e.target.value }))}
                  placeholder="USD"
                />
                <p className="text-sm text-gray-600 mt-1">
                  This will be automatically set based on your country
                </p>
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
                <Label htmlFor="business_registration_number">Business Registration Number</Label>
                <Input
                  id="business_registration_number"
                  value={formData.business_registration_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_registration_number: e.target.value }))}
                  placeholder="Enter your business registration number"
                />
              </div>

              <div>
                <Label htmlFor="business_bank_account">Business Bank Account</Label>
                <Input
                  id="business_bank_account"
                  value={formData.business_bank_account}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_bank_account: e.target.value }))}
                  placeholder="Enter your business bank account details"
                />
              </div>

              <div>
                <Label htmlFor="verification_documents">Verification Documents</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    id="verification_documents"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('verification_documents')?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload business license, tax certificates, or other official documents
                  </p>
                </div>

                {formData.verification_documents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.verification_documents.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                        <span className="text-sm">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
                <Button 
                  onClick={nextStep}
                  disabled={!isStepValid(currentStep)}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit}
                  disabled={loading || !isStepValid(1) || !isStepValid(2)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  {loading ? 'Creating Store...' : 'Create Store'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
