import axios from 'axios';
import type { Organization, OrganizationMember, CreateOrganizationInput, UpdateOrganizationInput } from '@/types/organization';
import apiUrl from '@/lib/api';

// Use centralized apiUrl helper so dev proxy and multiple env vars are respected
const API = (path: string) => apiUrl(path.startsWith('/') ? path : `/${path}`);

class OrganizationService {
  /**
   * Get all organizations for current user
   */
  async getMyOrganizations(): Promise<Organization[]> {
    try {
      const response = await axios.get(API('/api/organizations'), {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      throw error;
    }
  }

  /**
   * Get organization by slug
   */
  async getOrganization(slug: string) {
    try {
      const response = await axios.get(API(`/api/organizations/${slug}`), {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch organization:', error);
      throw error;
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization(input: CreateOrganizationInput): Promise<Organization> {
    try {
      const response = await axios.post(API('/api/organizations'), input, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create organization:', error);
      throw error;
    }
  }

  /**
   * Update organization details
   */
  async updateOrganization(id: string, input: UpdateOrganizationInput): Promise<Organization> {
    try {
      const response = await axios.patch(API(`/api/organizations/${id}`), input, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to update organization:', error);
      throw error;
    }
  }

  /**
   * Add member to organization
   */
  async addMember(orgId: string, userId: string, role: string = 'member'): Promise<OrganizationMember> {
    try {
      const response = await axios.post(
        API(`/api/organizations/${orgId}/members`),
        { user_id: userId, role },
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to add member:', error);
      throw error;
    }
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    try {
      await axios.delete(API(`/api/organizations/${orgId}/members/${userId}`), {
        withCredentials: true,
      });
    } catch (error) {
      console.error('Failed to remove member:', error);
      throw error;
    }
  }

  /**
   * Delete organization (owner only)
   */
  async deleteOrganization(id: string): Promise<void> {
    try {
      await axios.delete(API(`/api/organizations/${id}`), {
        withCredentials: true,
      });
    } catch (error) {
      console.error('Failed to delete organization:', error);
      throw error;
    }
  }
}

export default new OrganizationService();
