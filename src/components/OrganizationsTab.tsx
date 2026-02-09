import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Building2, Plus, Trash2 } from 'lucide-react';
import type { CreateOrganizationInput, Organization } from '@/types/organization';

export const OrganizationsTab: React.FC = () => {
  const { organizations, loading, error, fetchOrganizations, createOrganization, deleteOrganization } = useOrganizations();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<CreateOrganizationInput>({
    name: '',
    description: '',
    website: '',
    location: '',
    industry: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateOrganization = async () => {
    if (!formData.name.trim()) {
      setSubmitError('Organization name is required');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createOrganization(formData);
      setFormData({ name: '', description: '', website: '', location: '', industry: '' });
      setShowCreateDialog(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrganization = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteOrganization(id);
      setDeleteConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete organization';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Organizations</h2>
        <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Organization
        </Button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </Card>
      )}

      {loading && (
        <Card className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Loading organizations...</p>
        </Card>
      )}

      {!loading && organizations.length === 0 && (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No organizations yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
            Create your first organization to get started
          </p>
        </Card>
      )}

      {!loading && organizations.length > 0 && (
        <div className="grid gap-4">
          {organizations.map(org => (
            <Card key={org.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{org.name}</h3>
                  {org.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{org.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {org.location && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        📍 {org.location}
                      </span>
                    )}
                    {org.industry && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        🏢 {org.industry}
                      </span>
                    )}
                    {org.members_count > 0 && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        👥 {org.members_count} member{org.members_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteConfirm(org.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Organization Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Create a business or organization profile to collaborate with team members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {submitError && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                {submitError}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Organization Name *</label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g. Acme Corp, Tech Startup"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleInputChange}
                placeholder="What does your organization do?"
                className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-sm"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Website</label>
              <Input
                name="website"
                type="url"
                value={formData.website || ''}
                onChange={handleInputChange}
                placeholder="https://example.com"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input
                  name="location"
                  value={formData.location || ''}
                  onChange={handleInputChange}
                  placeholder="City, Country"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Industry</label>
                <Input
                  name="industry"
                  value={formData.industry || ''}
                  onChange={handleInputChange}
                  placeholder="e.g. Tech, Retail"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={submitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrganization}
                disabled={submitting || !formData.name.trim()}
                className="flex-1"
              >
                {submitting ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this organization? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteOrganization(deleteConfirm)}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
