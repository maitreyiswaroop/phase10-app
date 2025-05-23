// backend/src/gameLogic.js

// Phase 10 deck constants
const COLORS = ['red', 'yellow', 'green', 'blue'];
const NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const WILD_COUNT = 8;
const SKIP_COUNT = 4;

/**
 * Create a fresh Phase 10 deck (108 cards):
 *  - two of each number 1–12 in each color
 *  - 8 wilds
 *  - 4 skips
 */
export function createDeck() {
  const deck = [];
  let cardIdCounter = 0; // Initialize a counter for unique IDs
  for (const color of COLORS) {
    for (const num of NUMBERS) {
      deck.push({ id: cardIdCounter++, type: 'number', color, value: num });
      deck.push({ id: cardIdCounter++, type: 'number', color, value: num });
    }
  }
  // wilds
  for (let i = 0; i < WILD_COUNT; i++) {
    deck.push({ id: cardIdCounter++, type: 'wild' });
  }
  // skips
  for (let i = 0; i < SKIP_COUNT; i++) {
    deck.push({ id: cardIdCounter++, type: 'skip' });
  }
  return deck;
}

/** Fisher–Yates shuffle */
export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Deal `count` cards to each player
 * @param {Array} deck    - shuffled deck array
 * @param {Array} players - array of { socketId, username }
 * @param {number} count  - cards per player (default 10)
 */
export function deal(deck, players, count = 10) {
  const hands = {};
  for (const { socketId } of players) {
    hands[socketId] = deck.splice(0, count);
  }
  return { hands, deck };
}

// In‐memory rooms store
export const rooms = {};

// Array of phase descriptors
export const PHASES = [
  {
    description: 'Two sets of three',
    validate: cards => validateSets(cards, [3, 3])
  },
  {
    description: 'One set of three + one run of four',
    validate: cards => validateMixed(cards, { sets: [3], runs: [4] })
  },
  {
    description: 'One set of four + one run of four',
    validate: cards => validateMixed(cards, { sets: [4], runs: [4] })
  },
  {
    description: 'One run of seven',
    validate: cards => validateRuns(cards, [7])
  },
  {
    description: 'One run of eight',
    validate: cards => validateRuns(cards, [8])
  },
  {
    description: 'One run of nine',
    validate: cards => validateRuns(cards, [9])
  },
  {
    description: 'Two sets of four',
    validate: cards => validateSets(cards, [4, 4])
  },
  {
    description: 'Seven cards of one color',
    validate: cards => validateColor(cards, 7)
  },
  {
    description: 'One set of five + one set of two',
    validate: cards => validateSets(cards, [5, 2])
  },
  {
    description: 'One set of five + one set of three',
    validate: cards => validateSets(cards, [5, 3])
  }
];

/** 
 * Validates if cards can form the required sets
 * @param {Array} cards - Array of card objects
 * @param {Array} setLengths - Array of required set lengths
 * @returns {Object} Validation result with groups
 */
function validateSets(cards, setLengths) {
  // Count cards by value, accounting for wilds
  const valueCounts = {};
  let wildCount = 0;
  const assignedWilds = {};
  
  for (const card of cards) {
    if (card.type === 'wild') {
      if (card.assignedValue !== undefined) {
        // If the wild card has an assigned value, count it as that value
        assignedWilds[card.assignedValue] = (assignedWilds[card.assignedValue] || 0) + 1;
      } else {
        wildCount++;
      }
    } else if (card.type === 'number') {
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    } // Skip cards can't be used in phases
  }
  
  // Add assigned wilds to value counts
  for (const [value, count] of Object.entries(assignedWilds)) {
    valueCounts[value] = (valueCounts[value] || 0) + count;
  }
  
  // Sort values by count (descending)
  const sortedValues = Object.entries(valueCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value: parseInt(value), count }));
  
  const groups = [];
  let remainingWilds = wildCount;
  
  for (const length of setLengths) {
    // Try to find a set with required length
    let found = false;
    
    // look through actual cards for that value
    for (let i = 0; i < sortedValues.length; i++) {
      if (sortedValues[i].count === 0) continue;
      
      const needed = length - sortedValues[i].count;
      if (needed <= remainingWilds) {
        // Grab the actual card objects from the input array
        const value = sortedValues[i].value;
        
        // Get number cards of this value
        const normalCards = cards.filter(
          c => c.type === 'number' && c.value === value
        ).slice(0, Math.min(sortedValues[i].count, length));
        
        // Get wild cards already assigned to this value
        const preassignedWilds = cards.filter(
          c => c.type === 'wild' && c.assignedValue === value
        );
        
        // Calculate how many additional wilds we need
        const additionalWildsNeeded = length - normalCards.length - preassignedWilds.length;
        
        // Get unassigned wild cards
        const unassignedWilds = cards.filter(
          c => c.type === 'wild' && c.assignedValue === undefined
        ).slice(0, additionalWildsNeeded);
        
        // Combine all cards for this set
        groups.push([...normalCards, ...preassignedWilds, ...unassignedWilds]);
        sortedValues[i].count = Math.max(0, sortedValues[i].count - length);
        remainingWilds -= additionalWildsNeeded;
        found = true;
        break;
      }
    }
    
    if (!found) return { ok: false, groups: [] };
  }
  
  return { ok: true, groups };
}

