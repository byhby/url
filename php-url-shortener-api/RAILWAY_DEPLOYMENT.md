# Deploying PHP URL Shortener API on Railway 🚀

This PHP URL Shortener API is pre-configured for instant deployment on **[Railway](https://railway.app)**.

---

## Deploying via GitHub (Recommended)

1. Upload/push this `php-shortener` directory to **GitHub**.
2. Go to **[Railway Dashboard](https://railway.app/new)**.
3. Click **Deploy from GitHub repo**.
4. Select your repository.
5. Railway will automatically detect `nixpacks.toml` and `composer.json`, build PHP 8+, and run `php -S 0.0.0.0:$PORT index.php`.
6. Under Settings, click **Generate Domain** to get your public URL (e.g. `your-php-shortener.up.railway.app`).

---

## URL Formats & Usage

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
*(Opening from Chrome or Safari displays the 403 Access Restricted notification page)*.
