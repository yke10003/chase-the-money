<?php

namespace App\Domain\Sell;

/**
 * A link a person can paste. https is added when they leave the protocol off.
 * http and https are kept as typed. Other schemes are rejected.
 */
final class WebUrl
{
    public static function normalize(string $raw): ?string
    {
        $trimmed = trim($raw);

        if ($trimmed === '' || preg_match('/\s/u', $trimmed) === 1) {
            return null;
        }

        $prefixed = false;

        // A dot in the first token means a host (`vinted.com:8080`), not a scheme.
        if (preg_match('/^([a-zA-Z][a-zA-Z0-9+.-]*):/u', $trimmed, $match) === 1 && ! str_contains($match[1], '.')) {
            $scheme = strtolower($match[1]);

            if ($scheme !== 'http' && $scheme !== 'https') {
                return null;
            }

            $candidate = $trimmed;
        } elseif (str_starts_with($trimmed, '//')) {
            $candidate = 'https:'.$trimmed;
            $prefixed = true;
        } else {
            $candidate = 'https://'.$trimmed;
            $prefixed = true;
        }

        if (filter_var($candidate, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        $parts = parse_url($candidate);

        if (! is_array($parts)) {
            return null;
        }

        $protocol = strtolower((string) ($parts['scheme'] ?? ''));

        if ($protocol !== 'http' && $protocol !== 'https') {
            return null;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));

        if ($host === '' || (! str_contains($host, '.') && $host !== 'localhost')) {
            return null;
        }

        return $prefixed ? $candidate : $trimmed;
    }
}
