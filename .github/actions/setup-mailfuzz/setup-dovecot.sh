#!/usr/bin/env bash
#
# Configure Dovecot and Postfix for local mail testing.
#
# Expected environment variables:
#   TEST_USER  - system username for the test account
#   TEST_PASS  - password for the test account
#
set -euo pipefail

if [ -z "${TEST_USER:-}" ] || [ -z "${TEST_PASS:-}" ]; then
  echo "ERROR: TEST_USER and TEST_PASS environment variables must be set" >&2
  exit 1
fi

USER_ID=$(id -u "${TEST_USER}")
GROUP_ID=$(id -g "${TEST_USER}")

# Create Maildir structure
mkdir -p "/home/${TEST_USER}/Maildir"/{cur,new,tmp}
chown -R "${TEST_USER}:${TEST_USER}" "/home/${TEST_USER}/Maildir"
chmod -R 700 "/home/${TEST_USER}/Maildir"

# Create Dovecot users file (passwd-file format)
# Format: user:{SCHEME}password:uid:gid::home
cat <<EOF > /etc/dovecot/users
${TEST_USER}:{PLAIN}${TEST_PASS}:${USER_ID}:${GROUP_ID}::/home/${TEST_USER}
EOF
chmod 600 /etc/dovecot/users

# Write a single Dovecot override config
cat <<'EOF' > /etc/dovecot/conf.d/99-mailfuzz.conf
# Mailfuzz test configuration - overrides defaults

# Disable SSL for local testing
ssl = no
disable_plaintext_auth = no

# Listen on all interfaces
listen = *

# Protocols
protocols = imap

# Auth mechanisms
auth_mechanisms = plain login

# Use passwd-file for authentication
passdb {
  driver = passwd-file
  args = scheme=PLAIN username_format=%u /etc/dovecot/users
}

userdb {
  driver = passwd-file
  args = username_format=%u /etc/dovecot/users
}

# Maildir location
mail_location = maildir:~/Maildir

# Logging
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
EOF

# Disable the default system auth to avoid conflicts
sed -i 's|^!include auth-system.conf.ext|#!include auth-system.conf.ext|' /etc/dovecot/conf.d/10-auth.conf 2>/dev/null || true

# Configure Postfix for local-only delivery with Maildir
postconf -e "inet_interfaces = loopback-only"
postconf -e "mydestination = localhost, localhost.localdomain"
postconf -e "home_mailbox = Maildir/"
postconf -e "relayhost ="
postconf -e "mynetworks = 127.0.0.0/8"
postconf -e "myhostname = localhost"
postconf -e "mailbox_command ="
postconf -e "compatibility_level = 2"

echo "Dovecot and Postfix configured for local mail testing."
