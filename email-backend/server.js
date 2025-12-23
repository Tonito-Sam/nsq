console.log('Starting email backend...');


import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let transporter;
let usingEthereal = false;

async function initTransporter() {
  // Try to use configured SMTP first
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: (process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    await transporter.verify();
    console.log('SMTP connection verified');
    usingEthereal = false;
    return;
  } catch (err) {
    console.error('SMTP verification failed:', err && err.message ? err.message : err);
    console.warn('Falling back to Ethereal test account (no real emails will be sent).');
  }

  // Fallback: create Ethereal test account so we can test functionality
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    usingEthereal = true;
    console.log('Using Ethereal test account. Preview emails at URLs returned in responses.');
  } catch (err) {
    console.error('Failed to create Ethereal test account:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

// Initialize transporter (async) and log errors
initTransporter().catch(err => console.error('initTransporter failed', err));

// Init Supabase admin client (requires SERVICE_ROLE_KEY in env)
let supabaseAdmin = null;
if (process.env.SUPABASE_URL && process.env.SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY);
} else {
  console.warn('SUPABASE_URL or SERVICE_ROLE_KEY not set; /resend-verification endpoint will be unavailable');
}

// Send OTP email
app.post('/send-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`,
      html: `<p>Your OTP code is: <b>${otp}</b></p>`
    });
    const preview = usingEthereal ? nodemailer.getTestMessageUrl(info) : null;
    res.json({ success: true, preview });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send OTP email.' });
  }
});

// Send single notification email
app.post('/send-notification', async (req, res) => {
  const { email, subject, message, attachments } = req.body;
  try {
    const mailOptions = {
      from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject,
      text: message,
      html: `<p>${message}</p>`,
    };

    // attachments: accept array of { url, filename } or simple string URLs
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments.map((a) => {
        if (typeof a === 'string') {
          return { filename: path.basename(a), path: a };
        }
        return { filename: a.filename || path.basename(a.url || ''), path: a.url || a.path };
      });
    }

    const info = await transporter.sendMail(mailOptions);
    const preview = usingEthereal ? nodemailer.getTestMessageUrl(info) : null;
    res.json({ success: true, preview });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send notification email.' });
  }
});

// Send bulk email (admin)
app.post('/send-bulk', async (req, res) => {
  const { emails, subject, message, attachments } = req.body;
  try {
    const infos = await Promise.all(emails.map(email => {
      const mailOptions = {
        from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject,
        text: message,
        html: `<p>${message}</p>`,
      };
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        mailOptions.attachments = attachments.map((a) => {
          if (typeof a === 'string') return { filename: path.basename(a), path: a };
          return { filename: a.filename || path.basename(a.url || ''), path: a.url || a.path };
        });
      }
      return transporter.sendMail(mailOptions);
    }));
    const previews = usingEthereal ? infos.map(info => nodemailer.getTestMessageUrl(info)) : null;
    res.json({ success: true, previews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : 'Failed to send bulk email.' });
  }
});

// Test single email endpoint to validate SMTP in deployed environment
app.post('/test-email', async (req, res) => {
  const to = req.body?.to || process.env.SENDER_EMAIL;
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
      to,
      subject: req.body?.subject || 'Test email from email-backend',
      text: req.body?.message || 'This is a test email to verify SMTP settings.',
      html: `<p>${req.body?.message || 'This is a test email to verify SMTP settings.'}</p>`
    });
    const preview = usingEthereal ? nodemailer.getTestMessageUrl(info) : null;
    res.json({ success: true, message: `Test email sent to ${to}`, preview });
  } catch (err) {
    console.error('Test-email error', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : 'Failed to send test email.' });
  }
});

// Basic health endpoint for service checks
app.get('/health', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

// Global error handlers to capture crashes when started under PM2/windows terminals
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION', reason);
});

const PORT = parseInt(process.env.PORT || '4000', 10) || 4000;
// Bind explicitly to 0.0.0.0 to make sure it listens on all interfaces on Windows
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Email backend running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Failed to start email backend', err && err.stack ? err.stack : err);
  process.exit(1);
});

// Multipart/form-data version (accept file uploads)
app.post('/send-notification-multipart', upload.array('attachments'), async (req, res) => {
  const email = req.body.email || req.body.to;
  const subject = req.body.subject;
  const message = req.body.message;
  try {
    const mailOptions = {
      from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject,
      text: message,
      html: `<p>${message}</p>`,
    };

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      mailOptions.attachments = req.files.map(f => ({ filename: f.originalname, content: f.buffer }));
    }

    const info = await transporter.sendMail(mailOptions);
    const preview = usingEthereal ? nodemailer.getTestMessageUrl(info) : null;
    res.json({ success: true, preview });
  } catch (err) {
    console.error('Multipart send-notification error', err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : 'Failed to send multipart notification email.' });
  }
});

// Multipart bulk (form-data with files)
app.post('/send-bulk-multipart', upload.array('attachments'), async (req, res) => {
  // emails can be sent as comma-separated string or multiple emails fields
  let emails = [];
  if (req.body.emails) {
    if (Array.isArray(req.body.emails)) emails = req.body.emails;
    else if (typeof req.body.emails === 'string') emails = req.body.emails.split(',').map(s => s.trim()).filter(Boolean);
  } else if (req.body.email) {
    emails = [req.body.email];
  }
  const subject = req.body.subject;
  const message = req.body.message;
  try {
    const attachments = (req.files && Array.isArray(req.files)) ? req.files.map(f => ({ filename: f.originalname, content: f.buffer })) : [];
    const infos = await Promise.all(emails.map(email => transporter.sendMail({
      from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject,
      text: message,
      html: `<p>${message}</p>`,
      attachments
    })));
    const previews = usingEthereal ? infos.map(info => nodemailer.getTestMessageUrl(info)) : null;
    res.json({ success: true, previews });
  } catch (err) {
    console.error('Multipart send-bulk error', err);
    res.status(500).json({ success: false, error: err && err.message ? err.message : 'Failed to send multipart bulk email.' });
  }
});

// Resend verification email for a single user (admin only - uses service role key)
app.post('/resend-verification', async (req, res) => {
  const email = req.body?.email;
  if (!email) return res.status(400).json({ success: false, error: 'email is required' });
  if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'supabase admin client not configured' });

  try {
    const { error } = await supabaseAdmin.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: process.env.EMAIL_VERIFICATION_REDIRECT || 'https://nexsq.com'
      }
    });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (err) {
    console.error('resend-verification error', err);
    return res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
});