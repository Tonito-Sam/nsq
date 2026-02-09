export type OrgRole = 'owner' | 'admin' | 'member';

export interface Organization {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  cover_photo_url?: string;
  website?: string;
  location?: string;
  industry?: string;
  verified: boolean;
  members_count: number;
  followers_count: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
}

export interface OrganizationWithOwner extends Organization {
  owner?: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

export interface OrganizationWithMembers extends Organization {
  members?: OrganizationMember[];
}

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  description?: string;
  website?: string;
  location?: string;
  industry?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  logo_url?: string;
  cover_photo_url?: string;
  website?: string;
  location?: string;
  industry?: string;
}
