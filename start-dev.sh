#!/usr/bin/env bash

# Colors for terminal output
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN} Starting Seafudz ng Bayan Backend & Frontend ${NC}"
echo -e "${GREEN}=================================================${NC}"

# Check if npm run dev in root works via concurrently
if command -v npx &> /dev/null; then
    npx concurrently -n "BACKEND,FRONTEND" -c "cyan,magenta" \
        "cd Backend && npm run dev" \
        "cd Frontend && npm run dev"
else
    echo -e "${CYAN}[BACKEND] Starting Express API...${NC}"
    (cd Backend && npm run dev) &
    BACKEND_PID=$!

    echo -e "${MAGENTA}[FRONTEND] Starting React Vite...${NC}"
    (cd Frontend && npm run dev) &
    FRONTEND_PID=$!

    trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
    wait
fi
