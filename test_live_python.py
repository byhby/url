import sys
import time
import json
import urllib.request
import urllib.error
import subprocess
import os

print("🧪 Testing Python URL Shortener Live Server...")

# Install uvicorn & fastapi if needed or run via uvicorn if installed
try:
    import uvicorn
    import fastapi
except ImportError:
    print("Installing requirements for testing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "python-shortener/requirements.txt"])

proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8890"], cwd=os.path.join(os.path.dirname(__file__)))
time.sleep(1.5)

try:
    # 1. Create short URL via /url=https://github.com/validity=7
    print("\n1. Testing Creation: /url=https://github.com/validity=7")
    req = urllib.request.Request("http://127.0.0.1:8890/url=https://github.com/validity=7", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"   Response Code: {resp.status}")
        print(f"   Created Code: {data.get('code')}")
        print(f"   Short URL: {data.get('shortUrl')}")
        code = data.get("code")

    if not code:
        raise Exception("Code generation failed")

    # 2. Access with Chrome UA -> Expect 403 Access Restricted
    print(f"\n2. Testing Access with Chrome User-Agent: /{code}")
    req_chrome = urllib.request.Request(f"http://127.0.0.1:8890/{code}", headers={"User-Agent": "Mozilla/5.0 Chrome/120.0"})
    try:
        urllib.request.urlopen(req_chrome)
        raise Exception("Expected 403, but request succeeded")
    except urllib.error.HTTPError as e:
        print(f"   Chrome UA Response Status: {e.code} (Expected 403)")
        if e.code != 403:
            raise Exception(f"Expected 403, got {e.code}")

    # 3. Access with Instagram UA -> Expect 302 Redirect
    print(f"\n3. Testing Access with Instagram User-Agent: /{code}")
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    req_insta = urllib.request.Request(f"http://127.0.0.1:8890/{code}", headers={"User-Agent": "Instagram 225.0.0.19.115"})
    try:
        opener.open(req_insta)
    except urllib.error.HTTPError as e:
        print(f"   Instagram UA Response Status: {e.code} (Expected 302)")
        print(f"   Redirect Location: {e.headers.get('Location')}")
        if e.code != 302 or e.headers.get("Location") != "https://github.com":
            raise Exception("Instagram redirect failed")

    # 4. Edit URL -> /editurl={code}/url=https://gitlab.com
    print(f"\n4. Testing URL Edit: /editurl={code}/url=https://gitlab.com")
    req_edit = urllib.request.Request(f"http://127.0.0.1:8890/editurl={code}/url=https://gitlab.com", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req_edit) as resp:
        edit_data = json.loads(resp.read().decode("utf-8"))
        print(f"   Edit Status: {resp.status}")
        print(f"   New Destination: {edit_data.get('newDestinationUrl')}")
        if edit_data.get("newDestinationUrl") != "https://gitlab.com":
            raise Exception("Edit failed")

    print("\n========================================")
    print("🎉 LIVE PYTHON HTTP SERVER TESTS PASSED 100%!")
    print("========================================\n")

finally:
    proc.terminate()
    proc.wait()
