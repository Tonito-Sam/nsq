const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const tmpDir = path.join(__dirname, '..', '..', 'tmp', 'share_uploads');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const upload = multer({ dest: tmpDir });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(supabaseUrl, supabaseKey);

router.post('/', upload.array('files', 6), async (req, res) => {
  try {
    const files = req.files || [];
    const title = req.body.title || '';
    const text = req.body.text || '';

    if (!files || files.length === 0) {
      // No files: redirect to frontend share page with text only
      const q = new URLSearchParams();
      if (text) q.set('text', text);
      return res.redirect(303, `${process.env.FRONTEND_URL || ''}/share?${q.toString()}`);
    }

    const uploadedUrls = [];
    for (const f of files) {
      try {
        const buffer = fs.readFileSync(f.path);
        const bucket = process.env.SHARE_BUCKET || 'shared-media';
        const safeName = f.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const dest = `shared/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from(bucket).upload(dest, buffer, { contentType: f.mimetype, upsert: true });
        if (uploadError) {
          console.error('Supabase upload error', uploadError);
          // fallback: serve from server temp (not ideal)
          continue;
        }
        const { data } = supabase.storage.from(bucket).getPublicUrl(dest);
        if (data && data.publicUrl) uploadedUrls.push(data.publicUrl);
      } catch (e) {
        console.error('File upload error', e);
      } finally {
        // cleanup temp file
        try { fs.unlinkSync(f.path); } catch (e) { }
      }
    }

    const isVideo = files.some(f => f.mimetype && f.mimetype.startsWith('video/'));
    const type = isVideo ? 'video' : 'image';

    const q = new URLSearchParams();
    q.set('type', type);
    if (uploadedUrls.length) q.set('urls', uploadedUrls.join(','));
    if (text) q.set('text', text);

    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '') || '';
    return res.redirect(303, `${frontendBase}/share?${q.toString()}`);
  } catch (err) {
    console.error('Error in share-target handler', err);
    return res.status(500).send('Share handler error');
  }
});

module.exports = router;
