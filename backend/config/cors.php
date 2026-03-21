<?php

$frontendUrls = array_filter(array_map(
    static fn (string $origin): string => trim($origin),
    explode(',', (string) env('FRONTEND_URLS', ''))
));

if (count($frontendUrls) === 0) {
    $frontendUrls = array_filter([
        env('FRONTEND_URL', ''),
        env('APP_FRONTEND_URL', ''),
        env('ADMIN_FRONTEND_URL', ''),
    ]);
}

return [
    'paths' => ['api/*', 'up'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter([
        ...$frontendUrls,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ]))),

    'allowed_origins_patterns' => [
        '^https:\/\/([a-z0-9-]+\.)?genomni\.com$',
        '^https:\/\/([a-z0-9-]+\.)?vercel\.app$',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
