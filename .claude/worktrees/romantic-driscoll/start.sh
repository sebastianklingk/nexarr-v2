#!/bin/bash
LOGFILE="/tmp/nexarr-v2.log"
DIR="/mnt/user/appdata/openclaw/config/workspace/nexarr-v2"
PORTS=(3000 5173 5174 5175)

stop() {
  echo "-> PM2 stoppen..."
  pm2 stop all 2>/dev/null
  pm2 delete all 2>/dev/null

  echo "-> Alle nexarr-Prozesse killen..."
  pkill -9 -f "tsx" 2>/dev/null
  pkill -9 -f "vite" 2>/dev/null
  pkill -9 -f "concurrently" 2>/dev/null

  # lsof/fuser-basiertes Kill auf alle relevanten Ports
  for port in "${PORTS[@]}"; do
    fuser -k "$port/tcp" 2>/dev/null
  done

  # Warten bis alle Ports wirklich frei sind (max 30s)
  echo "-> Warte bis Ports frei sind..."
  local waited=0
  while [ $waited -lt 30 ]; do
    local busy=0
    for port in "${PORTS[@]}"; do
      if ss -tlnp "sport eq :$port" 2>/dev/null | grep -q LISTEN; then
        busy=1
        break
      fi
    done
    if [ $busy -eq 0 ]; then
      echo "   Alle Ports frei nach ${waited}s"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  echo "   WARNUNG: Ports nach 30s noch nicht frei!"
  return 1
}

start() {
  echo "-> Starte nexarr v2..."
  cd "$DIR"
  > "$LOGFILE"
  nohup npm run dev > "$LOGFILE" 2>&1 &

  # Warte bis Server + Vite melden dass sie laufen (max 30s)
  local waited=0
  while [ $waited -lt 30 ]; do
    local log
    log=$(cat "$LOGFILE" 2>/dev/null | tr -d '\000-\037')
    local has_server=0 has_vite=0
    echo "$log" | grep -qE "läuft auf|nexarr v2" && has_server=1
    echo "$log" | grep -q "Network:" && has_vite=1

    if echo "$log" | grep -q "database is locked"; then
      echo "!! FEHLER: database is locked"
      tail -15 "$LOGFILE" | tr -d '\000-\037'
      return 1
    fi

    if [ $has_server -eq 1 ] && [ $has_vite -eq 1 ]; then
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done

  # Ergebnis pruefen
  local log
  log=$(cat "$LOGFILE" | tr -d '\000-\037')
  local url
  url=$(echo "$log" | grep -o "http://192\.168\.[0-9.]*:[0-9]*/" | grep -v 3000 | tail -1)

  if echo "$log" | grep -qE "läuft auf|nexarr v2"; then
    echo "🚀 nexarr v2 läuft: ${url:-http://192.168.188.42:5173/}"
  else
    echo "!! Start unklar – Log:"
    tail -15 "$LOGFILE" | tr -d '\000-\037'
    return 1
  fi
}

# Main
stop && start
