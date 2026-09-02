import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.resolve('server/data');
const DATA_FILE = path.join(DATA_DIR, 'short_urls.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf-8');
}

// Memory cache synced with disk
let urlDatabase = {};

try {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  urlDatabase = JSON.parse(data || '{}');
} catch (err) {
  console.error('[Shortener] Failed to read data file, initializing empty db:', err.message);
  urlDatabase = {};
}

function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(urlDatabase, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Shortener] Failed to save data file:', err.message);
  }
}

/**
 * Generate a random 5-digit integer code (10000 - 99999)
 */
function generate5DigitCode() {
  let code;
  let attempts = 0;
  do {
    code = Math.floor(10000 + Math.random() * 90000).toString();
    attempts++;
    if (attempts > 1000) {
      // Fallback to 5-char alphanumeric if numeric space is exhausted
      code = Math.random().toString(36).substring(2, 7).toUpperCase();
      break;
    }
  } while (urlDatabase[code]);
  return code;
}

/**
 * Check if the User-Agent is from Instagram, Facebook, or Telegram in-app browsers
 */
export function isAllowedInAppBrowser(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return false;
  const ua = userAgent.toLowerCase();

  // Instagram in-app browser
  const isInstagram = ua.includes('instagram');

  // Facebook & Messenger in-app browser
  const isFacebook = ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab') || ua.includes('fb4a') || ua.includes('fbios') || ua.includes('messenger');

  // Telegram in-app browser / bot
  const isTelegram = ua.includes('telegram');

  return isInstagram || isFacebook || isTelegram;
}

/**
 * Clean & normalize destination URL
 */
function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

/**
 * Render Restricted Browser HTML Page (HTTP 403)
 */
