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
- Allow persistence - if I refresh the page, it should not take me to homescreen again; 
- same player id joining same game should be able to pick up where they left off
- joining via link?
- UI style considerations
- Fix the use of Wilds in a rn- eg if I have 2 W W W, should be able to add a 3 in a hit and so on 