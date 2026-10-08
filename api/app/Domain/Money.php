<?php

namespace App\Domain;

use InvalidArgumentException;

final readonly class Money
{
    public string $currency;

    public function __construct(
        public int $amountMinor,
        string $currency,
    ) {
        if ($amountMinor < 0) {
            throw new InvalidArgumentException('Money amounts cannot be negative.');
        }

        $this->currency = self::currency($currency);
    }

    public static function eur(int $amountMinor): self
    {
        return new self($amountMinor, 'EUR');
    }

    public static function fromDecimal(string $currency, string $amount): self
    {
        $amount = trim($amount);

        if (! preg_match('/^\d+(\.\d{1,2})?$/', $amount)) {
            throw new InvalidArgumentException('Amount must be a non-negative decimal with at most 2 places.');
        }

        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');
        $fraction = str_pad(substr($fraction, 0, 2), 2, '0');
        $minor = ((int) $whole * 100) + (int) $fraction;

        return new self($minor, self::currency($currency));
    }

    public static function currency(string $currency): string
    {
        $currency = strtoupper(trim($currency));

        if (! preg_match('/^[A-Z]{3}$/', $currency)) {
            throw new InvalidArgumentException('Currency must be a 3-letter ISO code.');
        }

        return $currency;
    }
}
