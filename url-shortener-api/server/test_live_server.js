import app from './index.js';
import http from 'http';

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`🧪 Running comprehensive edge-case live HTTP server tests on ${baseUrl}...\n`);

  try {
    // 1. Create short URL with nested path & query string: /url=https://github.com/trending?since=daily/validity=15
    console.log('1. Testing URL Creation with complex query & path: /url=https://github.com/trending?since=daily/validity=15');
    const createRes = await fetch(`${baseUrl}/url=https://github.com/trending?since=daily/validity=15`, {
      headers: { 'Accept': 'application/json' }
    });
    const createData = await createRes.json();
    console.log('   Response status:', createRes.status);
    console.log('   Created code:', createData.code);
    console.log('   Destination URL:', createData.destinationUrl);
    console.log('   Validity Days:', createData.validityDays);

    if (createData.destinationUrl !== 'https://github.com/trending?since=daily' || createData.validityDays !== 15) {
      throw new Error('Complex URL creation parsing failed');
    }

    const code1 = createData.code;

    // 2. Short URL access with incoming query string e.g. /{code}?utm_source=instagram
    console.log(`\n2. Testing Short URL access with query string: /${code1}?utm_source=instagram`);
    const queryAccessRes = await fetch(`${baseUrl}/${code1}?utm_source=instagram`, {
      headers: { 'User-Agent': 'Instagram 225.0.0.19.115' },
      redirect: 'manual'
    });
    console.log('   Response status:', queryAccessRes.status, '(Expected 302)');
    console.log('   Redirect location:', queryAccessRes.headers.get('location'));

    if (queryAccessRes.status !== 302 || queryAccessRes.headers.get('location') !== 'https://github.com/trending?since=daily') {
      throw new Error('Query string short code access failed');
    }

    // 3. Fallback URL Creation without validity param: /url=https://telegram.org
    console.log('\n3. Testing Fallback URL Creation: /url=https://telegram.org');
    const fallbackRes = await fetch(`${baseUrl}/url=https://telegram.org`, {
      headers: { 'Accept': 'application/json' }
    });
    const fallbackData = await fallbackRes.json();
    console.log('   Response status:', fallbackRes.status);
    console.log('   Default validity days:', fallbackData.validityDays, '(Expected 7)');

    if (fallbackData.validityDays !== 7) {
      throw new Error('Fallback validity days should default to 7');
    }

    // 4. Access via Unauthorized Browsers (Chrome & Safari)
    console.log('\n4. Testing Access Control (Chrome & Safari vs Instagram & Telegram)');
    const chromeRes = await fetch(`${baseUrl}/${code1}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0' }
    });
    console.log('   Chrome UA Status:', chromeRes.status, '(Expected 403 Access Restricted)');

    const telegramRes = await fetch(`${baseUrl}/${code1}`, {
      headers: { 'User-Agent': 'TelegramBot' },
      redirect: 'manual'
    });
    console.log('   Telegram UA Status:', telegramRes.status, '(Expected 302 Redirect)');

    if (chromeRes.status !== 403 || telegramRes.status !== 302) {
      throw new Error('Access control enforcement failed');
    }

    // 5. URL Editing
    console.log(`\n5. Testing Edit endpoint: /editurl=${code1}/url=https://news.ycombinator.com`);
    const editRes = await fetch(`${baseUrl}/editurl=${code1}/url=https://news.ycombinator.com`, {
      headers: { 'Accept': 'application/json' }
    });
    const editData = await editRes.json();
    console.log('   Edit Response Status:', editRes.status);
    console.log('   New Destination:', editData.newDestinationUrl);

    if (editData.newDestinationUrl !== 'https://news.ycombinator.com') {
      throw new Error('Edit URL failed');
    }

    console.log('\n==================================================');
    console.log('🎉 COMPREHENSIVE COMPONENT VERIFICATION PASSED 100%!');
    console.log('==================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit();
  }
});
