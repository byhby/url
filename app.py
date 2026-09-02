import os
import re
import urllib.parse
from datetime import datetime
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from shortener import Shortener

app = FastAPI(title="Python URL Shortener API", version="1.0.0")
shortener = Shortener()

@app.get("/")
async def home():
    return Response(content="", status_code=200, media_type="text/html")

def get_base_url(request: Request) -> str:
    host = request.headers.get("host", "localhost:8000")
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    if proto == "http" and "localhost" not in host and "127.0.0.1" not in host:
        proto = "https"
    return f"{proto}://{host}"

# Catch-all middleware for custom route patterns:
# 1. /url={destinationurl}/validity={indays}
# 2. /editurl={generatedurl}/url={newdestinationurl}
# 3. /{5_digit_code}
@app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def handle_custom_routes(request: Request, path_name: str):
    # HTTPS enforcement for production proxies (Cloudflare/Railway)
    host_hdr = request.headers.get("host", "")
    if request.headers.get("x-forwarded-proto") == "http" and "localhost" not in host_hdr and "127.0.0.1" not in host_hdr:
        return RedirectResponse(url=f"https://{host_hdr}{request.url.path}", status_code=301)

    raw_path = request.url.path
    if request.url.query:
        raw_path += "?" + request.url.query

    # 1. CREATION ENDPOINT: /url={dest}/validity={days}
    create_match = re.match(r"^/url=(.+)/validity=(\d+)/?$", raw_path, re.IGNORECASE) or \
                   re.match(r"^/url=(.+)\?validity=(\d+)/?$", raw_path, re.IGNORECASE)
    
    if create_match:
        try:
            dest_url = urllib.parse.unquote(create_match.group(1))
            days = int(create_match.group(2))
            record = shortener.create_short_url(dest_url, days)
            base_url = get_base_url(request)
            short_url = f"{base_url}/{record['code']}"

            if "application/json" in request.headers.get("accept", ""):
                return JSONResponse({
                    "success": True,
                    "shortUrl": short_url,
                    **record
                }, status_code=201)

            return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head><title>URL Shortened (Python)</title>