function renderRestrictedBrowserPage(res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Restricted</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border-radius: 20px; padding: 40px 32px; max-width: 460px; width: 100%; text-align: center; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .icon { font-size: 56px; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 22px; margin: 0 0 12px; color: #f43f5e; font-weight: 700; }
    p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px; }
    .apps-container { background: #0f172a; border-radius: 12px; padding: 16px; border: 1px solid #334155; }
    .apps-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; font-weight: 600; }
    .allowed-apps { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
    .badge { background: #1e293b; color: #38bdf8; padding: 8px 16px; border-radius: 9999px; font-size: 13px; font-weight: 600; border: 1px solid #0284c7; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🚫</div>
    <h1>In-App Browser Only</h1>
    <p>This link is restricted and can <strong>only</strong> be opened inside the <strong>Instagram</strong>, <strong>Facebook</strong>, or <strong>Telegram</strong> app browser.</p>
    <div class="apps-container">
      <div class="apps-title">Supported Apps</div>
      <div class="allowed-apps">
        <span class="badge">📷 Instagram</span>
        <span class="badge">📘 Facebook</span>
        <span class="badge">✈️ Telegram</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  res.status(403).setHeader('Content-Type', 'text/html').send(html);
}

/**
 * Render Expired Link HTML Page (HTTP 410)
 */
function renderExpiredPage(res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Expired</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border-radius: 20px; padding: 40px 32px; max-width: 440px; width: 100%; text-align: center; border: 1px solid #334155; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 12px; color: #fbbf24; }
    p { font-size: 15px; color: #94a3b8; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⌛</div>
    <h1>Link Expired</h1>
    <p>This shortened link has passed its validity period and is no longer active.</p>
  </div>
</body>
</html>`;
  res.status(410).setHeader('Content-Type', 'text/html').send(html);
}

/**
 * Core Shortener Controller functions
 */
export const shortenerService = {
  createShortUrl(destinationUrl, validityDays = 7) {
    const normUrl = normalizeUrl(destinationUrl);
    if (!normUrl) {
      throw new Error('Invalid destination URL');
    }
    const days = parseInt(validityDays, 10) || 7;
    const code = generate5DigitCode();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const record = {
      code,
      destinationUrl: normUrl,
      validityDays: days,
      createdAt,
      expiresAt,
      clicks: 0
    };

    urlDatabase[code] = record;
    saveDatabase();
    return record;
  },

  editShortUrl(codeOrUrl, newDestinationUrl) {
    let code = codeOrUrl.trim();
    if (code.includes('/')) {
      const parts = code.split('/').filter(Boolean);
      code = parts[parts.length - 1];
    }

    if (!urlDatabase[code]) {
      return null;
    }

    const normUrl = normalizeUrl(newDestinationUrl);
    if (!normUrl) {
      throw new Error('Invalid new destination URL');
    }

    urlDatabase[code].destinationUrl = normUrl;
    urlDatabase[code].updatedAt = new Date().toISOString();
    saveDatabase();
    return urlDatabase[code];
  },

  getShortUrl(code) {
    return urlDatabase[code] || null;
  },

  incrementClick(code) {
    if (urlDatabase[code]) {
      urlDatabase[code].clicks = (urlDatabase[code].clicks || 0) + 1;
      saveDatabase();
    }
  },

  getAllUrls() {
    return Object.values(urlDatabase);
  },

  deleteShortUrl(code) {
    if (urlDatabase[code]) {
      delete urlDatabase[code];
      saveDatabase();
      return true;
    }
    return false;
  }
};

/**
 * Express Route Interceptor Middleware
 * Matches custom path requests:
 * 1. Creation: /url={destinationurl}/validity={indays}
 * 2. Editing: /editurl={generatedurl}/url={newdestinationurl}
 * 3. Accessing: /{5_digit_code}
 */
export function urlShortenerCustomRouteMiddleware(req, res, next) {
  const rawUrl = req.originalUrl || req.url;
  const pathOnly = req.path || rawUrl.split('?')[0];

  // 1. MATCH CREATION ENDPOINT: domain/url={destinationurl}/validity={indays}
  // Handles: /url=https://example.com/validity=7 or /url=https://example.com?validity=7 or /url=https://example.com
  const createMatch = rawUrl.match(/^\/url=(.+)\/validity=(\d+)\/?$/i) ||
                      rawUrl.match(/^\/url=(.+)\?validity=(\d+)\/?$/i);

  if (createMatch) {
    try {
      const destUrl = decodeURIComponent(createMatch[1]);
      const days = parseInt(createMatch[2], 10);
      const record = shortenerService.createShortUrl(destUrl, days);
      const host = req.get('host') || 'localhost:3001';
      const protocol = req.protocol || 'http';
      const shortUrl = `${protocol}://${host}/${record.code}`;

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(201).json({
          success: true,
          shortUrl,
          code: record.code,
          destinationUrl: record.destinationUrl,
          validityDays: record.validityDays,
          expiresAt: record.expiresAt
        });
      }

      return res.status(201).setHeader('Content-Type', 'text/html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>URL Shortened</title>
        <style>
          body { font-family: sans-serif; background: #0f172a; color: #fff; padding: 40px; text-align: center; }
          .box { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #334155; }
          a { color: #38bdf8; font-size: 20px; font-weight: bold; text-decoration: none; word-break: break-all; }
          .info { color: #94a3b8; font-size: 14px; margin-top: 15px; }
        </style>
        </head>
        <body>
          <div class="box">
            <h2>Short URL Created Successfully!</h2>
            <p><a href="${shortUrl}">${shortUrl}</a></p>
            <div class="info">
              <p>Destination: ${record.destinationUrl}</p>
              <p>Valid for: ${record.validityDays} Days (Expires: ${new Date(record.expiresAt).toLocaleString()})</p>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Fallback creation without validity param (defaults to 7 days) e.g. /url=https://example.com
  const simpleCreateMatch = rawUrl.match(/^\/url=(.+)$/i);
  if (simpleCreateMatch && !rawUrl.toLowerCase().startsWith('/url=edit')) {
    try {
      const destUrl = decodeURIComponent(simpleCreateMatch[1]);
      const record = shortenerService.createShortUrl(destUrl, 7);
      const host = req.get('host') || 'localhost:3001';
      const protocol = req.protocol || 'http';
      const shortUrl = `${protocol}://${host}/${record.code}`;

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(201).json({
          success: true,
          shortUrl,
          code: record.code,
          destinationUrl: record.destinationUrl,
          validityDays: record.validityDays,
          expiresAt: record.expiresAt
        });
      }

      return res.status(201).setHeader('Content-Type', 'text/html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>URL Shortened</title>
        <style>
          body { font-family: sans-serif; background: #0f172a; color: #fff; padding: 40px; text-align: center; }
          .box { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #334155; }
          a { color: #38bdf8; font-size: 20px; font-weight: bold; text-decoration: none; word-break: break-all; }
          .info { color: #94a3b8; font-size: 14px; margin-top: 15px; }
        </style>
        </head>
        <body>
          <div class="box">
            <h2>Short URL Created Successfully!</h2>
            <p><a href="${shortUrl}">${shortUrl}</a></p>
            <div class="info">
              <p>Destination: ${record.destinationUrl}</p>
              <p>Valid for: ${record.validityDays} Days (Expires: ${new Date(record.expiresAt).toLocaleString()})</p>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  // 2. MATCH EDIT ENDPOINT: domain/editurl={generatedurl}/url={newdestinationurl}
  const editMatch = rawUrl.match(/^\/editurl=(.+)\/url=(.+)$/i);
  if (editMatch) {
    try {
      const codeOrUrl = decodeURIComponent(editMatch[1]);
      const newUrl = decodeURIComponent(editMatch[2]);
      const updatedRecord = shortenerService.editShortUrl(codeOrUrl, newUrl);

      if (!updatedRecord) {
        return res.status(404).json({ error: 'Short URL code not found for editing' });
      }

      const host = req.get('host') || 'localhost:3001';
      const protocol = req.protocol || 'http';
      const shortUrl = `${protocol}://${host}/${updatedRecord.code}`;

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'URL updated successfully',
          shortUrl,
          code: updatedRecord.code,
          newDestinationUrl: updatedRecord.destinationUrl,
          updatedAt: updatedRecord.updatedAt
        });
      }

      return res.status(200).setHeader('Content-Type', 'text/html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>URL Updated</title>
        <style>
          body { font-family: sans-serif; background: #0f172a; color: #fff; padding: 40px; text-align: center; }
          .box { background: #1e293b; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #334155; }
          a { color: #38bdf8; font-size: 20px; font-weight: bold; text-decoration: none; }
          .info { color: #4ade80; font-size: 15px; margin-top: 15px; }
        </style>
        </head>
        <body>
          <div class="box">
            <h2>Short URL Updated!</h2>
            <p><a href="${shortUrl}">${shortUrl}</a></p>
            <p class="info">New Destination: ${updatedRecord.destinationUrl}</p>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  // 3. MATCH SHORT URL REDIRECTION: domain/{5_digit_code} (or 5-char alphanumeric)
  const codeMatch = pathOnly.match(/^\/([a-zA-Z0-9]{5})\/?$/);
  if (codeMatch) {
    const code = codeMatch[1];
    const record = shortenerService.getShortUrl(code);

    if (!record) {
      return res.status(404).setHeader('Content-Type', 'text/html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>404 Not Found</title></head>
        <body style="background:#0f172a; color:#fff; text-align:center; padding:50px; font-family:sans-serif;">
          <h1>404 - Short Link Not Found</h1>
          <p style="color:#94a3b8;">The requested short link does not exist.</p>
        </body>
        </html>
      `);
    }

    // CHECK IN-APP BROWSER RESTRICTION (Instagram, Facebook, Telegram only)
    const userAgent = req.headers['user-agent'] || '';
    const bypassRestriction = req.query.bypass_ua === 'true';

    if (!bypassRestriction && !isAllowedInAppBrowser(userAgent)) {
      console.warn(`[Shortener Block] Code ${code} blocked for UA: ${userAgent}`);
      return renderRestrictedBrowserPage(res);
    }

    // CHECK EXPIRATION
    if (new Date() > new Date(record.expiresAt)) {
      console.warn(`[Shortener Expired] Code ${code} has expired.`);
      return renderExpiredPage(res);
    }

    // INCREMENT CLICKS AND REDIRECT
    shortenerService.incrementClick(code);
    return res.redirect(302, record.destinationUrl);
  }

  next();
}

/**
 * Standard REST API Router for Management
 */
export async function createShortenerApiRouter() {
  const expressModule = await import('express');
  const express = expressModule.default || expressModule;
  const router = express.Router();

  // Create short url
  router.post('/shorten', (req, res) => {
    const { destinationUrl, validityDays } = req.body;
    if (!destinationUrl) {
      return res.status(400).json({ error: 'destinationUrl is required' });
    }
    try {
      const record = shortenerService.createShortUrl(destinationUrl, validityDays);
      const host = req.get('host') || 'localhost:3001';
      const protocol = req.protocol || 'http';
      res.status(201).json({
        success: true,
        shortUrl: `${protocol}://${host}/${record.code}`,
        ...record
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Edit short url
  router.put('/edit', (req, res) => {
    const { code, newDestinationUrl } = req.body;
    if (!code || !newDestinationUrl) {
      return res.status(400).json({ error: 'code and newDestinationUrl are required' });
    }
    try {
      const record = shortenerService.editShortUrl(code, newDestinationUrl);
      if (!record) {
        return res.status(404).json({ error: 'Short URL not found' });
      }
      res.json({ success: true, ...record });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // List all short urls
  router.get('/list', (req, res) => {
    res.json({ urls: shortenerService.getAllUrls() });
  });

  // Delete short url
  router.delete('/:code', (req, res) => {
    const deleted = shortenerService.deleteShortUrl(req.params.code);
    if (!deleted) {
      return res.status(404).json({ error: 'Short URL not found' });
    }
    res.json({ success: true, message: `Short code ${req.params.code} deleted` });
  });

  return router;
}
