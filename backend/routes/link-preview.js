const express = require('express');
const axios = require('axios');
const router = express.Router();

function extractMeta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractFavicon(html, baseUrl) {
  const relIcons = html.match(/<link[^>]+rel=["']([^"']+)["'][^>]*>/ig) || [];
  for (const tag of relIcons) {
    const relMatch = tag.match(/rel=["']([^"']+)["']/i);
    if (!relMatch) continue;
    const rel = relMatch[1].toLowerCase();
    if (rel.includes('icon') || rel.includes('shortcut')) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        const href = hrefMatch[1];
        try {
          const resolvedUrl = new URL(href, baseUrl).toString();
          return resolvedUrl;
        } catch (e) {
          // If URL resolution fails, try to construct it
          if (href.startsWith('//')) {
            return `https:${href}`;
          } else if (href.startsWith('/')) {
            try {
              const u = new URL(baseUrl);
              return `${u.protocol}//${u.hostname}${href}`;
            } catch (err) {
              return href;
            }
          }
          return href;
        }
      }
    }
  }
  // fallback to /favicon.ico
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.hostname}/favicon.ico`;
  } catch (e) {
    return null;
  }
}

function extractDescription(html) {
  // Try Open Graph description first
  const ogDesc = extractMeta(html, 'og:description');
  if (ogDesc) return ogDesc;
  
  // Try Twitter description
  const twitterDesc = extractMeta(html, 'twitter:description');
  if (twitterDesc) return twitterDesc;
  
  // Try standard meta description
  const metaDesc = extractMeta(html, 'description');
  if (metaDesc) return metaDesc;
  
  // Try to extract from content (simplified)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Take first 200 characters as description
    if (bodyContent.length > 0) {
      return bodyContent.substring(0, 200) + (bodyContent.length > 200 ? '...' : '');
    }
  }
  
  return null;
}

function extractImage(html, baseUrl) {
  // Try Open Graph image first
  const ogImage = extractMeta(html, 'og:image');
  if (ogImage) {
    try {
      return new URL(ogImage, baseUrl).toString();
    } catch (e) {
      if (ogImage.startsWith('//')) {
        return `https:${ogImage}`;
      } else if (ogImage.startsWith('/')) {
        try {
          const u = new URL(baseUrl);
          return `${u.protocol}//${u.hostname}${ogImage}`;
        } catch (err) {
          return ogImage;
        }
      }
      return ogImage;
    }
  }
  
  // Try Twitter image
  const twitterImage = extractMeta(html, 'twitter:image');
  if (twitterImage) {
    try {
      return new URL(twitterImage, baseUrl).toString();
    } catch (e) {
      if (twitterImage.startsWith('//')) {
        return `https:${twitterImage}`;
      } else if (twitterImage.startsWith('/')) {
        try {
          const u = new URL(baseUrl);
          return `${u.protocol}//${u.hostname}${twitterImage}`;
        } catch (err) {
          return twitterImage;
        }
      }
      return twitterImage;
    }
  }
  
  // Try to find the largest image on the page
  const imgMatches = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
  let largestImage = null;
  let largestSize = 0;
  
  for (const imgTag of imgMatches.slice(0, 10)) { // Check first 10 images
    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      const src = srcMatch[1];
      // Skip data URLs, small icons, and tracking pixels
      if (src.startsWith('data:') || 
          src.includes('icon') || 
          src.includes('logo') || 
          src.includes('spacer') ||
          src.includes('pixel') ||
          src.includes('track') ||
          src.length < 20) {
        continue;
      }
      
      // Check for size attributes
      const widthMatch = imgTag.match(/width=["'](\d+)["']/i);
      const heightMatch = imgTag.match(/height=["'](\d+)["']/i);
      
      if (widthMatch && heightMatch) {
        const size = parseInt(widthMatch[1]) * parseInt(heightMatch[1]);
        if (size > largestSize && size > 10000) { // Minimum 100x100 pixels
          largestSize = size;
          try {
            largestImage = new URL(src, baseUrl).toString();
          } catch (e) {
            if (src.startsWith('//')) {
              largestImage = `https:${src}`;
            } else if (src.startsWith('/')) {
              try {
                const u = new URL(baseUrl);
                largestImage = `${u.protocol}//${u.hostname}${src}`;
              } catch (err) {
                largestImage = src;
              }
            } else {
              largestImage = src;
            }
          }
        }
      }
    }
  }
  
  return largestImage;
}

// Helper function to clean and sanitize strings
function cleanString(str) {
  if (!str) return null;
  return str
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 300); // Limit length
}

router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'url query required' });
  
  try {
    // Validate and parse URL
    const urlObj = new URL(String(url));
    const domain = urlObj.hostname.replace(/^www\./, '');
    
    // Fetch the page
    const resp = await axios.get(String(url), { 
      responseType: 'text', 
      timeout: 8000, 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; NexSq-Link-Preview/1.0; +http://nexsq.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      } 
    });
    
    const html = resp.data;
    
    // Extract metadata
    const ogTitle = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title');
    const title = cleanString(ogTitle || extractTitle(html) || null);
    
    const description = cleanString(extractDescription(html));
    
    const image = extractImage(html, url);
    
    const favicon = extractFavicon(html, url);
    
    // Fallback to Google favicon service if no favicon found
    let finalFavicon = favicon;
    if (!finalFavicon || !finalFavicon.startsWith('http')) {
      finalFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }
    
    // Return enhanced metadata
    return res.json({ 
      title, 
      description, 
      image, 
      favicon: finalFavicon, 
      domain,
      url: String(url)
    });
    
  } catch (error) {
    console.error('link-preview error for', url, error.message);
    
    try {
      const urlObj = new URL(String(url));
      const domain = urlObj.hostname.replace(/^www\./, '');
      
      // Return minimal data with Google favicon
      return res.json({ 
        title: null, 
        description: null, 
        image: null, 
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`, 
        domain,
        url: String(url)
      });
    } catch (parseError) {
      // If URL parsing fails completely
      return res.status(400).json({ 
        error: 'Invalid URL',
        url: String(url)
      });
    }
  }
});

module.exports = router;