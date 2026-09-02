# ⚡ RajPay for Business

RajPay is a premium, high-performance payment gateway routing router and merchant management console. It allows businesses to optimize payment fees, boost transaction success rates, and manage global customers using a smart dynamic rules engine.

---

## 🚀 Key Features

### 1. Smart Routing Engine
- Define custom routing rules based on conditions like **currency** (USD, INR, EUR, etc.) and **transaction amount**.
- Failover configurations redirect failed transactions to backup gateways (e.g., Stripe, PayPal, Adyen, Razorpay, Paytm, Kong AI) automatically.

### 2. Developer Console & HTTP Webhooks
- **Configurable Endpoints**: Enter target webhook URLs to listen for payment lifecycle events.
- **Outgoing Delivery Tracker**: View HTTP POST webhook requests, responses, latency, and status codes.
- **Built-in Local Receiver**: Check raw incoming JSON webhook events directly in the browser terminal for debugging.
- **Simulator Playground**: Manually trigger webhook events (`payment.captured`, `refund.succeeded`, etc.) to test integrations.

### 3. Customer Portal & Invoices
- **Invoices Listing**: Clear overview of paid, unpaid, and overdue orders.
- **Print-to-PDF**: Export beautifully formatted invoice receipts directly using browser print-to-PDF dialogues.
- **Self-Service Checkout**: Pay outstanding invoices directly using the pre-routed gateway.

### 4. Interactive Sandbox Simulator
- **Biometric Checkout**: Apple Pay and Google Pay simulation with face scanning and wallet authorization animations.
- **3D Secure OTP**: Stripe checkout flow including secure mock OTP/SMS verification.
- **QR Code Scanning**: Paytm/UPI static QR simulator with automated timer-based confirmation.

---

## 🛠️ Tech Stack & Setup

### Core Technologies
- **Frontend**: React, Vite, Vanilla CSS, Lucide Icons
- **Backend**: Node.js, Express, in-memory transaction and webhook databases

### Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Generate Self-Signed SSL/TLS Certificates**:
   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/CN=localhost"
   ```

3. **Start Backend Secure Server** (HTTPS on Port `3001`):
   ```bash
   npm run server
   ```

4. **Start Development Frontend Secure Server** (HTTPS on Port `5176`):
   ```bash
   npm run dev
   ```

5. **Verify Linter Status**:
   ```bash
   npm run lint
   ```

---

## 🔒 Security & Headers

The Express backend enforces CSRF verification on mutate endpoints. Ensure client calls include:
- `x-csrf-token`: Retried session authentication token.
- `x-session-id`: Current session context.
- Public receiver routes (like `/api/v1/webhook-receiver`) bypass CSRF filters to allow external payloads.
