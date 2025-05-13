// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard.jsx';
import Scoreboard from './components/Scoreboard.jsx';
import './styles/global.css';

// // Use WebSocket-only transport and auto‐reconnect
// const socket = io('http://localhost:3001', {
//   transports: ['websocket'],
//   reconnection: true,
//   reconnectionAttempts: Infinity,
//   pingInterval: 20000,
//   pingTimeout: 60000,
// });
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const socket = io(
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
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


    const sess = JSON.parse(localStorage.getItem('session') || '{}');
    if (sess.room && sess.username) {
      socket.emit('rejoinRoom', {
        room: sess.room,
        username: sess.username,
        accessKey: sess.accessKey
      });
    }
    // Lobby events
    socket.on('joinedRoom', ({ room, players }) => {
      setRoomInfo({ room, players });
      setJoined(true);
    });

    // All game‐state updates (deal, draw, discard, lay, turn changes)
    socket.on('gameState', (payload) => {
      console.log('📥 Client received gameState:', payload);
      setGameState(payload);
      setRoundOver(null);
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

  // clear on leave
  const leave = () => {
    localStorage.removeItem('session');
    setJoined(false);
    setGameState(null);
    setRoundOver(null);
  };

  // 1) While connecting
  if (status.startsWith('Connecting')) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto' }}>
        <h1 className="text-center">Phase 10 Online</h1>
        <p className="text-center">{status}</p>
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
      <div className="card" style={{ maxWidth: '800px', margin: '2rem auto' }}>
        <h1 className="text-center">Round {roundOver.roundNumber} Complete!</h1>
        <p className="text-center">Winner: {getWinnerUsername(roundOver.winner)}</p>
        
        <h2>Round Results</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Cards Left</th>
              <th>Points Added</th>
              <th>Total Score</th>
              <th>Current Phase</th>
              <th>Next Round</th>
            </tr>
          </thead>
          <tbody>
            {roundOver.scores.map(s => (
              <tr key={s.socketId} style={{
                backgroundColor: s.socketId === roundOver.winner ? 'var(--color-success)' : 'transparent',
                color: s.socketId === roundOver.winner ? 'white' : 'inherit'
              }}>
                <td>{s.player}</td>
                <td>{s.handSize}</td>
                <td>{s.roundPoints}</td>
                <td>{s.totalScore}</td>
                <td>
                  Phase {s.currentPhase + 1}
                  {s.willAdvance && <span style={{color: 'var(--color-success)'}}> ✓</span>}
                </td>
                <td>Phase {s.nextPhase + 1}</td>
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
            display: 'block',
            margin: '0 auto',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            fontSize: '1.1rem',
            backgroundColor: 'var(--color-success)'
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
        hasDrawn={gameState.hasDrawn}
      />
    );
  }

  // 5) Waiting-to-start room view
  return (
    <div className="card" style={{ maxWidth: '600px', margin: '2rem auto' }}>
      <h1 className="text-center">Room: {roomInfo.room}</h1>
      <p className="text-center">Players: {roomInfo.players.map(p => p.username).join(', ')}</p>
      <button
        onClick={() => {
          console.log('📤 Emitting startGame for room', roomInfo.room);
          socket.emit('startGame', { room: roomInfo.room });
        }}
        style={{ display: 'block', margin: '0 auto' }}
      >
        Start Game
      </button>
    </div>
  );
}