// Content script - injects React app via iframe and handles copy detection.
// IIFE + top-frame only to avoid "Identifier already declared" in subframes.
(function () {
  'use strict';
  if (window !== window.top) return;

  let extensionFrame = null;
  let collapseTab = null;
  let lastCopiedText = '';
  let lastCopyPosition = { x: 200, y: 100 };

  var expandIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';

  function setCollapsedState(collapsed) {
    if (!extensionFrame) return;
    if (collapsed) {
      extensionFrame.style.width = '0';
      extensionFrame.style.height = '0';
      extensionFrame.style.overflow = 'hidden';
      extensionFrame.style.pointerEvents = 'none';
      if (collapseTab) {
        collapseTab.style.display = 'flex';
      }
    } else {
      extensionFrame.style.width = '420px';
      extensionFrame.style.height = '100%';
      extensionFrame.style.overflow = '';
      extensionFrame.style.pointerEvents = 'auto';
      if (collapseTab) {
        collapseTab.style.display = 'none';
      }
    }
  }

  function onExpandClick() {
    setCollapsedState(false);
    if (extensionFrame && extensionFrame.contentWindow) {
      try {
        extensionFrame.contentWindow.postMessage({ type: 'PROSPECT_EXPAND' }, '*');
      } catch (err) {}
    }
  }

  function injectExtensionUI() {
    if (document.getElementById('prospect-extension-iframe')) return;
    var iframe = document.createElement('iframe');
    iframe.id = 'prospect-extension-iframe';
    iframe.src = chrome.runtime.getURL('index.html');
    iframe.style.cssText = 'position:fixed;top:0;right:0;left:auto;width:420px;height:100%;border:none;z-index:2147483646;pointer-events:auto;transition:width 0.3s ease-out, height 0.3s ease-out;';
    (document.body || document.documentElement).appendChild(iframe);
    extensionFrame = iframe;

    var tab = document.createElement('div');
    tab.id = 'prospect-extension-collapse-tab';
    tab.style.cssText = 'display:none;position:fixed;top:0;right:0;left:auto;width:72px;height:72px;z-index:2147483646;align-items:center;justify-content:center;background:transparent;pointer-events:auto;';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Expand Prospect Manager';
    btn.style.cssText = 'width:48px;height:48px;border:none;border-radius:12px;background:rgba(79,70,229,0.85);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.25);pointer-events:auto;';
    btn.innerHTML = expandIconSvg;
    btn.addEventListener('click', onExpandClick);
    tab.appendChild(btn);
    (document.body || document.documentElement).appendChild(tab);
    collapseTab = tab;
  }

  if (document.body) {
    injectExtensionUI();
  } else {
    document.addEventListener('DOMContentLoaded', injectExtensionUI);
  }

  function sendCopyToUI(text, x, y) {
    if (!text || !String(text).trim()) return;
    lastCopiedText = String(text).trim();
    lastCopyPosition = { x: x || 200, y: y || 100 };
    var payload = { type: 'PROSPECT_COPY', text: lastCopiedText, x: lastCopyPosition.x, y: lastCopyPosition.y };
    if (extensionFrame && extensionFrame.contentWindow) {
      try {
        extensionFrame.contentWindow.postMessage(payload, '*');
      } catch (err) {}
    }
  }

  function detectField(text) {
    if (!text || typeof text !== 'string') return null;
    var t = text.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'email';
    if (t.indexOf('linkedin.com/in/') !== -1) return 'linkedin_url';
    if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(t) || t.indexOf('http://') === 0 || t.indexOf('https://') === 0 || t.indexOf('www.') === 0) return 'website_link';
    var companyWords = ['inc', 'ltd', 'llc', 'corp', 'corporation', 'company', 'co', 'group', 'tech', 'solutions', 'systems', 'services'];
    if (companyWords.some(function (w) { return t.indexOf(w) !== -1; }) || (t.length > 3 && t.split(' ').length <= 4 && t.indexOf('@') === -1 && t.indexOf('http') === -1)) return 'company_name';
    if (/^[a-zA-Z\s]{2,40}$/.test(t) && t.split(' ').length >= 2 && t.split(' ').length <= 4) return 'name';
    if (t.length > 50) return 'about_prospect';
    return null;
  }

  var fieldLabels = { name: 'Name', email: 'Email', job_title: 'Designation', company_name: 'Company', website_link: 'Website', linkedin_url: 'LinkedIn URL', category: 'Category', sources: 'Source', status: 'Status', intent: 'Intent', intent_date: 'Intent Date', about_prospect: 'About' };
  var allFields = [
    { value: 'name', label: 'Name' }, { value: 'email', label: 'Email' }, { value: 'job_title', label: 'Designation' },
    { value: 'company_name', label: 'Company' }, { value: 'website_link', label: 'Website' }, { value: 'linkedin_url', label: 'LinkedIn URL' },
    { value: 'category', label: 'Category' }, { value: 'sources', label: 'Source' }, { value: 'intent', label: 'Intent' }, { value: 'intent_date', label: 'Intent Date' },
    { value: 'status', label: 'Status' }, { value: 'about_prospect', label: 'About' }
  ];

  function doPasteToField(field, text) {
    try {
      chrome.storage.local.set({ prospectPaste: { field: field, text: String(text), ts: Date.now() } });
      if (extensionFrame && extensionFrame.contentWindow) {
        try { extensionFrame.contentWindow.postMessage({ type: 'PROSPECT_PASTE_TO_FIELD', field: field, text: text }, '*'); } catch (err) {}
      }
    } catch (err) {}
  }

  function showInPageSuggestionPopup(text, x, y) {
    var existing = document.getElementById('prospect-inpage-popup');
    if (existing) existing.remove();
    var suggested = detectField(text);
    var popW = 320;
    var popH = 360;
    var pad = 12;
    x = Math.max(pad, Math.min(x, window.innerWidth - popW - pad));
    y = y + 8;
    if (y + popH > window.innerHeight - pad) y = window.innerHeight - popH - pad;
    if (y < pad) y = pad;

    function renderPopup(draft) {
      draft = draft && typeof draft === 'object' ? draft : {};
      function fieldValue(key) {
        var v = draft[key];
        if (v == null || v === '') return '';
        if (key === 'intent_date' && typeof v === 'string' && v.length >= 10) return v.slice(0, 10);
        var s = String(v).trim();
        return s.length > 35 ? s.slice(0, 35) + '…' : s;
      }

      var wrap = document.createElement('div');
      wrap.id = 'prospect-inpage-popup';
      wrap.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;width:' + popW + 'px;max-height:' + (window.innerHeight - y - pad) + 'px;z-index:2147483647;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 20px 48px rgba(0,0,0,0.18);font-family:system-ui,-apple-system,sans-serif;font-size:13px;overflow:hidden;';
      var header = document.createElement('div');
      header.style.cssText = 'padding:12px 14px;background:linear-gradient(to right,#4f46e5,#4338ca);color:#fff;font-weight:600;font-size:13px;border-radius:12px 12px 0 0;';
      header.textContent = 'Paste as';
      wrap.appendChild(header);
      var preview = document.createElement('div');
      preview.style.cssText = 'padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      preview.textContent = text.length > 45 ? text.slice(0, 45) + '…' : text;
      wrap.appendChild(preview);
      var area = document.createElement('div');
      area.style.cssText = 'padding:10px;max-height:280px;overflow-y:auto;';
      if (suggested) {
        var sugBtn = document.createElement('button');
        sugBtn.type = 'button';
        sugBtn.style.cssText = 'width:100%;padding:10px 12px;margin-bottom:8px;text-align:left;border:2px solid #c7d6fe;background:#e0e9fe;color:#3730a3;border-radius:8px;font-weight:500;cursor:pointer;font-size:13px;';
        var sugLabel = '✨ ' + (fieldLabels[suggested] || suggested);
        var sugVal = fieldValue(suggested);
        sugBtn.innerHTML = sugVal ? sugLabel + '<br><span style="font-size:11px;color:#64748b;font-weight:400;">' + escapeHtml(sugVal) + '</span>' : sugLabel;
        sugBtn.addEventListener('click', function () {
          doPasteToField(suggested, text);
          wrap.remove();
        });
        area.appendChild(sugBtn);
      }
      allFields.forEach(function (f) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'width:100%;padding:8px 12px;margin-bottom:4px;text-align:left;border:1px solid #e2e8f0;background:#fff;color:#334155;border-radius:6px;cursor:pointer;font-size:12px;';
        var val = fieldValue(f.value);
        if (val) {
          btn.innerHTML = f.label + '<br><span style="font-size:11px;color:#64748b;font-weight:400;">' + escapeHtml(val) + '</span>';
        } else {
          btn.textContent = f.label;
        }
        btn.addEventListener('click', function () {
          doPasteToField(f.value, text);
          wrap.remove();
        });
        area.appendChild(btn);
      });
      wrap.appendChild(area);
      var closeTimer = setTimeout(function () { wrap.remove(); cleanup(); }, 8000);
      wrap.addEventListener('click', function (ev) { ev.stopPropagation(); });
      function cleanup() {
        clearTimeout(closeTimer);
        document.body.removeEventListener('click', outsideHandler);
      }
      function outsideHandler() {
        wrap.remove();
        cleanup();
      }
      document.body.appendChild(wrap);
      setTimeout(function () { document.body.addEventListener('click', outsideHandler); }, 150);
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    chrome.storage.local.get(['prospectDraft'], function (result) {
      renderPopup(result.prospectDraft);
    });
  }

  window.addEventListener('message', function (e) {
    if (!extensionFrame || !extensionFrame.contentWindow || e.source !== extensionFrame.contentWindow) return;
    if (e.data && e.data.type === 'PROSPECT_IFRAME_READY') {
      setCollapsedState(false);
    }
    if (e.data && e.data.type === 'PROSPECT_PANEL_COLLAPSED') {
      setCollapsedState(e.data.collapsed === true);
    }
  });

  // Copy: show suggestion popup on top of the copied text (at cursor position)
  document.addEventListener('copy', function (e) {
    try {
      var sel = (window.getSelection && window.getSelection().toString()) || (document.getSelection && document.getSelection().toString()) || '';
      if (sel && sel.trim()) {
        lastCopiedText = sel.trim();
        lastCopyPosition = { x: e.clientX || 200, y: e.clientY || 100 };
        showInPageSuggestionPopup(lastCopiedText, lastCopyPosition.x, lastCopyPosition.y);
      }
      setTimeout(function () {
        navigator.clipboard.readText().then(function (clipboardText) {
          var t = clipboardText && clipboardText.trim();
          if (t && t !== lastCopiedText) {
            lastCopiedText = t;
            lastCopyPosition = { x: window.innerWidth / 2, y: 120 };
            showInPageSuggestionPopup(t, lastCopyPosition.x, lastCopyPosition.y);
          }
        }).catch(function () {});
      }, 150);
    } catch (err) {
      console.error('Prospect extension copy:', err);
    }
  }, true);

  document.addEventListener('paste', function (e) {
    try {
      navigator.clipboard.readText().then(function (clipboardText) {
        var t = clipboardText && clipboardText.trim();
        if (t) {
          lastCopiedText = t;
          lastCopyPosition = { x: e.clientX || window.innerWidth / 2, y: e.clientY || 120 };
          showInPageSuggestionPopup(t, lastCopyPosition.x, lastCopyPosition.y);
        }
      }).catch(function () {});
    } catch (err) {}
  });

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'toggleOverlay') {
      if (extensionFrame && extensionFrame.contentWindow) {
        extensionFrame.contentWindow.postMessage({ type: 'PROSPECT_TOGGLE_OVERLAY' }, '*');
      }
      sendResponse({ success: true });
    }
    if (request.action === 'textCopied') {
      sendCopyToUI(request.text, request.x, request.y);
      sendResponse({ success: true });
    }
    if (request.action === 'getSelection') {
      var sel = (window.getSelection && window.getSelection().toString()) || (document.getSelection && document.getSelection().toString()) || '';
      sendResponse({ text: sel ? sel.trim() : '' });
    }
    return true;
  });
})();
