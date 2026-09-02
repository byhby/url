<?php
require_once __DIR__ . '/Shortener.php';

echo "🧪 Starting PHP Shortener Engine Tests...\n\n";

$failed = 0;

function assertTest(bool $condition, string $message, int &$failed): void {
    if ($condition) {
        echo "  ✅ PASS: {$message}\n";
    } else {
        echo "  ❌ FAIL: {$message}\n";
        $failed++;
    }
}

$shortener = new Shortener(__DIR__ . '/data/test_short_urls.json');

// 1. User Agent Tests
echo "Test 1: User Agent Inspection for Instagram, Facebook, and Telegram\n";
$chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
$safariUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) Version/15.0 Mobile/15E148 Safari/604.1';
$instaUA = 'Instagram 225.0.0.19.115';
$fbUA = 'Mozilla/5.0 [FBAN/FBIOS;FBDV/iPhone12,1]';
$teleUA = 'TelegramBot (like TwitterBot)';

assertTest(!$shortener->isAllowedInAppBrowser($chromeUA), 'Chrome blocked', $failed);
assertTest(!$shortener->isAllowedInAppBrowser($safariUA), 'Safari blocked', $failed);
assertTest($shortener->isAllowedInAppBrowser($instaUA), 'Instagram allowed', $failed);
assertTest($shortener->isAllowedInAppBrowser($fbUA), 'Facebook allowed', $failed);
assertTest($shortener->isAllowedInAppBrowser($teleUA), 'Telegram allowed', $failed);

// 2. Creation Test
echo "\nTest 2: Creation of 5-digit short code\n";
$record = $shortener->createShortUrl('https://google.com', 10);
assertTest(preg_match('/^[a-zA-Z0-9]{5}$/', $record['code']) === 1, "Generated 5-digit code: {$record['code']}", $failed);
assertTest($record['destinationUrl'] === 'https://google.com', 'Destination set correctly', $failed);
assertTest($record['validityDays'] === 10, 'Validity is 10 days', $failed);

// 3. Edit Test
echo "\nTest 3: Editing short URL\n";
$updated = $shortener->editShortUrl($record['code'], 'https://updated-domain.com');
assertTest($updated['destinationUrl'] === 'https://updated-domain.com', 'Updated destination URL', $failed);

// Clean up
$shortener->deleteShortUrl($record['code']);
if (file_exists(__DIR__ . '/data/test_short_urls.json')) {
    unlink(__DIR__ . '/data/test_short_urls.json');
}

echo "\n----------------------------------------\n";
if ($failed === 0) {
    echo "🎉 ALL PHP UNIT TESTS PASSED 100%!\n";
    exit(0);
} else {
    echo "🚨 {$failed} TEST(S) FAILED!\n";
    exit(1);
}