/**
 * Validates if cards can form the required runs
 * @param {Array} cards - Array of card objects
 * @param {Array} runLengths - Array of required run lengths
 * @returns {Object} Validation result with groups
 */
function validateRuns(cards, runLengths) {
  // Group cards by value, accounting for wilds and assigned wilds
  const valueMap = {};
  const unassignedWilds = [];
  
  for (const card of cards) {
    if (card.type === 'wild') {
      if (card.assignedValue !== undefined) {
        // If wild has an assigned value, add it to that value's array
        if (!valueMap[card.assignedValue]) valueMap[card.assignedValue] = [];
        valueMap[card.assignedValue].push(card);
      } else {
        unassignedWilds.push(card);
      }
    } else if (card.type === 'number') {
      if (!valueMap[card.value]) valueMap[card.value] = [];
      valueMap[card.value].push(card);
    }
  }
  
  const groups = [];
  let remainingWilds = unassignedWilds.length;
  
  for (const length of runLengths) {
    let foundRun = false;
    
    // Find the longest possible run
    for (let start = 1; start <= (12 - length + 1); start++) {
      const end = start + length - 1;
      const run = [];
      const neededWilds = [];
      
      for (let i = start; i <= end; i++) {
        if (valueMap[i] && valueMap[i].length > 0) {
          run.push(valueMap[i][0]);
          valueMap[i].shift();
        } else {
          // We need a wild here
          if (remainingWilds > 0) {
            neededWilds.push({ value: i });
          } else {
            // Not enough wilds
            break;
          }
        }
      }
      
      if (run.length + neededWilds.length === length) {
        // We found a valid run
        const wildCardsToUse = unassignedWilds.slice(0, neededWilds.length);
        groups.push([...run, ...wildCardsToUse]);
        remainingWilds -= neededWilds.length;
        // Remove used wilds from the available wilds
        unassignedWilds.splice(0, neededWilds.length);
        foundRun = true;
        break;
      }
    }
    
    if (!foundRun) {
      return { ok: false, groups: [] };
    }
  }
  
  return { ok: true, groups };
}

/**
 * Validates if cards can form the required color group
 * @param {Array} cards - Array of card objects
 * @param {number} count - Required number of cards of same color
 * @returns {Object} Validation result with groups
 */
function validateColor(cards, count) {
  // Group cards by color
  const colorGroups = {
    red: [],
    blue: [],
    green: [],
    yellow: []
  };
  
  const wilds = cards.filter(c => c.type === 'wild');
  
  for (const card of cards) {
    if (card.type === 'number' && card.color) {
      colorGroups[card.color].push(card);
    }
  }
  
  // Find color with most cards
  const colorEntries = Object.entries(colorGroups);
  colorEntries.sort((a, b) => b[1].length - a[1].length);
  
  const [maxColor, colorCards] = colorEntries[0];
  
  if (colorCards.length + wilds.length >= count) {
    // We can form a valid color group
    const neededWilds = Math.min(count - colorCards.length, wilds.length);
    const allCards = [...colorCards.slice(0, count), ...wilds.slice(0, neededWilds)];
    
    return { 
      ok: true, 
      groups: [allCards] 
    };
  }
  
  return { ok: false, groups: [] };
}

/**
 * Validates mixed requirements (both sets and runs)
 * @param {Array} cards - Array of card objects
 * @param {Object} requirements - { sets: [...], runs: [...] }
 * @returns {Object} Validation result with groups
 */
function validateMixed(cards, requirements) {
  // Make a copy so we don't modify the original array
  const cardsCopy = [...cards];
  const cardsForSets = cardsCopy.filter(c => c.type !== 'skip');
  
  // First try sets
  const setResult = validateSets(cardsForSets, requirements.sets);
  if (!setResult.ok) return { ok: false, groups: [] };
  
  // Remove cards used in sets (we need to do this by reference)
  const usedInSets = new Set();
  setResult.groups.forEach(group => {
    group.forEach(card => {
      const index = cardsCopy.findIndex(c => c === card);
      if (index !== -1) {
        usedInSets.add(index);
      }
    });
  });
  
  const remainingCards = cardsCopy.filter((_, i) => !usedInSets.has(i));
  
  // Then try runs with remaining cards
  const runResult = validateRuns(remainingCards, requirements.runs);
  if (!runResult.ok) return { ok: false, groups: [] };
  
  return { 
    ok: true, 
    groups: [...setResult.groups, ...runResult.groups] 
  };
}

/**
 * Validates a phase with explicitly assigned wild card values
 * @param {number} phaseIndex - The phase index (0-9)
 * @param {Array} cardGroups - Array of card groups, each representing a set, run, or color group
 * @returns {Object} Validation result with groups
 */
