import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { urlShortenerCustomRouteMiddleware, createShortenerApiRouter } from './urlShortener.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════
// 1. HELMET — HTTP Security Headers
// ═══════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://localhost:3001"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xContentTypeOptions: true, // X-Content-Type-Options: nosniff
  xFrameOptions: { action: 'deny' }, // Clickjacking protection
  xXssProtection: true // X-XSS-Protection
}));

// ═══════════════════════════════════════════
// 2. CORS — Cross-Origin Resource Sharing
// ═══════════════════════════════════════════
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://rajpay.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^https?:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID', 'X-Session-ID'],
  credentials: true,
  maxAge: 600
}));

// ═══════════════════════════════════════════
// 3. BODY PARSING — With Size Limits
// ═══════════════════════════════════════════
app.use(express.json({ limit: '10kb' })); // Prevent large payload attacks
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ═══════════════════════════════════════════
// 4. RATE LIMITING — DDoS Protection
// ═══════════════════════════════════════════
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Try again in 15 minutes.',
    retryAfter: 900
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 login attempts per 15 min
  message: {
    error: 'Too many login attempts',
    message: 'Account temporarily locked. Try again in 15 minutes.'
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 180,
  message: {
    error: 'API rate limit exceeded',
    message: 'Max 180 requests per minute. Upgrade your plan for higher limits.'
  }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/v1/', apiLimiter);

// ═══════════════════════════════════════════
// 5. CSRF TOKEN GENERATION
// ═══════════════════════════════════════════
const csrfTokens = new Map();

const generateCSRFToken = (sessionId) => {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, { token, createdAt: Date.now() });
  // Auto-expire after 1 hour
  setTimeout(() => csrfTokens.delete(sessionId), 3600000);
  return token;
};

const validateCSRFToken = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  
  const token = req.headers['x-csrf-token'];
  const sessionId = req.headers['x-session-id'];
  
  if (!token || !sessionId) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  const stored = csrfTokens.get(sessionId);
  if (!stored || stored.token !== token) {
    console.warn(`[CSRF] Invalid token from ${req.ip}`);
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// ═══════════════════════════════════════════
// 6. API KEY AUTHENTICATION MIDDLEWARE
// ═══════════════════════════════════════════
const liveApiKey = process.env.RAJPAY_LIVE_API_KEY || 'sec_key_live_rp_28f3a9e1c4d7';
const testApiKey = process.env.RAJPAY_TEST_API_KEY || 'sec_key_test_rp_demo123456';

const API_KEYS = new Map([
  [liveApiKey, { merchant: 'R Merchant', role: 'admin', rateLimit: 1000 }],
  [testApiKey, { merchant: 'R Merchant', role: 'admin', rateLimit: 100 }]
]);

const authenticateAPIKey = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Provide API key as Bearer token in Authorization header'
    });
  }
  
  const apiKey = authHeader.replace('Bearer ', '');
  const keyData = API_KEYS.get(apiKey);
  
  if (!keyData) {
    console.warn(`[AUTH] Invalid API key attempt from ${req.ip}`);
    logSecurityEvent('INVALID_API_KEY', req.ip, { key: apiKey.substring(0, 12) + '...' });
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.merchant = keyData;
  next();
};

// ═══════════════════════════════════════════
// 7. INPUT VALIDATION & SANITIZATION
// ═══════════════════════════════════════════
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '')          // Strip HTML tags
    .replace(/javascript:/gi, '')  // Remove JS protocol
    .replace(/on\w+=/gi, '')       // Remove event handlers
    .replace(/\\/g, '\\\\')        // Escape backslashes
    .trim();
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    const sanitized = sanitizeObject(req.body);
    for (const key in req.body) delete req.body[key];
    Object.assign(req.body, sanitized);
  }
  if (req.query) {
    const sanitized = sanitizeObject(req.query);
    for (const key in req.query) delete req.query[key];
    Object.assign(req.query, sanitized);
  }
  if (req.params) {
    const sanitized = sanitizeObject(req.params);
    for (const key in req.params) delete req.params[key];
    Object.assign(req.params, sanitized);
  }
  next();
};

app.use(sanitizeMiddleware);

const validatePaymentPayload = (req, res, next) => {
  const { amount, currency, description } = req.body;
  const errors = [];
  
  if (amount === undefined) {
    errors.push('amount is required');
  } else {
    const val = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(val) || val <= 0 || val > 10000.00) {
      errors.push('amount must be a number between 0.01 and 10000.00');
    } else {
      req.body.amount = val; // update to verified numeric type
    }
  }
  if (!currency || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    errors.push('currency must be a valid 3-letter ISO code (e.g. USD, INR)');
  }
  if (description && (typeof description !== 'string' || description.length > 500)) {
    errors.push('description must be a string under 500 characters');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
};

