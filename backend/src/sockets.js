// backend/src/sockets.js
import {
    rooms,
    createDeck,
    shuffle,
    deal,
    validatePhase,
    validateHit,
    PHASES,
    validatePhaseWithAssignedWilds
  } from './gameLogic.js';
  
  export function registerSockets(io) {
    io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);
  
      // Create Room
      socket.on('createRoom', ({ username, room, isPrivate, accessKey }) => {
        const expiresAt = Date.now() + 1000 * 60 * 15; // 15 min to rejoin
        rooms[room] = {
          players:    [{ socketId: socket.id, username, phaseIndex: 0, score: 0 }],
          isPrivate:  !!isPrivate,
          accessKey:  accessKey || '',
          expiresAt,
          deck:       [],
          hands:      {},
          discard:    [],
          currentTurn: null,
          hasDrawn:   false,
          laid:       {},    // laid[phaseIndex] = { socketId: [cards] }
          roundNumber: 1,
          currentStarterIndex: 0  // Track who starts each round
        };
        socket.join(room);
        io.to(room).emit('joinedRoom', {
          room,
          players: rooms[room].players,
        });
      });
  
      // Join Room
      socket.on('joinRoom', ({ username, room, accessKey }) => {
        const r = rooms[room];
        if (!r) {
          socket.emit('error', `Room "${room}" does not exist`);
          return;
        }
        // enforce private key
        if (r.isPrivate && r.accessKey !== accessKey) {
          socket.emit('error', 'Invalid access key');
          return;
        }
        // enforce not expired
        if (r.expiresAt && Date.now() > r.expiresAt) {
          delete rooms[room];
          socket.emit('error', 'Room expired');
          return;
        }
        // normal join
        r.players.push({ socketId: socket.id, username, phaseIndex: 0, score: 0 });
        socket.join(room);
        io.to(room).emit('joinedRoom', {
          room,
          players: r.players,
        });
      });
  
      // Rejoin Room on refresh
      socket.on('rejoinRoom', ({ room, username, accessKey }) => {
        const r = rooms[room];
        if (!r) return socket.emit('error', 'Room not found');
        if (r.isPrivate && r.accessKey !== accessKey) {
          return socket.emit('error', 'Invalid access key');
        }
        if (r.expiresAt && Date.now() > r.expiresAt) {
          delete rooms[room];
          return socket.emit('error', 'Room expired');
        }
        // find the old player entry by username
        const p = r.players.find(p => p.username === username);
        if (!p) return socket.emit('error', 'Player not in room');
        p.socketId = socket.id;         // update socket.id
        toast && clearTimeout(toast);   // if you have any pending timeout...
        socket.join(room);
        io.to(room).emit('joinedRoom', { room, players: r.players });
        emitState(room, r, io);
      });
      // Start Game: shuffle, deal, set first turn
      socket.on('startGame', ({ room }) => {
        console.log('📥 startGame →', room);
        const r = rooms[room];
        if (!r) return;

        if (!r.roundNumber) r.roundNumber = 1;
        if (r.currentStarterIndex === undefined) r.currentStarterIndex = 0;
  
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
  
        // Set the starting player based on currentStarterIndex
        const startingPlayerIndex = r.currentStarterIndex % r.players.length;
        r.currentTurn = r.players[startingPlayerIndex].socketId;
        r.hasDrawn    = false;
        r.laid        = {};
  
        emitState(room, r, io);
        console.log('📤 gameState (start) →', room, 'Starting player:', r.players[startingPlayerIndex].username);
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
          r.isRoundOver = true;
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
                  points += card.value < 10 ? 5 : 10;
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
          const completedPhases = {};
            for (const phaseIndex in r.laid) {
                for (const socketId in r.laid[phaseIndex]) {
                    completedPhases[socketId] = parseInt(phaseIndex, 10);
                }
                }

          const scores = r.players.map(p => {
            const currentPhase = typeof p.phaseIndex === 'number' ? p.phaseIndex : 0;
            const willAdvance = completedPhases[p.socketId] !== undefined;
            let nextPhase;
            if (willAdvance) {
              nextPhase = (currentPhase + 1) % PHASES.length;
            } else {
              nextPhase = currentPhase;
            }

            return {
              socketId: p.socketId,
              player: p.username,
              handSize: r.hands[p.socketId].length,
              roundPoints: roundScores[p.socketId] || 0,
              totalScore: p.score,
              currentPhase: currentPhase,
              nextPhase: nextPhase,
              willAdvance: willAdvance
            };
          });
          
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

        const playerIndex = r.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex < 0) return;

        const actualPhaseIndex = r.players[playerIndex].phaseIndex || 0;

        if (phaseIndex !== actualPhaseIndex) {
            socket.emit('error', `You're on Phase ${actualPhaseIndex + 1}, not Phase ${phaseIndex + 1}`);
            return;
          }
  
        const hand = r.hands[socket.id];
        const selected = cards;
        
        // Check if there are wild cards with assigned values
        const hasAssignedWilds = selected.some(card => card.type === 'wild' && card.assignedValue !== undefined);
        
        let validationResult;
        if (hasAssignedWilds) {
          // Use the new validation function that handles assigned wilds
          validationResult = validatePhaseWithAssignedWilds(phaseIndex, [selected]);
        } else {
          // Use the original validation function
          validationResult = validatePhase(phaseIndex, selected);
        }
        
        const { ok, groups } = validationResult;
        
        if (!ok) {
          socket.emit('error', 'Invalid phase combination for Phase ' + (phaseIndex + 1));
          return;
        }
  
        // Remove the cards from the player's hand
        selected.forEach(card => {
          const ix = hand.findIndex(c =>
            c.type === card.type &&
            (c.value === card.value || card.value == null) &&
            (c.color === card.color || card.color == null)
          );
          if (ix >= 0) hand.splice(ix, 1);
        });
  
        // Store the laid phase with any wild card assignments
        r.laid[phaseIndex] = r.laid[phaseIndex] || {};
        
        // Preserve wild card assignments in the stored groups
        const groupsWithAssignments = groups.map(group => 
          group.map(card => {
            // Find if this card has an assigned value in the original selected cards
            if (card.type === 'wild') {
              const originalWild = selected.find(c => 
                c.type === 'wild' && 
                c.id === card.id && 
                c.assignedValue !== undefined
              );
              
              if (originalWild && originalWild.assignedValue !== undefined) {
                return { ...card, assignedValue: originalWild.assignedValue };
              }
            }
            return card;
          })
        );
        
        r.laid[phaseIndex][socket.id] = groupsWithAssignments;
        
        // Check if hand is empty after laying down cards
        if (hand.length === 0) {
          r.isRoundOver = true;
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
                  points += card.value < 10 ? 5 : 10;
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
          const completedPhases = {};
          for (const phaseIndex in r.laid) {
            for (const socketId in r.laid[phaseIndex]) {
              completedPhases[socketId] = parseInt(phaseIndex, 10);
            }
          }

          const scores = r.players.map(p => {
            const currentPhase = typeof p.phaseIndex === 'number' ? p.phaseIndex : 0;
            const willAdvance = completedPhases[p.socketId] !== undefined;
            let nextPhase;
            if (willAdvance) {
              nextPhase = (currentPhase + 1) % PHASES.length;
            } else {
              nextPhase = currentPhase;
            }

            return {
              socketId: p.socketId,
              player: p.username,
              handSize: r.hands[p.socketId].length,
              roundPoints: roundScores[p.socketId] || 0,
              totalScore: p.score,
              currentPhase: currentPhase,
              nextPhase: nextPhase,
              willAdvance: willAdvance
            };
          });
          
          // broadcast roundEnd
          io.to(room).emit('roundEnd', { 
            winner: socket.id, 
            scores,
            roundNumber: r.roundNumber
          });
          return; // skip normal emitState so no further moves are allowed
        }


        emitState(room, r, io);
        console.log('📤 gameState (layPhase) →', room, phaseIndex, socket.id);
      });
  
      // Hit (add) a card to someone's laid meld
      socket.on('hitPhase', ({ room, phaseIndex, targetId, groupIndex, card, chosenWildValue }) => {
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
        
        // Use enhanced validateHit that returns { ok, possibleValues, assignedValue }
        const hitResult = validateHit(phaseIndex, currentGroup, candidate);
        if (!hitResult.ok) {
          socket.emit('error', 'Invalid hit: This card cannot be added to this meld');
          hand.splice(idx, 0, candidate);
          return;
        }

        // Handle wild card value assignment
        if (candidate.type === 'wild') {
          if (hitResult.possibleValues) {
            // Multiple possible values
            if (!chosenWildValue || !hitResult.possibleValues.includes(chosenWildValue)) {
              // Send possible values to client and put card back in hand
              socket.emit('chooseWildValue', {
                possibleValues: hitResult.possibleValues,
                card: candidate,
                phaseIndex,
                targetId,
                groupIndex
              });
              hand.splice(idx, 0, candidate);
              return;
            }
            // User has chosen a valid value
            candidate.assignedValue = chosenWildValue;
          } else if (hitResult.assignedValue !== undefined) {
            // Single possible value
            candidate.assignedValue = hitResult.assignedValue;
          }
        }
      
        r.laid[phaseIndex][targetId][groupIndex] = [...currentGroup, candidate];
        emitState(room, r, io);
        console.log('📤 gameState (hitPhase) →', room, phaseIndex, targetId, groupIndex);
      });
  
    // Start Next Round
