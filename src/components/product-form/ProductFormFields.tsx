import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

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

interface ProductFormFieldsProps {
  formData: ProductFormData;
  currentTag: string;
  onInputChange: (field: keyof ProductFormData, value: any) => void;
  onTagChange: (tag: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  storeCurrency: string;
  onChangeCurrency: () => void;
}

const categories = [
  'Electronics & Tech',
  'Fashion & Clothing',
  'Home & Garden',
  'Health & Beauty',
  'Sports & Outdoors',
  'Books & Media',
  'Food & Beverages',
  'Arts & Crafts',
  'Digital Products',
  'Services',
  'Other'
];

export const ProductFormFields: React.FC<ProductFormFieldsProps> = ({
  formData,
  currentTag,
  onInputChange,
  onTagChange,
  onAddTag,
  onRemoveTag,
  storeCurrency,
  onChangeCurrency
}) => {
  return (
    <div className="space-y-6">
      {/* Product Type Selection */}
      <div className="space-y-3">
        <Label className="text-lg font-semibold">Product Type</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
            <input
              type="radio"
              value="physical"
              checked={formData.product_type === 'physical'}
              onChange={(e) => onInputChange('product_type', e.target.value)}
              className="text-purple-600"
            />
            <div>
              <span className="font-medium">Physical Product</span>
              <p className="text-sm text-gray-500">Tangible items that require shipping</p>
            </div>
          </label>
          <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
            <input
              type="radio"
              value="digital"
              checked={formData.product_type === 'digital'}
              onChange={(e) => onInputChange('product_type', e.target.value)}
              className="text-purple-600"
            />
            <div>
              <span className="font-medium">Digital Product</span>
              <p className="text-sm text-gray-500">Downloadable files, software, etc.</p>
            </div>
          </label>
          <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
            <input
              type="radio"
              value="service"
              checked={formData.product_type === 'service'}
              onChange={(e) => onInputChange('product_type', e.target.value)}
              className="text-purple-600"
            />
            <div>
              <span className="font-medium">Service</span>
              <p className="text-sm text-gray-500">Consulting, support, etc.</p>
            </div>
          </label>
        </div>
      </div>

      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="title">Product Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => onInputChange('title', e.target.value)}
            placeholder="Enter product title"
            required
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="price">Price ({storeCurrency}) *</Label>
            <Button type="button" variant="ghost" size="sm" onClick={onChangeCurrency}>
              Change Base Currency
            </Button>
          </div>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => onInputChange('price', e.target.value)}
            placeholder={`0.00 (${storeCurrency})`}
            required
            className="h-12"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) => onInputChange('category', e.target.value)}
          placeholder={
            formData.product_type === 'service' 
              ? "e.g., Consulting, Design, Marketing"
              : formData.product_type === 'digital'
              ? "e.g., Software, Ebooks, Templates"
              : "e.g., Electronics, Clothing, Books"
          }
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => onInputChange('description', e.target.value)}
          placeholder={
            formData.product_type === 'service'
              ? "Describe your service, what's included, duration, etc..."
              : formData.product_type === 'digital'
              ? "Describe your digital product, features, requirements, etc..."
              : "Describe your product, features, specifications, etc..."
          }
          rows={6}
          className="resize-none"
        />
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <Label>Tags</Label>
        <div className="flex space-x-2">
          <Input
            value={currentTag}
            onChange={(e) => onTagChange(e.target.value)}
            placeholder="Add a tag"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), onAddTag())}
            className="h-12"
          />
          <Button type="button" onClick={onAddTag} size="lg" className="px-6">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="flex items-center space-x-2 py-2 px-3">
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Service-specific fields */}
      {formData.product_type === 'service' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="requirements">Service Requirements *</Label>
            <Textarea
              id="requirements"
              value={formData.requirements || ''}
              onChange={e => onInputChange('requirements', e.target.value)}
              placeholder="Describe what you need from the customer to start the service"
              rows={3}
              required
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery_time">Delivery Time (days) *</Label>
            <Input
              id="delivery_time"
              type="number"
              min="1"
              value={formData.delivery_time || ''}
              onChange={e => onInputChange('delivery_time', e.target.value)}
              placeholder="e.g., 3"
              required
              className="h-12"
            />
          </div>
        </div>
      )}
    </div>
  );
};
