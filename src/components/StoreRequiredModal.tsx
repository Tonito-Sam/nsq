import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Store, AlertCircle } from 'lucide-react';

interface StoreRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateStore: () => void;
}

export const StoreRequiredModal: React.FC<StoreRequiredModalProps> = ({
  open,
  onOpenChange,
  onCreateStore
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span>Store Required</span>
          </DialogTitle>
          <DialogDescription className="text-center py-4">
            You need to set up your store before you can add products. 
            This will only take a few minutes!
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-3">
          <Button onClick={onCreateStore} className="w-full">
            <Store className="h-4 w-4 mr-2" />
            Set Up My Store
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