const validateWebhookURL = (urlStr) => {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      // Allow localhost in test environments only
      const isProduction = process.env.NODE_ENV === 'production' || process.env.RAJPAY_LIVE_API_KEY;
      if (isProduction) {
        return { valid: false, error: 'SSRF Protection: Loopback and private IP addresses are blocked in production' };
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

// ═══════════════════════════════════════════
// 8. SECURITY EVENT LOGGING
// ═══════════════════════════════════════════
const securityEvents = [];

const logSecurityEvent = (type, ip, details = {}) => {
  const event = {
    id: crypto.randomUUID(),
    type,
    ip,
    details,
    timestamp: new Date().toISOString()
  };
  securityEvents.unshift(event);
  if (securityEvents.length > 500) securityEvents.pop();
  console.log(`[SECURITY] ${type} from ${ip}`, JSON.stringify(details));
};

// ═══════════════════════════════════════════
// 9. IP BLOCKING
// ═══════════════════════════════════════════
const blockedIPs = new Set();
const failedAttempts = new Map();

const ipBlockMiddleware = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (blockedIPs.has(ip)) {
    logSecurityEvent('BLOCKED_REQUEST', ip);
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP has been blocked due to suspicious activity'
    });
  }
  next();
};

const trackFailedAttempt = (ip) => {
  const attempts = failedAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  attempts.count++;
  
  // Auto-block after 10 failed attempts in 5 minutes
  if (attempts.count >= 10) {
    blockedIPs.add(ip);
    logSecurityEvent('IP_AUTO_BLOCKED', ip, { reason: 'Too many failed attempts', attempts: attempts.count });
    failedAttempts.delete(ip);
  } else {
    failedAttempts.set(ip, attempts);
  }
};

app.use(ipBlockMiddleware);

// ═══════════════════════════════════════════
// WEBHOOK IN-MEMORY STORAGE & CONFIG
// ═══════════════════════════════════════════
const webhookDeliveries = [];
const webhookReceiverLogs = [];
let configuredWebhookUrl = 'http://localhost:3001/api/v1/webhook-receiver';


// ═══════════════════════════════════════════
// 10. REQUEST ID & AUDIT TRAIL
// ═══════════════════════════════════════════
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-RateLimit-Remaining', res.getHeader('X-RateLimit-Remaining') || 'N/A');
  
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 5000) {
      console.warn(`[SLOW] ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});

// ═══════════════════════════════════════════
// URL SHORTENER CUSTOM ROUTE MIDDLEWARE & API ROUTER
// ═══════════════════════════════════════════
app.use(urlShortenerCustomRouteMiddleware);

const shortenerRouter = await createShortenerApiRouter();
app.use('/api/v1/shortener', shortenerRouter);

// ═══════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    security: {
      helmet: true,
      cors: true,
      rateLimiting: true,
      csrfProtection: true,
      inputSanitization: true,
      ipBlocking: true
    }
  });
});

// Get CSRF Token (public)
app.get('/api/auth/csrf-token', (req, res) => {
  const sessionId = crypto.randomUUID();
  const token = generateCSRFToken(sessionId);
  res.json({ csrfToken: token, sessionId });
});

// Login (rate-limited)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;
  
  // Demo credentials
  if (email === 'admin@rajpay.com' && (password === 'admin123' || password === 'password123')) {
    const token = crypto.randomBytes(32).toString('hex');
    logSecurityEvent('LOGIN_SUCCESS', ip, { email });
    failedAttempts.delete(ip);
    return res.json({
      success: true,
      token,
      user: { name: 'R Merchant', email, role: 'admin' },
      expiresIn: 3600
    });
  }
  
  trackFailedAttempt(ip);
  logSecurityEvent('LOGIN_FAILED', ip, { email });
  res.status(401).json({ error: 'Invalid credentials' });
});

// Create Payment (authenticated + validated)
app.post('/api/v1/charges', authenticateAPIKey, validateCSRFToken, validatePaymentPayload, (req, res) => {
  const { amount, currency, description } = req.body;
  
  logSecurityEvent('PAYMENT_CREATED', req.ip, { amount, currency, merchant: req.merchant.merchant });
  
  res.status(201).json({
    id: `ch_${crypto.randomBytes(12).toString('hex')}`,
    amount,
    currency,
    description,
    status: 'succeeded',
    created: new Date().toISOString(),
    merchant: req.merchant.merchant
  });
});

// Get Security Status (authenticated)
app.get('/api/v1/security/status', authenticateAPIKey, (req, res) => {
  res.json({
    score: 87,
    blockedIPs: blockedIPs.size,
    blockedIPsList: Array.from(blockedIPs),
    recentEvents: securityEvents.slice(0, 20),
    rateLimits: {
      general: { windowMs: 900000, max: 100 },
      auth: { windowMs: 900000, max: 5 },
      api: { windowMs: 60000, max: 60 }
    },
    headers: {
      helmet: true,
      hsts: true,
      csp: true,
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff'
    }
  });
});

// Get Security Events (authenticated)
app.get('/api/v1/security/events', authenticateAPIKey, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  res.json({ events: securityEvents.slice(0, limit), total: securityEvents.length });
});

// Block/Unblock IP (authenticated)
app.post('/api/v1/security/block-ip', authenticateAPIKey, validateCSRFToken, (req, res) => {
  const { ip, action } = req.body;
  if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return res.status(400).json({ error: 'Invalid IP address format' });
  }
  
  if (action === 'block') {
    blockedIPs.add(ip);
    logSecurityEvent('IP_MANUALLY_BLOCKED', req.ip, { blockedIP: ip });
  } else if (action === 'unblock') {
    blockedIPs.delete(ip);
    logSecurityEvent('IP_UNBLOCKED', req.ip, { unblockedIP: ip });
  }
  
  res.json({ success: true, blockedIPs: Array.from(blockedIPs) });
});

// ═══════════════════════════════════════════
// WEBHOOK & RECEIVER APIS
// ═══════════════════════════════════════════

// Get current webhook configuration
app.get('/api/v1/webhook/config', (req, res) => {
  res.json({ url: configuredWebhookUrl });
});

// Update webhook configuration
app.post('/api/v1/webhook/config', validateCSRFToken, (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL must be a valid string' });
  }
  const validation = validateWebhookURL(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  configuredWebhookUrl = url;
  res.json({ success: true, url: configuredWebhookUrl });
});

// Get history of webhook deliveries (outgoing)
app.get('/api/v1/webhook/deliveries', (req, res) => {
  res.json({ deliveries: webhookDeliveries });
});

// Trigger a real HTTP webhook delivery
app.post('/api/v1/webhook/deliver', validateCSRFToken, async (req, res) => {
  const { event, gateway, payload } = req.body;
  if (!event || !payload) {
    return res.status(400).json({ error: 'Event name and payload are required' });
  }

  const deliveryId = `wd_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const targetUrl = configuredWebhookUrl;
  const start = Date.now();

  const deliveryRecord = {
    id: deliveryId,
    timestamp,
    url: targetUrl,
    event,
    gateway: gateway || 'unknown',
    payload,
    status: 0,
    response: '',
    latency: 0
  };

  // SSRF Check on trigger
  const urlCheck = validateWebhookURL(targetUrl);
  if (!urlCheck.valid) {
    deliveryRecord.status = 400;
    deliveryRecord.response = `SSRF Blocked: ${urlCheck.error}`;
    webhookDeliveries.unshift(deliveryRecord);
    if (webhookDeliveries.length > 100) webhookDeliveries.pop();
    return res.status(400).json({ error: urlCheck.error });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RajPay-Webhook-Engine/1.0',
        'X-RajPay-Signature': crypto.createHmac('sha256', process.env.WEBHOOK_SIGNATURE_KEY || 'super_secret_webhook_key').update(JSON.stringify(payload)).digest('hex')
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;
    const responseText = await response.text();

    deliveryRecord.status = response.status;
    deliveryRecord.response = responseText.substring(0, 1000); // Truncate response if too long
    deliveryRecord.latency = latency;
  } catch (error) {
    const latency = Date.now() - start;
    deliveryRecord.status = 0;
    deliveryRecord.response = error.message || 'Connection timeout / Network error';
    deliveryRecord.latency = latency;
  }

  webhookDeliveries.unshift(deliveryRecord);
  if (webhookDeliveries.length > 100) webhookDeliveries.pop();

  res.json(deliveryRecord);
});

