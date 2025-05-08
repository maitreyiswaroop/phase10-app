import React from 'react';
import { cardImageUrl } from '../utils/cardImages.js';

// Add PHASE_DESCRIPTIONS from your gameLogic
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
  'One set of five + one set of three'
];

export default function PhaseDisplay({
  phaseIndex,
  laid,
  players,
  localId,
  socket,
  room,
  selectedIndices,
  hasDrawn,
  handOrder,
  setSelectedIndices,
  hasCompletedCurrentPhase,
  isMyTurn
}) { 
  // Get the current player's phase description
//   const isMyTurn = localId === players.find(p => p.socketId === localId)?.socketId;
  const description = PHASE_DESCRIPTIONS[phaseIndex] || '';

  return (
    <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ccc' }}>
      <h2>
        Phase {phaseIndex + 1}: {description}
      </h2>
      <ul>
        {players.map((p) => {
          // Get this player's phase index and description
          const playerPhaseIndex = p.phaseIndex || 0;
          
          // Get the groups this player has laid for their current phase
          const groups = 
            (laid[playerPhaseIndex] && laid[playerPhaseIndex][p.socketId]) || [];

            return (
                <li key={p.socketId} style={{ marginBottom: 8 }}>
                  <strong>{p.username}:</strong> (Phase {playerPhaseIndex + 1}):{' '}
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
                        {/* "Hit" button with updated disabled logic */}
                        <button
                          disabled={
                            !hasDrawn ||
                            selectedIndices.length !== 1 ||
                            groups.length === 0 ||
                            !isMyTurn ||
                            !hasCompletedCurrentPhase // Disable if player hasn't completed their phase
                          }
                          onClick={() => {
                            const cardToHit = handOrder[selectedIndices[0]];
                            socket.emit('hitPhase', {
                              room,
                              phaseIndex: playerPhaseIndex,
                              targetId: p.socketId,
                              groupIndex: gi,
                              card: cardToHit
                            });
                            setSelectedIndices([]);
                          }}
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