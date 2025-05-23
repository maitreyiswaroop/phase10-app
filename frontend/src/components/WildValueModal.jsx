import React from 'react';

export default function WildValueModal({ 
  possibleValues, 
  onSelect, 
  onCancel 
}) {
  if (!possibleValues?.length) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h2>Choose Wild Card Value</h2>
        <p>Select a value for your wild card:</p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
          gap: '0.5rem',
          marginTop: '1rem',
          marginBottom: '1rem'
        }}>
          {possibleValues.map(value => (
            <button
              key={value}
              onClick={() => onSelect(value)}
              style={{
                padding: '0.5rem',
                fontSize: '1.2rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#f0f0f0',
                cursor: 'pointer'
              }}
            >
              {value}
            </button>
          ))}
        </div>
        
        <button
          onClick={onCancel}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#e0e0e0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
} 