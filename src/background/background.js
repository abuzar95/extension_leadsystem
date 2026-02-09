// Background service worker
console.log('Prospect Management Extension background loaded');

// Store overlay state per tab
const overlayStates = new Map();

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Listen for tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Inject content script
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch(() => {
      // Script might already be injected
    });
  }
});

// Listen for extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const tabId = tab.id;
    const isVisible = overlayStates.get(tabId) || false;
    
    // Toggle state
    overlayStates.set(tabId, !isVisible);
    
    // Send toggle message
    chrome.tabs.sendMessage(tabId, { action: 'toggleOverlay' }).catch(() => {
      // Content script might not be ready, inject it
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      }).then(() => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'toggleOverlay' });
        }, 200);
      });
    });
  } catch (error) {
    console.error('Error toggling overlay:', error);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'overlayStateChanged') {
    overlayStates.set(sender.tab.id, request.visible);
    sendResponse({ success: true });
  }
  
  if (request.action === 'textCopied') {
    // Forward copy event to content script
    chrome.tabs.sendMessage(sender.tab.id, {
      action: 'textCopied',
      text: request.text,
      x: request.x,
      y: request.y
    });
    sendResponse({ success: true });
  }
  
  return true;
});
