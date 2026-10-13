#!/usr/bin/env bash
# Sobe o Smaug inteiro e mostra o endereço para acessar da rede local.
set -euo pipefail

cd "$(dirname "$0")"
RAIZ="$PWD"

# O IP muda quando o roteador renova o DHCP, então é sempre lido na hora.
ip_local() {
  for interface in en0 en1 en2; do
    local ip
    ip=$(ipconfig getifaddr "$interface" 2>/dev/null) && [ -n "$ip" ] && echo "$ip" && return
  done
  echo "127.0.0.1"
}

encerrar() {
  echo ""
  echo "Encerrando..."
  # Mata o grupo de processos: sem isso o Vite e o Flask ficam rodando soltos.
  [ -n "${PID_BACK:-}" ] && kill "$PID_BACK" 2>/dev/null || true
  [ -n "${PID_BOT:-}" ] && kill "$PID_BOT" 2>/dev/null || true
  [ -n "${PID_FRONT:-}" ] && kill "$PID_FRONT" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap encerrar EXIT INT TERM

echo "1/4  Banco (Docker)..."
docker compose up -d db backup >/dev/null

echo "2/4  Bot..."
# Opcional: a API do bot-trader, se o repositório estiver ao lado deste com o venv criado.
# Robôs que estavam ligados voltam sozinhos; com o Ctrl+C eles param (stop e alvo seguem na Bybit).
BOT="$RAIZ/../bot-trader"
if [ ! -x "$BOT/venv/bin/uvicorn" ]; then
  echo "     sem ../bot-trader/venv: a tela do bot fica sem servidor"
elif lsof -ti:8000 >/dev/null 2>&1; then
  echo "     a porta 8000 já está em uso: a tela vai usar o bot que já está rodando"
else
  (cd "$BOT/src" && exec ../venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8000 >/tmp/bot-trader.log 2>&1) &
  PID_BOT=$!
  for _ in $(seq 1 20); do
    curl -s -o /dev/null http://127.0.0.1:8000/health && break
    sleep 0.5
  done
  if ! curl -s -o /dev/null http://127.0.0.1:8000/health; then
    echo "     o bot não subiu (o Smaug segue sem ele). Motivo em /tmp/bot-trader.log:"
    tail -3 /tmp/bot-trader.log | sed 's/^/       /'
    PID_BOT=""
  fi
fi

echo "3/4  Backend..."
cd "$RAIZ/backend"

# Se já houver algo na 5001, subir de novo falha em silêncio e o script segue
# usando o processo velho — com o código antigo. Melhor avisar e parar.
if lsof -ti:5001 >/dev/null 2>&1; then
  echo ""
  echo "  A porta 5001 já está ocupada — provavelmente um backend de antes."
  echo "  Encerre com:  kill \$(lsof -ti:5001)"
  echo "  e rode ./start.sh de novo."
  exit 1
fi

if ! ./venv/bin/flask db upgrade >/tmp/smaug-migrate.log 2>&1; then
  echo ""
  echo "  A migração do banco falhou. Veja o motivo em /tmp/smaug-migrate.log:"
  tail -5 /tmp/smaug-migrate.log | sed 's/^/    /'
  exit 1
fi
./venv/bin/flask run >/tmp/saldos-backend.log 2>&1 &
PID_BACK=$!

# Espera o Flask responder antes de liberar o frontend.
for _ in $(seq 1 40); do
  curl -s -o /dev/null http://127.0.0.1:5001/api/auth/me && break
  sleep 0.5
done

if ! curl -s -o /dev/null http://127.0.0.1:5001/api/auth/me; then
  echo ""
  echo "  O backend não subiu. Veja o motivo em /tmp/saldos-backend.log:"
  tail -5 /tmp/saldos-backend.log | sed 's/^/    /'
  exit 1
fi

echo "4/4  Frontend..."
cd "$RAIZ/frontend"
npm run dev >/tmp/saldos-frontend.log 2>&1 &
PID_FRONT=$!
sleep 3

IP=$(ip_local)
echo ""
echo "  Smaug no ar"
echo ""
echo "    Nesta máquina:  http://localhost:5173"
echo "    Na rede local:  http://$IP:5173"
echo ""
echo "  Logs: /tmp/saldos-backend.log, /tmp/saldos-frontend.log e /tmp/bot-trader.log"
echo "  Ctrl+C encerra tudo."
echo ""

wait
