#!/bin/bash
# Batloung Farm - install (first time only) and start. Needs Node.js 18+ and MySQL running.
cd "$(dirname "$0")"
[ -d backend/node_modules ]  || npm install --prefix backend
[ -d frontend/node_modules ] || npm install --prefix frontend
[ -f backend/.setup_done ] || { npm run db:init --prefix backend && touch backend/.setup_done; } || { echo "Database setup failed - check backend/.env"; exit 1; }
(cd backend && npm run dev) & (cd frontend && npm run dev) & wait
