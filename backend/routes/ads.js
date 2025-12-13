// ads.js - UPDATED FOR YOUR campaigns TABLE
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/ads/serve?user_id=...&country=...&age=...&interests=a,b,c
router.get('/serve', async (req, res) => {
  try {
    const { user_id, country, age, interests } = req.query;

    console.log('ads.serve request:', { user_id, country, age, interests });
    console.log('Current date:', new Date().toISOString());

    // First, debug by seeing what's in the campaigns table
    const { data: allCampaigns, error: allError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(5);

    if (allError) {
      console.error('Error fetching all campaigns for debugging:', allError);
      return res.status(500).json({ error: 'Database error' });
    }

    console.log('All campaigns in database:', allCampaigns?.map(c => ({
      id: c.id,
      name: c.name,
      user_id: c.user_id,
      post_id: c.post_id,
      status: c.status,
      start_at: c.start_at,
      end_at: c.end_at,
      budget_usd: c.budget_usd,
      spent_usd: c.spent_usd
    })));

    // Check if we have any campaigns
    if (!allCampaigns || allCampaigns.length === 0) {
      console.log('No campaigns found in database');
      return res.json({
        served: true,
        campaign: {
          id: 'fallback-' + Date.now(),
          name: 'Welcome to Our Platform',
          advertiser_name: 'Community',
          bid_amount: 0.50,
          campaign_type: 'cpm',
          creative: {
            title: 'Discover Amazing Content',
            description: 'Explore what our community has to offer!',
            cta_text: 'Get Started',
            cta_url: '#'
          }
        }
      });
    }

    // Filter for active campaigns
    const now = new Date();
    const activeCampaigns = allCampaigns.filter(campaign => {
      // Check status (assuming 'active' or 'running' status)
      if (campaign.status && campaign.status !== 'active' && campaign.status !== 'running') {
        console.log(`Campaign ${campaign.name} has status: ${campaign.status}`);
        return false;
      }
      
      // Check start date
      if (campaign.start_at) {
        const startDate = new Date(campaign.start_at);
        if (startDate > now) {
          console.log(`Campaign ${campaign.name} hasn't started yet (starts: ${campaign.start_at})`);
          return false;
        }
      }
      
      // Check end date if exists
      if (campaign.end_at) {
        const endDate = new Date(campaign.end_at);
        if (endDate < now) {
          console.log(`Campaign ${campaign.name} has ended (ended: ${campaign.end_at})`);
          return false;
        }
      }
      
      // Check budget (if applicable)
      if (campaign.budget_usd && campaign.spent_usd && campaign.budget_usd <= campaign.spent_usd) {
        console.log(`Campaign ${campaign.name} budget exhausted (budget: ${campaign.budget_usd}, spent: ${campaign.spent_usd})`);
        return false;
      }
      
      console.log(`Campaign ${campaign.name} is eligible`);
      return true;
    });

    console.log('Active campaigns after filtering:', activeCampaigns.length);

    if (activeCampaigns.length === 0) {
      console.log('No active campaigns found after filtering, using first campaign as fallback');
      
      // Use the first campaign as fallback
      const selectedCampaign = allCampaigns[0];
      
      // Get advertiser name from user table
      let advertiserName = 'Sponsor';
      if (selectedCampaign.user_id) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('first_name, last_name, username')
            .eq('id', selectedCampaign.user_id)
            .single();
            
          if (userData) {
            advertiserName = userData.first_name 
              ? `${userData.first_name} ${userData.last_name || ''}`.trim()
              : userData.username || 'Sponsor';
          }
        } catch (err) {
          console.warn('Could not fetch advertiser name:', err.message);
        }
      }
      
      // Get post content if post_id exists
      let postContent = null;
      if (selectedCampaign.post_id) {
        try {
          const { data: postData } = await supabase
            .from('posts')
            .select('content, media_url')
            .eq('id', selectedCampaign.post_id)
            .single();
            
          if (postData) {
            postContent = postData;
          }
        } catch (err) {
          console.warn('Could not fetch post content:', err.message);
        }
      }

      // Return the fallback campaign
      return res.json({
        served: true,
        campaign: {
          id: selectedCampaign.id,
          name: selectedCampaign.name,
          advertiser_name: advertiserName,
          bid_amount: selectedCampaign.budget_usd ? (selectedCampaign.budget_usd / 100) : 1.00,
          campaign_type: 'cpm',
          creative: {
            title: selectedCampaign.name,
            description: postContent?.content || `Sponsored by ${advertiserName}`,
            image_url: postContent?.media_url || null,
            cta_text: 'Learn More',
            cta_url: '#'
          }
        }
      });
    }

    // Pick a random active campaign
    const selectedCampaign = activeCampaigns[Math.floor(Math.random() * activeCampaigns.length)];

    console.log('Selected campaign:', {
      id: selectedCampaign.id,
      name: selectedCampaign.name,
      user_id: selectedCampaign.user_id,
      post_id: selectedCampaign.post_id
    });

    // Get advertiser name from user table
    let advertiserName = 'Sponsor';
    if (selectedCampaign.user_id) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name, username')
          .eq('id', selectedCampaign.user_id)
          .single();
          
        if (userData) {
          advertiserName = userData.first_name 
            ? `${userData.first_name} ${userData.last_name || ''}`.trim()
            : userData.username || 'Sponsor';
        }
      } catch (err) {
        console.warn('Could not fetch advertiser name:', err.message);
      }
    }

    // Get post content if post_id exists
    let creative = {
      title: selectedCampaign.name,
      description: `Sponsored by ${advertiserName}`,
      cta_text: 'Learn More',
      cta_url: '#'
    };

    if (selectedCampaign.post_id) {
      try {
        const { data: postData } = await supabase
          .from('posts')
          .select('content, media_url, media_urls')
          .eq('id', selectedCampaign.post_id)
          .single();
          
        if (postData) {
          creative.description = postData.content || creative.description;
          
          // Get image URL from media
          if (postData.media_url) {
            creative.image_url = postData.media_url;
          } else if (postData.media_urls && Array.isArray(postData.media_urls) && postData.media_urls.length > 0) {
            creative.image_url = postData.media_urls[0];
          }
        }
      } catch (err) {
        console.warn('Could not fetch post content:', err.message);
      }
    }

    // Record impression (optional - you might not have an ad_impressions table)
    try {
      await supabase
        .from('ad_impressions')
        .insert({
          campaign_id: selectedCampaign.id,
          user_id: user_id || null,
          country: country || null,
          age: age ? parseInt(age) : null,
          served_at: new Date().toISOString()
        });
    } catch (err) {
      console.log('No ad_impressions table or error recording impression:', err.message);
    }

    // Update campaign spent (optional)
    try {
      const newSpent = (selectedCampaign.spent_usd || 0) + 0.01; // Small increment
      await supabase
        .from('campaigns')
        .update({
          spent_usd: newSpent,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCampaign.id);
    } catch (err) {
      console.log('Could not update campaign spent:', err.message);
    }

    // Return the ad campaign
    return res.json({
      served: true,
      campaign: {
        id: selectedCampaign.id,
        name: selectedCampaign.name,
        advertiser_name: advertiserName,
        bid_amount: selectedCampaign.budget_usd ? (selectedCampaign.budget_usd / 100) : 1.00,
        campaign_type: 'cpm',
        creative: creative
      }
    });

  } catch (err) {
    console.error('ads serve error', err.message, err.stack);
    
    // Always return a valid JSON response
    return res.json({
      served: true,
      campaign: {
        id: 'error-fallback-' + Date.now(),
        name: 'Featured Content',
        advertiser_name: 'Community Partner',
        bid_amount: 0.50,
        campaign_type: 'cpm',
        creative: {
          title: 'Discover Amazing Content',
          description: 'Check out our partners for great deals and offers!',
          cta_text: 'Explore',
          cta_url: '#'
        }
      }
    });
  }
});

// Add click tracking endpoint
router.post('/click', async (req, res) => {
  try {
    const { campaign_id, user_id } = req.body;
    
    console.log('Ad click:', { campaign_id, user_id });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Ad click error:', err);
    res.json({ success: false });
  }
});

module.exports = router;