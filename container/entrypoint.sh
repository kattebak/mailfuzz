#!/bin/sh
set -eu

MESSAGE_COUNT="${MESSAGE_COUNT:-50}"
SEED="${SEED:-1984}"
TEST_PASSWORD="${TEST_PASSWORD:-testpass}"
ALL_PLUGINS="${ALL_PLUGINS:-true}"

# Create vmail user if not exists
if ! id vmail >/dev/null 2>&1; then
  addgroup -g 1000 vmail
  adduser -D -u 1000 -G vmail -h /srv/mail vmail
fi

# Create Maildir structure
mkdir -p /srv/mail/Maildir/cur /srv/mail/Maildir/new /srv/mail/Maildir/tmp

# Write dovecot users file
echo "vmail:{PLAIN}${TEST_PASSWORD}:1000:1000::/srv/mail" > /etc/dovecot/users

# Generate test emails
if [ -f /etc/mailfuzz/config.json ]; then
  mailfuzz generate --config /etc/mailfuzz/config.json --output /srv/mail/Maildir
else
  if [ "${ALL_PLUGINS}" = "true" ]; then
    mailfuzz generate --output /srv/mail/Maildir --count "${MESSAGE_COUNT}" --seed "${SEED}" --all-plugins
  else
    mailfuzz generate --output /srv/mail/Maildir --count "${MESSAGE_COUNT}" --seed "${SEED}"
  fi
fi

# Fix ownership
chown -R vmail:vmail /srv/mail

# Start dovecot as PID 1
exec dovecot -F
