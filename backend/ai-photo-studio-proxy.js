// Rebuilt AI Photo Studio Proxy with Replicate image upload support
// ================================================================
// This version FIXES the 422 error by uploading base64 images via
// Replicate's /files endpoint before prediction.
// It also keeps Automatic1111 support.
// ================================================================

try {
  require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
} catch (e) {}

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');

const UPLOAD_FIELD = 'image';
const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// ---------------------------------------------------------------
// Utility: Upload base64 to Replicate to get a temporary URL
// ---------------------------------------------------------------
async function uploadToReplicate(base64) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('Missing REPLICATE_API_TOKEN');

  // Remove the data URL prefix
  const pureBase64 = base64.split(',')[1];
  if (!pureBase64) throw new Error('Invalid base64 image input');

  const r = await axios.post(
    'https://api.replicate.com/v1/files',
    {
      filename: 'input.jpg',
      content: pureBase64,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return r.data.url; // URL now safe for use in model
}

// ---------------------------------------------------------------
// Health check
// ---------------------------------------------------------------
app.get('/api/ai-photo-studio/health', (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------
// MAIN ENDPOINT
// ---------------------------------------------------------------
app.post('/api/ai-photo-studio', upload.single(UPLOAD_FIELD), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing image file' });

    const prompt = (req.body.prompt || '').toString();
    const aiPreset = (req.body.preset || '').toString();
    const n = parseInt(req.body.n || '1', 10) || 1;

    const initImage = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // -----------------------------------------------------------
    // 1) AUTOMATIC1111 mode
    // -----------------------------------------------------------
    const automaticUrl = process.env.AUTOMATIC1111_URL;
    if (automaticUrl) {
      try {
        const sdPayload = {
          init_images: [initImage],
          prompt: prompt || `Professional ${aiPreset || 'portrait'} headshot, neutral background, soft lighting`,
          negative_prompt: '',
          steps: 20,
          sampler_name: 'Euler a',
          cfg_scale: 7,
          denoising_strength: 0.6,
          width: 512,
          height: 512,
          restore_faces: false,
          batch_size: Math.min(4, Math.max(1, n)),
        };

        const r = await axios.post(
          `${automaticUrl.replace(/\/$/, '')}/sdapi/v1/img2img`,
          sdPayload,
          { timeout: 120000 }
        );

        const images = Array.isArray(r.data?.images)
          ? r.data.images.map((b) => (b.startsWith('data:') ? b : `data:image/png;base64,${b}`))
          : [];

        return res.json({ images });
      } catch (err) {
        console.error('AUTOMATIC1111 ERROR:', err.toString());
        return res.status(502).json({ error: 'Automatic1111 failed', detail: err.toString() });
      }
    }

    // -----------------------------------------------------------
    // 2) REPLICATE mode
    // -----------------------------------------------------------
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    const replicateVersions = [
      process.env.REPLICATE_MODEL_VERSION,
      process.env.REPLICATE_MODEL_VERSION_FALLBACK_1,
      process.env.REPLICATE_MODEL_VERSION_FALLBACK_2,
    ].filter(Boolean);

    if (!replicateToken || replicateVersions.length === 0) {
      return res.status(400).json({
        error: 'No AI backend configured. Set AUTOMATIC1111_URL or REPLICATE_API_TOKEN + REPLICATE_MODEL_VERSION',
      });
    }

    // Preset mapping
    const presetPrompts = {
      corporate: 'professional corporate headshot, soft studio lighting, sharp details, neutral background, confident expression, high-end portrait',
      suited: 'executive portrait, tailored suit, luxury business headshot, crisp lighting, leadership pose, premium corporate look',
      beach: 'relaxed beach portrait, warm natural sunlight, ocean backdrop, lifestyle photography, candid mood',
      boardroom: 'CEO boardroom portrait, dramatic office lighting, leadership presence, high-end corporate photography',
      glamour: 'cinematic glamour portrait, luxury editorial lighting, glossy finish, beauty-grade retouch',
      tech: 'tech founder portrait, startup aesthetic, minimal background, soft modern lighting',
      editorial: 'fashion editorial portrait, magazine cover lighting, artistic pose, premium styling',
    };

    const chosenPrompt = prompt || presetPrompts[aiPreset] || `Professional ${aiPreset || 'portrait'} headshot, neutral background, soft lighting`;

    // Upload base64 image to Replicate
    let uploadedImageUrl;
    try {
      uploadedImageUrl = await uploadToReplicate(initImage);
    } catch (uploadErr) {
      console.error('UPLOAD ERROR:', uploadErr.toString());
      return res.status(500).json({ error: 'Upload to Replicate failed', detail: uploadErr.toString() });
    }

    const tryVersions = [...replicateVersions];
    const allErrors = [];

    for (const version of tryVersions) {
      try {
        // Create prediction
        const createRes = await axios.post(
          'https://api.replicate.com/v1/predictions',
          {
            version,
            input: {
              image: uploadedImageUrl,
              prompt: chosenPrompt,
              num_outputs: Math.min(4, Math.max(1, n)),
            },
          },
          {
            headers: {
              Authorization: `Bearer ${replicateToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000,
          }
        );

        const predictionId = createRes.data.id;
        const predictionUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;

        // Poll
        let final = null;
        const start = Date.now();
        while (Date.now() - start < 120000) {
          await new Promise((r) => setTimeout(r, 1500));
          const poll = await axios.get(predictionUrl, {
            headers: { Authorization: `Bearer ${replicateToken}` },
            timeout: 60000,
          });

          if (poll.data.status === 'succeeded') {
            final = poll.data;
            break;
          }
          if (poll.data.status === 'failed') {
            final = poll.data;
            break;
          }
        }

        if (!final) {
          allErrors.push({ version, error: 'timeout' });
          continue;
        }

        if (final.status === 'failed') {
          allErrors.push({ version, error: final.error });
          continue;
        }

        // Fetch URLs → base64
        const outputs = Array.isArray(final.output) ? final.output : [];
        const images = [];

        for (const url of outputs) {
          if (typeof url === 'string' && url.startsWith('http')) {
            const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
            const b64 = Buffer.from(imgRes.data).toString('base64');
            const ct = imgRes.headers['content-type'] || 'image/png';
            images.push(`data:${ct};base64,${b64}`);
          }
        }

        return res.json({ images, model_version_used: version });
      } catch (err) {
        allErrors.push({ version, error: err?.response?.data || err.toString() });
      }
    }

    return res.status(502).json({ error: 'All Replicate attempts failed', details: allErrors });
  } catch (err) {
    console.error('AI PROXY FATAL ERROR:', err.toString());
    return res.status(500).json({ error: 'Server failure', detail: err.toString() });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`AI Photo Studio Proxy running → http://localhost:${port}`));
