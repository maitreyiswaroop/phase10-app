import React, { useState } from 'react';
import { cardImageUrl } from '../utils/cardImages.js';
import WildValueModal from './WildValueModal.jsx';

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
  isMyTurn,
  currentTurn,
  hands
}) { 
  const [wildValueChoice, setWildValueChoice] = useState(null);
  
  // Handle wild value selection modal
  React.useEffect(() => {
    socket.on('chooseWildValue', (data) => {
      setWildValueChoice(data);
    });
    return () => socket.off('chooseWildValue');
  }, [socket]);

  const handleWildValueSelect = (value) => {
    if (!wildValueChoice) return;
    
    const { card, phaseIndex, targetId, groupIndex } = wildValueChoice;
    socket.emit('hitPhase', {
      room,
      phaseIndex,
      targetId,
      groupIndex,
      card,
      chosenWildValue: value
    });
    setWildValueChoice(null);
  };

  // Find the local player's justLaid flag
  const localPlayer = players.find(p => p.socketId === localId);
  const justLaid = localPlayer?.justLaid;

  // Get the current player's phase description
//   const isMyTurn = localId === players.find(p => p.socketId === localId)?.socketId;
  const description = PHASE_DESCRIPTIONS[phaseIndex] || '';

  return (
    <div>
      <h2>
        Phase {phaseIndex + 1}: {description}
      </h2>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'var(--spacing-md)'
      }}>
        {players.map((p) => {
          const playerPhaseIndex = p.phaseIndex || 0;
          const groups = (laid[playerPhaseIndex] && laid[playerPhaseIndex][p.socketId]) || [];
          const isCurrentPlayer = p.socketId === localId;
          const isTurn = p.socketId === currentTurn;

          return (
            <div 
              key={p.socketId} 
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: isTurn ? '#e3f2fd' : 'var(--color-background)',
                borderRadius: 'var(--radius-sm)',
                border: isTurn ? '2px solid #1976d2' : 'none',
                boxShadow: isTurn ? '0 0 0 2px #1976d2' : 'none',
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-sm)'
              }}>
                <strong>{p.username}</strong>
                {isTurn && isCurrentPlayer && (
                  <span style={{
                    color: '#fff',
                    background: '#1976d2',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    marginLeft: '8px',
                    fontSize: '0.8em'
                  }}>Your Turn</span>
                )}
                <span>Phase {playerPhaseIndex + 1}</span>
              </div>
              {/* Show number of cards remaining */}
              <div style={{ fontSize: '0.95em', marginBottom: '4px', color: '#444' }}>
                {typeof hands === 'object' && hands[p.socketId] ? `${hands[p.socketId].length} cards` : ''}
              </div>
              {groups.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                  {groups.map((grp, gi) => (
                    <div 
                      key={gi}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm)',
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      {grp.map((c, ci) => (
                        <div key={ci} style={{ position: 'relative' }}>
                          <img
                            src={cardImageUrl(c)}
                            alt=""
                            style={{ width: 30, margin: '0 2px' }}
                          />
                          {c.type === 'wild' && c.assignedValue !== undefined && (
                            <div style={{
                              position: 'absolute',
                              bottom: '0',
                              right: '0',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              width: '14px',
                              height: '14px',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              fontWeight: 'bold',
                              fontSize: '8px',
                              border: '1px solid black'
                            }}>
                              {c.assignedValue}
                            </div>
                          )}
                        </div>
                      ))}
                      <button
                        disabled={
                          !hasDrawn ||
                          selectedIndices.length !== 1 ||
                          groups.length === 0 ||
                          !isMyTurn ||
                          !hasCompletedCurrentPhase ||
                          // Disable if justLaid and trying to hit on another player's meld
                          (justLaid && p.socketId !== localId)
                        }
                        title={
                          (justLaid && p.socketId !== localId)
                            ? 'You may only hit on your own phase this turn.'
                            : undefined
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
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          fontSize: '1.2rem',
                          lineHeight: 1,
                          minWidth: '32px'
                        }}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <em>not laid yet</em>
              )}
            </div>
          );
        })}
      </div>

      {/* Wild Value Selection Modal */}
      {wildValueChoice && (
        <WildValueModal
          possibleValues={wildValueChoice.possibleValues}
          onSelect={handleWildValueSelect}
          onCancel={() => setWildValueChoice(null)}
        />
      )}
    </div>
  );
}