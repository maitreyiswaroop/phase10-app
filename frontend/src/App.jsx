// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard.jsx';
import Scoreboard from './components/Scoreboard.jsx';

// // Use WebSocket-only transport and auto‐reconnect
// const socket = io('http://localhost:3001', {
//   transports: ['websocket'],
//   reconnection: true,
//   reconnectionAttempts: Infinity,
//   pingInterval: 20000,
//   pingTimeout: 60000,
// });
const socket = io(
    process.env.NODE_ENV === 'production' 
      ? 'https://phase10-backend.onrender.com'
      : 'http://localhost:3001',
    {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      pingInterval: 20000,
      pingTimeout: 60000,
    }
  );

export default function App() {
  const [localId,   setLocalId]   = useState('');
  const [status,    setStatus]    = useState('Connecting…');
  const [joined,    setJoined]    = useState(false);
  const [roomInfo,  setRoomInfo]  = useState(null);
  const [gameState, setGameState] = useState(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [roundOver, setRoundOver] = useState(null);

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

    socket.on('roundEnd', ({ winner, scores, roundNumber }) => {
        console.log('🏆 Round over, winner:', winner, scores, roundNumber);
        setRoundOver({ winner, scores, roundNumber });
    });
    
    // Cleanup listeners on unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('joinedRoom');
      socket.off('gameState');
      socket.off('roundEnd');
    };
  }, []); // <- run once

  // Get username of the winner
  const getWinnerUsername = (winnerId) => {
    if (!gameState) return 'Unknown';
    const winner = gameState.players.find(p => p.socketId === winnerId);
    return winner ? winner.username : 'Unknown';
  };

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

  // 3) Round over view
  if (roundOver) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <h1>Round {roundOver.roundNumber} Complete!</h1>
        <p>Winner: {getWinnerUsername(roundOver.winner)}</p>
        
        <h2>Round Results</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>Player</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>Cards Left</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>Points Added</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>Total Score</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>Current Phase</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>Next Round</th>
            </tr>
        </thead>
        <tbody>
            {roundOver.scores.map(s => (
            <tr key={s.socketId} style={{
                backgroundColor: s.socketId === roundOver.winner ? '#d4edda' : 'transparent'
            }}>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{s.player}</td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{s.handSize}</td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{s.roundPoints}</td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>{s.totalScore}</td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>
                Phase {s.currentPhase + 1}
                {s.willAdvance && <span style={{color: 'green'}}> ✓</span>}
                </td>
                <td style={{ padding: 8, border: '1px solid #ddd' }}>
                Phase {s.nextPhase + 1}
                </td>
            </tr>
            ))}
        </tbody>
        </table>
        
        <button 
          onClick={() => {
            socket.emit('startNextRound', { room: roomInfo.room });
            setRoundOver(null);
          }}
          style={{ 
            padding: '10px 16px', 
            fontSize: '16px', 
            backgroundColor: '#28a745', 
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Start Round {roundOver.roundNumber + 1}
        </button>
      </div>
    );
  }

  // 4) GameBoard view
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
        // phaseIndex={phaseIndex}
        hasDrawn={gameState.hasDrawn}
      />
    );
  }

  // 5) Waiting-to-start room view
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