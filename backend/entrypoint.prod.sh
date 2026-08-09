#!/bin/sh
set -e

# Postgres accepts connections a moment after the container reports healthy under
# load; migrate would otherwise fail the whole boot on a cold start.
echo "Waiting for database at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until python -c "
import os, socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect((os.environ.get('POSTGRES_HOST', 'db'), int(os.environ.get('POSTGRES_PORT', '5432'))))
except OSError:
    sys.exit(1)
"; do
    sleep 1
done

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "Starting gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-120}" \
    --access-logfile - \
    --error-logfile -
