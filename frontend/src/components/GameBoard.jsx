// frontend/src/components/GameBoard.jsx
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import PhaseDisplay from './PhaseDisplay.jsx';
import { cardImageUrl } from '../utils/cardImages.js';
import Scoreboard from './Scoreboard';
import LayPhaseModal from './LayPhaseModal.jsx';

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
  currentStarterIndex,
  roundNumber,
}) {
  const currentPlayer = players.find(p => p.socketId === localId);
  const currentPhaseIndex = currentPlayer?.phaseIndex || 0;
  const [handOrder, setHandOrder] = useState(hands[localId] || []);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [showLayPhaseModal, setShowLayPhaseModal] = useState(false);
  
  const isMyTurn = localId === currentTurn;
  const topDiscard = discardPile[0] || null;
  const hasCompletedCurrentPhase = !!laid[currentPhaseIndex]?.[localId];

  // Whenever the server deals or updates your hand, reconcile local order
  useEffect(() => {
    const serverHand = hands[localId] || [];

    if (serverHand.length === 0) {
      setHandOrder([]);
      setSelectedIndices([]); // Clear selection when hand is empty
      return;
    }

    // Fallback: If local handOrder is empty, or if cards don't have IDs yet (e.g., during a migration or error),
    // or if server hand is empty (already handled), directly use the server's hand.
    // This assumes card objects from the server will have a unique 'id' property.
    if (handOrder.length === 0 || !handOrder[0]?.id || !serverHand[0]?.id) {
      setHandOrder(serverHand);
    } else {
      // Reconcile: Preserve existing order as much as possible
      const serverHandCardsMap = new Map(serverHand.map(card => [card.id, card]));
      const newHandOrder = [];

      // 1. Add cards that are still in the server's hand, maintaining their previous order from handOrder
      for (const localCard of handOrder) {
        if (serverHandCardsMap.has(localCard.id)) {
          newHandOrder.push(serverHandCardsMap.get(localCard.id)); // Use the card object from serverHand to get latest state
          serverHandCardsMap.delete(localCard.id); // Mark as processed
        }
      }

      // 2. Add any new cards from the server hand (cards that were in serverHandCardsMap but not in local handOrder)
      // These are typically newly drawn cards. Add them to the end.
      // Alternatively, you could try to find a "logical" place, but end is simplest.
      serverHandCardsMap.forEach(newCardFromServer => {
        newHandOrder.push(newCardFromServer);
      });
      
      setHandOrder(newHandOrder);
    }
    // It's generally safer to reset selections when the hand fundamentally changes.
    // If you need to preserve selection based on card ID, this logic would also need an update.
    setSelectedIndices([]);
  }, [hands, localId]); // handOrder is NOT a dependency here to prevent re-render loops.

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
    // Create a new array for the reordered hand
    const newOrder = Array.from(handOrder);
    const [movedCard] = newOrder.splice(source.index, 1);
    newOrder.splice(destination.index, 0, movedCard);
    setHandOrder(newOrder);
    // Note: If selectedIndices tracked IDs, this would need to update based on IDs, not indices.
  }

  // Handle laying a phase with the new modal
  const handleLayPhase = (cardsWithAssignments, groups) => {
    socket.emit('layPhase', {
      room,
      phaseIndex: currentPhaseIndex,
      cards: cardsWithAssignments,
    });
  };

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
                      key={card.id || `card-${idx}`}
                      draggableId={(card.id && String(card.id)) || `card-${idx}`}
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
                            : card.type ? card.type.toUpperCase() : 'UNKNOWN_CARD'}
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
            disabled={!isMyTurn || !hasDrawn || hasCompletedCurrentPhase}
            onClick={() => setShowLayPhaseModal(true)}
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
      <Scoreboard players={players} localId={localId} currentStarterIndex={currentStarterIndex} roundNumber={roundNumber} />

      {/* ─── LAY PHASE MODAL ─── */}
      <LayPhaseModal
        show={showLayPhaseModal}
        onClose={() => setShowLayPhaseModal(false)}
        phaseIndex={currentPhaseIndex}
        hand={handOrder}
        onLayPhase={handleLayPhase}
      />
    </div>
  );
}