<style>
  body {{ font-family: sans-serif; background: #0f172a; color: #fff; padding: 40px; text-align: center; }}
  .box {{ background: #1e293b; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #334155; }}
  a {{ color: #38bdf8; font-size: 20px; font-weight: bold; text-decoration: none; word-break: break-all; }}
  .info {{ color: #94a3b8; font-size: 14px; margin-top: 15px; }}
</style>
</head>
<body>
  <div class="box">
    <h2>Short URL Created Successfully!</h2>
    <p><a href="{short_url}">{short_url}</a></p>
    <div class="info">
      <p>Destination: {record['destinationUrl']}</p>
      <p>Valid for: {record['validityDays']} Days (Expires: {record['expiresAt']})</p>
    </div>
  </div>
</body>
</html>""", status_code=201)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=400)

    # Fallback creation without /validity= e.g. /url=https://example.com
    simple_create = re.match(r"^/url=(.+)$", raw_path, re.IGNORECASE)
    if simple_create and not raw_path.lower().startswith("/url=edit"):
        try:
            dest_url = urllib.parse.unquote(simple_create.group(1))
            record = shortener.create_short_url(dest_url, 7)
            base_url = get_base_url(request)
            short_url = f"{base_url}/{record['code']}"

            if "application/json" in request.headers.get("accept", ""):
                return JSONResponse({
                    "success": True,
                    "shortUrl": short_url,
                    **record
                }, status_code=201)

            return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head><title>URL Shortened (Python)</title>
<style>
  body {{ font-family: sans-serif; background: #0f172a; color: #fff; padding: 40px; text-align: center; }}
  .box {{ background: #1e293b; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #334155; }}
  a {{ color: #38bdf8; font-size: 20px; font-weight: bold; text-decoration: none; word-break: break-all; }}
  .info {{ color: #94a3b8; font-size: 14px; margin-top: 15px; }}
</style>
</head>
<body>
  <div class="box">
    <h2>Short URL Created Successfully!</h2>
    <p><a href="{short_url}">{short_url}</a></p>
    <div class="info">
      <p>Destination: {record['destinationUrl']}</p>
      <p>Valid for: {record['validityDays']} Days (Expires: {record['expiresAt']})</p>
    </div>
  </div>
</body>
</html>""", status_code=201)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=400)

    # 2. EDIT ENDPOINT: /editurl={code}/url={newdest}
    edit_match = re.match(r"^/editurl=(.+)/url=(.+)$", raw_path, re.IGNORECASE)
    if edit_match:
        try:
            code_or_url = urllib.parse.unquote(edit_match.group(1))
            new_url = urllib.parse.unquote(edit_match.group(2))
            updated_record = shortener.edit_short_url(code_or_url, new_url)

            if not updated_record:
                return JSONResponse({"error": "Short URL code not found for editing"}, status_code=404)

            base_url = get_base_url(request)
            short_url = f"{base_url}/{updated_record['code']}"

            if "application/json" in request.headers.get("accept", ""):
                return JSONResponse({
                    "success": True,
                    "message": "URL updated successfully",
                    "shortUrl": short_url,
                    "newDestinationUrl": updated_record["destinationUrl"],
                    **updated_record
                }, status_code=200)

            return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head><title>URL Updated (Python)</title>
<style>
  body {{ font-family: sans-serif; background: #0f172a; color: #fff; padding: 40px; text-align: center; }}
  .box {{ background: #1e293b; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #334155; }}
  a {{ color: #38bdf8; font-size: 20px; font-weight: bold; text-decoration: none; }}
  .info {{ color: #4ade80; font-size: 15px; margin-top: 15px; }}
</style>
</head>
<body>
  <div class="box">
    <h2>Short URL Updated!</h2>
    <p><a href="{short_url}">{short_url}</a></p>
    <p class="info">New Destination: {updated_record['destinationUrl']}</p>
  </div>
</body>
</html>""", status_code=200)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=400)

    # 3. REST API ENDPOINTS
    if request.url.path == "/api/shorten" and request.method == "POST":
        body = await request.json()
        try:
            record = shortener.create_short_url(body.get("destinationUrl"), body.get("validityDays", 7))
            base_url = get_base_url(request)
            return JSONResponse({"success": True, "shortUrl": f"{base_url}/{record['code']}", **record}, status_code=201)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=400)

    if request.url.path == "/api/edit" and request.method in ["PUT", "POST"]:
        body = await request.json()
        try:
            record = shortener.edit_short_url(body.get("code"), body.get("newDestinationUrl"))
            if not record:
                return JSONResponse({"error": "Short code not found"}, status_code=404)
            return JSONResponse({"success": True, **record}, status_code=200)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=400)

    if request.url.path == "/api/list" and request.method == "GET":
        return JSONResponse({"urls": shortener.get_all_urls()}, status_code=200)

    # 4. REDIRECTION: /{short_code} (7-10 alphanumeric characters)
    code_match = re.match(r"^/([a-zA-Z0-9]{5,12})/?$", request.url.path)
    if code_match:
        code = code_match.group(1)
        record = shortener.get_short_url(code)
        
        if not record:
            return HTMLResponse("""<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body style="background:#0f172a; color:#fff; text-align:center; padding:50px; font-family:sans-serif;">
  <h1>404 - Short Link Not Found</h1>
  <p style="color:#94a3b8;">The requested short link does not exist.</p>
</body>
</html>""", status_code=404)

        # CHECK IN-APP BROWSER RESTRICTION (Instagram, Facebook, Telegram only)
        user_agent = request.headers.get("user-agent", "")
        bypass = request.query_params.get("bypass_ua") == "true"
        
        if not bypass and not shortener.is_allowed_in_app_browser(user_agent):
            host = request.headers.get("host", "domain.com")
            if ":" in host:
                host = host.split(":")[0]
            ip = request.client.host if request.client else "127.0.0.1"
            return HTMLResponse(shortener.get_restricted_browser_html(host=host, ip=ip), status_code=403)

        # CHECK EXPIRATION
        expires_at = datetime.fromisoformat(record["expiresAt"].replace("Z", "+00:00"))
        if datetime.now(expires_at.tzinfo) > expires_at:
            return HTMLResponse(shortener.get_expired_page_html(), status_code=410)

        # INCREMENT CLICKS AND REDIRECT
        shortener.increment_click(code)
        return RedirectResponse(url=record["destinationUrl"], status_code=302)

    return JSONResponse({"error": "Not Found", "message": f"Route {request.method} {request.url.path} does not exist"}, status_code=404)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
