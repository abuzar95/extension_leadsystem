import React, { useState, useEffect } from 'react';
import { ProspectProvider, useProspect } from './context/ProspectContext';
import OverlayPanel from './components/OverlayPanel';
import CopyPopup from './components/CopyPopup';
import LoginScreen from './components/LoginScreen';
import './styles/main.css';

function ProspectPasteListener() {
  const { pasteToField } = useProspect();
  useEffect(() => {
    function applyPaste(field, text) {
      if (field && text != null) pasteToField(field, typeof text === 'string' ? text : String(text));
    }
    function onStorageChange(changes, areaName) {
      if (areaName !== 'local' || !changes.prospectPaste) return;
      var v = changes.prospectPaste.newValue;
      if (v && v.field) {
        applyPaste(v.field, v.text);
        chrome.storage.local.remove('prospectPaste').catch(function () {});
      }
    }
    function onMessage(e) {
      if (e.data?.type === 'PROSPECT_PASTE_TO_FIELD' && e.data.field != null) {
        applyPaste(e.data.field, e.data.text);
      }
    }
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChange);
    }
    window.addEventListener('message', onMessage);
    return function () {
      if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(onStorageChange);
      }
      window.removeEventListener('message', onMessage);
    };
  }, [pasteToField]);
  return null;
}

function App() {
  const [showOverlay, setShowOverlay] = useState(true);
  const [copiedText, setCopiedText] = useState(null);
  const [copyPosition, setCopyPosition] = useState({ x: 0, y: 0 });
  const [showCopyPopup, setShowCopyPopup] = useState(false);

  // Notify parent (content script) when iframe is ready so it can resend last copy
  useEffect(() => {
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'PROSPECT_IFRAME_READY' }, '*');
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window && event.source !== window.parent) return;
      if (event.data?.type === 'PROSPECT_COPY' && event.data.text) {
        setCopiedText(event.data.text);
        setCopyPosition({
          x: 20,
          y: 100
        });
        setShowCopyPopup(true);
      }
      if (event.data?.type === 'PROSPECT_TOGGLE_OVERLAY') {
        setShowOverlay((v) => !v);
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
          setShowOverlay((v) => !v);
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

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCaptureSelection = () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (res) => {
        if (res?.text) {
          setCopiedText(res.text);
          setCopyPosition({ x: 20, y: 100 });
          setShowCopyPopup(true);
        }
      });
    });
  };

  return (
    <ProspectProvider>
      <AppContent
        showOverlay={showOverlay}
        handleCaptureSelection={handleCaptureSelection}
        showCopyPopup={showCopyPopup}
        copiedText={copiedText}
        copyPosition={copyPosition}
        setShowCopyPopup={setShowCopyPopup}
        setCopiedText={setCopiedText}
      />
    </ProspectProvider>
  );
}

function AppContent({
  showOverlay,
  handleCaptureSelection,
  showCopyPopup,
  copiedText,
  copyPosition,
  setShowCopyPopup,
  setCopiedText,
}) {
  const { authUser, authLoading, login } = useProspect();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <>
      <ProspectPasteListener />
      {showOverlay && <OverlayPanel onRequestCaptureSelection={handleCaptureSelection} />}
      {showCopyPopup && copiedText && (
        <CopyPopup
          text={copiedText}
          position={copyPosition}
          onSelect={() => {
            setShowCopyPopup(false);
            setCopiedText(null);
          }}
          onClose={() => {
            setShowCopyPopup(false);
            setCopiedText(null);
          }}
        />
      )}
    </>
  );
}

export default App;
