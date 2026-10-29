import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Building2, 
  Plus, 
  Globe, 
  MapPin, 
  Briefcase,
  Users,
  Loader2,
  Edit,
  Trash2,
  X,
  Check,
  Upload
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import axios from 'axios';
import apiUrl from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { uploadFile } from '@/utils/mediaUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Organization {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_photo_url: string | null;
  website: string | null;
  location: string | null;
  industry: string | null;
  verified: boolean;
  members_count: number;
  followers_count: number;
  created_at: string;
}

interface OrganizationFormData {
  name: string;
  description: string;
  website: string;
  location: string;
  industry: string;
  logo_url: string;
  cover_photo_url: string;
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export const OrganizationsTab = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: '',
    description: '',
    website: '',
    location: '',
    industry: '',
    logo_url: '',
    cover_photo_url: ''
  });

  // Fetch organizations on component mount
  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  const fetchOrganizations = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data } = await axios.get(
        apiUrl(`/api/organizations?user_id=${encodeURIComponent(user.id)}`),
        { withCredentials: true }
      );
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching organizations:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch organizations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof OrganizationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      website: '',
      location: '',
      industry: '',
      logo_url: '',
      cover_photo_url: ''
    });
    setEditingOrg(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      description: org.description || '',
      website: org.website || '',
      location: org.location || '',
      industry: org.industry || '',
      logo_url: org.logo_url || '',
      cover_photo_url: org.cover_photo_url || ''
    });
    setIsModalOpen(true);
  };

  const handleFileUpload = async (type: 'logo' | 'cover', file: File) => {
    if (!user) return;
    
    try {
      if (type === 'logo') {
        setUploadingLogo(true);
      } else {
        setUploadingCover(true);
      }

      const bucket = 'organizations';
      const folder = type === 'logo' ? 'logos/' : 'covers/';
      const field = type === 'logo' ? 'logo_url' : 'cover_photo_url';
      const mediaUrl = await uploadFile(file, bucket, folder, user.id);

      if (editingOrg) {
        const { data: savedOrganization, error } = await supabase
          .from('organizations')
          .update({ [field]: mediaUrl })
          .eq('id', editingOrg.id)
          .eq('owner_id', user.id)
          .select('id, logo_url, cover_photo_url')
          .single();

        if (error) throw error;
        if (savedOrganization[field] !== mediaUrl) {
          throw new Error('The image uploaded, but its URL was not saved to the organization.');
        }

        setEditingOrg(current => current ? { ...current, [field]: mediaUrl } : current);
        await fetchOrganizations();
        window.dispatchEvent(new Event('organizations-updated'));
      }
      
      setFormData(prev => ({
        ...prev,
        [field]: mediaUrl
      }));

      toast({
        title: 'Success!',
        description: `${type === 'logo' ? 'Logo' : 'Cover photo'} uploaded successfully.`,
      });
    } catch (error: any) {
      console.error(`Error uploading ${type}:`, error);
      toast({
        title: 'Error',
        description: error.message || `Failed to upload ${type}`,
        variant: 'destructive',
      });
    } finally {
      if (type === 'logo') {
        setUploadingLogo(false);
      } else {
        setUploadingCover(false);
      }
    }
  };

  const triggerFileUpload = (type: 'logo' | 'cover') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileUpload(type, file);
      }
    };
    input.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);
      
      // Generate slug from name
      const slug = generateSlug(formData.name);
      
      // Check if slug already exists (for new orgs or if name changed)
      if (!editingOrg || editingOrg.name !== formData.name) {
        const { data: existingOrg, error: checkError } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (checkError) throw checkError;
        
        if (existingOrg && (!editingOrg || existingOrg.id !== editingOrg.id)) {
          toast({
            title: 'Error',
            description: 'An organization with this name already exists',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }

      const organizationData = {
        owner_id: user.id,
        name: formData.name,
        slug,
        description: formData.description || null,
        logo_url: formData.logo_url || null,
        cover_photo_url: formData.cover_photo_url || null,
        website: formData.website || null,
        location: formData.location || null,
        industry: formData.industry || null,
        verified: editingOrg?.verified || false,
        members_count: editingOrg?.members_count || 1,
        followers_count: editingOrg?.followers_count || 0
      };

      let error;
      let savedOrganization: Pick<Organization, 'logo_url' | 'cover_photo_url'> | null = null;
      
      if (editingOrg) {
        // Update existing organization
        const { data: updatedOrganization, error: updateError } = await supabase
          .from('organizations')
          .update(organizationData)
          .eq('id', editingOrg.id)
          .eq('owner_id', user.id)
          .select('id, logo_url, cover_photo_url')
          .single();
        error = updateError;
        savedOrganization = updatedOrganization;
      } else {
        // Create new organization
        const { data: createdOrganization, error: insertError } = await supabase
          .from('organizations')
          .insert([organizationData])
          .select('id, logo_url, cover_photo_url')
          .single();
        error = insertError;
        savedOrganization = createdOrganization;
      }

      if (error) throw error;
      if (!savedOrganization) throw new Error('Organization save could not be confirmed.');
      if (
        (formData.logo_url && savedOrganization.logo_url !== formData.logo_url) ||
        (formData.cover_photo_url && savedOrganization.cover_photo_url !== formData.cover_photo_url)
      ) {
        throw new Error('The organization saved, but the logo or cover URL did not persist. Please retry.');
      }

      toast({
        title: 'Success!',
        description: editingOrg ? 'Organization updated successfully.' : 'Organization created successfully.',
      });

      // Refresh organizations list
      await fetchOrganizations();
      window.dispatchEvent(new Event('organizations-updated'));
      
      // Close modal and reset form
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving organization:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save organization',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (orgId: string) => {
    if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId)
        .eq('owner_id', user?.id); // Extra safety check

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Organization deleted successfully.',
      });

      // Refresh organizations list
      await fetchOrganizations();
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete organization',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Your Organizations
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and manage your business or organization profiles
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {/* Organizations List */}
      {organizations.length === 0 ? (
        <Card className="p-8 text-center dark:bg-[#161616]">
          <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No organizations yet
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Create your first organization to get started
          </p>
          <Button
            onClick={openCreateModal}
            variant="outline"
            className="mx-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {organizations.map((org) => (
            <Card key={org.id} className="p-4 dark:bg-[#161616]">
              <div className="flex items-start gap-4">
                {/* Logo */}
                <div className="flex-shrink-0">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {org.name}
                        </h4>
                        {org.verified && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            <Check className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      
                      {org.industry && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <Briefcase className="h-3.5 w-3.5 mr-1" />
                          {org.industry}
                        </div>
                      )}
                      
                      {org.location && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <MapPin className="h-3.5 w-3.5 mr-1" />
                          {org.location}
                        </div>
                      )}
                      
                      {org.website && (
                        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 mt-1">
                          <Globe className="h-3.5 w-3.5 mr-1" />
                          <a 
                            href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {org.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                      
                      {org.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                          {org.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center">
                          <Users className="h-3.5 w-3.5 mr-1" />
                          {org.members_count} {org.members_count === 1 ? 'member' : 'members'}
                        </span>
                        <span>
                          Created {new Date(org.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(org)}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(org.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Organization Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsModalOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingOrg ? 'Edit Organization' : 'Create New Organization'}
            </DialogTitle>
            <DialogDescription>
              {editingOrg 
                ? 'Update your business or organization profile'
                : 'Create a business or organization profile to collaborate with team members'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            {/* Cover Photo */}
            <div className="relative">
              <div 
                className="h-32 bg-gradient-to-r from-blue-500 to-purple-500 relative rounded-lg overflow-hidden"
                style={{
                  backgroundImage: formData.cover_photo_url ? `url(${formData.cover_photo_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <div className="absolute inset-0 bg-black/20"></div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 bg-white/20 hover:bg-white/30 text-white"
                  onClick={() => triggerFileUpload('cover')}
                  disabled={uploadingCover}
                >
                  {uploadingCover ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Add Cover
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Logo and Basic Info */}
            <div className="flex items-start gap-6">
              {/* Logo Upload */}
              <div className="flex-shrink-0 text-center">
                <div className="relative inline-block">
                  {formData.logo_url ? (
                    <img
                      src={formData.logo_url}
                      alt="Logo"
                      className="h-24 w-24 rounded-lg object-cover border-2 border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <Building2 className="h-10 w-10 text-white" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-800 shadow-md rounded-full h-8 w-8 p-0"
                    onClick={() => triggerFileUpload('logo')}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Organization Logo
                </p>
              </div>

              {/* Organization Name */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Acme Corp, Tech Startup"
                  required
                  className="dark:bg-[#161616] dark:border-gray-600"
                />
                {formData.name && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    URL: /organization/{generateSlug(formData.name)}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="What does your organization do?"
                rows={3}
                className="dark:bg-[#161616] dark:border-gray-600"
              />
            </div>

            {/* Website and Location */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Website
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="https://example.com"
                    className="pl-10 dark:bg-[#161616] dark:border-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="City, Country"
                    className="pl-10 dark:bg-[#161616] dark:border-gray-600"
                  />
                </div>
              </div>
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Industry
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  placeholder="e.g., Tech, Retail"
                  className="pl-10 dark:bg-[#161616] dark:border-gray-600"
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !formData.name}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingOrg ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingOrg ? 'Update Organization' : 'Create Organization'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationsTab;