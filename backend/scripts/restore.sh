#!/bin/sh
# Restaura um backup. Uso:
#   ./backend/scripts/restore.sh backups/saldos-20260827-030000.sql.gz
#
# Substitui TODO o conteúdo atual do banco pelo do arquivo.
set -eu

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    echo "Uso: $0 <arquivo.sql.gz>" >&2
    echo >&2
    echo "Backups disponíveis:" >&2
    ls -1t backups/saldos-*.sql.gz 2>/dev/null | head -20 >&2 || echo "  (nenhum)" >&2
    exit 1
fi

CONTAINER="${CONTAINER:-saldos-db}"
DB="${DB:-saldos}"
USER="${USER_DB:-saldos}"

printf 'Isso APAGA o banco atual e restaura "%s". Continuar? [s/N] ' "$FILE"
read -r answer
case "$answer" in
    s|S|sim|y|Y) ;;
    *) echo "Cancelado."; exit 0 ;;
esac

echo "Restaurando..."
gunzip -c "$FILE" | docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 \
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -f - >/dev/null

echo "Pronto. Reinicie o backend para pegar o estado restaurado."
