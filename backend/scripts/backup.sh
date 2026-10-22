#!/bin/sh
# Dump do banco para ./backups, apagando os mais velhos que RETENTION_DAYS.
#
# Roda dentro do container `backup` do docker-compose, mas também funciona
# solto na máquina se as variáveis estiverem no ambiente.
set -eu

: "${PGHOST:=db}"
: "${PGUSER:=saldos}"
: "${PGDATABASE:=saldos}"
: "${BACKUP_DIR:=/backups}"
: "${RETENTION_DAYS:=14}"

mkdir -p "$BACKUP_DIR"

STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/saldos-$STAMP.sql.gz"

# Escreve num temporário e só renomeia no fim: um dump interrompido nunca
# fica parecendo um backup válido. E o rodapé só existe se o pg_dump chegou
# ao fim: sem conferir, um dump cortado (disco cheio) passaria por bom.
if pg_dump --no-owner --no-privileges -Z 6 > "$FILE.tmp" \
    && gunzip -c "$FILE.tmp" | tail -n 5 | grep -q 'dump complete'; then
    mv "$FILE.tmp" "$FILE"
    echo "[$(date +%H:%M:%S)] backup ok: $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
else
    rm -f "$FILE.tmp"
    echo "[$(date +%H:%M:%S)] FALHA no backup" >&2
    exit 1
fi

# O primeiro backup de cada mês fica para sempre em mensal/: se um erro só for
# notado depois dos RETENTION_DAYS, ainda há de onde voltar.
mkdir -p "$BACKUP_DIR/mensal"
MONTHLY="$BACKUP_DIR/mensal/saldos-$(date +%Y%m).sql.gz"
[ -f "$MONTHLY" ] || cp "$FILE" "$MONTHLY"

# Retenção: só apaga depois de um dump bem-sucedido, para nunca ficar sem nada.
# -maxdepth 1 para nunca chegar em mensal/.
REMOVED=$(find "$BACKUP_DIR" -maxdepth 1 -name 'saldos-*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')
if [ "$REMOVED" != "0" ]; then
    echo "  removidos $REMOVED backup(s) com mais de $RETENTION_DAYS dias"
fi

echo "  total guardado: $(find "$BACKUP_DIR" -maxdepth 1 -name 'saldos-*.sql.gz' | wc -l | tr -d ' ') arquivo(s)"
