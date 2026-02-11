import React, { useState, useEffect } from 'react';
import { useProspect } from '../context/ProspectContext';
import ProspectForm from './ProspectForm';
import { UserPlus, MousePointer2, PanelLeftClose, PanelLeft, RefreshCw, List, ArrowLeft, Loader2 } from './icons';

import { API_URL } from '../config.js';

const OverlayPanel = ({ onRequestCaptureSelection }) => {
  const { activeProspect, isCollapsed, setIsCollapsed, startNewProspect, clearProspect, userId, reloadDraftFromStorage, loadProspect, authUser, logout } = useProspect();
  const [viewMode, setViewMode] = useState('home'); // 'home' | 'prospects'
  const [fromProspectsList, setFromProspectsList] = useState(false);
  const [prospects, setProspects] = useState([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);
  const [prospectsError, setProspectsError] = useState(null);

  useEffect(() => {
    if (viewMode !== 'prospects') return;
    setProspectsLoading(true);
    setProspectsError(null);
    fetch(`${API_URL}/prospects`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load prospects');
        return res.json();
      })
      .then((data) => {
        setProspects(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setProspectsError(err.message || 'Error loading prospects');
        setProspects([]);
      })
      .finally(() => setProspectsLoading(false));
  }, [viewMode]);

  // Notify parent (content script) so it can hide iframe and show transparent tab when collapsed
  React.useEffect(() => {
    if (typeof window.parent !== 'undefined' && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'PROSPECT_PANEL_COLLAPSED', collapsed: isCollapsed }, '*');
      } catch (_) {}
    }
  }, [isCollapsed]);

  // Listen for expand from content script (transparent tab click)
  React.useEffect(() => {
    const handler = (e) => {
      if (e.source !== window.parent) return;
      if (e.data?.type === 'PROSPECT_EXPAND') setIsCollapsed(false);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div
      className={`flex flex-col border-l transition-all duration-300 ease-out ${
        isCollapsed
          ? 'w-[72px] min-w-[72px] h-[72px] min-h-0 rounded-l-lg overflow-hidden shadow-lg bg-primary-700 border-primary-800/50'
          : 'w-[420px] min-w-[420px] h-full bg-slate-100 border-slate-200'
      }`}
    >
      {!isCollapsed ? (
        <>
          {/* Header - solid purple/blue like reference */}
          <header className="flex-shrink-0 bg-primary-600 text-white">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/15">
                  <UserPlus className="w-5 h-5" strokeWidth={2} />
                </div>
                <span className="font-semibold text-[15px] tracking-tight">Prospect Manager</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={reloadDraftFromStorage}
                  title="Reload draft – get latest data pasted from other tabs/sites"
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" strokeWidth={2} />
                </button>
                {typeof onRequestCaptureSelection === 'function' && (
                  <button
                    type="button"
                    onClick={onRequestCaptureSelection}
                    title="Capture current selection"
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <MousePointer2 className="w-4 h-4" strokeWidth={2} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  title="Collapse panel"
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </header>

          {/* Content - light gray background, white card inside */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
            <div className="flex-1 overflow-y-auto scroll-thin p-4">
              {viewMode === 'prospects' ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      clearProspect();
                      setFromProspectsList(false);
                      setViewMode('home');
                    }}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                    Back
                  </button>
                  <h3 className="text-base font-bold text-slate-800">All prospects</h3>
                  {prospectsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary-500" strokeWidth={2} />
                    </div>
                  ) : prospectsError ? (
                    <p className="text-sm text-red-600 py-4">{prospectsError}</p>
                  ) : prospects.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">No prospects saved yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {prospects.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => {
                            loadProspect(p);
                            setFromProspectsList(true);
                            setViewMode('home');
                          }}
                          className="w-full text-left rounded-xl bg-white border border-slate-200/80 p-4 shadow-sm hover:border-primary-300 hover:shadow-md transition-colors cursor-pointer"
                        >
                          <div className="font-semibold text-slate-800 truncate">
                            {p.name || '—'}
                          </div>
                          {p.email && (
                            <a
                              href={`mailto:${p.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-primary-600 hover:underline truncate block"
                            >
                              {p.email}
                            </a>
                          )}
                          {p.company_name && (
                            <p className="text-xs text-slate-500 mt-1 truncate">{p.company_name}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {String(p.category).replace('_', '-')}
                              </span>
                            )}
                            {p.sources && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {p.sources}
                              </span>
                            )}
                            {p.status && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-primary-100 text-primary-700">
                                {String(p.status).replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          {p.linkedin_url && (
                            <a
                              href={p.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-primary-600 hover:underline mt-2 inline-block truncate max-w-full"
                            >
                              LinkedIn →
                            </a>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : !activeProspect ? (
                <div className="rounded-xl bg-white border border-slate-200/80 p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-1.5">
                    Ready to capture prospects
                  </h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    Start a new prospect session. Select text and copy (Ctrl+C), or capture the
                    current selection below.
                  </p>
                  <div className="space-y-3">
                    {typeof onRequestCaptureSelection === 'function' && (
                      <button
                        type="button"
                        onClick={onRequestCaptureSelection}
                        className="w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <MousePointer2 className="w-4 h-4" strokeWidth={2} />
                        Capture selection
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFromProspectsList(false);
                        startNewProspect();
                      }}
                      className="w-full rounded-lg bg-primary-600 py-3 px-4 text-sm font-semibold text-white hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" strokeWidth={2.5} />
                      Start New Prospect
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('prospects')}
                      className="w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <List className="w-4 h-4" strokeWidth={2} />
                      View all prospects
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {fromProspectsList && (
                    <button
                      type="button"
                      onClick={() => {
                        setFromProspectsList(false);
                        setViewMode('prospects');
                      }}
                      className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                    >
                      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                      Back to list
                    </button>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-slate-200 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-medium text-slate-700">Active Prospect Session</span>
                  </div>
                  <ProspectForm />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex flex-col text-xs text-slate-500 truncate max-w-[280px]">
                  <span className="font-medium text-slate-700 truncate">{authUser?.name || authUser?.email || '—'}</span>
                  <span className="text-[11px] text-slate-400">{authUser?.role || ''}</span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[72px] bg-primary-600">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            title="Expand panel"
            className="p-3 rounded-lg hover:bg-white/20 transition-colors"
          >
            <PanelLeft className="w-6 h-6 text-white" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
};

export default OverlayPanel;
