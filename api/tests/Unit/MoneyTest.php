<?php

namespace Tests\Unit;

use App\Domain\Money;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MoneyTest extends TestCase
{
    #[Test]
    public function it_converts_a_decimal_amount_to_minor_units(): void
    {
        $money = Money::fromDecimal('eur', '400.00');

        $this->assertSame(40000, $money->amountMinor);
        $this->assertSame('EUR', $money->currency);
    }

    #[Test]
    public function it_pads_a_single_decimal_place(): void
    {
        $money = Money::fromDecimal('EUR', '20.5');

        $this->assertSame(2050, $money->amountMinor);
    }

    #[Test]
    public function it_rejects_more_than_two_decimal_places(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Money::fromDecimal('EUR', '20.555');
    }

    #[Test]
    public function it_rejects_a_negative_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Money::eur(-1);
    }
}
