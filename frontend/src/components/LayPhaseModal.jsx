import React, { useState, useEffect } from 'react';
import { cardImageUrl } from '../utils/cardImages.js';

// Same phase descriptions as in PhaseDisplay
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

export default function LayPhaseModal({ 
  show, 
  onClose, 
  phaseIndex, 
  hand, 
  onLayPhase 
}) {
  // State for the groups of cards
  const [groups, setGroups] = useState([]);
  // State for the selected card from hand
  const [selectedCard, setSelectedCard] = useState(null);
  // State for tracking wild card assignments
  const [wildAssignments, setWildAssignments] = useState({});
  // State for tracking which wild card is being assigned
  const [assigningWildId, setAssigningWildId] = useState(null);

  // Initialize groups based on phase requirements
  useEffect(() => {
    if (!show) return;
    
    // Reset state when modal opens
    setGroups([]);
    setSelectedCard(null);
    setWildAssignments({});
    setAssigningWildId(null);
    
    // Create empty groups based on phase requirements
    let newGroups = [];
    
    switch (phaseIndex) {
      case 0: // Two sets of three
        newGroups = [[], []];
        break;
      case 1: // One set of three + one run of four
        newGroups = [[], []];
        break;
      case 2: // One set of four + one run of four
        newGroups = [[], []];
        break;
      case 3: // One run of seven
      case 4: // One run of eight
      case 5: // One run of nine
        newGroups = [[]];
        break;
      case 6: // Two sets of four
        newGroups = [[], []];
        break;
      case 7: // Seven cards of one color
        newGroups = [[]];
        break;
      case 8: // One set of five + one set of two
      case 9: // One set of five + one set of three
        newGroups = [[], []];
        break;
      default:
        newGroups = [[]];
    }
    
    setGroups(newGroups);
  }, [show, phaseIndex]);

  // Get the requirements for the current phase
  const getPhaseRequirements = () => {
    switch (phaseIndex) {
      case 0: return ["Set of 3", "Set of 3"];
      case 1: return ["Set of 3", "Run of 4"];
      case 2: return ["Set of 4", "Run of 4"];
      case 3: return ["Run of 7"];
      case 4: return ["Run of 8"];
      case 5: return ["Run of 9"];
      case 6: return ["Set of 4", "Set of 4"];
      case 7: return ["7 cards of one color"];
      case 8: return ["Set of 5", "Set of 2"];
      case 9: return ["Set of 5", "Set of 3"];
      default: return ["Unknown"];
    }
  };

  // Handle card selection from hand
  const handleCardSelect = (card) => {
    setSelectedCard(card);
  };

  // Handle placing a card into a group
  const handlePlaceCard = (groupIndex) => {
    if (!selectedCard) return;
    
    // Add the card to the specified group
    const newGroups = [...groups];
    newGroups[groupIndex] = [...newGroups[groupIndex], selectedCard];
    setGroups(newGroups);
    
    // If it's a wild card, prompt for value assignment
    if (selectedCard.type === 'wild') {
      setAssigningWildId(selectedCard.id);
    }
    
    // Clear the selected card
    setSelectedCard(null);
  };

  // Handle removing a card from a group
  const handleRemoveCard = (groupIndex, cardIndex) => {
    const newGroups = [...groups];
    const removedCard = newGroups[groupIndex][cardIndex];
    newGroups[groupIndex].splice(cardIndex, 1);
    setGroups(newGroups);
    
    // If it was a wild card, remove its assignment
    if (removedCard.type === 'wild') {
      const newWildAssignments = {...wildAssignments};
      delete newWildAssignments[removedCard.id];
      setWildAssignments(newWildAssignments);
    }
  };

  // Handle wild card value assignment
  const handleWildAssignment = (wildId, value) => {
    setWildAssignments({
      ...wildAssignments,
      [wildId]: value
    });
    setAssigningWildId(null);
  };

  // Get possible values for a wild card based on its group context
  const getWildOptions = (groupIndex) => {
    const groupCards = groups[groupIndex].filter(card => card.type === 'number');
    const requirements = getPhaseRequirements()[groupIndex];
    
    // For sets
    if (requirements.startsWith("Set")) {
      // If there are number cards in the set, wild should be the same value
      if (groupCards.length > 0) {
        return [groupCards[0].value];
      }
      // Otherwise, allow any value 1-12
      return Array.from({ length: 12 }, (_, i) => i + 1);
    }
    
    // For runs
    if (requirements.startsWith("Run")) {
      if (groupCards.length === 0) {
        // If no cards yet, allow any value 1-12
        return Array.from({ length: 12 }, (_, i) => i + 1);
      }
      
      // Find min and max values in the current run
      const values = groupCards.map(card => card.value).sort((a, b) => a - b);
      const min = values[0];
      const max = values[values.length - 1];
      
      // Possible options: values before min and after max
      const options = [];
      if (min > 1) options.push(min - 1);
      if (max < 12) options.push(max + 1);
      
      // Also check for gaps in the run
      for (let i = 1; i < values.length; i++) {
        if (values[i] - values[i-1] > 1) {
          for (let j = values[i-1] + 1; j < values[i]; j++) {
            options.push(j);
          }
        }
      }
      
      return options.sort((a, b) => a - b);
    }
    
    // For color groups (Phase 8)
    if (requirements.includes("color")) {
      // Wild cards don't need a value assignment for color groups
      return [];
    }
    
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  // Check if all groups meet their requirements
  const isPhaseComplete = () => {
    const requirements = getPhaseRequirements();
    
    // Check if each group has the right number of cards
    for (let i = 0; i < groups.length; i++) {
      const req = requirements[i];
      const count = parseInt(req.match(/\d+/)[0], 10);
      
      if (groups[i].length !== count) {
        return false;
      }
      
      // Check if all wilds have assignments (except for color groups)
      const wilds = groups[i].filter(card => card.type === 'wild');
      if (!req.includes("color") && wilds.some(wild => wildAssignments[wild.id] === undefined)) {
        return false;
      }
    }
    
    return true;
  };

  // Handle submission of the phase
  const handleSubmit = () => {
    // Prepare cards with wild assignments
    const cardsWithAssignments = groups.flat().map(card => {
      if (card.type === 'wild' && wildAssignments[card.id] !== undefined) {
        return {
          ...card,
          assignedValue: wildAssignments[card.id]
        };
      }
      return card;
    });
    
    onLayPhase(cardsWithAssignments, groups);
    onClose();
  };

  // Get the remaining cards in hand (not placed in any group)
  const getRemainingHand = () => {
    const placedCardIds = new Set(groups.flat().map(card => card.id));
    return hand.filter(card => !placedCardIds.has(card.id));
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'var(--color-background)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-lg)',
        maxWidth: '90%',
        width: '800px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h2>Lay Phase {phaseIndex + 1}: {PHASE_DESCRIPTIONS[phaseIndex]}</h2>
        
        {/* Phase Groups */}
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3>Phase Requirements</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${groups.length}, 1fr)`,
            gap: 'var(--spacing-md)'
          }}>
            {groups.map((group, groupIndex) => (
              <div key={groupIndex} style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-surface)'
              }}>
                <h4>{getPhaseRequirements()[groupIndex]}</h4>
                <div style={{ 
                  minHeight: '120px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--spacing-sm)'
                }}>
                  {group.map((card, cardIndex) => (
                    <div key={cardIndex} style={{ position: 'relative' }}>
                      <img
                        src={cardImageUrl(card)}
                        alt={card.type === 'number' ? `${card.color} ${card.value}` : card.type}
                        style={{ 
                          width: 60,
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      />
                      {card.type === 'wild' && wildAssignments[card.id] !== undefined && (
                        <div style={{
                          position: 'absolute',
                          bottom: '5px',
                          right: '5px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          border: '1px solid black'
                        }}>
                          {wildAssignments[card.id]}
                        </div>
                      )}
                      <button
                        onClick={() => handleRemoveCard(groupIndex, cardIndex)}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-error)',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {group.length < parseInt(getPhaseRequirements()[groupIndex].match(/\d+/)[0], 10) && (
                    <button
                      onClick={() => handlePlaceCard(groupIndex)}
                      disabled={!selectedCard}
                      style={{
                        width: 60,
                        height: 90,
                        border: '1px dashed var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: selectedCard ? 'var(--color-surface-hover)' : 'transparent',
                        cursor: selectedCard ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Wild Card Value Assignment */}
        {assigningWildId && (
          <div style={{
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-primary)'
          }}>
            <h4>Assign Value to Wild Card</h4>
            <div style={{ 
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--spacing-sm)',
              justifyContent: 'center'
            }}>
              {/* Find which group contains this wild */}
              {groups.map((group, groupIndex) => {
                const containsWild = group.some(card => card.id === assigningWildId);
                if (!containsWild) return null;
                
                const options = getWildOptions(groupIndex);
                return options.map(value => (
                  <button
                    key={value}
                    onClick={() => handleWildAssignment(assigningWildId, value)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      cursor: 'pointer'
                    }}
                  >
                    {value}
                  </button>
                ));
              })}
            </div>
          </div>
        )}
        
        {/* Remaining Hand */}
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <h3>Your Hand</h3>
          <div style={{ 
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-sm)'
          }}>
            {getRemainingHand().map((card) => (
              <img
                key={card.id}
                src={cardImageUrl(card)}
                alt={card.type === 'number' ? `${card.color} ${card.value}` : card.type}
                onClick={() => handleCardSelect(card)}
                style={{ 
                  width: 80,
                  border: selectedCard?.id === card.id ? '3px solid var(--color-primary)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transform: selectedCard?.id === card.id ? 'translateY(-10px)' : 'none',
                  transition: '0.2s'
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div style={{ 
          marginTop: 'var(--spacing-lg)',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <button onClick={onClose}>Cancel</button>
          <button 
            onClick={handleSubmit}
            disabled={!isPhaseComplete()}
            style={{
              backgroundColor: isPhaseComplete() ? 'var(--color-primary)' : 'var(--color-disabled)',
              color: 'white',
              cursor: isPhaseComplete() ? 'pointer' : 'not-allowed'
            }}
          >
            Lay Phase
          </button>
        </div>
      </div>
    </div>
  );
} 