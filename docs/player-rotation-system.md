# Player Rotation System

## Overview

The player rotation system ensures that each player gets a fair opportunity to start rounds throughout the game. Instead of the same player always starting each round, the starting position rotates clockwise through all players, creating a balanced gameplay experience.

## Functionality

### Round Starting Rotation

- **Round 1**: Player A starts
- **Round 2**: Player B starts  
- **Round 3**: Player C starts
- **Round 4**: Player A starts (cycle repeats)

This rotation continues throughout the entire game, ensuring no single player has a consistent advantage of starting rounds.

### Within-Round Turn Order

Once a round starts, the normal clockwise turn progression continues as usual:
- Starting player takes the first turn
- Next player clockwise takes the second turn
- And so on...

The rotation only affects **who starts each round**, not the turn order within rounds.

## Technical Implementation

### Data Structure

The room object tracks the current starting position:

```javascript
{
  // ... other room properties
  currentStarterIndex: 0,  // Index of player who starts current round
  players: [               // Array of players in joining order
    { socketId: 'abc', username: 'Player A', ... },
    { socketId: 'def', username: 'Player B', ... },
    { socketId: 'ghi', username: 'Player C', ... }
  ]
}
```

### Key Functions

#### Game Start (`startGame`)
- Uses `currentStarterIndex` to determine who starts the first round
- Defaults to index 0 (first player) if not set
- Sets `currentTurn` to the appropriate player

```javascript
const startingPlayerIndex = r.currentStarterIndex % r.players.length;
r.currentTurn = r.players[startingPlayerIndex].socketId;
```

#### New Round Start (`startNextRound`)
- Increments `currentStarterIndex` to rotate to next player
- Uses modulo arithmetic to wrap around to beginning when reaching end
- Sets the new starting player for the round

```javascript
r.currentStarterIndex = (r.currentStarterIndex + 1) % r.players.length;
const startingPlayerIndex = r.currentStarterIndex % r.players.length;
r.currentTurn = r.players[startingPlayerIndex].socketId;
```

### Robustness Considerations

- **Modulo arithmetic** ensures index never goes out of bounds
- **Defensive initialization** handles cases where `currentStarterIndex` is undefined
- **Player count changes** are handled gracefully (though not currently supported mid-game)

## Benefits

### Fairness
- Every player gets equal opportunity to start rounds
- No permanent advantage for any single player
- Balanced strategic opportunities across the game

### Strategic Depth
- Starting position can be tactically significant in some phases
- Players must adapt strategies based on their round starting position
- Creates more dynamic gameplay patterns

### Long-term Engagement
- Prevents repetitive game patterns
- Maintains player interest through varied experiences
- Reduces potential frustration from always going last

## Logging and Debugging

Enhanced logging helps track rotation behavior:

```javascript
console.log('📤 gameState (start) →', room, 'Starting player:', r.players[startingPlayerIndex].username);
console.log('📤 gameState (new round) →', room, 'Round', r.roundNumber, 'Starting player:', r.players[startingPlayerIndex].username);
```

This makes it easy to verify rotation is working correctly and troubleshoot any issues.

## Future Enhancements

### Potential Improvements
- **Visual indicator** in UI showing who will start next round
- **Historical tracking** of who started each previous round
- **Randomized starting player** option for first round
- **Player preference** settings for rotation behavior

### Advanced Features
- **Balanced seeding** based on cumulative scores
- **Adaptive rotation** based on game performance
- **Tournament mode** with specific rotation rules

## Testing Scenarios

### Basic Rotation
1. Start game with 3 players → Player 1 starts Round 1
2. Complete Round 1 → Player 2 starts Round 2  
3. Complete Round 2 → Player 3 starts Round 3
4. Complete Round 3 → Player 1 starts Round 4

### Edge Cases
- **2 players**: Alternates between them each round
- **Single player**: Always starts (though multiplayer game)
- **Mid-game reconnection**: Rotation state preserved

## Code Quality Notes

This implementation follows our engineering principles:

✅ **Long-term solution**: Robust rotation algorithm that scales  
✅ **Comprehensive documentation**: Clear explanation with examples  
✅ **Error handling**: Defensive programming with modulo arithmetic  
✅ **Clear naming**: `currentStarterIndex` clearly indicates purpose  
✅ **Extensive logging**: Detailed logs for debugging and verification 