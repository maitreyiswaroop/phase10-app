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
//   phaseIndex,
}) {
    const currentPlayer = players.find(p => p.socketId === localId);
    const currentPhaseIndex = currentPlayer?.phaseIndex || 0;
  // Keep a local, mutable copy of your hand order
  const [handOrder, setHandOrder] = useState(hands[localId] || []);
  const [selectedIndices, setSelectedIndices] = useState([]);
  
  const isMyTurn = localId === currentTurn;
  const myHand = hands[localId] || [];
  const topDiscard = discardPile[0] || null;
  const hasCompletedCurrentPhase = !!laid[currentPhaseIndex]?.[localId];

  // Update hand order while preserving existing order
  useEffect(() => {
    if (!hands[localId]) return;
    
    // If this is the first time we're getting cards, set the initial order
    if (handOrder.length === 0) {
      setHandOrder(hands[localId]);
      return;
    }

    // Find new cards that aren't in our current handOrder
    const newCards = hands[localId].filter(newCard => 
      !handOrder.some(existingCard => 
        existingCard.type === newCard.type && 
        existingCard.value === newCard.value && 
        existingCard.color === newCard.color
      )
    );

    // Remove cards that are no longer in the hand
    const updatedOrder = handOrder.filter(card => 
      hands[localId].some(newCard => 
        newCard.type === card.type && 
        newCard.value === card.value && 
        newCard.color === card.color
      )
    );

    // Add new cards to the end
    setHandOrder([...updatedOrder, ...newCards]);
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
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Phase 10 Online</h1>

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
      <p>
        Current turn:{' '}
        {players.find(p => p.socketId === currentTurn)?.username || 'Unknown'}
      </p>

      {/* ─── DRAW CONTROLS ─── */}
      <div style={{ marginBottom: 20 }}>
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
          style={{ marginLeft: 8 }}
        >
          Draw from Discard
        </button>
        
        <span style={{ marginLeft: 20, verticalAlign: 'middle' }}>
          Top Discard:{' '}
          {topDiscard ? (
            <img
              src={cardImageUrl(topDiscard)}
              alt="top discard"
              style={{ width: 60 }}
            />
          ) : (
            <em>(none)</em>
          )}
        </span>
      </div>

      {/* ─── YOUR HAND ─── */}
      <h2>Your Hand ({handOrder.length} cards):</h2>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="hand" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
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
                            ? '3px solid blue'
                            : '1px solid #ccc',
                          borderRadius: 6,
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
      <div style={{ marginTop: 16 }}>
        <button
          disabled={!isMyTurn || !hasDrawn || selectedIndices.length === 0}
          onClick={() => {
            // grab the real card objects out of your reordered handOrder
            const cardsToLay = selectedIndices.map(i => handOrder[i]);
           socket.emit('layPhase', {
             room,
             phaseIndex : currentPhaseIndex,
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
            // pull the card object from your reordered handOrder
            const cardToDiscard = handOrder[selectedIndices[0]];
            socket.emit('discardCard', {
            room,
            card: cardToDiscard,
            });
            setSelectedIndices([]);
        }}
        style={{ marginLeft: 8 }}
        >
        Discard Card
        </button>
      </div>

      {/* ─── OTHER PLAYERS ─── */}
      <h2>Other Players:</h2>
      <ul>
        {players
          .filter((p) => p.socketId !== localId)
          .map((p) => (
            <li key={p.socketId}>
              {p.username}: {hands[p.socketId]?.length || 0} cards
            </li>
          ))}
      </ul>

        {/* ─── SCOREBOARD ─── */}
        <Scoreboard players={players} localId={localId} />
    </div>
  );
}