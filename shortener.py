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

    def generate_random_code(self) -> str:
        chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        while True:
            length = random.randint(7, 10)
            code = "".join(random.choice(chars) for _ in range(length))
            if code not in self.database:
                return code

    def generate_5_digit_code(self) -> str:
        return self.generate_random_code()

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

    def get_restricted_browser_html(self, host: str = "supersalepro.com", ip: str = "127.0.0.1") -> str:
        import secrets
        ray_id = secrets.token_hex(8)
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attention Required! | Cloudflare</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: #f6f6f6; color: #333333; line-height: 1.5; }}
    .header-bar {{ background: #ffffff; padding: 40px 20px 30px; border-bottom: 1px solid #e0e0e0; }}
    .header-container {{ max-width: 960px; margin: 0 auto; }}
    h1 {{ font-size: 38px; font-weight: 300; color: #222222; margin-bottom: 8px; letter-spacing: -0.5px; }}
    .subtitle {{ font-size: 20px; font-weight: 300; color: #666666; }}
    .hero-section {{ background: #e9e9e9; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e0e0e0; }}
    .hero-container {{ max-width: 960px; margin: 0 auto; }}
    .browser-frame {{ background: #ffffff; border-radius: 8px 8px 0 0; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); }}
    .browser-header {{ background: #7a7a7a; padding: 10px 14px; display: flex; align-items: center; gap: 6px; }}
    .dot {{ width: 10px; height: 10px; border-radius: 50%; background: #ffffff; opacity: 0.8; }}
    .tab {{ background: #ffffff; width: 120px; height: 16px; border-radius: 4px 4px 0 0; margin-left: 10px; }}
    .browser-content {{ background: #ffffff; min-height: 300px; display: flex; align-items: center; justify-content: center; border: 1px solid #dcdcdc; border-top: none; }}
    .red-cross-circle {{ width: 120px; height: 120px; background-color: #bd2c2c; border-radius: 50%; display: flex; align-items: center; justify-content: center; }}
    .red-cross-circle svg {{ width: 64px; height: 64px; fill: #ffffff; }}
    .info-section {{ background: #ffffff; padding: 40px 20px; }}
    .info-container {{ max-width: 960px; margin: 0 auto; display: flex; gap: 40px; flex-wrap: wrap; text-align: left; }}
    .column {{ flex: 1; min-width: 280px; }}
    .column h2 {{ font-size: 22px; font-weight: 400; color: #333333; margin-bottom: 16px; }}
    .column p {{ font-size: 14px; color: #666666; line-height: 1.6; }}
    .footer {{ max-width: 960px; margin: 0 auto; padding: 25px 20px 40px; font-size: 12px; color: #888888; border-top: 1px solid #e0e0e0; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="header-container">
      <h1>Sorry, you have been blocked</h1>
      <div class="subtitle">You are unable to access {host}</div>
    </div>
  </div>

  <div class="hero-section">
    <div class="hero-container">
      <div class="browser-frame">
        <div class="browser-header">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="tab"></div>
        </div>
        <div class="browser-content">
          <div class="red-cross-circle">
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="info-section">
    <div class="info-container">
      <div class="column">
        <h2>Why have I been blocked?</h2>
        <p>This website is using a security service to protect itself from online attacks. The action you just performed triggered the security solution. There are several actions that could trigger this block including submitting a certain word or phrase, a SQL command or malformed data.</p>
      </div>
      <div class="column">
        <h2>What can I do to resolve this?</h2>
        <p>You can email the site owner to let them know you were blocked. Please include what you were doing when this page came up and the Cloudflare Ray ID found at the bottom of this page.</p>
      </div>
    </div>
  </div>

  <div class="footer">
    Cloudflare Ray ID: <strong>{ray_id}</strong> &bull; Your IP: {ip} &bull; Performance &amp; security by Cloudflare
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
