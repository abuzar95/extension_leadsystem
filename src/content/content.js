// Content script - injects React app and handles copy detection

// Inject React app
(function() {
  // Check if already injected
  if (document.getElementById('prospect-extension-root')) {
    return;
  }

  // Create script element to load React app
  const script = document.createElement('script');
  script.type = 'module';
  script.src = chrome.runtime.getURL('main.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // Inject CSS (if needed, but we'll use inline styles in React)
  // CSS will be bundled with the React app
})();

// Copy detection
let lastCopiedText = '';

document.addEventListener('copy', async (e) => {
  try {
    const selection = window.getSelection().toString() || document.getSelection().toString();
    if (selection && selection.trim() && selection !== lastCopiedText) {
      lastCopiedText = selection.trim();
      
      // Get cursor position
      const x = e.clientX || window.innerWidth / 2;
      const y = e.clientY || 100;
      
      // Send to React app
      window.postMessage({
        type: 'PROSPECT_COPY',
        text: lastCopiedText,
        x,
        y
      }, '*');
      
      // Also try clipboard API
      setTimeout(async () => {
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText && clipboardText.trim() && clipboardText !== lastCopiedText) {
            lastCopiedText = clipboardText.trim();
            window.postMessage({
              type: 'PROSPECT_COPY',
              text: lastCopiedText,
              x: window.innerWidth / 2,
              y: 100
            }, '*');
          }
        } catch (err) {
          // Clipboard API might not be available
        }
      }, 100);
    }
  } catch (error) {
    console.error('Error detecting copy:', error);
  }
});

// Listen for paste events
document.addEventListener('paste', async (e) => {
  try {
    const clipboardText = await navigator.clipboard.readText();
    if (clipboardText && clipboardText.trim() && clipboardText !== lastCopiedText) {
      lastCopiedText = clipboardText.trim();
      window.postMessage({
        type: 'PROSPECT_COPY',
        text: lastCopiedText,
        x: window.innerWidth / 2,
        y: 100
      }, '*');
    }
  } catch (err) {
    // Clipboard API might not be available
  }
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleOverlay') {
    window.postMessage({ type: 'PROSPECT_TOGGLE_OVERLAY' }, '*');
    sendResponse({ success: true });
  }
  
  if (request.action === 'textCopied') {
    window.postMessage({
      type: 'PROSPECT_COPY',
      text: request.text,
      x: request.x,
      y: request.y
    }, '*');
    sendResponse({ success: true });
  }
  
  return true;
});
