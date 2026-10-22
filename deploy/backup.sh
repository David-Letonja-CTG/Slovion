#!/usr/bin/env bash
# Daily database backup (docs/hosting.md): dumps PostgreSQL in custom format next to this script, uploads the dump
# to OCI Object Storage through the pre-authenticated write URL in .env (BACKUP_URL, ending in /o/), and keeps the
# newest 3 dumps locally. Run by the slovion-backup systemd timer; safe to run by hand.
set -euo pipefail

# Dumps hold every save; only the deploy user may read them.
umask 077
cd "$(dirname "$(readlink -f "$0")")"
mkdir -p backups
chmod 700 backups

# Read only BACKUP_URL from .env; the file is in compose format, not shell syntax.
backup_url="$(grep -E '^BACKUP_URL=' .env 2>/dev/null | head -n 1 | cut -d= -f2- || true)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

# Every database on this server: Slovion's, and those of other services on this VM (D12).
databases="$(docker compose exec -T db psql -U slovion -d slovion -Atc \
  "select datname from pg_database where not datistemplate and datname <> 'postgres' order by datname")"
for db in $databases; do
  name="$db-$stamp.dump"
  docker compose exec -T db pg_dump -U slovion -d "$db" -Fc > "backups/$name.partial"
  mv "backups/$name.partial" "backups/$name"
  echo "dumped backups/$name ($(stat -c %s "backups/$name") bytes)"
  if [ -n "$backup_url" ]; then
    curl -fsS --retry 3 --upload-file "backups/$name" "${backup_url%/}/$name"
    echo "uploaded $name"
  fi
  # Keep the newest 3 local dumps of each database.
  ls -1t "backups/$db-"*.dump | tail -n +4 | xargs -r rm --
done
[ -n "$backup_url" ] || echo "BACKUP_URL is not set; the dumps are kept on this machine only"
