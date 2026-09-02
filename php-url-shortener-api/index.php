<?php
require_once __DIR__ . '/Shortener.php';

$shortener = new Shortener();

// Retrieve full request URI
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$parsedUrl = parse_url($requestUri);
$pathOnly = $parsedUrl['path'] ?? '/';

// Determine Host & Scheme
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
$baseUrl = "{$scheme}://{$host}";

// Helper for JSON response
function sendJson($data, int $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// 1. MATCH CREATION ENDPOINT: domain/url={destinationurl}/validity={indays}
if (preg_match('/^\/url=(.+)\/validity=(\d+)\/?$/i', $requestUri, $matches) ||
    preg_match('/^\/url=(.+)\?validity=(\d+)\/?$/i', $requestUri, $matches)) {
    try {
        $destUrl = urldecode($matches[1]);
        $days = (int) $matches[2];
        $record = $shortener->createShortUrl($destUrl, $days);
        $shortUrl = "{$baseUrl}/{$record['code']}";

        if (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json')) {
            sendJson([
                'success' => true,
                'shortUrl' => $shortUrl,
                'code' => $record['code'],
                'destinationUrl' => $record['destinationUrl'],
                'validityDays' => $record['validityDays'],
                'expiresAt' => $record['expiresAt']
            ], 201);
        }

        header('Content-Type: text/html; charset=UTF-8');
        http_response_code(201);
        echo <<<HTML
<!DOCTYPE html>
<html>
<head><title>URL Shortened (PHP)</title>
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
    <p><a href="{$shortUrl}">{$shortUrl}</a></p>
    <div class="info">
      <p>Destination: {$record['destinationUrl']}</p>
      <p>Valid for: {$record['validityDays']} Days (Expires: {$record['expiresAt']})</p>
    </div>
  </div>
</body>
</html>
HTML;
        exit;
    } catch (Exception $e) {
        sendJson(['error' => $e->getMessage()], 400);
    }
}

// Fallback creation without /validity= (defaults to 7 days) e.g. /url=https://example.com
if (preg_match('/^\/url=(.+)$/i', $requestUri, $matches) && !str_starts_with(strtolower($requestUri), '/url=edit')) {
    try {
        $destUrl = urldecode($matches[1]);
        $record = $shortener->createShortUrl($destUrl, 7);
        $shortUrl = "{$baseUrl}/{$record['code']}";

        if (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json')) {
            sendJson([
                'success' => true,
                'shortUrl' => $shortUrl,
                'code' => $record['code'],
                'destinationUrl' => $record['destinationUrl'],
                'validityDays' => $record['validityDays'],
                'expiresAt' => $record['expiresAt']
            ], 201);
        }

        header('Content-Type: text/html; charset=UTF-8');
        http_response_code(201);
        echo <<<HTML
<!DOCTYPE html>
<html>
<head><title>URL Shortened (PHP)</title>
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
    <p><a href="{$shortUrl}">{$shortUrl}</a></p>
    <div class="info">
      <p>Destination: {$record['destinationUrl']}</p>
      <p>Valid for: {$record['validityDays']} Days (Expires: {$record['expiresAt']})</p>
    </div>
  </div>
</body>
</html>
HTML;
        exit;
    } catch (Exception $e) {
        sendJson(['error' => $e->getMessage()], 400);
    }
}

// 2. MATCH EDIT ENDPOINT: domain/editurl={generatedurl}/url={newdestinationurl}
if (preg_match('/^\/editurl=(.+)\/url=(.+)$/i', $requestUri, $matches)) {
    try {
        $codeOrUrl = urldecode($matches[1]);
        $newUrl = urldecode($matches[2]);
        $updatedRecord = $shortener->editShortUrl($codeOrUrl, $newUrl);

        if (!$updatedRecord) {
            sendJson(['error' => 'Short URL code not found for editing'], 404);
        }

        $shortUrl = "{$baseUrl}/{$updatedRecord['code']}";

        if (isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json')) {
            sendJson([
                'success' => true,
                'message' => 'URL updated successfully',
                'shortUrl' => $shortUrl,
                'code' => $updatedRecord['code'],
                'newDestinationUrl' => $updatedRecord['destinationUrl'],
                'updatedAt' => $updatedRecord['updatedAt']
            ], 200);
        }

        header('Content-Type: text/html; charset=UTF-8');
        http_response_code(200);
        echo <<<HTML
<!DOCTYPE html>
<html>
<head><title>URL Updated (PHP)</title>
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
    <p><a href="{$shortUrl}">{$shortUrl}</a></p>
    <p class="info">New Destination: {$updatedRecord['destinationUrl']}</p>
  </div>
</body>
</html>
HTML;
        exit;
    } catch (Exception $e) {
        sendJson(['error' => $e->getMessage()], 400);
    }
}

// 3. REST API ENDPOINTS
if ($pathOnly === '/api/shorten' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $url = $input['destinationUrl'] ?? null;
    $days = (int) ($input['validityDays'] ?? 7);

    try {
        $record = $shortener->createShortUrl($url, $days);
        sendJson(array_merge(['success' => true, 'shortUrl' => "{$baseUrl}/{$record['code']}"], $record), 201);
    } catch (Exception $e) {
        sendJson(['error' => $e->getMessage()], 400);
    }
}

if ($pathOnly === '/api/edit' && ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'POST')) {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $code = $input['code'] ?? null;
    $newUrl = $input['newDestinationUrl'] ?? null;

    try {
        $record = $shortener->editShortUrl($code, $newUrl);
        if (!$record) {
            sendJson(['error' => 'Short code not found'], 404);
        }
        sendJson(array_merge(['success' => true], $record), 200);
    } catch (Exception $e) {
        sendJson(['error' => $e->getMessage()], 400);
    }
}