// Add this socket handler or update your existing one
    socket.on('startNextRound', ({ room }) => {
        const r = rooms[room];
        if (!r || !r.isRoundOver) return;
        
        r.isRoundOver = false;
        // Increment round number
        r.roundNumber++;
        
        // Rotate the starting player for the new round
        r.currentStarterIndex = (r.currentStarterIndex + 1) % r.players.length;
        
        // Track which players completed their phase
        const completedPhases = {};
        for (const phaseIndex in r.laid) {
        for (const socketId in r.laid[phaseIndex]) {
            completedPhases[socketId] = parseInt(phaseIndex, 10);
        }
        }
        
        // Update players: advance phase for those who completed theirs
        r.players = r.players.map(p => {
            const currentPhase = typeof p.phaseIndex === 'number' ? p.phaseIndex : 0;
        if (completedPhases[p.socketId] !== undefined) {
            // Player completed their phase, move to next phase
            // const nextPhase = ((p.phaseIndex || 0) + 1) % PHASES.length;
            return {
            ...p,
            phaseIndex:  (currentPhase + 1) % PHASES.length
            };
        } else {
            // Player didn't complete their phase, stay on same phase
            return {
            ...p,
            phaseIndex: currentPhase
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
        
        // Set the starting player based on the rotated currentStarterIndex
        const startingPlayerIndex = r.currentStarterIndex % r.players.length;
        r.currentTurn = r.players[startingPlayerIndex].socketId;
        r.hasDrawn = false;
        r.laid = {};  // Reset laid phases for the new round
        
        emitState(room, r, io);
        console.log('📤 gameState (new round) →', room, 'Round', r.roundNumber, 'Starting player:', r.players[startingPlayerIndex].username);
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
      laid:        r.laid,
      currentStarterIndex: r.currentStarterIndex,
      roundNumber: r.roundNumber
    });
  }
  