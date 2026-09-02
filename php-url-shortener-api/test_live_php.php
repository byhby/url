<?php

$host = "127.0.0.1:8889";
$docRoot = __DIR__;

$descriptorspec = [
   0 => ["pipe", "r"],
   1 => ["pipe", "w"],
   2 => ["pipe", "w"]
];

$process = proc_open("php -S {$host} -t {$docRoot} {$docRoot}/index.php", $descriptorspec, $pipes);
usleep(500000); // 0.5s pause to ensure server is bound

echo "🧪 Running Live PHP Built-in HTTP Server Tests on http://{$host}...\n\n";

try {
    // 1. Create URL via /url=https://github.com/validity=7
    echo "1. Testing /url=https://github.com/validity=7\n";
    $opts = [
        'http' => [
            'method' => 'GET',
            'header' => "Accept: application/json\r\n",
            'ignore_errors' => true
        ]
    ];
    $res = file_get_contents("http://{$host}/url=https://github.com/validity=7", false, stream_context_create($opts));
    $headers = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : $http_response_header;
    $statusLine = $headers[0] ?? '';
    preg_match('{HTTP\/\S+\s+(\d+)}', $statusLine, $m);
    $status = (int)($m[1] ?? 0);

    $data = json_decode($res, true);
    echo "   Response Status: {$status}\n";
    echo "   Generated Code: " . ($data['code'] ?? 'N/A') . "\n";
    echo "   Short URL: " . ($data['shortUrl'] ?? 'N/A') . "\n";

    if ($status !== 201 || empty($data['code'])) {
        throw new Exception('PHP URL creation failed');
    }

    $code = $data['code'];

    // 2. Access with Chrome UA -> Expect 403
    echo "\n2. Testing Short URL access with Chrome User-Agent: /{$code}\n";
    $optsChrome = [
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: Mozilla/5.0 Chrome/120.0\r\n",
            'ignore_errors' => true
        ]
    ];
    $resChrome = file_get_contents("http://{$host}/{$code}", false, stream_context_create($optsChrome));
    $headersChrome = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : $http_response_header;
    $statusLineChrome = $headersChrome[0] ?? '';
    preg_match('{HTTP\/\S+\s+(\d+)}', $statusLineChrome, $m);
    $statusChrome = (int)($m[1] ?? 0);

    echo "   Chrome UA Status: {$statusChrome} (Expected 403)\n";
    if ($statusChrome !== 403) {
        throw new Exception("Expected 403 for Chrome, got {$statusChrome}");
    }

    // 3. Access with Instagram UA -> Expect 302 Redirect
    echo "\n3. Testing Short URL access with Instagram User-Agent: /{$code}\n";
    $optsInsta = [
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: Instagram 225.0.0.19.115\r\n",
            'max_redirects' => 0,
            'ignore_errors' => true
        ]
    ];
    $resInsta = @file_get_contents("http://{$host}/{$code}", false, stream_context_create($optsInsta));
    $headersInsta = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : $http_response_header;
    $statusLineInsta = $headersInsta[0] ?? '';
    preg_match('{HTTP\/\S+\s+(\d+)}', $statusLineInsta, $m);
    $statusInsta = (int)($m[1] ?? 0);

    $location = '';
    foreach ($headersInsta as $header) {
        if (stripos($header, 'Location:') === 0) {
            $location = trim(substr($header, 9));
        }
    }

    echo "   Instagram UA Status: {$statusInsta} (Expected 302)\n";
    echo "   Redirect Location: {$location} (Expected https://github.com)\n";

    if ($statusInsta !== 302 || $location !== 'https://github.com') {
        throw new Exception("Expected 302 redirect to https://github.com");
    }

    // 4. Edit URL -> /editurl={$code}/url=https://gitlab.com
    echo "\n4. Testing URL Edit: /editurl={$code}/url=https://gitlab.com\n";
    $optsEdit = [
        'http' => [
            'method' => 'GET',
            'header' => "Accept: application/json\r\n",
            'ignore_errors' => true
        ]
    ];
    $resEdit = file_get_contents("http://{$host}/editurl={$code}/url=https://gitlab.com", false, stream_context_create($optsEdit));
    $editData = json_decode($resEdit, true);

    echo "   New Destination: " . ($editData['newDestinationUrl'] ?? 'N/A') . "\n";

    if (($editData['newDestinationUrl'] ?? '') !== 'https://gitlab.com') {
        throw new Exception('Edit URL failed');
    }

    echo "\n========================================\n";
    echo "🎉 LIVE PHP HTTP SERVER TESTS PASSED 100%!\n";
    echo "========================================\n";
} catch (Exception $e) {
    echo "❌ Live test failed: " . $e->getMessage() . "\n";
    exit(1);
} finally {
    if (is_resource($process)) {
        proc_terminate($process);
        proc_close($process);
    }
}
