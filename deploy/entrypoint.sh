#!/bin/sh
set -e

touch /var/www/html/database/database.sqlite
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database

php artisan migrate --force
php artisan storage:link || true

exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
