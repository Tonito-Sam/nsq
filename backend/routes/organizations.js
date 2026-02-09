const express = require('express');
const axios = require('axios');

const router = express.Router();

function supabaseAuthHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

const SUPABASE_URL = process.env.SUPABASE_URL;

// Helper: Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Helper: Check if slug is unique
async function isSlugUnique(slug, excludeId = null) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/organizations?select=id&slug=eq.${slug}`;
    if (excludeId) {
      url += `&id=neq.${excludeId}`;
    }
    const resp = await axios.get(url, { headers: supabaseAuthHeaders() });
    const rows = Array.isArray(resp.data) ? resp.data : [];
    return rows.length === 0;
  } catch (err) {
    console.error('Error checking slug uniqueness:', err.message);
    return false;
  }
}

// GET /api/organizations - List organizations for current user
router.get('/', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get organizations where user is owner or member
    const url = `${SUPABASE_URL}/rest/v1/organization_members?select=organization_id,organizations(*)&user_id=eq.${userId}`;
    const resp = await axios.get(url, { headers: supabaseAuthHeaders() });
    const members = Array.isArray(resp.data) ? resp.data : [];
    
    const orgs = members.map(m => m.organizations).filter(Boolean);
    return res.json(orgs);
  } catch (err) {
    console.error('Error listing organizations:', err.message);
    return res.status(500).json({ error: 'Failed to list organizations' });
  }
});

// GET /api/organizations/:slug - Get organization by slug
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const url = `${SUPABASE_URL}/rest/v1/organizations?slug=eq.${slug}&select=*`;
    const resp = await axios.get(url, { headers: supabaseAuthHeaders() });
    const orgs = Array.isArray(resp.data) ? resp.data : [];
    
    if (orgs.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const org = orgs[0];

    // Get members
    const membersUrl = `${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${org.id}&select=*`;
    const membersResp = await axios.get(membersUrl, { headers: supabaseAuthHeaders() });
    const members = Array.isArray(membersResp.data) ? membersResp.data : [];

    // Get owner details
    const ownerUrl = `${SUPABASE_URL}/rest/v1/users?id=eq.${org.owner_id}&select=id,username,first_name,last_name,avatar_url`;
    const ownerResp = await axios.get(ownerUrl, { headers: supabaseAuthHeaders() });
    const owners = Array.isArray(ownerResp.data) ? ownerResp.data : [];

    return res.json({
      ...org,
      owner: owners[0] || null,
      members: members,
    });
  } catch (err) {
    console.error('Error fetching organization:', err.message);
    return res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// POST /api/organizations - Create organization
router.post('/', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, description, website, location, industry } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Organization name is required' });
  }

  try {
    // Generate slug
    let slug = generateSlug(name);
    let counter = 1;
    while (!(await isSlugUnique(slug))) {
      slug = `${generateSlug(name)}-${counter}`;
      counter++;
    }

    // Create organization
    const createUrl = `${SUPABASE_URL}/rest/v1/organizations`;
    const createResp = await axios.post(
      createUrl,
      {
        owner_id: userId,
        name: name.trim(),
        slug,
        description: description || null,
        website: website || null,
        location: location || null,
        industry: industry || null,
      },
      { headers: supabaseAuthHeaders() }
    );

    const org = createResp.data;

    // Add owner as member with 'owner' role
    const memberUrl = `${SUPABASE_URL}/rest/v1/organization_members`;
    await axios.post(
      memberUrl,
      {
        organization_id: org.id,
        user_id: userId,
        role: 'owner',
      },
      { headers: supabaseAuthHeaders() }
    );

    return res.status(201).json(org);
  } catch (err) {
    console.error('Error creating organization:', err.message);
    if (err.response?.status === 409) {
      return res.status(409).json({ error: 'Organization slug already exists' });
    }
    return res.status(500).json({ error: 'Failed to create organization' });
  }
});

// PATCH /api/organizations/:id - Update organization
router.patch('/:id', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { name, description, logo_url, cover_photo_url, website, location, industry } = req.body;

  try {
    // Check if user is owner or admin
    const memberUrl = `${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${id}&user_id=eq.${userId}&select=role`;
    const memberResp = await axios.get(memberUrl, { headers: supabaseAuthHeaders() });
    const members = Array.isArray(memberResp.data) ? memberResp.data : [];

    if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
      return res.status(403).json({ error: 'Only owner or admin can update organization' });
    }

    // Update organization
    const updateUrl = `${SUPABASE_URL}/rest/v1/organizations?id=eq.${id}`;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (cover_photo_url !== undefined) updateData.cover_photo_url = cover_photo_url;
    if (website !== undefined) updateData.website = website;
    if (location !== undefined) updateData.location = location;
    if (industry !== undefined) updateData.industry = industry;
    updateData.updated_at = new Date().toISOString();

    const updateResp = await axios.patch(updateUrl, updateData, { headers: supabaseAuthHeaders() });
    const org = Array.isArray(updateResp.data) ? updateResp.data[0] : updateResp.data;

    return res.json(org);
  } catch (err) {
    console.error('Error updating organization:', err.message);
    return res.status(500).json({ error: 'Failed to update organization' });
  }
});

// POST /api/organizations/:id/members - Add member to organization
router.post('/:id/members', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { user_id, role = 'member' } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    // Check if requester is owner or admin
    const memberUrl = `${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${id}&user_id=eq.${userId}&select=role`;
    const memberResp = await axios.get(memberUrl, { headers: supabaseAuthHeaders() });
    const members = Array.isArray(memberResp.data) ? memberResp.data : [];

    if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
      return res.status(403).json({ error: 'Only owner or admin can add members' });
    }

    // Add member
    const addMemberUrl = `${SUPABASE_URL}/rest/v1/organization_members`;
    const addResp = await axios.post(
      addMemberUrl,
      {
        organization_id: id,
        user_id,
        role,
      },
      { headers: supabaseAuthHeaders() }
    );

    return res.status(201).json(addResp.data);
  } catch (err) {
    console.error('Error adding member:', err.message);
    if (err.response?.status === 409) {
      return res.status(409).json({ error: 'User is already a member' });
    }
    return res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/organizations/:id/members/:userId - Remove member
router.delete('/:id/members/:userId', async (req, res) => {
  const currentUserId = req.user?.id;
  if (!currentUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, userId } = req.params;

  try {
    // Check if requester is owner or admin
    const memberUrl = `${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${id}&user_id=eq.${currentUserId}&select=role`;
    const memberResp = await axios.get(memberUrl, { headers: supabaseAuthHeaders() });
    const members = Array.isArray(memberResp.data) ? memberResp.data : [];

    if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
      return res.status(403).json({ error: 'Only owner or admin can remove members' });
    }

    // Remove member
    const removeUrl = `${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${id}&user_id=eq.${userId}`;
    await axios.delete(removeUrl, { headers: supabaseAuthHeaders() });

    return res.status(204).send();
  } catch (err) {
    console.error('Error removing member:', err.message);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

// DELETE /api/organizations/:id - Delete organization (owner only)
router.delete('/:id', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    // Check if user is owner
    const orgUrl = `${SUPABASE_URL}/rest/v1/organizations?id=eq.${id}&select=owner_id`;
    const orgResp = await axios.get(orgUrl, { headers: supabaseAuthHeaders() });
    const orgs = Array.isArray(orgResp.data) ? orgResp.data : [];

    if (orgs.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (orgs[0].owner_id !== userId) {
      return res.status(403).json({ error: 'Only owner can delete organization' });
    }

    // Delete organization (cascades to members)
    const deleteUrl = `${SUPABASE_URL}/rest/v1/organizations?id=eq.${id}`;
    await axios.delete(deleteUrl, { headers: supabaseAuthHeaders() });

    return res.status(204).send();
  } catch (err) {
    console.error('Error deleting organization:', err.message);
    return res.status(500).json({ error: 'Failed to delete organization' });
  }
});

module.exports = router;
