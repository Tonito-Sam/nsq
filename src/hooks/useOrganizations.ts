import { useState, useCallback } from 'react';
import organizationService from '@/services/organizationService';
import type { Organization, CreateOrganizationInput } from '@/types/organization';

interface UseOrganizationsReturn {
  organizations: Organization[];
  loading: boolean;
  error: string | null;
  fetchOrganizations: () => Promise<void>;
  createOrganization: (input: CreateOrganizationInput) => Promise<Organization>;
  deleteOrganization: (id: string) => Promise<void>;
}

export function useOrganizations(): UseOrganizationsReturn {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.getMyOrganizations();
      setOrganizations(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch organizations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrganization = useCallback(async (input: CreateOrganizationInput) => {
    setLoading(true);
    setError(null);
    try {
      const org = await organizationService.createOrganization(input);
      setOrganizations(prev => [...prev, org]);
      return org;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteOrganization = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await organizationService.deleteOrganization(id);
      setOrganizations(prev => prev.filter(org => org.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete organization';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    organizations,
    loading,
    error,
    fetchOrganizations,
    createOrganization,
    deleteOrganization,
  };
}