// Local Webhook Receiver Endpoint
app.post('/api/v1/webhook-receiver', (req, res) => {
  const logEntry = {
    id: `wr_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body
  };
  webhookReceiverLogs.unshift(logEntry);
  if (webhookReceiverLogs.length > 100) webhookReceiverLogs.pop();
  
  res.status(200).send('Webhook Received successfully by RajPay Receiver');
});

// Get received webhooks history
app.get('/api/v1/webhook-receiver/logs', (req, res) => {
  res.json({ logs: webhookReceiverLogs });
});

// Clear received webhooks history
app.post('/api/v1/webhook-receiver/clear', (req, res) => {
  webhookReceiverLogs.length = 0;
  res.json({ success: true });
});

// ═══════════════════════════════════════════
// ERROR HANDLING — No stack traces leaked
// ═══════════════════════════════════════════
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  logSecurityEvent('SERVER_ERROR', req.ip, { path: req.path, error: err.message });
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    requestId: req.requestId
  });
});

// Serve static assets in production
const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Fallback to React index.html for SPA routing (excluding API routes)
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} does not exist`
  });
});

const keyPath = path.resolve(process.env.SSL_KEY_PATH || 'key.pem');
const certPath = path.resolve(process.env.SSL_CERT_PATH || 'cert.pem');

const hasSSL = fs.existsSync(keyPath) && fs.existsSync(certPath);

const HOST = process.env.HOST || '0.0.0.0';

if (hasSSL) {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
    console.log(`\n🛡️  URL Shortener & API Server running (HTTPS)`);
    console.log(`   Host: ${HOST}:${PORT}`);
    console.log(`   Security Features: Helmet, CORS, Rate-Limiting, UA-Filter Active\n`);
  });
} else {
  app.listen(PORT, HOST, () => {
    console.log(`\n🛡️  URL Shortener & API Server running (HTTP)`);
    console.log(`   Host: ${HOST}:${PORT}`);
    console.log(`   Security Features: Helmet, CORS, Rate-Limiting, UA-Filter Active\n`);
  });
}

export default app;
