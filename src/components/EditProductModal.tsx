import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  created_at: string;
  store_id: string;
}

interface EditProductModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSave: (product: Product) => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({ open, product, onClose, onSave }) => {
  const [form, setForm] = useState<Product | null>(product);

  React.useEffect(() => {
    setForm(product);
  }, [product]);

  if (!form) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => prev ? { ...prev, [name]: value } : prev);
  };

  const handleSave = () => {
    if (form) onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTitle>Edit Product</DialogTitle>
      <DialogContent className="space-y-4">
        <input name="title" value={form.title} onChange={handleChange} placeholder="Title" className="w-full p-2 border rounded" />
        <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="w-full p-2 border rounded" />
        <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="Price" className="w-full p-2 border rounded" />
        <input name="category" value={form.category} onChange={handleChange} placeholder="Category" className="w-full p-2 border rounded" />
        {/* Add more fields as needed */}
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
};
