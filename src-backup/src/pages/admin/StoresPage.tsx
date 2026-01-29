import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search,
  RefreshCw,
  Eye,
  Mail,
  Power,
  Trash2,
  Gift,
  User,
  Package,
  Globe,
  Calendar,
  Paperclip,
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// Types
type User = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

type Store = {
  id: string;
  store_name: string;
  user_id: string;
  is_active: boolean;
  logo_url?: string | null;
  store_category?: string | null;
  country?: string | null;
  created_at: string;
  updated_at: string;
  description?: string | null;
  verification_status?: string | null;
  business_email?: string | null;
  free_until?: string | null;
  user?: User | null;
  product_count: number;
};

type AttachmentFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploading?: boolean;
  progress?: number;
};

type EmailFormData = {
  recipient: string;
  subject: string;
  message: string;
  attachments: AttachmentFile[];
};

// File size formatter
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get file icon based on type
const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (type === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (type.includes('word') || type.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />;
  if (type.includes('spreadsheet') || type.includes('excel')) return <FileText className="h-4 w-4 text-green-500" />;
  return <FileText className="h-4 w-4" />;
};

const StoresPage = () => {
  // State
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailForm, setEmailForm] = useState<EmailFormData>({
    recipient: '',
    subject: '',
    message: '',
    attachments: []
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch stores
  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const { data: storesData, error: storesError } = await supabase
        .from('user_stores')
        .select('*')
        .order('created_at', { ascending: false });

      if (storesError) throw storesError;

      const storesWithUsers = await enrichStoresWithUsers(storesData || []);
      const storesWithCounts = await enrichStoresWithProductCounts(storesWithUsers);
      
      setStores(storesWithCounts);
      toast.success('Stores loaded successfully');
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  }, []);

  // Enrich stores with user data
  const enrichStoresWithUsers = async (stores: any[]): Promise<Store[]> => {
    const userIds = [...new Set(stores.map(s => s.user_id).filter(Boolean))];
    
    if (userIds.length === 0) return stores;

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    if (error) throw error;

    const usersMap: Record<string, User> = (users || []).reduce(
      (acc: Record<string, User>, user: any) => ({ ...acc, [user.id]: user }),
      {} as Record<string, User>
    );

    return stores.map(store => ({
      ...store,
      user: usersMap[String((store as any).user_id)] || null
    }));
  };

  // Enrich stores with product counts
  const enrichStoresWithProductCounts = async (stores: Store[]): Promise<Store[]> => {
    const storeIds = stores.map(s => s.id).filter(Boolean);

    if (storeIds.length === 0) return stores;

    const { data: products, error } = await supabase
      .from('store_products')
      .select('store_id')
      .in('store_id', storeIds);

    if (error) throw error;

    const countsMap = (products || []).reduce(
      (acc: Record<string, number>, product) => {
        acc[product.store_id] = (acc[product.store_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return stores.map(store => ({
      ...store,
      product_count: countsMap[store.id] || 0
    }));
  };

  // Actions
  const toggleStoreActive = async (storeId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from('user_stores')
        .update({ is_active: newStatus })
        .eq('id', storeId);

      if (error) throw error;

      setStores(prev => prev.map(store =>
        store.id === storeId ? { ...store, is_active: newStatus } : store
      ));
      
      toast.success(`Store ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Failed to update store status:', error);
      toast.error('Failed to update store status');
    }
  };

  const deleteStore = async (storeId: string) => {
    if (!confirm('Are you sure you want to delete this store? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('user_stores')
        .delete()
        .eq('id', storeId);

      if (error) throw error;

      setStores(prev => prev.filter(store => store.id !== storeId));
      if (selectedStore?.id === storeId) {
        setSelectedStore(null);
      }
      
      toast.success('Store deleted successfully');
    } catch (error) {
      console.error('Failed to delete store:', error);
      toast.error('Failed to delete store');
    }
  };

  const grantFreeUsage = async (storeId: string, months: number = 24) => {
    if (!confirm(`Grant ${months} months free usage for this store?`)) return;

    try {
      const freeUntil = new Date();
      freeUntil.setMonth(freeUntil.getMonth() + months);

      const { error } = await supabase
        .from('user_stores')
        .update({ free_until: freeUntil.toISOString() })
        .eq('id', storeId);

      if (error) throw error;

      setStores(prev => prev.map(store =>
        store.id === storeId ? { ...store, free_until: freeUntil.toISOString() } : store
      ));

      toast.success(`${months} months free usage granted successfully!`);
    } catch (error) {
      console.error('Failed to grant free usage:', error);
      toast.error('Failed to grant free usage');
    }
  };

  // Upload file to Supabase Storage
  const uploadFileToStorage = async (file: File): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `email-attachments/${fileName}`;

        const { data, error } = await supabase.storage
          .from('attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        resolve(publicUrl);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    const newAttachments: AttachmentFile[] = [];

    // First, add files with uploading state
    Array.from(files).forEach(file => {
      const attachmentId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      newAttachments.push({
        id: attachmentId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploading: true,
        progress: 0
      });
    });

    // Update state with uploading files
    setEmailForm(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments]
    }));

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attachmentId = newAttachments[i].id;

      try {
        // Simulate progress for better UX using functional state update
        const progressInterval = setInterval(() => {
          setEmailForm(prev => ({
            ...prev,
            attachments: prev.attachments.map(att =>
              att.id === attachmentId ? { ...att, progress: Math.min((att.progress || 0) + 10, 90) } : att
            )
          }));
        }, 200);

        // Upload file
        const url = await uploadFileToStorage(file);

        clearInterval(progressInterval);
        // Ensure final progress = 100 for this attachment
        setEmailForm(prev => ({
          ...prev,
          attachments: prev.attachments.map(att => att.id === attachmentId ? { ...att, progress: 100 } : att)
        }));

        // Update with final URL
        setEmailForm(prev => ({
          ...prev,
          attachments: prev.attachments.map(att =>
            att.id === attachmentId
              ? { ...att, url, uploading: false, progress: undefined }
              : att
          )
        }));

        toast.success(`Uploaded: ${file.name}`);
      } catch (error) {
        console.error('Failed to upload file:', error);
        setEmailForm(prev => ({
          ...prev,
          attachments: prev.attachments.filter(att => att.id !== attachmentId)
        }));
        toast.error(`Failed to upload: ${file.name}`);
      }
    }

    setUploadingFiles(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = (attachmentId: string) => {
    setEmailForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentId)
    }));
  };

  // Send email with attachments
  const sendEmail = async () => {
    if (!emailForm.recipient.trim()) {
      toast.error('Recipient email is required');
      return;
    }

    // Check for still uploading files
    const stillUploading = emailForm.attachments.some(att => att.uploading);
    if (stillUploading) {
      toast.error('Please wait for all files to finish uploading');
      return;
    }

    setSendingEmail(true);
    try {
      const attachmentUrls = emailForm.attachments
        .map(att => att.url)
        .filter(Boolean) as string[];

      const payload = {
        email: emailForm.recipient,
        subject: emailForm.subject,
        message: emailForm.message,
        attachments: attachmentUrls
      };

      const response = await fetch('https://nsq-email-backend.onrender.com/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) throw data;

      toast.success('Email sent successfully!');
      setEmailDialogOpen(false);
      setEmailForm({
        recipient: '',
        subject: '',
        message: '',
        attachments: []
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const openEmailDialog = (store: Store) => {
    setEmailForm({
      recipient: store.user?.email || store.business_email || store.user_id,
      subject: `Message about your store: ${store.store_name}`,
      message: '',
      attachments: []
    });
    setEmailDialogOpen(true);
  };

  // Filtered stores
  const filteredStores = useMemo(() => {
    if (!searchQuery.trim()) return stores;

    const query = searchQuery.toLowerCase();
    return stores.filter(store =>
      store.store_name.toLowerCase().includes(query) ||
      store.user?.email?.toLowerCase().includes(query) ||
      store.store_category?.toLowerCase().includes(query) ||
      store.country?.toLowerCase().includes(query)
    );
  }, [stores, searchQuery]);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Effects
  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Stores Management</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage all stores and their owners
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-[300px]"
                />
              </div>
              <Button onClick={fetchStores} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stores Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No stores found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStores.map((store) => (
                      <TableRow key={store.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {store.logo_url && (
                              <img
                                src={store.logo_url}
                                alt={store.store_name}
                                className="h-10 w-10 rounded-md object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium">{store.store_name}</p>
                              {store.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {store.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{store.user?.email || store.user_id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span>{store.product_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>{store.store_category || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span>{store.country || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={store.is_active ? "default" : "destructive"}>
                            {store.is_active ? 'Active' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{formatDate(store.created_at)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedStore(store)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEmailDialog(store)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleStoreActive(store.id, store.is_active)}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteStore(store.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => grantFreeUsage(store.id)}
                            >
                              <Gift className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Details Dialog */}
      <Dialog open={!!selectedStore} onOpenChange={(open) => !open && setSelectedStore(null)}>
        <DialogContent className="max-w-2xl">
          {selectedStore && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedStore.logo_url && (
                    <img
                      src={selectedStore.logo_url}
                      alt={selectedStore.store_name}
                      className="h-10 w-10 rounded-md"
                    />
                  )}
                  {selectedStore.store_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Owner</h4>
                    <p>{selectedStore.user?.email || selectedStore.user_id}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Category</h4>
                    <p>{selectedStore.store_category || '-'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Products</h4>
                    <p>{selectedStore.product_count}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Country</h4>
                    <p>{selectedStore.country || '-'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                    <Badge variant={selectedStore.is_active ? "default" : "destructive"}>
                      {selectedStore.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Free Until</h4>
                    <p>{selectedStore.free_until ? formatDate(selectedStore.free_until) : 'Not set'}</p>
                  </div>
                </div>
                {selectedStore.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                    <p className="mt-1">{selectedStore.description}</p>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Created: {new Date(selectedStore.created_at).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Dialog with File Uploads */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Recipient */}
            <div>
              <label className="text-sm font-medium mb-1 block">To</label>
              <Input
                value={emailForm.recipient}
                onChange={(e) => setEmailForm(prev => ({ ...prev, recipient: e.target.value }))}
                placeholder="recipient@example.com"
                className="w-full"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium mb-1 block">Subject</label>
              <Input
                value={emailForm.subject}
                onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject"
                className="w-full"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-sm font-medium mb-1 block">Message</label>
              <textarea
                value={emailForm.message}
                onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                className="w-full min-h-[150px] p-3 border rounded-md resize-y"
                placeholder="Your message here..."
              />
            </div>

            {/* File Upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Attachments</label>
                <span className="text-xs text-muted-foreground">
                  {emailForm.attachments.length} file(s)
                </span>
              </div>
              
              {/* File Input */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.zip"
                  disabled={uploadingFiles}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFiles}
                  className="gap-2"
                >
                  {uploadingFiles ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadingFiles ? 'Uploading...' : 'Upload Files'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Max file size: 50MB • PDF, DOC, Images, ZIP, TXT
                </p>
              </div>

              {/* Attachment List */}
              {emailForm.attachments.length > 0 && (
                <div className="space-y-2">
                  {emailForm.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getFileIcon(attachment.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {attachment.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.size)}
                            </span>
                            {attachment.uploading && (
                              <>
                                <Progress
                                  value={attachment.progress}
                                  className="h-1 w-24"
                                />
                                <span className="text-xs text-muted-foreground">
                                  {attachment.progress}%
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => removeAttachment(attachment.id)}
                        disabled={attachment.uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setEmailDialogOpen(false)}
                disabled={sendingEmail || uploadingFiles}
              >
                Cancel
              </Button>
              <Button
                onClick={sendEmail}
                disabled={
                  sendingEmail ||
                  uploadingFiles ||
                  !emailForm.recipient.trim() ||
                  emailForm.attachments.some(att => att.uploading)
                }
                className="gap-2"
              >
                {sendingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoresPage;