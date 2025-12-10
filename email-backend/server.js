console.log('Starting email backend...');


import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: true, // true for port 465 (SSL)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send OTP email
app.post('/send-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    await transporter.sendMail({
      from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`,
      html: `<p>Your OTP code is: <b>${otp}</b></p>`
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send OTP email.' });
  }
});

// Send single notification email
app.post('/send-notification', async (req, res) => {
  const { email, subject, message } = req.body;
  try {
    await transporter.sendMail({
      from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject,
      text: message,
      html: `<p>${message}</p>`
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send notification email.' });
  }
});

// Send bulk email (admin)
app.post('/send-bulk', async (req, res) => {
  const { emails, subject, message } = req.body;
  try {
    const sendPromises = emails.map(email =>
      transporter.sendMail({
        from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject,
        text: message,
        html: `<p>${message}</p>`
      })
    );
    await Promise.all(sendPromises);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send bulk email.' });
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