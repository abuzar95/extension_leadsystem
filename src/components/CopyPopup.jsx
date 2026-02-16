import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useProspect } from '../context/ProspectContext';
import { detectField, getAllFields, getFieldLabel } from '../utils/copyDetector';
import { FieldIcons, X, Sparkles } from './icons';

const CopyPopup = ({ text, onSelect, onClose }) => {
  const { pasteToField, activeProspect, startNewProspect } = useProspect();
  const [detectedField, setDetectedField] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(0); // start on first item
  const containerRef = useRef(null);
  const allFields = getAllFields();

  useEffect(() => {
    const detected = detectField(text);
    setDetectedField(detected);
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [text, onClose]);

  // Build a flat ordered list of selectable field values:
  // [suggested (if any), ...all fields in grid order]
  const selectableFields = useMemo(() => {
    const list = [];
    if (detectedField) list.push(detectedField);
    allFields.forEach((f) => list.push(f.value));
    return list;
  }, [detectedField, allFields]);

  const handleFieldSelect = useCallback((field) => {
    if (!activeProspect) {
      startNewProspect();
      setTimeout(() => pasteToField(field, text), 100);
    } else {
      pasteToField(field, text);
    }
    onSelect(field);
  }, [activeProspect, startNewProspect, pasteToField, text, onSelect]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      const total = selectableFields.length;
      if (!total) return;

      // Grid is 2 columns; suggested is full-width (1 item per row)
      const suggestedCount = detectedField ? 1 : 0;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) => {
          if (prev < suggestedCount) {
            // From suggested → first grid row
            return Math.min(suggestedCount, total - 1);
          }
          // In grid: move down = +2 (next row)
          const next = prev + 2;
          return next < total ? next : prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) => {
          if (prev <= suggestedCount) {
            // At first grid row or suggested → go to suggested (or stay)
            return 0;
          }
          // In grid: move up = -2 (prev row)
          const next = prev - 2;
          return next >= suggestedCount ? next : (suggestedCount > 0 ? 0 : prev);
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) => {
          if (prev < suggestedCount) return prev; // suggested is full-width
          const next = prev + 1;
          return next < total ? next : prev;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) => {
          if (prev <= suggestedCount) return prev < suggestedCount ? prev : (suggestedCount > 0 ? 0 : prev);
          const next = prev - 1;
          return next >= suggestedCount ? next : prev;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIndex >= 0 && focusedIndex < total) {
          handleFieldSelect(selectableFields[focusedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [selectableFields, focusedIndex, detectedField, handleFieldSelect, onClose]);

  // Scroll focused item into view
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-field-idx="${focusedIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex]);

  // Reset focus when popup opens
  useEffect(() => {
    setFocusedIndex(0);
  }, [text]);

  // Index tracker for grid items (offset by suggestedCount)
  let gridIdx = detectedField ? 1 : 0;

  return (
    <div ref={containerRef} className="fixed right-5 left-auto top-[100px] z-[2147483647] w-[320px] max-w-[calc(100vw-40px)] overflow-hidden rounded-xl bg-white border border-slate-200 shadow-lg animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">Paste as</h3>
          <span className="text-[10px] text-slate-400 font-medium">↑↓←→ navigate · Enter select · Esc close</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Preview - like a read-only field */}
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-medium text-slate-500 mb-1.5">Copied text</p>
        <p className="text-sm text-slate-700 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 truncate" title={text}>
          {text.length > 48 ? `${text.substring(0, 48)}…` : text}
        </p>
      </div>

      {/* Fields */}
      <div className="p-4 max-h-[320px] overflow-y-auto scroll-thin space-y-4">
        {detectedField && (
          <div>
            <p className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" strokeWidth={2} />
              Suggested
            </p>
            <button
              type="button"
              data-field-idx={0}
              onClick={() => handleFieldSelect(detectedField)}
              className={`w-full flex items-center gap-3 rounded-lg border py-3 px-4 text-left text-sm font-medium transition-colors ${
                focusedIndex === 0
                  ? 'border-primary-500 bg-primary-100 text-primary-900 ring-2 ring-primary-400'
                  : 'border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100'
              }`}
            >
              {React.createElement(FieldIcons[detectedField] || Sparkles, {
                className: 'w-4 h-4 flex-shrink-0 text-primary-600',
                strokeWidth: 2,
              })}
              {getFieldLabel(detectedField)}
            </button>
          </div>
        )}

        <div>
          <p className="text-sm font-bold text-slate-800 mb-2">
            {detectedField ? 'All fields' : 'Select field'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {allFields.map((field) => {
              const Icon = FieldIcons[field.value];
              const isSuggested = detectedField === field.value;
              const idx = gridIdx++;
              const isFocused = focusedIndex === idx;
              return (
                <button
                  key={field.value}
                  type="button"
                  data-field-idx={idx}
                  onClick={() => handleFieldSelect(field.value)}
                  className={`flex items-center gap-2 rounded-lg border py-2.5 px-3 text-left text-sm font-medium transition-colors ${
                    isFocused
                      ? 'border-primary-500 bg-primary-100 text-primary-900 ring-2 ring-primary-400'
                      : isSuggested
                        ? 'border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {Icon ? (
                    <Icon className="w-4 h-4 flex-shrink-0 text-slate-500" strokeWidth={2} />
                  ) : (
                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className="truncate">{field.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopyPopup;
