#!/bin/zsh
# Quick health check: database, API, web (through the proxy), tunnel, and the links to share.
export PATH="/opt/homebrew/bin:$PATH"
RUN="$HOME/kauhoot-run"
check() { if eval "$2" >/dev/null 2>&1; then echo "  ok    $1"; else echo "  DOWN  $1"; fi; }
echo "== status"
check "PostgreSQL :5432"            "pg_isready -h 127.0.0.1 -p 5432 -q"
check "API :3000/health"            "curl -sf http://127.0.0.1:3000/health"
check "Web :5173 (+ proxy to API)"  "curl -sf http://127.0.0.1:5173/health"
check "Mac kept awake (caffeinate)" "pgrep -x caffeinate"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
echo "== links"
[ -n "$IP" ] && echo "  LAN     http://$IP:5173        (admin: http://$IP:5173/admin)" || echo "  LAN     no Wi-Fi/Ethernet address found"
URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN/logs/tunnel.log" 2>/dev/null | tail -1)"
if [ -n "$URL" ] && pgrep -f "cloudflared tunnel" >/dev/null; then
  if curl -sf "$URL/health" >/dev/null 2>&1; then echo "  Tunnel  $URL   (ok)"; else echo "  Tunnel  $URL   (not answering yet; wait 10-20 s and re-run)"; fi
fi
