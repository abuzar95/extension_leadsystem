import React, { useState, useEffect } from 'react';
import { ProspectProvider } from './context/ProspectContext';
import OverlayPanel from './components/OverlayPanel';
import CopyPopup from './components/CopyPopup';
import './styles/main.css';

function App() {
  const [showOverlay, setShowOverlay] = useState(true);
  const [copiedText, setCopiedText] = useState(null);
  const [copyPosition, setCopyPosition] = useState({ x: 0, y: 0 });
  const [showCopyPopup, setShowCopyPopup] = useState(false);

  useEffect(() => {
    // Listen for postMessage from content script
    const handleMessage = (event) => {
      if (event.data.type === 'PROSPECT_COPY' && event.data.text) {
        setCopiedText(event.data.text);
        setCopyPosition({
          x: event.data.x || window.innerWidth / 2,
          y: event.data.y || 100
        });
        setShowCopyPopup(true);
      }
      
      if (event.data.type === 'PROSPECT_TOGGLE_OVERLAY') {
        setShowOverlay(!showOverlay);
      }
    };

    window.addEventListener('message', handleMessage);

    // Also listen via chrome.runtime messages
    if (chrome.runtime && chrome.runtime.onMessage) {
      const messageListener = (request, sender, sendResponse) => {
        if (request.action === 'textCopied' && request.text) {
          setCopiedText(request.text);
          setCopyPosition({
            x: request.x || window.innerWidth / 2,
            y: request.y || 100
          });
          setShowCopyPopup(true);
          sendResponse({ success: true });
        }
        if (request.action === 'toggleOverlay') {
          setShowOverlay(!showOverlay);
          sendResponse({ success: true });
        }
        return true;
      };

      chrome.runtime.onMessage.addListener(messageListener);

      return () => {
        window.removeEventListener('message', handleMessage);
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [showOverlay]);

  return (
    <ProspectProvider>
      {showOverlay && <OverlayPanel />}
      {showCopyPopup && copiedText && (
        <CopyPopup
          text={copiedText}
          position={copyPosition}
          onSelect={(field) => {
            // Handle field selection - will be implemented in context
            setShowCopyPopup(false);
            setCopiedText(null);
          }}
          onClose={() => {
            setShowCopyPopup(false);
            setCopiedText(null);
          }}
        />
      )}
    </ProspectProvider>
  );
}

export default App;
