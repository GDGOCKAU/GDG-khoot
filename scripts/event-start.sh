#!/bin/zsh
# Starts KAUHOOT on this Mac for an event.
#   ./scripts/event-start.sh            LAN only   (http://<this-mac-ip>:5173)
#   ./scripts/event-start.sh --tunnel   also opens a public https://*.trycloudflare.com link
# PostgreSQL = Homebrew service postgresql@17. API on :3000, web on :5173 (Vite preview,
# which forwards /api, /socket.io and /uploads to the API). Logs + pids in ~/kauhoot-run.
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$HOME/kauhoot-run"; LOG="$RUN/logs"; mkdir -p "$LOG"
export PATH="/opt/homebrew/bin:$PATH"

if lsof -tiTCP:3000 -sTCP:LISTEN >/dev/null || lsof -tiTCP:5173 -sTCP:LISTEN >/dev/null; then
  echo "Port 3000 or 5173 is already in use. Run ./scripts/event-stop.sh first."; exit 1
fi
[ -f "$REPO/backend/.env" ] || { echo "Missing backend/.env (see docs/event-day.md)"; exit 1; }

echo "== database"
brew services start postgresql@17 >/dev/null 2>&1
for i in {1..20}; do pg_isready -h 127.0.0.1 -p 5432 -q && break; sleep 0.5; done
pg_isready -h 127.0.0.1 -p 5432 || { echo "PostgreSQL is not answering"; exit 1; }

echo "== build + migrations"
( cd "$REPO/backend" && npx prisma migrate deploy && npm run build ) >> "$LOG/build.log" 2>&1 || { echo "backend build/migrate failed: see $LOG/build.log"; exit 1; }
( cd "$REPO" && npm run build ) >> "$LOG/build.log" 2>&1 || { echo "web build failed: see $LOG/build.log"; exit 1; }

echo "== servers"
echo "=== start $(date '+%F %T')" >> "$LOG/api.log"
( cd "$REPO/backend" && nohup npm start >> "$LOG/api.log" 2>&1 & echo $! > "$RUN/api.pid" )
( cd "$REPO" && nohup npx vite preview --host 0.0.0.0 --port 5173 --strictPort >> "$LOG/web.log" 2>&1 & echo $! > "$RUN/web.pid" )
# keep the Mac awake (display, idle, disk, system) for as long as the API runs
nohup caffeinate -dimsu -w "$(cat "$RUN/api.pid")" >/dev/null 2>&1 & echo $! > "$RUN/caffeinate.pid"

for i in {1..30}; do curl -sf http://127.0.0.1:5173/health >/dev/null && break; sleep 0.5; done

# the API refuses to start without a valid ADMIN_PASSWORD in backend/.env: show why
if ! curl -sf http://127.0.0.1:3000/health >/dev/null && ! kill -0 "$(cat "$RUN/api.pid")" 2>/dev/null; then
  echo "== API did not start:"
  # only this run's lines (after the last "=== start" mark)
  awk '/^=== start /{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' "$LOG/api.log" | grep -v "^=== start" | grep -A4 "will not start" \
    || awk '/^=== start /{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' "$LOG/api.log" | tail -n 12
fi

if [ "${1:-}" = "--tunnel" ]; then
  echo "== tunnel"
  : > "$LOG/tunnel.log"
  nohup cloudflared tunnel --no-autoupdate --url http://127.0.0.1:5173 >> "$LOG/tunnel.log" 2>&1 & echo $! > "$RUN/tunnel.pid"
  for i in {1..40}; do grep -qo 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG/tunnel.log" && break; sleep 0.5; done
fi

"$REPO/scripts/event-status.sh"
