const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
// sharp will let us composite the returned image over a white background
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('sharp is not installed. Images will be forwarded as-is. To enable white-background flattening, run `npm install sharp` in backend.');
}

// Use memory storage so we can forward buffer to remove.bg
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// POST /api/removebg
// Expects multipart/form-data with a single file field named 'image'
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No image file provided. Use field name "image".' });
  }

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server not configured with REMOVE_BG_API_KEY' });
  }

  try {
    const form = new FormData();
    // 'image_file' is the name remove.bg expects
    form.append('image_file', req.file.buffer, { filename: req.file.originalname });
    form.append('size', 'auto');

    const response = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
      headers: {
        ...form.getHeaders(),
        'X-Api-Key': apiKey,
      },
      responseType: 'arraybuffer',
      maxBodyLength: Infinity,
    });

    // Forward the image bytes back to the client
    // Convert to Buffer
    let outBuffer = Buffer.from(response.data, 'binary');

    // If sharp is available, flatten transparency onto white background to avoid black backgrounds
    if (sharp) {
      try {
        outBuffer = await sharp(outBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } }) // composite over white
          .png()
          .toBuffer();
      } catch (err) {
        console.warn('sharp processing failed, sending original image:', err);
      }
    }

    res.set('Content-Type', 'image/png');
    res.send(outBuffer);
  } catch (err) {
    console.error('remove.bg proxy error:', err.response?.data || err.message || err);
    const status = err.response?.status || 500;
    const body = err.response?.data ? err.response.data : { error: err.message || 'Unknown error' };
    try {
      // If remove.bg returned an error body, try to send it as JSON
      if (typeof body === 'object') return res.status(status).json(body);
      return res.status(status).send(body);
    } catch (e) {
      return res.status(500).json({ error: 'Proxy error', details: err.message || err.toString() });
    }
  }
});

module.exports = router;
