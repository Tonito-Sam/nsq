import { useState, useCallback } from 'react';
import organizationService from '@/services/organizationService';
import type { Organization } from '@/types/organization';

interface UseOrganizationReturn {
  organization: Organization | null;
  loading: boolean;
  error: string | null;
  fetchOrganization: (slug: string) => Promise<void>;
  updateOrganization: (data: Partial<Organization>) => Promise<void>;
  addMember: (userId: string, role?: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

export function useOrganization(initialSlug?: string): UseOrganizationReturn {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = useCallback(async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.getOrganization(slug);
      setOrganization(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch organization';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOrganization = useCallback(async (data: Partial<Organization>) => {
    if (!organization?.id) throw new Error('No organization loaded');
    setLoading(true);
    setError(null);
    try {
      const updated = await organizationService.updateOrganization(organization.id, data);
      setOrganization(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update organization';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  const addMember = useCallback(async (userId: string, role: string = 'member') => {
    if (!organization?.id) throw new Error('No organization loaded');
    setError(null);
    try {
      await organizationService.addMember(organization.id, userId, role);
      // Refetch to update members list
      if (organization.slug) {
        await fetchOrganization(organization.slug);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add member';
      setError(message);
      throw err;
    }
  }, [organization?.id, organization?.slug, fetchOrganization]);

  const removeMember = useCallback(async (userId: string) => {
    if (!organization?.id) throw new Error('No organization loaded');
    setError(null);
    try {
      await organizationService.removeMember(organization.id, userId);
      // Refetch to update members list
      if (organization.slug) {
        await fetchOrganization(organization.slug);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      setError(message);
      throw err;
    }
  }, [organization?.id, organization?.slug, fetchOrganization]);

  // Fetch initial organization if slug provided
  if (initialSlug && !organization) {
    fetchOrganization(initialSlug);
  }

  return {
    organization,
    loading,
    error,
    fetchOrganization,
    updateOrganization,
    addMember,
    removeMember,
  };
}
