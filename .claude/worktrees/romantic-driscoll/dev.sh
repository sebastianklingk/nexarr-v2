#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# nexarr-v2 Dev Environment
# Server + Vite laufen BEIDE als Hintergrund-Daemons (setsid).
# Überleben Terminal-Close, SSH-Disconnect, Ctrl+C, alles.
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_PID="$SCRIPT_DIR/.server.pid"
CLIENT_PID="$SCRIPT_DIR/.client.pid"
SERVER_LOG="$SCRIPT_DIR/server.log"
CLIENT_LOG="$SCRIPT_DIR/client.log"
SERVER_DIR="$SCRIPT_DIR/packages/server"
CLIENT_DIR="$SCRIPT_DIR/packages/client"

# ── Kill a process by PID file ───────────────────────────────────────────────
kill_by_pidfile() {
  local PF="$1"
  if [ -f "$PF" ]; then
    local P=$(cat "$PF")
    if kill -0 "$P" 2>/dev/null; then
      kill "$P" 2>/dev/null
      sleep 0.5
      kill -0 "$P" 2>/dev/null && kill -9 "$P" 2>/dev/null
    fi
    rm -f "$PF"
  fi
}

# ── Server ───────────────────────────────────────────────────────────────────
start_server() {
  kill_by_pidfile "$SERVER_PID"
  fuser -k 3000/tcp 2>/dev/null
  sleep 0.3

  echo "🚀 Starte Server..."
  > "$SERVER_LOG"
  setsid bash -c "cd '$SERVER_DIR' && NODE_OPTIONS='--experimental-sqlite' exec npx tsx src/server.ts >> '$SERVER_LOG' 2>&1" &
  echo $! > "$SERVER_PID"
  disown $! 2>/dev/null

  # Warten bis Server HTTP antwortet
  echo -n "   Warte auf Port 3000"
  for i in $(seq 1 20); do
    if curl -sf http://localhost:3000/api/auth/me >/dev/null 2>&1; then
      echo ""
      echo "   ✅ Server läuft (PID $(cat "$SERVER_PID"))"
      return 0
    fi
    echo -n "."
    sleep 0.5
  done
  echo ""
  if kill -0 "$(cat "$SERVER_PID")" 2>/dev/null; then
    echo "   ⚠ Prozess lebt, wartet noch... (PID $(cat "$SERVER_PID"))"
  else
    echo "   ❌ Server-Start fehlgeschlagen:"
    tail -10 "$SERVER_LOG"
    return 1
  fi
}

stop_server() {
  kill_by_pidfile "$SERVER_PID"
  fuser -k 3000/tcp 2>/dev/null
}

# ── Client (Vite) ────────────────────────────────────────────────────────────
start_client() {
  kill_by_pidfile "$CLIENT_PID"
  fuser -k 5173/tcp 5174/tcp 5175/tcp 2>/dev/null
  sleep 0.2

  echo "🎨 Starte Vite..."
  > "$CLIENT_LOG"
  setsid bash -c "cd '$CLIENT_DIR' && exec npx vite --host >> '$CLIENT_LOG' 2>&1" &
  echo $! > "$CLIENT_PID"
  disown $! 2>/dev/null

  # Warten bis Vite antwortet
  echo -n "   Warte auf Vite"
  for i in $(seq 1 15); do
    if curl -sf http://localhost:5173/ >/dev/null 2>&1; then
      echo ""
      echo "   ✅ Vite läuft (PID $(cat "$CLIENT_PID"))"
      return 0
    fi
    echo -n "."
    sleep 0.5
  done
  echo ""
  if kill -0 "$(cat "$CLIENT_PID")" 2>/dev/null; then
    echo "   ✅ Vite läuft (PID $(cat "$CLIENT_PID"))"
  else
    echo "   ❌ Vite-Start fehlgeschlagen:"
    tail -5 "$CLIENT_LOG"
    return 1
  fi
}

stop_client() {
  kill_by_pidfile "$CLIENT_PID"
  fuser -k 5173/tcp 5174/tcp 5175/tcp 2>/dev/null
}

# ── Combined Commands ────────────────────────────────────────────────────────
start_all() {
  echo "════════════════════════════════════════"
  echo " nexarr-v2 Dev Environment"
  echo "════════════════════════════════════════"
  start_server || true
  start_client || true
  echo ""
  echo "════════════════════════════════════════"
  echo " 🌐 http://192.168.188.42:5173"
  echo " Server-Log:  npm run logs"
  echo " Client-Log:  npm run logs:client"
  echo " Status:      npm run status"
  echo " Neustart:    npm run restart"
  echo " Stoppen:     npm run stop"
  echo "════════════════════════════════════════"
}

stop_all() {
  stop_client
  stop_server
  echo "⏹  Alles gestoppt."
}

status_all() {
  if [ -f "$SERVER_PID" ] && kill -0 "$(cat "$SERVER_PID")" 2>/dev/null; then
    echo "✅ Server läuft (PID $(cat "$SERVER_PID"))"
  else
    echo "⏹  Server nicht aktiv"
  fi
  if [ -f "$CLIENT_PID" ] && kill -0 "$(cat "$CLIENT_PID")" 2>/dev/null; then
    echo "✅ Vite   läuft (PID $(cat "$CLIENT_PID"))"
  else
    echo "⏹  Vite nicht aktiv"
  fi
}

# ── Entry Point ──────────────────────────────────────────────────────────────
case "${1:-start}" in
  start)          start_all ;;
  stop)           stop_all ;;
  restart)        stop_all; echo ""; start_all ;;
  restart:server) stop_server; start_server ;;
  restart:client) stop_client; start_client ;;
  status)         status_all ;;
  logs)           tail -f "$SERVER_LOG" ;;
  logs:client)    tail -f "$CLIENT_LOG" ;;
  *)              echo "Usage: $0 {start|stop|restart|restart:server|restart:client|status|logs|logs:client}" ;;
esac
