import React from 'react';

export default function Scoreboard({ players, localId }) {
  // Sort players by phase (descending), then by score (ascending)
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.phaseIndex !== b.phaseIndex) {
      return b.phaseIndex - a.phaseIndex; // Higher phase first
    }
    return a.score - b.score; // Lower score first
  });

  return (
    <div className="scoreboard" style={{ marginTop: 20 }}>
      <h2>Scoreboard</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={cellStyle}>Player</th>
            <th style={cellStyle}>Current Phase</th>
            <th style={cellStyle}>Score</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => (
            <tr 
              key={player.socketId} 
              style={{
                backgroundColor: player.socketId === localId ? '#e6f7ff' : 'transparent'
              }}
            >
              <td style={cellStyle}>{player.username}</td>
              <td style={cellStyle}>Phase {(player.phaseIndex || 0) + 1}</td>
              <td style={cellStyle}>{player.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '0.8em', marginTop: 10 }}>
        *Lower score is better. Players are sorted by phase progress, then score.
      </p>
    </div>
  );
}

const cellStyle = {
  padding: '8px 12px',
  border: '1px solid #ddd',
  textAlign: 'center'
};