// backend/src/sockets.js
import {
  rooms,
  createDeck,
  shuffle,
  deal,
  validatePhase
} from './gameLogic.js';

export function registerSockets(io) {
  io.on('connection', socket => {
    console.log('🔌 Client connected:', socket.id);

    // Create Room
    socket.on('createRoom', ({ username, room }) => {
      rooms[room] = {
        players:    [{ socketId: socket.id, username }],
        deck:       [],
        hands:      {},
        discard:    [],
        currentTurn: null,
        hasDrawn:   false,
        laid:       {},    // laid[phaseIndex] = { socketId: [cards] }
      };
      socket.join(room);
      io.to(room).emit('joinedRoom', {
        room,
        players: rooms[room].players,
      });
    });

    // Join Room
    socket.on('joinRoom', ({ username, room }) => {
      const r = rooms[room];
      if (!r) {
        socket.emit('error', `Room "${room}" does not exist`);
        return;
      }
      r.players.push({ socketId: socket.id, username });
      socket.join(room);
      io.to(room).emit('joinedRoom', {
        room,
        players: r.players,
      });
    });

    // Start Game: shuffle, deal, set first turn
    socket.on('startGame', ({ room }) => {
      console.log('📥 startGame →', room);
      const r = rooms[room];
      if (!r) return;

      // shuffle & deal
      const fullDeck = shuffle(createDeck());
      const { hands, deck: remaining } = deal(fullDeck, r.players);
      r.hands       = hands;
      r.deck        = remaining;
      r.discard     = [];
      const starter = r.deck.shift();
      r.discard.push(starter);
      r.currentTurn = r.players[0].socketId;
      r.hasDrawn    = false;
      r.laid        = {};

      emitState(room, r, io);
      console.log('📤 gameState (start) →', room);
    });

    // Draw a card from deck
    socket.on('drawCard', ({ room }) => {
      const r = rooms[room];
      if (!r || r.deck.length === 0 || socket.id !== r.currentTurn || r.hasDrawn) return;

      const card = r.deck.shift();
      r.hands[socket.id].push(card);
      r.hasDrawn = true;

      emitState(room, r, io);
      console.log('📤 gameState (draw) →', room, card);
    });

    // Draw from discard pile
    socket.on('drawDiscard', ({ room }) => {
      const r = rooms[room];
      if (!r || r.discard.length === 0 || socket.id !== r.currentTurn || r.hasDrawn) return;
      
      const card = r.discard.shift();
      r.hands[socket.id].push(card);
      r.hasDrawn = true;
      
      emitState(room, r, io);
      console.log('📤 gameState (draw discard) →', room, card);
    });

    // Discard a card (must have drawn first, ends turn; skip will skip one extra)
    socket.on('discardCard', ({ room, cardIndex }) => {
      const r = rooms[room];
      if (!r || socket.id !== r.currentTurn || !r.hasDrawn) return;

      const hand = r.hands[socket.id];
      if (cardIndex < 0 || cardIndex >= hand.length) return;

      // Remove the card from the player's hand
      const [card] = hand.splice(cardIndex, 1);
      // Put it on top of the discard pile
      r.discard.unshift(card);

      // Determine next turn index
      const idx = r.players.findIndex((p) => p.socketId === socket.id);
      let next = (idx + 1) % r.players.length;

      // ** SKIP LOGIC **: if the discarded card is a skip, advance one more
      if (card.type === 'skip') {
        next = (next + 1) % r.players.length;
      }

      r.currentTurn = r.players[next].socketId;
      r.hasDrawn    = false;

      emitState(room, r, io);
      console.log('📤 gameState (discard) →', room, 'discarded', card);
    });

    // Lay Phase: validate and record
    socket.on('layPhase', ({ room, phaseIndex, cardIndices }) => {
      const r = rooms[room];
      if (!r) return;
      if (socket.id !== r.currentTurn || !r.hasDrawn) {
        socket.emit('error', 'Not your turn to lay phase or you need to draw first');
        return;
      }

      // pick cards
      const hand     = r.hands[socket.id];
      const selected = cardIndices.map(i => hand[i]);
      const { ok, groups } = validatePhase(phaseIndex, selected);
      if (!ok) {
        socket.emit('error', 'Invalid phase combination');
        return;
      }

      // remove from hand
      // (splice in descending order so indices stay valid)
      cardIndices
        .sort((a,b) => b - a)
        .forEach(i => hand.splice(i, 1));

      // record laid sets
      r.laid[phaseIndex] = r.laid[phaseIndex] || {};
      r.laid[phaseIndex][socket.id] = groups;

      emitState(room, r, io);
      console.log('📤 gameState (layPhase) →', room, phaseIndex, socket.id);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });

    // Hit (add) a card to someone’s laid meld
    socket.on('hitPhase', ({ room, phaseIndex, targetId, groupIndex, cardIndex }) => {
    const r = rooms[room];
    if (!r) return;

    // Must have drawn, and must be your turn, and that target must have already laid
    if (socket.id !== r.currentTurn || !r.hasDrawn) return;
    if (!r.laid[phaseIndex]?.[targetId]) return;

    const hand = r.hands[socket.id];
    if (cardIndex < 0 || cardIndex >= hand.length) return;

    const card = hand.splice(cardIndex, 1)[0];
    // append to the correct laid group
    r.laid[phaseIndex][targetId][groupIndex].push(card);

    // emit updated state
    io.to(room).emit('gameState', {
        hands:       r.hands,
        players:     r.players,
        deckCount:   r.deck.length,
        discard:     r.discard,
        currentTurn: r.currentTurn,
        hasDrawn:    r.hasDrawn,
        laid:        r.laid,
    });
    });

  });
}

// Helper to broadcast game state
function emitState(room, r, io) {
  io.to(room).emit('gameState', {
    hands:       r.hands,
    players:     r.players,
    deckCount:   r.deck.length,
    discard:     r.discard,
    currentTurn: r.currentTurn,
    hasDrawn:    r.hasDrawn,
    laid:        r.laid
  });
}