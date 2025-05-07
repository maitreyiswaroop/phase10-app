// backend/src/sockets.js
import {
    rooms,
    createDeck,
    shuffle,
    deal,
    validatePhase,
    validateHit,
    PHASES
  } from './gameLogic.js';
  
  export function registerSockets(io) {
    io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);
  
      // Create Room
      socket.on('createRoom', ({ username, room }) => {
        rooms[room] = {
          players:    [{ socketId: socket.id, username, phaseIndex: 0, score: 0 }],
          deck:       [],
          hands:      {},
          discard:    [],
          currentTurn: null,
          hasDrawn:   false,
          laid:       {},    // laid[phaseIndex] = { socketId: [cards] }
          roundNumber: 0,
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
        r.players.push({ socketId: socket.id, username, phaseIndex: 0, score: 0 });
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
  
        const fullDeck = shuffle(createDeck());
        const { hands, deck: remaining } = deal(fullDeck, r.players);
  
        r.hands       = hands;
        r.deck        = remaining;
        r.discard     = [];
        let starter;
        do {
          // Put any rejected cards back into the deck at a random position
          if (starter) {
            const randomPos = Math.floor(Math.random() * r.deck.length);
            r.deck.splice(randomPos, 0, starter);
          }
          starter = r.deck.shift();
        } while (starter.type === 'wild' || starter.type === 'skip');
        
        r.discard.push(starter);
        // const starter  = r.deck.shift();
        // r.discard.push(starter);
  
        r.currentTurn = r.players[0].socketId;
        r.hasDrawn    = false;
        r.laid        = {};
  
        emitState(room, r, io);
        console.log('📤 gameState (start) →', room);
      });
  
      // Draw a card from deck
      socket.on('drawCard', ({ room }) => {
        const r = rooms[room];
        if (!r || socket.id !== r.currentTurn || r.hasDrawn || r.deck.length === 0) return;
  
        const card = r.deck.shift();
        r.hands[socket.id].push(card);
        r.hasDrawn = true;
  
        emitState(room, r, io);
        console.log('📤 gameState (draw) →', room, card);
      });
  
      // Draw from discard pile
      socket.on('drawDiscard', ({ room }) => {
        const r = rooms[room];
        if (!r || socket.id !== r.currentTurn || r.hasDrawn || r.discard.length === 0) return;
  
        const card = r.discard.shift();
        r.hands[socket.id].push(card);
        r.hasDrawn = true;
  
        emitState(room, r, io);
        console.log('📤 gameState (drawDiscard) →', room, card);
      });
  
      // Discard a card (must have drawn first, ends turn; skip will skip one extra)
      socket.on('discardCard', ({ room, card }) => {
        const r = rooms[room];
        if (!r || socket.id !== r.currentTurn || !r.hasDrawn) return;
  
        const hand = r.hands[socket.id];
        const idx = hand.findIndex(c =>
          c.type === card.type &&
          (c.value === card.value || card.value == null) &&
          (c.color === card.color || card.color == null)
        );
        if (idx < 0) return;
        const [removed] = hand.splice(idx, 1);
  
        r.discard.unshift(removed);
  
        // determine next turn index
        const curIndex = r.players.findIndex(p => p.socketId === socket.id);
        let next = (curIndex + 1) % r.players.length;
  
        // skip logic
        if (removed.type === 'skip') {
          next = (next + 1) % r.players.length;
        }
  
        r.currentTurn = r.players[next].socketId;
        r.hasDrawn    = false;
  
        // round end?
        const isRoundOver = r.hands[socket.id].length === 0;
        if (isRoundOver) {
          // Calculate points for remaining cards
          const roundScores = {};
          r.players.forEach(p => {
            const hand = r.hands[p.socketId];
            let points = 0;
            
            // Skip the winner - they get 0 points this round
            if (p.socketId !== socket.id) {
              // Calculate points based on cards left in hand
              hand.forEach(card => {
                if (card.type === 'number') {
                  points += card.value;
                } else if (card.type === 'wild') {
                  points += 25;
                } else if (card.type === 'skip') {
                  points += 15;
                }
              });
              
              // Update their total score
              const playerIndex = r.players.findIndex(pl => pl.socketId === p.socketId);
              r.players[playerIndex].score += points;
            }
            
            roundScores[p.socketId] = points;
          });
          
          // compute player data to send to clients
          const scores = r.players.map(p => ({
            socketId: p.socketId,
            player: p.username,
            handSize: r.hands[p.socketId].length,
            roundPoints: roundScores[p.socketId] || 0,
            totalScore: p.score,
            currentPhase: p.phaseIndex
          }));
          
          // broadcast roundEnd
          io.to(room).emit('roundEnd', { 
            winner: socket.id, 
            scores,
            roundNumber: r.roundNumber
          });
          return; // skip normal emitState so no further moves are allowed
        }
  
        emitState(room, r, io);
        console.log('📤 gameState (discard) →', room, removed);
      });
  
      // Lay Phase: validate and record
      socket.on('layPhase', ({ room, phaseIndex, cards }) => {
        const r = rooms[room];
        if (!r || socket.id !== r.currentTurn || !r.hasDrawn) {
          socket.emit('error', 'Not your turn or must draw first');
          return;
        }
  
        const hand     = r.hands[socket.id];
        const selected = cards;
  
        const { ok, groups } = validatePhase(phaseIndex, selected);
        if (!ok) {
          socket.emit('error', 'Invalid phase combination');
          return;
        }
  
        selected.forEach(card => {
          const ix = hand.findIndex(c =>
            c.type === card.type &&
            (c.value === card.value || card.value == null) &&
            (c.color === card.color || card.color == null)
          );
          if (ix >= 0) hand.splice(ix, 1);
        });
  
        r.laid[phaseIndex] = r.laid[phaseIndex] || {};
        r.laid[phaseIndex][socket.id] = groups;
  
        emitState(room, r, io);
        console.log('📤 gameState (layPhase) →', room, phaseIndex, socket.id);
      });
  
      // Hit (add) a card to someone's laid meld
      socket.on('hitPhase', ({ room, phaseIndex, targetId, groupIndex, card }) => {
        const r = rooms[room];
        if (!r) return;
        if (!r.laid[phaseIndex]?.[targetId]) return;
        if (socket.id !== r.currentTurn || !r.hasDrawn) return;
      
        const hand = r.hands[socket.id];
        const idx = hand.findIndex(c =>
          c.type === card.type &&
          (c.value === card.value || card.value == null) &&
          (c.color === card.color || card.color == null)
        );
        if (idx < 0) return;
        const [candidate] = hand.splice(idx, 1);
      
        const currentGroup = r.laid[phaseIndex][targetId][groupIndex];
        
        // Use validateHit instead of validatePhase
        const isValidHit = validateHit(phaseIndex, currentGroup, candidate);
        if (!isValidHit) {
          socket.emit('error', 'Invalid hit: This card cannot be added to this meld');
          hand.splice(idx, 0, candidate);
          return;
        }
      
        r.laid[phaseIndex][targetId][groupIndex] = [...currentGroup, candidate];
        emitState(room, r, io);
        console.log('📤 gameState (hitPhase) →', room, phaseIndex, targetId, groupIndex);
      });
  
    // Start Next Round
// Add this socket handler or update your existing one
    socket.on('startNextRound', ({ room }) => {
        const r = rooms[room];
        if (!r) return;
        
        // Increment round number
        r.roundNumber = (r.roundNumber || 0) + 1;
        
        // Track which players completed their phase
        const completedPhases = {};
        for (const phaseIndex in r.laid) {
        for (const socketId in r.laid[phaseIndex]) {
            completedPhases[socketId] = parseInt(phaseIndex, 10);
        }
        }
        
        // Update players: advance phase for those who completed theirs
        r.players = r.players.map(p => {
        if (completedPhases[p.socketId] !== undefined) {
            // Player completed their phase, move to next phase
            const nextPhase = ((p.phaseIndex || 0) + 1) % PHASES.length;
            return {
            ...p,
            phaseIndex: nextPhase
            };
        } else {
            // Player didn't complete their phase, stay on same phase
            return {
            ...p,
            phaseIndex: p.phaseIndex || 0
            };
        }
        });
        
        // Reset game state for new round
        const fullDeck = shuffle(createDeck());
        const { hands, deck: remaining } = deal(fullDeck, r.players);
        r.hands = hands;
        r.deck = remaining;
        r.discard = [];
        
        // Ensure first discard is never a wild or skip
        let starter;
        do {
        // Put any rejected cards back in the deck at a random position
        if (starter) {
            const randomPos = Math.floor(Math.random() * r.deck.length);
            r.deck.splice(randomPos, 0, starter);
        }
        starter = r.deck.shift();
        } while (starter.type === 'wild' || starter.type === 'skip');
        
        r.discard.push(starter);
        
        r.currentTurn = r.players[0].socketId;
        r.hasDrawn = false;
        r.laid = {};  // Reset laid phases for the new round
        
        emitState(room, r, io);
        console.log('📤 gameState (new round) →', room);
    });
  
      socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
      });
    });
  }
  
  // Helper to broadcast full game state
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
  