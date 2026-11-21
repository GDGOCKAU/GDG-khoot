#!/bin/zsh
# Stops the tunnel, web and API servers and caffeinate. PostgreSQL keeps running (data is safe).
RUN="$HOME/kauhoot-run"
for name in tunnel web api caffeinate; do
  f="$RUN/$name.pid"; [ -f "$f" ] || continue
  pid="$(cat "$f")"; pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null; rm -f "$f"
done
for port in 3000 5173; do lsof -tiTCP:$port -sTCP:LISTEN | xargs kill 2>/dev/null; done
echo "stopped (PostgreSQL still running)"
