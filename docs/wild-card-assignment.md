# Wild Card Assignment Feature

## Overview

The wild card assignment feature allows players to explicitly define what value a wild card represents when laying down a phase. This improves clarity and strategic control for players, especially in runs where wild cards could represent different values.

## User Experience

When a player clicks "Lay Phase", a modal dialog appears that allows them to:

1. Select cards from their hand
2. Place them into the required groups for their current phase
3. Explicitly assign values to any wild cards
4. Submit their phase once all requirements are met

### Wild Card Value Assignment

- When a wild card is placed into a group, the player is immediately prompted to assign a value to it
- For sets: If there are already number cards in the set, the wild card will automatically be assigned that value
- For runs: The player will be offered valid values that would complete the run (e.g., values that would fill gaps or extend the sequence)
- For color groups: Wild cards don't need value assignments

### Visual Indicators

- Assigned wild cards display their value as a small number in the corner of the card
- This makes it clear to all players what value each wild card represents
- The assigned value is preserved throughout the game and visible in the phase display

## Technical Implementation

### Frontend

- `LayPhaseModal.jsx`: A new component that provides the UI for laying phases and assigning wild card values
- The modal handles the logic for determining valid wild card values based on context
- Wild assignments are tracked in the component state and sent to the server when the phase is submitted

### Backend

- `gameLogic.js`: Updated validation functions to handle wild cards with assigned values
- `validatePhaseWithAssignedWilds`: A new function that validates phases where wild cards have explicit values
- The server preserves wild card assignments when storing laid phases

### Data Structure

Wild cards with assigned values have an additional property:

```javascript
{
  id: 42,
  type: 'wild',
  assignedValue: 7  // The value this wild card represents
}
```

## Benefits

1. **Clarity**: All players can see what value each wild card represents
2. **Strategic Control**: Players can choose how to use their wild cards optimally
3. **Reduced Ambiguity**: No confusion about what a wild card represents in a run
4. **Better UX**: Intuitive interface for creating phases with clear feedback

## Future Enhancements

- Allow reassigning wild card values when hitting on existing phases
- Add animations to make the assignment process more engaging
- Implement auto-suggestion for optimal wild card placement 