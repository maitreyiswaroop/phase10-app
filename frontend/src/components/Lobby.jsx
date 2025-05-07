// src/components/Lobby.jsx
import { useState } from 'react';

export default function Lobby({ socket }) {
  const [username, setUsername] = useState('');
  const [room, setRoom]       = useState('');
  const [error, setError]     = useState('');

  const handleCreate = () => {
    if (!username || !room) {
      setError('Username and room required');
      return;
    }
    socket.emit('createRoom', { username, room });
  };

  const handleJoin = () => {
    if (!username || !room) {
      setError('Username and room required');
      return;
    }
    socket.emit('joinRoom', { username, room });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🏠 Lobby</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div>
        <input
          placeholder="Username"
          value={username}
          onChange={e => { setError(''); setUsername(e.target.value); }}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <input
          placeholder="Room name"
          value={room}
          onChange={e => { setError(''); setRoom(e.target.value); }}
        />
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={handleCreate}>Create Room</button>
        <button onClick={handleJoin} style={{ marginLeft: 8 }}>
          Join Room
        </button>
      </div>
    </div>
  );
}
