# Deploying to Railway 🚀

This URL Shortener API is pre-configured for direct deployment on **[Railway](https://railway.app)**.

---

## Method 1: Deploy via GitHub (Recommended)

1. Push your repository to **GitHub**.
2. Go to [Railway Dashboard](https://railway.app/new).
3. Click **Deploy from GitHub repo**.
4. Select this repository.
5. Railway will automatically detect Node.js, run `npm install`, and start `node server/index.js`.
6. Click **Generate Domain** under project settings to get your live URL (e.g. `your-app.up.railway.app`).

---

## Method 2: Deploy via Railway CLI

1. Install Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```
2. Login & initialize:
   ```bash
   railway login
   railway init
   ```
3. Deploy:
   ```bash
   railway up
   ```
4. Generate a public domain:
   ```bash
   railway domain
   ```

---

## Persistent Data (Optional Railway Volume)

By default, shortened URLs are saved to `server/data/short_urls.json`.
To persist data across redeployments:

1. In your Railway Service dashboard, go to **Volumes**.
2. Click **Add Volume**.
3. Set Mount Path to: `/app/server/data`
4. Set Environment Variable:
   - `DATA_DIR` = `/app/server/data`

---

## Testing Your Deployed Railway API

Once deployed to `https://your-app.up.railway.app`:

### 1. Create a Short URL
```text
https://your-app.up.railway.app/url=https://instagram.com/p/example/validity=7
```
**Response**: Returns `https://your-app.up.railway.app/58291`

### 2. Edit a Short URL
```text
https://your-app.up.railway.app/editurl=58291/url=https://newdestination.com
```

### 3. Open Shortened Link
Open `https://your-app.up.railway.app/58291` inside **Instagram**, **Facebook**, or **Telegram** app browser.
*(Opening in standard browsers like Chrome or Safari will display the Access Restricted notification)*.
