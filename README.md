# Phase 10 Online

## Setup

```bash
# Install backend dependencies and start server
git clone <repo-url>
cd phase10-app/backend
npm install
npm start

# In another terminal, install frontend and start
dcd phase10-app/frontend
npm install
npm run dev
CTRL C to cancel, not Z - will have to kill process if Z

## TODOs:
- Fix game logic - eg. once phase complete, enable hitting either of the players' existing phases
- only allow valid hits
- round end when one player's hand is empty
- how to proceed after round end
- UI style considerations