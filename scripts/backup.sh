#!/bin/sh
# Backup diário do banco (cron: 0 2 * * * /opt/snct-car/scripts/backup.sh). Mantém 14 dias.
set -e
DEST=${BACKUP_DIR:-/var/backups/snct-car}; mkdir -p "$DEST"
pg_dump "$DATABASE_URL" | gzip > "$DEST/snct-$(date +%F).sql.gz"
find "$DEST" -name 'snct-*.sql.gz' -mtime +14 -delete
