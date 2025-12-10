import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  product_type: string;
  category: string;
  tags: string[];
  images: string[];
  files: string[];
  is_active: boolean;
  is_on_sale?: boolean;
  is_deals_of_day?: boolean;
  created_at: string;
  store_id: string;
  // debug/diagnostic fields (may be present from the DB)
  user_id?: string;
  updated_at?: string;
}

interface EditProductModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSave: (product: Product) => void;
  isSaving?: boolean;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({ 
  open, 
  product, 
  onClose, 
  onSave, 
  isSaving = false 
}) => {
  const [form, setForm] = useState<Product | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (product) {
      setForm(product);
    }
  }, [product]);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setErrors({});
    }
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (!form) return;

    setForm(prev => {
      if (!prev) return prev;
      
      if (name === 'price') {
        // Handle price conversion safely
        const numericValue = value === '' ? 0 : parseFloat(value);
        return { 
          ...prev, 
          [name]: isNaN(numericValue) ? 0 : numericValue 
        };
      } else {
        return { ...prev, [name]: value };
      }
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!form?.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!form?.description?.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (form && (form.price < 0 || isNaN(form.price))) {
      newErrors.price = 'Price must be a valid number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!form) return;
    
    if (validateForm()) {
      console.log('[EditProductModal] Saving product:', form);
      onSave(form);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Product Title</Label>
            <Input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Enter product title"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter product description"
              rows={4}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              min="0"
              value={form.price || ''}
              onChange={handleChange}
              placeholder="0.00"
              className={errors.price ? 'border-red-500' : ''}
            />
            {errors.price && (
              <p className="text-sm text-red-500">{errors.price}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="Enter product category"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_type">Product Type</Label>
            <Input
              id="product_type"
              name="product_type"
              value={form.product_type}
              onChange={handleChange}
              placeholder="Enter product type"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label>Put on Sale</Label>
              <Switch checked={!!form.is_on_sale} onCheckedChange={(val) => setForm(prev => prev ? ({ ...prev, is_on_sale: !!val }) : prev)} />
            </div>

            <div className="flex items-center justify-between">
              <Label>List in Deals of the Day</Label>
              <Switch checked={!!form.is_deals_of_day} onCheckedChange={(val) => setForm(prev => prev ? ({ ...prev, is_deals_of_day: !!val }) : prev)} />
            </div>
          </div>

          {/* Diagnostic: owner and last-updated (read-only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <Label>Owner (user_id)</Label>
              <Input readOnly value={form.user_id ?? '—'} />
            </div>

            <div>
              <Label>Last updated</Label>
              <Input readOnly value={form.updated_at ? new Date(form.updated_at).toLocaleString() : '—'} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};