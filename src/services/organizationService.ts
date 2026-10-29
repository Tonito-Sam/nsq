import { supabase } from '@/integrations/supabase/client';
import type { Organization, OrganizationMember, CreateOrganizationInput, UpdateOrganizationInput } from '@/types/organization';
import slugify from 'slugify';

class OrganizationService {
  async getMyOrganizations(): Promise<Organization[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return [];

      // Owned organizations
      const { data: ownedOrgs, error: ownedErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', userId);
      if (ownedErr) throw ownedErr;

      // Organizations where user is a member
      const { data: memberRows, error: memberErr } = await supabase
        .from('organization_members')
        .select('organization(*)')
        .eq('user_id', userId);
      if (memberErr) throw memberErr;

      const memberOrgs = (memberRows || []).map((r: any) => r.organization).filter(Boolean);

      // Merge and dedupe by id
      const combined = [...(ownedOrgs || []), ...memberOrgs];
      const unique: Record<string, Organization> = {};
      combined.forEach((o: Organization) => { if (o && o.id) unique[o.id] = o; });
      return Object.values(unique);
    } catch (error) {
      console.error('Failed to fetch organizations from Supabase:', error);
      throw error;
    }
  }

  async getOrganization(slug: string) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*, owner:users(id,username,first_name,last_name,avatar_url)')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to fetch organization from Supabase:', error);
      throw error;
    }
  }

  async createOrganization(input: CreateOrganizationInput): Promise<Organization> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const slug = input.slug ? slugify(input.slug, { lower: true, strict: true }) : slugify(input.name, { lower: true, strict: true });

      const { data, error } = await supabase
        .from('organizations')
        .insert({
          owner_id: userId,
          name: input.name,
          slug,
          description: input.description || null,
          website: input.website || null,
          location: input.location || null,
          industry: input.industry || null,
          verified: false,
        })
        .select()
        .single();

      if (error) throw error;

      // add member as owner
      await supabase.from('organization_members').insert({ organization_id: data.id, user_id: userId, role: 'owner' });

      return data as Organization;
    } catch (error) {
      console.error('Failed to create organization in Supabase:', error);
      throw error;
    }
  }

  async updateOrganization(id: string, input: UpdateOrganizationInput): Promise<Organization> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Organization;
    } catch (error) {
      console.error('Failed to update organization in Supabase:', error);
      throw error;
    }
  }

  async addMember(orgId: string, userId: string, role: string = 'member'): Promise<OrganizationMember> {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .insert({ organization_id: orgId, user_id: userId, role })
        .select()
        .single();
      if (error) throw error;
      return data as OrganizationMember;
    } catch (error) {
      console.error('Failed to add organization member in Supabase:', error);
      throw error;
    }
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', orgId)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (error) {
      console.error('Failed to remove organization member in Supabase:', error);
      throw error;
    }
  }

  async deleteOrganization(id: string): Promise<void> {
    try {
      // remove members first
      await supabase.from('organization_members').delete().eq('organization_id', id);
      const { error } = await supabase.from('organizations').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete organization in Supabase:', error);
      throw error;
    }
  }
}

export default new OrganizationService();
