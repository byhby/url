import { shortenerService, isAllowedInAppBrowser } from './urlShortener.js';

console.log('🧪 Starting URL Shortener Tests...\n');

let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// TEST 1: User-Agent Detection
console.log('Test 1: User-Agent Inspection for Instagram, Facebook, and Telegram');

const chromeUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const safariUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
const instagramUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/19E241 Instagram 225.0.0.19.115';
const facebookUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) [FBAN/FBIOS;FBDV/iPhone12,1;FBMD/iPhone;FBSN/iOS;FBSV/14.0;FBSS/2;FBID/phone;FBLC/en_US;FBOP/5]';
const telegramUA = 'Mozilla/5.0 (Android; Mobile; rv:68.0) TelegramBot/1.0';

assert(!isAllowedInAppBrowser(chromeUA), 'Chrome should be BLOCKED');
assert(!isAllowedInAppBrowser(safariUA), 'Safari should be BLOCKED');
assert(isAllowedInAppBrowser(instagramUA), 'Instagram in-app browser should be ALLOWED');
assert(isAllowedInAppBrowser(facebookUA), 'Facebook in-app browser should be ALLOWED');
assert(isAllowedInAppBrowser(telegramUA), 'Telegram in-app browser should be ALLOWED');

// TEST 2: Creation of short URL
console.log('\nTest 2: Short URL Creation (5-digit code & validity in days)');
const target1 = 'https://google.com';
const record1 = shortenerService.createShortUrl(target1, 10);

assert(/^[a-zA-Z0-9]{5}$/.test(record1.code), `Generated code "${record1.code}" is 5 digits/chars`);
assert(record1.destinationUrl === 'https://google.com', `Destination URL correctly set to ${record1.destinationUrl}`);
assert(record1.validityDays === 10, 'Validity period is 10 days');
const expiresDate = new Date(record1.expiresAt);
const expectedExpires = Date.now() + 10 * 24 * 60 * 60 * 1000;
assert(Math.abs(expiresDate.getTime() - expectedExpires) < 5000, 'ExpiresAt timestamp accurately set');

// TEST 3: Editing short URL
console.log('\nTest 3: Short URL Editing (domain/editurl={generatedurl}/url={newurl})');
const updatedTarget = 'https://updated-google.com';
const updatedRecord = shortenerService.editShortUrl(record1.code, updatedTarget);

assert(updatedRecord !== null, 'Found record to update');
assert(updatedRecord.destinationUrl === updatedTarget, `Updated destination URL to ${updatedTarget}`);

// TEST 4: Full URL string edit parsing
const updatedTarget2 = 'https://destination-final.com';
const editWithFullUrl = shortenerService.editShortUrl(`https://domain.com/${record1.code}`, updatedTarget2);
assert(editWithFullUrl.destinationUrl === updatedTarget2, 'Extracted code from full URL and updated successfully');

// TEST 5: Expiration check
console.log('\nTest 5: Expiration handling');
const expiredRecord = shortenerService.createShortUrl('https://expired.com', -1); // Created -1 days in past
assert(new Date() > new Date(expiredRecord.expiresAt), 'Expired link is properly detected as expired');

// Clean up test code
shortenerService.deleteShortUrl(record1.code);
shortenerService.deleteShortUrl(expiredRecord.code);

console.log('\n----------------------------------------');
if (failedTests === 0) {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
} else {
  console.error(`🚨 ${failedTests} TEST(S) FAILED!`);
  process.exit(1);
}
