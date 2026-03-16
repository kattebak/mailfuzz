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
cat <<EOF > /etc/dovecot/users
${TEST_USER}:{PLAIN}${TEST_PASS}:${USER_ID}:${GROUP_ID}::/home/${TEST_USER}
EOF
chmod 600 /etc/dovecot/users

# Replace the entire Dovecot config with a minimal one
# This avoids conflicts with default configs
cat <<'EOF' > /etc/dovecot/dovecot.conf
# Minimal Dovecot configuration for CI testing

protocols = imap
listen = *

# Disable SSL for local testing
ssl = no
disable_plaintext_auth = no

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

# Service configuration
service imap-login {
  inet_listener imap {
    port = 143
  }
}
EOF

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
