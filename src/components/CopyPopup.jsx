import React, { useEffect, useState } from 'react';
import { useProspect } from '../context/ProspectContext';
import { detectField, getAllFields, getFieldLabel } from '../utils/copyDetector';
import './CopyPopup.css';

const CopyPopup = ({ text, position, onSelect, onClose }) => {
  const { pasteToField, activeProspect, startNewProspect } = useProspect();
  const [detectedField, setDetectedField] = useState(null);
  const allFields = getAllFields();

  useEffect(() => {
    // Auto-detect field
    const detected = detectField(text);
    setDetectedField(detected);

    // Auto-close after 5 seconds if no interaction
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [text, onClose]);

  const handleFieldSelect = (field) => {
    // Ensure we have an active prospect
    if (!activeProspect) {
      startNewProspect();
      // Wait a bit for state to update
      setTimeout(() => {
        pasteToField(field, text);
      }, 100);
    } else {
      pasteToField(field, text);
    }
    
    onSelect(field);
  };

  return (
    <div 
      className="copy-popup"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      <div className="copy-popup-header">
        <span className="copy-popup-title">Paste as:</span>
        <button className="copy-popup-close" onClick={onClose}>×</button>
      </div>
      <div className="copy-popup-text">{text.substring(0, 50)}{text.length > 50 ? '...' : ''}</div>
      <div className="copy-popup-fields">
        {detectedField && (
          <div className="copy-popup-section">
            <div className="copy-popup-section-title">Suggested</div>
            <button
              className="copy-popup-field suggested"
              onClick={() => handleFieldSelect(detectedField)}
            >
              <span className="copy-popup-field-icon">
                {allFields.find(f => f.value === detectedField)?.icon || '✨'}
              </span>
              <span className="copy-popup-field-label">
                {getFieldLabel(detectedField)}
              </span>
            </button>
          </div>
        )}
        <div className="copy-popup-section">
          <div className="copy-popup-section-title">
            {detectedField ? 'All Fields' : 'Select Field'}
          </div>
          <div className="copy-popup-fields-grid">
            {allFields.map((field) => (
              <button
                key={field.value}
                className={`copy-popup-field ${detectedField === field.value ? 'suggested' : ''}`}
                onClick={() => handleFieldSelect(field.value)}
              >
                <span className="copy-popup-field-icon">{field.icon}</span>
                <span className="copy-popup-field-label">{field.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopyPopup;
