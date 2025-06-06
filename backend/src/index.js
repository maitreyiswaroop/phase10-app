// backend/src/index.js
import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import { registerSockets } from './sockets.js';

const app = express();

// Allow connections from both development and production origins
const allowedOrigins = [
  'http://localhost:5173',      // Local Vite dev server
  'https://phase10-app.netlify.app', // Your production frontend URL
  'https://phase10-frontend.onrender.com',
  'https://your-custom-domain.com'   // If you have a custom domain
];

app.use(cors({ 
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.get("/", (req, res) => {
  res.send({ status: "ok" });
});

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET','POST']
  }
});

io.on('connection', socket => {
  console.log('🔌 client connected:', socket.id);
  // ...your handlers...
});

// Use environment port or fallback to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});

registerSockets(io);
// // backend/src/index.js
// import express from 'express';
// import http from 'http';
// import { Server as IOServer } from 'socket.io';
// import cors from 'cors';
// import { registerSockets } from './sockets.js';

// const app = express();
// // Allow your Vite dev origin
// app.use(cors({ origin: 'http://localhost:5173' }));

// const server = http.createServer(app);
// const io = new IOServer(server, {
//   cors: {
//     origin: 'http://localhost:5173',
//     methods: ['GET','POST']
//   }
// });

// io.on('connection', socket => {
//   console.log('🔌 client connected:', socket.id);
//   // …your handlers…
// });

// const PORT = 3001;
// server.listen(PORT, () => {
//   console.log(`🚀 Backend listening on http://localhost:${PORT}`);
// });

// registerSockets(io);