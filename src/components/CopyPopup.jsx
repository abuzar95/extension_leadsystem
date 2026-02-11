import React, { useEffect, useState } from 'react';
import { useProspect } from '../context/ProspectContext';
import { detectField, getAllFields, getFieldLabel } from '../utils/copyDetector';
import { FieldIcons, X, Sparkles } from './icons';

const CopyPopup = ({ text, onSelect, onClose }) => {
  const { pasteToField, activeProspect, startNewProspect } = useProspect();
  const [detectedField, setDetectedField] = useState(null);
  const allFields = getAllFields();

  useEffect(() => {
    const detected = detectField(text);
    setDetectedField(detected);
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [text, onClose]);

  const handleFieldSelect = (field) => {
    if (!activeProspect) {
      startNewProspect();
      setTimeout(() => pasteToField(field, text), 100);
    } else {
      pasteToField(field, text);
    }
    onSelect(field);
  };

  return (
    <div className="fixed right-5 left-auto top-[100px] z-[2147483647] w-[320px] max-w-[calc(100vw-40px)] overflow-hidden rounded-xl bg-white border border-slate-200 shadow-lg animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <h3 className="text-sm font-bold text-slate-800">Paste as</h3>
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
              onClick={() => handleFieldSelect(detectedField)}
              className="w-full flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 py-3 px-4 text-left text-sm font-medium text-primary-800 hover:bg-primary-100 transition-colors"
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
              return (
                <button
                  key={field.value}
                  type="button"
                  onClick={() => handleFieldSelect(field.value)}
                  className={`flex items-center gap-2 rounded-lg border py-2.5 px-3 text-left text-sm font-medium transition-colors ${
                    isSuggested
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
