<?php

namespace App\Console\Commands;

use Illuminate\Foundation\Console\ServeCommand as FrameworkServeCommand;

class ServeCommand extends FrameworkServeCommand
{
    protected function serverCommand()
    {
        $command = parent::serverCommand();
        array_splice($command, 1, 0, $this->uploadFlags());

        return $command;
    }

    /**
     * `php artisan serve` does not read deploy/uploads.ini. PHP's 2 MB default
     * rejects a cutout and prints a warning in front of the JSON body.
     *
     * @return list<string>
     */
    private function uploadFlags(): array
    {
        $path = dirname(base_path()).'/deploy/uploads.ini';
        $parsed = is_file($path) ? parse_ini_file($path, false, INI_SCANNER_RAW) : false;
        $flags = [];

        if (! is_array($parsed)) {
            return $flags;
        }

        foreach (['upload_max_filesize', 'post_max_size', 'memory_limit'] as $key) {
            $value = $parsed[$key] ?? null;

            if (is_string($value) && $value !== '') {
                $flags[] = '-d';
                $flags[] = $key.'='.$value;
            }
        }

        return $flags;
    }
}
