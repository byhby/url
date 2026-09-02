import os
import json
import random
import re
from datetime import datetime, timedelta

class Shortener:
    def __init__(self, data_file=None):
        if data_file is None:
            data_dir = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
            os.makedirs(data_dir, exist_ok=True)
            data_file = os.path.join(data_dir, "short_urls.json")
        
        self.data_file = data_file
        os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
        
        if not os.path.exists(self.data_file):
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump({}, f, indent=2)
                
        self.database = self._load()

    def _load(self):
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save(self):
        try:
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(self.database, f, indent=2)
        except Exception as e:
            print(f"[Shortener] Save error: {e}")

    def generate_5_digit_code(self):
        attempts = 0
        while True:
            code = str(random.randint(10000, 99999))
            attempts += 1
            if code not in self.database:
                return code
            if attempts > 1000:
                # Fallback to 5-char alphanumeric
                chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                return "".join(random.choice(chars) for _ in range(5))

    def is_allowed_in_app_browser(self, user_agent: str) -> bool:
        if not user_agent:
            return False
        
        ua = user_agent.lower()
        is_instagram = "instagram" in ua
        is_facebook = any(term in ua for term in ["fban", "fbav", "fb_iab", "fb4a", "fbios", "messenger"])
        is_telegram = "telegram" in ua
        
        return is_instagram or is_facebook or is_telegram

    def normalize_url(self, raw_url: str) -> str:
        if not raw_url:
            return None
        
        url = raw_url.strip()
        if not re.match(r"^https?://", url, re.IGNORECASE):
            url = "https://" + url
            
        if re.match(r"^https?://[^\s]+$", url, re.IGNORECASE):
            return url
        return None

    def create_short_url(self, destination_url: str, validity_days: int = 7) -> dict:
        norm_url = self.normalize_url(destination_url)
        if not norm_url:
            raise ValueError("Invalid destination URL")
            
        days = max(1, int(validity_days))
        code = self.generate_5_digit_code()
        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(days=days)
        
        record = {
            "code": code,
            "destinationUrl": norm_url,
            "validityDays": days,
            "createdAt": created_at.isoformat() + "Z",
            "expiresAt": expires_at.isoformat() + "Z",
            "clicks": 0
        }
        
        self.database[code] = record
        self._save()
        return record

    def edit_short_url(self, code_or_url: str, new_destination_url: str) -> dict:
        code = code_or_url.strip()
        if "/" in code:
            parts = [p for p in code.split("/") if p]
            code = parts[-1]
            
        if code not in self.database:
            return None
            
        norm_url = self.normalize_url(new_destination_url)
        if not norm_url:
            raise ValueError("Invalid new destination URL")
            
        self.database[code]["destinationUrl"] = norm_url
        self.database[code]["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        self._save()
        return self.database[code]

    def get_short_url(self, code: str) -> dict:
        return self.database.get(code)

    def increment_click(self, code: str):
        if code in self.database:
            self.database[code]["clicks"] = self.database[code].get("clicks", 0) + 1
            self._save()

    def get_all_urls(self) -> list:
        return list(self.database.values())

    def delete_short_url(self, code: str) -> bool:
        if code in self.database:
            del self.database[code]
            self._save()
            return True
        return False

    def get_restricted_browser_html(self) -> str:
        return """<!DOCTYPE html>
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
</html>"""

    def get_expired_page_html(self) -> str:
        return """<!DOCTYPE html>
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
</html>"""
