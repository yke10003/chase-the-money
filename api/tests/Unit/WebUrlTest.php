<?php

namespace Tests\Unit;

use App\Domain\Sell\WebUrl;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WebUrlTest extends TestCase
{
    #[Test]
    public function it_adds_https_when_the_protocol_was_left_off(): void
    {
        $this->assertSame('https://vinted.com/abc', WebUrl::normalize('vinted.com/abc'));
        $this->assertSame('https://www.vinted.com/abc', WebUrl::normalize('  www.vinted.com/abc  '));
        $this->assertSame('https://vinted.com/abc?id=1&ref=a#photo', WebUrl::normalize('vinted.com/abc?id=1&ref=a#photo'));
        $this->assertSame('https://vinted.com:8080/abc', WebUrl::normalize('vinted.com:8080/abc'));
        $this->assertSame('https://vinted.com/abc', WebUrl::normalize('//vinted.com/abc'));
    }

    #[Test]
    public function it_keeps_http_and_https_as_typed(): void
    {
        $this->assertSame('https://vinted.com/abc', WebUrl::normalize('https://vinted.com/abc'));
        $this->assertSame('http://example.com/item', WebUrl::normalize('http://example.com/item'));
        $this->assertSame('http://localhost/item', WebUrl::normalize('http://localhost/item'));
    }

    #[Test]
    public function it_rejects_empty_values_and_other_schemes(): void
    {
        $this->assertNull(WebUrl::normalize(''));
        $this->assertNull(WebUrl::normalize('   '));
        $this->assertNull(WebUrl::normalize('not a url'));
        $this->assertNull(WebUrl::normalize('vinted'));
        $this->assertNull(WebUrl::normalize('https://'));
        $this->assertNull(WebUrl::normalize('javascript:alert(1)'));
        $this->assertNull(WebUrl::normalize('JavaScript:alert(1)'));
        $this->assertNull(WebUrl::normalize('data:text/html,hi'));
        $this->assertNull(WebUrl::normalize('file:///etc/passwd'));
        $this->assertNull(WebUrl::normalize('ftp://files.example.com/a'));
    }
}
