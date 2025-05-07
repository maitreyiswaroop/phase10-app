// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard.jsx';

// Use WebSocket-only transport and auto‐reconnect
const socket = io('http://localhost:3001', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  pingInterval: 20000,
  pingTimeout: 60000,
});

export default function App() {
  const [localId,   setLocalId]   = useState('');
  const [status,    setStatus]    = useState('Connecting…');
  const [joined,    setJoined]    = useState(false);
  const [roomInfo,  setRoomInfo]  = useState(null);
  const [gameState, setGameState] = useState(null);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    // Fired on initial connect
    socket.on('connect', () => {
      setStatus('✅ Connected');
      setLocalId(socket.id);
    });

    socket.on('disconnect', () => {
      setStatus('❌ Disconnected');
    });

    // Lobby events
    socket.on('joinedRoom', ({ room, players }) => {
      setRoomInfo({ room, players });
      setJoined(true);
    });

    // All game‐state updates (deal, draw, discard, lay, turn changes)
    socket.on('gameState', (payload) => {
      console.log('📥 Client received gameState:', payload);
      setGameState(payload);
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('joinedRoom');
      socket.off('gameState');
    };
  }, []); // <- run once

  // 1) While connecting
  if (status.startsWith('Connecting')) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <h1>Phase 10 Online</h1>
        <p>{status}</p>
      </div>
    );
  }

  // 2) Lobby view
  if (!joined) {
    return <Lobby socket={socket} />;
  }

  // 3) GameBoard view
  if (gameState) {
    return (
      <GameBoard
        hands={gameState.hands}
        players={gameState.players}
        deckCount={gameState.deckCount}
        discardPile={gameState.discard}
        localId={localId}
        socket={socket}
        room={roomInfo.room}
        currentTurn={gameState.currentTurn}
        laid={gameState.laid}
        phaseIndex={phaseIndex}
        hasDrawn={gameState.hasDrawn}
      />
    );
  }

  // 4) Waiting-to-start room view
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Room: {roomInfo.room}</h1>
      <p>Players: {roomInfo.players.map(p => p.username).join(', ')}</p>
      <button
        onClick={() => {
          console.log('📤 Emitting startGame for room', roomInfo.room);
          socket.emit('startGame', { room: roomInfo.room });
        }}
      >
        Start Game
      </button>
    </div>
  );
}
