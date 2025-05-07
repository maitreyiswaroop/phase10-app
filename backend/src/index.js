// backend/src/index.js
import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import { registerSockets } from './sockets.js';

const app = express();
// Allow your Vite dev origin
app.use(cors({ origin: 'http://localhost:5173' }));

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET','POST']
  }
});

io.on('connection', socket => {
  console.log('🔌 client connected:', socket.id);
  // …your handlers…
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend listening on http://localhost:${PORT}`);
});

registerSockets(io);