if ($pathOnly === '/api/list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    sendJson(['urls' => $shortener->getAllUrls()], 200);
}

// 4. MATCH SHORT URL REDIRECTION: domain/{5_digit_code}
if (preg_match('/^\/([a-zA-Z0-9]{5})\/?$/', $pathOnly, $matches)) {
    $code = $matches[1];
    $record = $shortener->getShortUrl($code);

    if (!$record) {
        http_response_code(404);
        header('Content-Type: text/html; charset=UTF-8');
        echo <<<'HTML'
<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body style="background:#0f172a; color:#fff; text-align:center; padding:50px; font-family:sans-serif;">
  <h1>404 - Short Link Not Found</h1>
  <p style="color:#94a3b8;">The requested short link does not exist.</p>
</body>
</html>
HTML;
        exit;
    }

    // CHECK USER-AGENT RESTRICTION (Instagram, Facebook, Telegram only)
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $bypass = isset($_GET['bypass_ua']) && $_GET['bypass_ua'] === 'true';

    if (!$bypass && !$shortener->isAllowedInAppBrowser($userAgent)) {
        $shortener->renderRestrictedBrowserPage();
    }

    // CHECK EXPIRATION
    if (strtotime('now') > strtotime($record['expiresAt'])) {
        $shortener->renderExpiredPage();
    }

    // INCREMENT CLICK & REDIRECT
    $shortener->incrementClick($code);
    header("Location: {$record['destinationUrl']}", true, 302);
    exit;
}

// Default Home Page
http_response_code(200);
header('Content-Type: text/html; charset=UTF-8');
echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PHP URL Shortener API</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; line-height: 1.6; }
    .card { background: #1e293b; max-width: 600px; margin: 0 auto; padding: 32px; border-radius: 16px; border: 1px solid #334155; }
    code { background: #0f172a; color: #38bdf8; padding: 4px 8px; border-radius: 6px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 PHP URL Shortener API</h1>
    <p>Supported URL Endpoints:</p>
    <ul>
      <li><strong>Create:</strong> <code>/url={destinationurl}/validity={indays}</code></li>
      <li><strong>Edit:</strong> <code>/editurl={code}/url={newdestinationurl}</code></li>
      <li><strong>Redirect:</strong> <code>/{5_digit_code}</code> <em>(Instagram, Facebook, Telegram browsers only)</em></li>
    </ul>
  </div>
</body>
</html>
HTML;
