import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/utils/mediaUtils';
import { StoreRequiredModal } from './StoreRequiredModal';
import { EnhancedStoreSetupModal } from './EnhancedStoreSetupModal';
import { ProductFormFields } from './product-form/ProductFormFields';
import { ProductFileUpload } from './product-form/ProductFileUpload';

interface ProductFormData {
  title: string;
  description: string;
  price: string;
  category: string;
  product_type: 'physical' | 'digital' | 'service';
  tags: string[];
  images: File[];
  files: File[];
  requirements?: string;
  delivery_time?: number;
}

interface EnhancedAddProductFormProps {
  onClose: () => void;
  onSuccess: () => void;
  storeCurrency: string;
  onChangeCurrency: () => void;
}

export const EnhancedAddProductForm: React.FC<EnhancedAddProductFormProps> = ({ onClose, onSuccess, storeCurrency, onChangeCurrency }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  // storeCurrency and onChangeCurrency are now properly destructured from props
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [showStoreRequired, setShowStoreRequired] = useState(false);
  const [showStoreSetup, setShowStoreSetup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    description: '',
    price: '',
    category: '',
    product_type: 'physical',
    tags: [],
    images: [],
    files: [],
    requirements: '',
    delivery_time: undefined,
  });

  useEffect(() => {
    console.log('Current user:', user);
    checkUserStore();
    createProductsBucket();
  }, [user]);

  const createProductsBucket = async () => {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === 'products');
      
      if (!bucketExists) {
        const { error } = await supabase.storage.createBucket('products', {
          public: true,
          allowedMimeTypes: ['image/*', 'application/*', 'text/*'],
          fileSizeLimit: 104857600
        });
        
        if (error) {
          console.error('Error creating products bucket:', error);
        }
      }
    } catch (error) {
      console.error('Error checking/creating bucket:', error);
    }
  };

  const checkUserStore = async () => {
    if (!user) {
      console.log('No user found');
      return;
    }

    try {
      console.log('Checking store for user ID:', user.id);
      const { data, error } = await supabase
        .from('user_stores')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking user store:', error);
        setHasStore(false);
        return;
      }

      console.log('Store check result:', data);
      setHasStore(!!data);
      setStoreId(data?.id || null);
      if (!data) {
        setShowStoreRequired(true);
      }
    } catch (error) {
      console.error('Error checking user store:', error);
      setHasStore(false);
    }
  };

  const handleCreateStore = () => {
    setShowStoreRequired(false);
    setShowStoreSetup(true);
  };

  const handleStoreCreated = () => {
    setShowStoreSetup(false);
    setHasStore(true);
    checkUserStore();
    toast({
      title: "Store Created",
      description: "Your store has been set up successfully! You can now add products.",
    });
  };

  const handleInputChange = (field: keyof ProductFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: 'images' | 'files', files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files);
      handleInputChange(field, [...formData[field], ...fileArray]);
    }
  };

  const removeFile = (field: 'images' | 'files', index: number) => {
    const newFiles = formData[field].filter((_, i) => i !== index);
    handleInputChange(field, newFiles);
  };

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      handleInputChange('tags', [...formData.tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started');
    console.log('User:', user);
    console.log('Has store:', hasStore);
    console.log('Store ID:', storeId);
    
    if (!user) {
      console.error('No user found during submission');
      toast({
        title: "Authentication Error",
        description: "Please sign in to add products.",
        variant: "destructive"
      });
      return;
    }

    if (!hasStore || !storeId) {
      console.log('No store found, showing store required modal');
      setShowStoreRequired(true);
      return;
    }

    if (!formData.title || !formData.price) {
      toast({
        title: "Missing Information",
        description: "Please fill in the title and price fields.",
        variant: "destructive"
      });
      return;
    }

    if (formData.product_type === 'digital' && formData.files.length === 0) {
      toast({
        title: "Missing Files",
        description: "Digital products must include downloadable files.",
        variant: "destructive"
      });
      return;
    }

    if (formData.product_type === 'service') {
      if (!formData.requirements || !formData.delivery_time) {
        toast({
          title: "Missing Information",
          description: "Please fill in the requirements and delivery time for your service.",
          variant: "destructive"
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      console.log('Starting file uploads...');
      
      const imageUrls = await Promise.all(
        formData.images.map(file => uploadFile(file, 'products', 'images/', user.id))
      );

      const fileUrls = formData.product_type === 'digital' ? await Promise.all(
        formData.files.map(file => uploadFile(file, 'products', 'files/', user.id))
      ) : [];

      console.log('Files uploaded successfully');
      console.log('User ID for product:', user.id);
      console.log('Store ID for product:', storeId);

      const productData: any = {
        user_id: user.id, // Ensure user_id is included if required by schema or RLS
        store_id: storeId,
        title: formData.title.trim(),
        price: parseFloat(formData.price),
        product_type: formData.product_type,
        is_active: true,
      };

      // Only add optional fields if they have a value
      if (formData.description?.trim()) productData.description = formData.description.trim();
      if (formData.category?.trim()) productData.category = formData.category.trim();
      if (formData.tags.length > 0) productData.tags = formData.tags;
      if (imageUrls.length > 0) productData.images = imageUrls;
      if (fileUrls.length > 0) productData.files = fileUrls;
      if (formData.product_type === 'service') {
        if (formData.requirements?.trim()) productData.requirements = formData.requirements.trim();
        if (formData.delivery_time) productData.delivery_time = formData.delivery_time;
      }

      console.log('Product data to insert:', productData);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication session expired. Please sign in again.');
      }
      
      if (!session?.user) {
        throw new Error('No authenticated user found. Please sign in again.');
      }

      console.log('Session user ID:', session.user.id);
      console.log('Product user ID:', productData.user_id);

      const { error } = await supabase
        .from('store_products')
        .insert(productData);

      if (error) {
        console.error('Database insertion error:', error);
        // Log the full error object for debugging
        toast({
          title: "Error",
          description: error.message + (error.details ? ` | Details: ${error.details}` : ''),
          variant: "destructive"
        });
        throw error;
      }

      console.log('Product inserted successfully');

      toast({
        title: "Product Added",
        description: "Your product has been added successfully!",
      });

      onSuccess();
      onClose();

    } catch (error: any) {
      console.error('Error adding product:', error);
      
      let errorMessage = "Failed to add product. Please try again.";
      
      if (error.message?.includes('row-level security')) {
        errorMessage = "Permission denied. Please ensure you're properly signed in and try again.";
      } else if (error.message?.includes('auth')) {
        errorMessage = "Authentication error. Please sign in again.";
      }
      
      toast({
        title: "Error",
        description: error.message || errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasStore === null) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Checking store status...</p>
        </CardContent>
      </Card>
    );
  }

  if (!hasStore && !showStoreRequired) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Store Required</h3>
          <p className="text-gray-600 mb-4">You need to set up your store before adding products.</p>
          <Button onClick={() => setShowStoreRequired(true)}>
            Set Up Store
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Add New Product</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-8 pb-6">
            <ProductFormFields
              formData={formData}
              currentTag={currentTag}
              onInputChange={handleInputChange}
              onTagChange={setCurrentTag}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              storeCurrency={storeCurrency}
              onChangeCurrency={onChangeCurrency}
            />

            <ProductFileUpload
              images={formData.images}
              files={formData.files}
              productType={formData.product_type}
              onImageChange={(files) => handleFileChange('images', files)}
              onFileChange={(files) => handleFileChange('files', files)}
              onRemoveImage={(index) => removeFile('images', index)}
              onRemoveFile={(index) => removeFile('files', index)}
            />

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose} size="lg">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !hasStore}
                className="bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding Product...
                  </div>
                ) : (
                  'Add Product'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <StoreRequiredModal
        open={showStoreRequired}
        onOpenChange={setShowStoreRequired}
        onCreateStore={handleCreateStore}
      />

      {showStoreSetup && (
        <EnhancedStoreSetupModal
          onClose={() => setShowStoreSetup(false)}
          onSuccess={handleStoreCreated}
        />
      )}
    </>
  );
};
