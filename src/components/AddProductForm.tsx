
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

export const AddProductForm = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    product_type: '',
    category: '',
    tags: [] as string[],
    images: [] as string[],
    files: [] as string[],
  });
  // sale / deals fields will be stored as strings in the form and converted when submitting
  // is_on_sale: boolean, sale_price: string, sale_starts: string (datetime), sale_ends: string (datetime), is_deals_of_day: boolean
  const [isOnSale, setIsOnSale] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [saleStarts, setSaleStarts] = useState('');
  const [saleEnds, setSaleEnds] = useState('');
  const [isDealsOfDay, setIsDealsOfDay] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('store_products')
        .insert({
          ...formData,
          price: parseFloat(formData.price),
          is_on_sale: !!isOnSale,
          sale_price: salePrice ? parseFloat(salePrice) : null,
          sale_starts: saleStarts || null,
          sale_ends: saleEnds || null,
          is_deals_of_day: !!isDealsOfDay,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product added successfully!"
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Add New Product
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Product Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="product_type">Product Type</Label>
              <Select value={formData.product_type} onValueChange={(value) => setFormData(prev => ({ ...prev, product_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">Physical Product</SelectItem>
                  <SelectItem value="digital">Digital Product</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sale controls: sale toggle, sale price and period, deals of the day */}
            <div className="mt-4 space-y-2">
              <label className="flex items-center justify-between">
                <span className="text-sm">Put on Sale</span>
                <input type="checkbox" checked={isOnSale} onChange={(e) => setIsOnSale(e.target.checked)} />
              </label>

              {isOnSale && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    id="sale_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder={`Sale price`}
                    className="h-10"
                  />
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="datetime-local"
                      value={saleStarts}
                      onChange={(e) => setSaleStarts(e.target.value)}
                      className="h-10 rounded border p-2"
                    />
                    <input
                      type="datetime-local"
                      value={saleEnds}
                      onChange={(e) => setSaleEnds(e.target.value)}
                      className="h-10 rounded border p-2"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center justify-between">
                <span className="text-sm">List as Deals of the Day</span>
                <input type="checkbox" checked={isDealsOfDay} onChange={(e) => setIsDealsOfDay(e.target.checked)} />
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              placeholder="e.g., Electronics, Design, Consulting"
            />
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex space-x-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex items-center space-x-3 mr-2">
          
            </div>
            <div className="flex items-center space-x-3 mr-2">
           
           
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Product'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
