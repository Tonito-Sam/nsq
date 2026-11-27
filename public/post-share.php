<?php

function postShareEscape($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function postShareFetchMetadata($url) {
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
            error_log('Post OG metadata request failed: ' . ($error ?: 'HTTP ' . $status));
            return ['status' => $status ?: 503, 'metadata' => null];
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
            error_log('Post OG metadata request failed: PHP cURL and stream request both failed.');
            return ['status' => 503, 'metadata' => null];
        }
    }

    $metadata = json_decode($body, true);
    return is_array($metadata)
        ? ['status' => 200, 'metadata' => $metadata]
        : ['status' => 503, 'metadata' => null];
}

$rawEventSlug = $_GET['event_slug'] ?? null;
$isEvent = $rawEventSlug !== null;
$eventSlug = is_string($rawEventSlug) ? $rawEventSlug : '';
$postId = isset($_GET['post_id']) && is_string($_GET['post_id']) ? $_GET['post_id'] : '';
$uuidPattern = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';
$eventSlugPattern = '/^[a-z0-9][a-z0-9-]*$/i';
if (
    ($isEvent && !preg_match($eventSlugPattern, $eventSlug))
    || (!$isEvent && !preg_match($uuidPattern, $postId))
) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo $isEvent ? 'Invalid event slug.' : 'Invalid post ID.';
    exit;
}

$apiBase = getenv('POST_OG_API_BASE') ?: getenv('VITE_API_BASE_URL') ?: 'https://nsq-98et.onrender.com';
$apiHost = parse_url($apiBase, PHP_URL_HOST);
if (!$apiHost || in_array(strtolower($apiHost), ['localhost', '127.0.0.1', '::1'], true)) {
    $apiBase = 'https://nsq-98et.onrender.com';
}
$apiBase = rtrim($apiBase, '/');
$metadataPath = $isEvent
    ? '/api/post-og/event/' . rawurlencode($eventSlug) . '/meta'
    : '/api/post-og/' . rawurlencode($postId) . '/meta';
$result = postShareFetchMetadata($apiBase . $metadataPath);
if (!$result['metadata']) {
    http_response_code($result['status'] === 404 ? 404 : 503);
    header('Content-Type: text/plain; charset=UTF-8');
    echo $result['status'] === 404
        ? ($isEvent ? 'Event not found.' : 'Post not found.')
        : 'Share preview is temporarily unavailable.';
    exit;
}

$metadata = $result['metadata'];
$siteBase = rtrim(getenv('PUBLIC_SITE_URL') ?: 'https://www.nexsq.com', '/');
$canonicalFallback = $siteBase . ($isEvent ? '/event/' . rawurlencode($eventSlug) : '/post/' . rawurlencode($postId));
$canonicalUrl = $metadata['canonicalUrl'] ?? $canonicalFallback;
$title = $metadata['title'] ?? ($isEvent ? 'Event on NexSq' : 'Post on NexSq');
$description = $metadata['description'] ?? ($isEvent ? 'View this event on NexSq.' : 'View this post on NexSq.');
$imageUrl = $metadata['imageUrl'] ?? ($siteBase . '/og-nexsq.png');
$videoUrl = $metadata['videoUrl'] ?? '';
$videoType = $metadata['videoType'] ?? 'video/mp4';

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
$html = preg_replace('/<title>.*?<\/title>/is', '<title>' . postShareEscape($title) . '</title>', $html, 1);
$html = preg_replace(
    '/<meta\s+(?:property|name)=["\'](?:og:[^"\']+|twitter:[^"\']+|description)["\'][^>]*>\s*/i',
    '',
    $html,
);

$metaTags = [
    '<meta name="description" content="' . postShareEscape($description) . '">',
    '<meta property="og:type" content="' . ($isEvent ? 'website' : ($videoUrl ? 'video.other' : 'article')) . '">',
    '<meta property="og:site_name" content="NexSq">',
    '<meta property="og:title" content="' . postShareEscape($title) . '">',
    '<meta property="og:description" content="' . postShareEscape($description) . '">',
    '<meta property="og:url" content="' . postShareEscape($canonicalUrl) . '">',
    '<meta property="og:image" content="' . postShareEscape($imageUrl) . '">',
    '<meta property="og:image:secure_url" content="' . postShareEscape($imageUrl) . '">',
    '<meta property="og:image:alt" content="' . postShareEscape($title) . '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' . postShareEscape($title) . '">',
    '<meta name="twitter:description" content="' . postShareEscape($description) . '">',
    '<meta name="twitter:image" content="' . postShareEscape($imageUrl) . '">',
];
if ($videoUrl) {
    $metaTags[] = '<meta property="og:video" content="' . postShareEscape($videoUrl) . '">';
    $metaTags[] = '<meta property="og:video:secure_url" content="' . postShareEscape($videoUrl) . '">';
    $metaTags[] = '<meta property="og:video:type" content="' . postShareEscape($videoType) . '">';
}

$headClose = stripos($html, '</head>');
if ($headClose !== false) {
    $html = substr_replace($html, implode("\n  ", $metaTags) . "\n  ", $headClose, 0);
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: public, max-age=300, stale-while-revalidate=600');
echo $html;
