<?php

class Shortener {
    private string $dataFile;
    private array $database = [];

    public function __construct(string $dataFile = __DIR__ . '/data/short_urls.json') {
        $this->dataFile = $dataFile;
        $dataDir = dirname($this->dataFile);

        if (!is_dir($dataDir)) {
            mkdir($dataDir, 0777, true);
        }

        if (!file_exists($this->dataFile)) {
            file_put_contents($this->dataFile, json_encode([], JSON_PRETTY_PRINT));
        }

        $raw = file_get_contents($this->dataFile);
        $this->database = json_decode($raw, true) ?: [];
    }

    private function save(): void {
        file_put_contents($this->dataFile, json_encode($this->database, JSON_PRETTY_PRINT));
    }

    public function generate5DigitCode(): string {
        $attempts = 0;
        do {
            $code = (string) rand(10000, 99999);
            $attempts++;
            if ($attempts > 1000) {
                $code = strtoupper(substr(md5(uniqid()), 0, 5));
                break;
            }
        } while (isset($this->database[$code]));

        return $code;
    }

    public function isAllowedInAppBrowser(?string $userAgent): bool {
        if (empty($userAgent)) {
            return false;
        }

        $ua = strtolower($userAgent);

        // Instagram
        $isInstagram = str_contains($ua, 'instagram');

        // Facebook & Messenger
        $isFacebook = str_contains($ua, 'fban') ||
                      str_contains($ua, 'fbav') ||
                      str_contains($ua, 'fb_iab') ||
                      str_contains($ua, 'fb4a') ||
                      str_contains($ua, 'fbios') ||
                      str_contains($ua, 'messenger');

        // Telegram
        $isTelegram = str_contains($ua, 'telegram');

        return $isInstagram || $isFacebook || $isTelegram;
    }

    public function normalizeUrl(?string $rawUrl): ?string {
        if (empty($rawUrl)) {
            return null;
        }

        $url = trim($rawUrl);
        if (!preg_match('/^https?:\/\//i', $url)) {
            $url = 'https://' . $url;
        }

        return preg_match('/^https?:\/\/[^\s]+$/i', $url) ? $url : null;
    }

    public function createShortUrl(string $destinationUrl, int $validityDays = 7): array {
        $normUrl = $this->normalizeUrl($destinationUrl);
        if (!$normUrl) {
            throw new Exception('Invalid destination URL');
        }

        $days = max(1, $validityDays);
        $code = $this->generate5DigitCode();
        $createdAt = date('c');
        $expiresAt = date('c', strtotime("+{$days} days"));

        $record = [
            'code' => $code,
            'destinationUrl' => $normUrl,
            'validityDays' => $days,
            'createdAt' => $createdAt,
            'expiresAt' => $expiresAt,
            'clicks' => 0
        ];

        $this->database[$code] = $record;
        $this->save();

        return $record;
    }

    public function editShortUrl(string $codeOrUrl, string $newDestinationUrl): ?array {
        $code = trim($codeOrUrl);
        if (str_contains($code, '/')) {
            $parts = array_values(array_filter(explode('/', $code)));
            $code = end($parts);
        }

        if (!isset($this->database[$code])) {
            return null;
        }

        $normUrl = $this->normalizeUrl($newDestinationUrl);
        if (!$normUrl) {
            throw new Exception('Invalid new destination URL');
        }

        $this->database[$code]['destinationUrl'] = $normUrl;
        $this->database[$code]['updatedAt'] = date('c');
        $this->save();

        return $this->database[$code];
    }

    public function getShortUrl(string $code): ?array {
        return $this->database[$code] ?? null;
    }

    public function incrementClick(string $code): void {
        if (isset($this->database[$code])) {
            $this->database[$code]['clicks'] = ($this->database[$code]['clicks'] ?? 0) + 1;
            $this->save();
        }
    }

    public function getAllUrls(): array {
        return array_values($this->database);
    }

    public function deleteShortUrl(string $code): bool {
        if (isset($this->database[$code])) {
            unset($this->database[$code]);
            $this->save();
            return true;
        }
        return false;
    }

    public function renderRestrictedBrowserPage(): void {
        http_response_code(403);
        header('Content-Type: text/html; charset=UTF-8');
        echo <<<'HTML'
<!DOCTYPE html>
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
</html>
HTML;
        exit;
    }

    public function renderExpiredPage(): void {
        http_response_code(410);
        header('Content-Type: text/html; charset=UTF-8');
        echo <<<'HTML'
<!DOCTYPE html>
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
</html>
HTML;
        exit;
    }
}
