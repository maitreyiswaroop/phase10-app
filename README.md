# Phase 10 Online

This project contains the frontend and backend for a "Phase 10 Online" game.

## Development

### Prerequisites
- Node.js
- npm

### Running the application
```bash
# Install backend dependencies and start server
cd phase10-app/backend
npm install
npm start

# In another terminal, install frontend and start
cd phase10-app/frontend
npm install
npm run dev
```

## Deployment

This application is containerized using Docker. To run the application, you need Docker and Docker Compose installed.

```bash
docker-compose up -d --build
```

The frontend will be available at [http://localhost:8080](http://localhost:8080) and the backend will be available at [http://localhost:3001](http://localhost:3001).

## TODOs:
- Allow persistence - if I refresh the page, it should not take me to homescreen again;
- same player id joining same game should be able to pick up where they left off
- joining via link?
- UI style considerations
- Fix the use of Wilds in a rn- eg if I have 2 W W W, should be able to add a 3 in a hit and so on 