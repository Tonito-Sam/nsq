<?php

function podcastShareEscape($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function podcastShareFetchMetadata($url) {
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        if ($body === false || $status < 200 || $status >= 300) {
            error_log('Podcast OG metadata request failed: ' . ($error ?: 'HTTP ' . $status));
            return null;
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 12,
                'header' => "Accept: application/json\r\n",
                'ignore_errors' => true,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            error_log('Podcast OG metadata request failed: PHP cURL and stream request both failed.');
            return null;
        }
    }

    $metadata = json_decode($body, true);
    return is_array($metadata) ? $metadata : null;
}

$showId = isset($_GET['show_id']) ? (string)$_GET['show_id'] : '';
$episodeId = isset($_GET['episode']) ? (string)$_GET['episode'] : '';
$uuidPattern = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';
if (!preg_match($uuidPattern, $showId)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Invalid Podcast channel ID.';
    exit;
}

$apiBase = getenv('PODCAST_OG_API_BASE') ?: getenv('VITE_API_BASE_URL') ?: 'https://nsq-98et.onrender.com';
$apiHost = parse_url($apiBase, PHP_URL_HOST);
if (!$apiHost || in_array(strtolower($apiHost), ['localhost', '127.0.0.1', '::1'], true)) {
    $apiBase = 'https://nsq-98et.onrender.com';
}
$apiBase = rtrim($apiBase, '/');
$metadataUrl = $apiBase . '/api/podcast-og/' . rawurlencode($showId) . '/meta';
if (preg_match($uuidPattern, $episodeId)) {
    $metadataUrl .= '?episode=' . rawurlencode($episodeId);
}
$metadata = podcastShareFetchMetadata($metadataUrl);

$siteBase = rtrim(getenv('PUBLIC_SITE_URL') ?: 'https://www.nexsq.com', '/');
$canonicalUrl = $siteBase . '/podcast/' . rawurlencode($showId);
if (preg_match($uuidPattern, $episodeId)) {
    $canonicalUrl .= '?episode=' . rawurlencode($episodeId);
}
$title = $metadata['title'] ?? 'Podcast on NexSq';
$description = $metadata['description'] ?? 'Listen to Podcasts on NexSq.';
$imageAlt = $metadata['imageAlt'] ?? 'Podcast cover with NexSq branding';
$imageUrl = $apiBase . '/api/podcast-og/' . rawurlencode($showId);

$indexPath = __DIR__ . '/index.html';
if (!is_file($indexPath)) {
    $indexPath = dirname(__DIR__) . '/index.html';
}
if (!is_file($indexPath)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Frontend index was not found.';
    exit;
}

$html = file_get_contents($indexPath);
$html = preg_replace('/<title>.*?<\/title>/is', '<title>' . podcastShareEscape($title) . '</title>', $html, 1);
$html = preg_replace(
    '/<meta\s+(?:property|name)=["\'](?:og:[^"\']+|twitter:[^"\']+|description)["\'][^>]*>\s*/i',
    '',
    $html,
);

$metaTags = [
    '<meta name="description" content="' . podcastShareEscape($description) . '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="NexSq">',
    '<meta property="og:title" content="' . podcastShareEscape($title) . '">',
    '<meta property="og:description" content="' . podcastShareEscape($description) . '">',
    '<meta property="og:url" content="' . podcastShareEscape($canonicalUrl) . '">',
    '<meta property="og:image" content="' . podcastShareEscape($imageUrl) . '">',
    '<meta property="og:image:secure_url" content="' . podcastShareEscape($imageUrl) . '">',
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="' . podcastShareEscape($imageAlt) . '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' . podcastShareEscape($title) . '">',
    '<meta name="twitter:description" content="' . podcastShareEscape($description) . '">',
    '<meta name="twitter:image" content="' . podcastShareEscape($imageUrl) . '">',
];
$headClose = stripos($html, '</head>');
if ($headClose !== false) {
    $html = substr_replace($html, implode("\n  ", $metaTags) . "\n  ", $headClose, 0);
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: public, max-age=300, stale-while-revalidate=600');
echo $html;
