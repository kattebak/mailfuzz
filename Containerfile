FROM node:22-alpine

RUN apk add --no-cache dovecot dovecot-imapd

RUN npm install -g @kattebak/mailfuzz

COPY container/dovecot.conf /etc/dovecot/dovecot.conf
COPY container/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 143

ENTRYPOINT ["entrypoint.sh"]
