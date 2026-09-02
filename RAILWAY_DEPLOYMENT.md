# Deploying Python URL Shortener API on Railway 🚀

This Python URL Shortener API is pre-configured for instant deployment on **[Railway](https://railway.app)**.

---

## Deployment Steps

1. Push this `python-shortener` directory to **GitHub**.
2. Open **[Railway Dashboard](https://railway.app/new)**.
3. Select **Deploy from GitHub repo**.
4. Railway will automatically detect `requirements.txt`, install dependencies, and run:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port $PORT
   ```
5. Click **Generate Domain** under settings to get your public URL (e.g. `your-python-app.up.railway.app`).

---

## Supported URL Endpoints

- **Create Short URL**: `https://your-app.up.railway.app/url=https://example.com/validity=7`
- **Edit Short URL**: `https://your-app.up.railway.app/editurl=58291/url=https://newdestination.com`
- **Short URL Access**: `https://your-app.up.railway.app/58291` *(Opens only inside Instagram, Facebook, and Telegram in-app browsers)*.
