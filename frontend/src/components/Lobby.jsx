// src/components/Lobby.jsx
import { useState } from 'react';

export default function Lobby({ socket }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!username || !room) {
      setError('Username and room required');
      return;
    }
    const key = isPrivate
      ? accessKey || Math.random().toString(36).slice(-5).toUpperCase()
      : '';
    socket.emit('createRoom', { username, room, isPrivate, accessKey: key });
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
    <div className="card" style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h1 className="text-center">🏠 Lobby</h1>
      
      {error && (
        <div style={{ 
          backgroundColor: 'var(--color-danger)', 
          color: 'white',
          padding: 'var(--spacing-sm)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--spacing-md)'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          Username
        </label>
        <input
          placeholder="Enter your username"
          value={username}
          onChange={e => { setError(''); setUsername(e.target.value); }}
        />
      </div>

      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          Room Name
        </label>
        <input
          placeholder="Enter room name"
          value={room}
          onChange={e => { setError(''); setRoom(e.target.value); }}
        />
      </div>

      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={e => setIsPrivate(e.target.checked)}
          />
          Private room
        </label>
      </div>

      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
          Access Key
        </label>
        <input
          placeholder="Enter access key"
          value={accessKey}
          onChange={e => setAccessKey(e.target.value.toUpperCase())}
          maxLength={5}
          disabled={!isPrivate}
          style={{
            opacity: isPrivate ? 1 : 0.5,
            cursor: isPrivate ? 'text' : 'not-allowed'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
        <button 
          onClick={handleCreate}
          style={{ flex: 1 }}
        >
          Create Room
        </button>
        <button 
          onClick={handleJoin}
          style={{ flex: 1 }}
        >
          Join Room
        </button>
      </div>
    </div>
  );
}
