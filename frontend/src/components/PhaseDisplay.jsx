// frontend/src/components/PhaseDisplay.jsx
import React from 'react';
import { cardImageUrl } from '../utils/cardImages.js';

const PHASE_DESCRIPTIONS = [
  'Two sets of three',
  'One set of three + one run of four',
  'One set of four + one run of four',
  'One run of seven',
  'One run of eight',
  'One run of nine',
  'Two sets of four',
  'Seven cards of one color',
  'One set of five + one set of two',
  'One set of five + one set of three',
];

export default function PhaseDisplay({
  phaseIndex,
  laid,
  players,
  localId,
  socket,
  room,
  selectedIndices,
  hasDrawn
}) {
  // Safely pull the description for this phase
  const description = PHASE_DESCRIPTIONS[phaseIndex] || '';

  return (
    <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ccc' }}>
      <h2>
        Phase {phaseIndex + 1}: {description}
      </h2>
      <ul>
        {players.map((p) => {
          // Get the groups this player has laid for the current phase
          const groups =
            (laid[phaseIndex] && laid[phaseIndex][p.socketId]) || [];

          return (
            <li key={p.socketId} style={{ marginBottom: 8 }}>
              <strong>{p.username}:</strong>{' '}
              {groups.length ? (
                groups.map((grp, gi) => (
                  <span key={gi} style={{ marginRight: 8 }}>
                    [{' '}
                    {grp.map((c, ci) => (
                      <img
                        key={ci}
                        src={cardImageUrl(c)}
                        alt=""
                        style={{ width: 30, margin: '0 2px' }}
                      />
                    ))}{' '}
                    ]
                    {/* “Hit” button */}
                    <button
                      disabled={
                        // you can’t hit yourself, must have drawn, and exactly one selected
                        p.socketId === localId ||
                        !hasDrawn ||
                        selectedIndices.length !== 1
                      }
                      onClick={() =>
                        socket.emit('hitPhase', {
                          room,
                          phaseIndex,
                          targetId: p.socketId,
                          groupIndex: gi,
                          cardIndex: selectedIndices[0],
                        })
                      }
                      style={{ marginLeft: 4 }}
                    >
                      +
                    </button>
                  </span>
                ))
              ) : (
                <em>not laid yet</em>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
