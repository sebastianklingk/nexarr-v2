#!/bin/bash
# nexarr-v2 Dev Server Daemon
# Startet den Server als Hintergrund-Prozess, überlebt Terminal-Close + Ctrl+C

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"
LOG_FILE="$SCRIPT_DIR/server.log"

start_server() {
  # Falls alter Prozess läuft, erst stoppen
  stop_server 2>/dev/null

  # Port 3000 sicherheitshalber freigeben
  fuser -k 3000/tcp 2>/dev/null
  sleep 0.3

  echo "🚀 Starte Server im Hintergrund..."
  cd "$SCRIPT_DIR/packages/server"
  NODE_OPTIONS='--experimental-sqlite' nohup npx tsx src/server.ts > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "   PID: $(cat "$PID_FILE")"
  echo "   Log: $LOG_FILE"

  # Kurz warten und prüfen ob der Prozess lebt
  sleep 2
  if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "   ✅ Server läuft"
  else
    echo "   ❌ Server konnte nicht starten! Log:"
    tail -20 "$LOG_FILE"
    return 1
  fi
}

stop_server() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "⏹  Stoppe Server (PID $PID)..."
      kill "$PID" 2>/dev/null
      sleep 1
      kill -9 "$PID" 2>/dev/null
    fi
    rm -f "$PID_FILE"
  fi
  fuser -k 3000/tcp 2>/dev/null
}

status_server() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "✅ Server läuft (PID $(cat "$PID_FILE"))"
  else
    echo "⏹  Server nicht aktiv"
  fi
}

logs_server() {
  tail -f "$LOG_FILE"
}

case "${1:-start}" in
  start)   start_server ;;
  stop)    stop_server; echo "⏹  Server gestoppt" ;;
  restart) stop_server; start_server ;;
  status)  status_server ;;
  logs)    logs_server ;;
  *)       echo "Usage: $0 {start|stop|restart|status|logs}" ;;
esac
