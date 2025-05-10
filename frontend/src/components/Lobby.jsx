// src/components/Lobby.jsx
import { useState } from 'react';

export default function Lobby({ socket }) {
  const [username, setUsername] = useState('');
  const [room, setRoom]       = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [error, setError]     = useState('');

  const handleCreate = () => {
    if (!username || !room) {
      setError('Username and room required');
      return;
    }
    const key = isPrivate
    ? accessKey || Math.random().toString(36).slice(-5).toUpperCase()
    : '';
    socket.emit('createRoom', { username, room, isPrivate, accessKey: key });
    // store for rejoin
    localStorage.setItem('session', JSON.stringify({ room, username, accessKey: key }));
  };

  const handleJoin = () => {
    if (!username || !room) {
      setError('Username and room required');
      return;
    }
    socket.emit('joinRoom', { username, room, accessKey });
    localStorage.setItem('session', JSON.stringify({ room, username, accessKey }));
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🏠 Lobby</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input
        placeholder="Username" value={username}
        onChange={e => { setError(''); setUsername(e.target.value); }}
      />
      <input
        placeholder="Room name" value={room}
        onChange={e => { setError(''); setRoom(e.target.value); }}
      />
      <label>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={e => setIsPrivate(e.target.checked)}
        /> Private room
      </label>
      {isPrivate && (
        <input
          placeholder="Access Key"
          value={accessKey}
          onChange={e => setAccessKey(e.target.value.toUpperCase())}
          maxLength={5}
        />
      )}
      <div style={{ marginTop: 12 }}>
        <button onClick={handleCreate}>Create Room</button>
        <button onClick={handleJoin} style={{ marginLeft: 8 }}>Join Room</button>
      </div>
    </div>
  );
}
