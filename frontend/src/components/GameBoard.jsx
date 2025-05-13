// frontend/src/components/GameBoard.jsx
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import PhaseDisplay from './PhaseDisplay.jsx';
import { cardImageUrl } from '../utils/cardImages.js';
import Scoreboard from './Scoreboard';

export default function GameBoard({
  hands,
  players,
  deckCount,
  discardPile,
  localId,
  socket,
  room,
  currentTurn,
  hasDrawn,
  laid,
}) {
  const currentPlayer = players.find(p => p.socketId === localId);
  const currentPhaseIndex = currentPlayer?.phaseIndex || 0;
  const [handOrder, setHandOrder] = useState(hands[localId] || []);
  const [selectedIndices, setSelectedIndices] = useState([]);
  
  const isMyTurn = localId === currentTurn;
  const myHand = hands[localId] || [];
  const topDiscard = discardPile[0] || null;
  const hasCompletedCurrentPhase = !!laid[currentPhaseIndex]?.[localId];

  // Whenever the server deals or updates your hand, reset local order
  useEffect(() => {
    setHandOrder(hands[localId] || []);
    setSelectedIndices([]);
  }, [hands, localId]);

  // Clear any leftover selection once you've successfully laid
  useEffect(() => {
    if (laid[currentPhaseIndex]?.[localId]) {
      setSelectedIndices([]);
    }
  }, [laid, currentPhaseIndex, localId]);

  // Handle drag end: reorder locally
  function onDragEnd(result) {
    const { source, destination } = result;
    if (!destination) return;
    // if dropped in same place, no change
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    const newOrder = Array.from(handOrder);
    const [moved] = newOrder.splice(source.index, 1);
    newOrder.splice(destination.index, 0, moved);
    setHandOrder(newOrder);
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--spacing-lg)' }}>
      <h1 className="text-center">Phase 10 Online</h1>

      <div className="card">
        <PhaseDisplay
          phaseIndex={currentPhaseIndex}
          laid={laid}
          players={players}
          localId={localId}
          socket={socket}
          room={room}
          selectedIndices={selectedIndices}
          hasDrawn={hasDrawn}
          handOrder={handOrder}
          setSelectedIndices={setSelectedIndices}
          hasCompletedCurrentPhase={hasCompletedCurrentPhase}
          isMyTurn={isMyTurn}
        />
      </div>

      <div className="card">
        <h2>Current Turn</h2>
        <p>
          {players.find(p => p.socketId === currentTurn)?.username || 'Unknown'}
        </p>
      </div>

      {/* ─── DRAW CONTROLS ─── */}
      <div className="card">
        <h2>Draw Controls</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
          <button
            disabled={!isMyTurn || hasDrawn}
            onClick={() => socket.emit('drawCard', { room })}
          >
            Draw from Deck ({deckCount})
          </button>
          
          <button
            disabled={
              !isMyTurn ||
              hasDrawn ||
              !topDiscard ||
              topDiscard.type === 'skip'
            }
            onClick={() => socket.emit('drawDiscard', { room })}
          >
            Draw from Discard
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span>Top Discard:</span>
            {topDiscard ? (
              <img
                src={cardImageUrl(topDiscard)}
                alt="top discard"
                style={{ width: 60 }}
              />
            ) : (
              <em>(none)</em>
            )}
          </div>
        </div>
      </div>

      {/* ─── YOUR HAND ─── */}
      <div className="card">
        <h2>Your Hand ({handOrder.length} cards)</h2>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="hand" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-sm)', 
                  flexWrap: 'wrap',
                  minHeight: '120px',
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-background)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                {handOrder.map((card, idx) => {
                  const isSelected = selectedIndices.includes(idx);
                  return (
                    <Draggable
                      key={`card-${idx}`}
                      draggableId={`card-${idx}`}
                      index={idx}
                    >
                      {(prov) => (
                        <img
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          src={cardImageUrl(card)}
                          alt={card.type === 'number' 
                            ? `${card.color} ${card.value}` 
                            : card.type.toUpperCase()}
                          onClick={() => {
                            if (!isMyTurn || !hasDrawn) return;
                            setSelectedIndices((sel) =>
                              sel.includes(idx)
                                ? sel.filter((i) => i !== idx)
                                : [...sel, idx]
                            );
                          }}
                          style={{
                            width: 80,
                            border: isSelected
                              ? '3px solid var(--color-primary)'
                              : '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            transform: isSelected
                              ? 'translateY(-10px)'
                              : 'none',
                            cursor: isMyTurn && hasDrawn ? 'pointer' : 'not-allowed',
                            transition: '0.2s',
                            ...prov.draggableProps.style,
                          }}
                        />
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* ─── LAY & DISCARD ─── */}
        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-md)', 
          marginTop: 'var(--spacing-lg)',
          justifyContent: 'center'
        }}>
          <button
            disabled={!isMyTurn || !hasDrawn || selectedIndices.length === 0}
            onClick={() => {
              const cardsToLay = selectedIndices.map(i => handOrder[i]);
              socket.emit('layPhase', {
                room,
                phaseIndex: currentPhaseIndex,
                cards: cardsToLay,
              });
              setSelectedIndices([]);
            }}
          >
            Lay Phase (Phase {currentPhaseIndex + 1})
          </button>

          <button
            disabled={!isMyTurn || !hasDrawn || selectedIndices.length !== 1}
            onClick={() => {
              const cardToDiscard = handOrder[selectedIndices[0]];
              socket.emit('discardCard', {
                room,
                card: cardToDiscard,
              });
              setSelectedIndices([]);
            }}
          >
            Discard Card
          </button>
        </div>
      </div>

      {/* ─── OTHER PLAYERS ─── */}
      <div className="card">
        <h2>Other Players</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)'
        }}>
          {players
            .filter((p) => p.socketId !== localId)
            .map((p) => (
              <div 
                key={p.socketId}
                style={{
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-background)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <strong>{p.username}</strong>
                <p>{hands[p.socketId]?.length || 0} cards</p>
              </div>
            ))}
        </div>
      </div>

      {/* ─── SCOREBOARD ─── */}
      <Scoreboard players={players} localId={localId} />
    </div>
  );
}