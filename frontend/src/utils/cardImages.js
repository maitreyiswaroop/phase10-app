// frontend/src/utils/cardImages.js
/**
 * Given a card object, returns the correct SVG path from /public/images/…
 */
export function cardImageUrl(card) {
    const folder = 'uno-cards-svg';
  
    if (card.type === 'number' && card.color != null && card.value != null) {
      // e.g. "/images/UNO Cards SVG/Blue- 5.svg"
      return `/images/${folder}/${capitalize(card.color)}- ${card.value}.svg`;
    }
  
    if (card.type === 'skip') {
      // skip cards in your deck have no color, so use the generic Skip image
      return `/images/${folder}/Skip-1.svg`;
    }
  
    if (card.type === 'wild') {
      return `/images/${folder}/Wild-1.svg`;
    }
  
    return ''; // no image
  }
  
  function capitalize(str) {
    if (typeof str !== 'string' || str.length === 0) {
      return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  