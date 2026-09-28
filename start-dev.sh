#!/usr/bin/env bash

# Colors for terminal output
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN} Starting Seafudz ng Bayan Backend & Frontend ${NC}"
echo -e "${GREEN}=================================================${NC}"

# Ensure Backend dependencies are installed
if [ ! -d "Backend/node_modules" ]; then
    echo -e "${CYAN}[BACKEND] Installing dependencies...${NC}"
    (cd Backend && npm install)
fi

# Ensure Frontend dependencies are installed
if [ ! -d "Frontend/node_modules" ]; then
    echo -e "${MAGENTA}[FRONTEND] Installing dependencies...${NC}"
    (cd Frontend && npm install)
fi

echo -e "${CYAN}[BACKEND] Starting Express API server on http://localhost:5000...${NC}"
(cd Backend && npm run dev) &
BACKEND_PID=$!

echo -e "${MAGENTA}[FRONTEND] Starting React Vite app on http://localhost:5173...${NC}"
(cd Frontend && npm run dev) &
FRONTEND_PID=$!

# Trap Ctrl+C (SIGINT / SIGTERM) to cleanly shut down both processes
trap "echo -e '\n[INFO] Stopping dev servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

wait