export function validatePhaseWithAssignedWilds(phaseIndex, cardGroups) {
  if (phaseIndex < 0 || phaseIndex >= PHASES.length) {
    return { ok: false, groups: [] };
  }
  
  // Flatten all cards for validation
  const allCards = cardGroups.flat();
  
  // Use the standard validation function
  return PHASES[phaseIndex].validate(allCards);
}

/**
 * Determines the appropriate value for a wild card in a set
 * @param {Array} group - The existing cards in the set
 * @returns {number|null} The value for the wild card, or null if cannot be determined
 */
function determineWildValueForSet(group) {
  // Find the first non-wild card to get the set value
  const numberCard = group.find(c => c.type === 'number');
  return numberCard ? numberCard.value : null;
}

/**
 * Determines possible values for a wild card in a run
 * @param {Array} group - The existing cards in the run
 * @returns {Array<number>} Array of possible values for the wild card
 */
function determineWildValuesForRun(group) {
  // Sort cards by value, considering assigned wilds
  const sortedCards = group
    .filter(c => c.type === 'number' || (c.type === 'wild' && c.assignedValue !== undefined))
    .sort((a, b) => {
      const valA = a.type === 'wild' ? a.assignedValue : a.value;
      const valB = b.type === 'wild' ? b.assignedValue : b.value;
      return valA - valB;
    });

  if (sortedCards.length === 0) return [];
  
  const possibleValues = new Set();
  
  // Check each gap in the sequence
  let prevValue = sortedCards[0].type === 'wild' ? sortedCards[0].assignedValue : sortedCards[0].value;
  for (let i = 1; i < sortedCards.length; i++) {
    const currentCard = sortedCards[i];
    const currentValue = currentCard.type === 'wild' ? currentCard.assignedValue : currentCard.value;
    
    // If there's a gap bigger than 1, any number in between could be valid
    if (currentValue - prevValue > 1) {
      for (let val = prevValue + 1; val < currentValue; val++) {
        if (val >= 1 && val <= 12) {  // Ensure value is within valid range
          possibleValues.add(val);
        }
      }
    }
    prevValue = currentValue;
  }
  
  // Check if wild could go at the start
  const firstValue = sortedCards[0].type === 'wild' ? sortedCards[0].assignedValue : sortedCards[0].value;
  if (firstValue > 1) {
    possibleValues.add(firstValue - 1);
  }
  
  // Check if wild could go at the end
  const lastValue = sortedCards[sortedCards.length - 1].type === 'wild' ? 
    sortedCards[sortedCards.length - 1].assignedValue : 
    sortedCards[sortedCards.length - 1].value;
  if (lastValue < 12) {
    possibleValues.add(lastValue + 1);
  }

  return Array.from(possibleValues).sort((a, b) => a - b);
}

/**
 * Validates if a card can be added to an existing meld
 * @param {number} phaseIndex - The phase index
 * @param {Array} existingGroup - The existing cards in the meld
 * @param {Object} newCard - The card to add
 * @returns {Object} { ok: boolean, possibleValues?: number[], assignedValue?: number }
 */
export function validateHit(phaseIndex, existingGroup, newCard) {
    // For sets (all cards have same value)
    if (existingGroup.every(c => c.type === 'wild' || 
                               (c.type === 'number' && existingGroup[0].type === 'number' && 
                                c.value === existingGroup[0].value))) {
      // New card must be wild or match the set value
      if (newCard.type === 'wild') {
        const setValue = determineWildValueForSet(existingGroup);
        return { ok: true, assignedValue: setValue };
      }
      return { 
        ok: newCard.type === 'number' && 
            existingGroup[0].type === 'number' &&
            newCard.value === existingGroup[0].value 
      };
    }
    
    // For runs (sequential values)
    if (existingGroup.some(c => c.type === 'number')) {
      if (newCard.type === 'wild') {
        const possibleValues = determineWildValuesForRun(existingGroup);
        if (possibleValues.length === 0) return { ok: false };
        if (possibleValues.length === 1) {
          return { ok: true, assignedValue: possibleValues[0] };
        }
        return { ok: true, possibleValues };
      }
      // For number cards, just check if it makes a valid run
      const newGroup = [...existingGroup, newCard];
      const { ok } = validateRuns(newGroup, [newGroup.length]);
      return { ok };
    }
    
    // For color groups (Phase 8)
    if (phaseIndex === 7) {
      const groupColor = existingGroup.find(c => c.type === 'number')?.color;
      return { 
        ok: newCard.type === 'wild' ||
            (newCard.type === 'number' && newCard.color === groupColor)
      };
    }
    
    return { ok: false };
}

/** Returns { ok: boolean, groups: [...] } */
export function validatePhase(phaseIndex, cardArray) {
  if (phaseIndex < 0 || phaseIndex >= PHASES.length) {
    return { ok: false, groups: [] };
  }
  return PHASES[phaseIndex].validate(cardArray);
}