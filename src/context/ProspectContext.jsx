import React, { createContext, useContext, useState, useEffect } from 'react';

const ProspectContext = createContext();

import { API_URL } from '../config.js';
const DRAFT_STORAGE_KEY = 'prospectDraft';
const AUTH_STORAGE_KEY = 'authUser';
const AUTH_TOKEN_KEY = 'authToken';
const PANEL_STATE_KEY = 'panelState'; // { activeTab, editingFromTab, isCollapsed }

const emptyProspect = () => ({
  id: Date.now().toString(),
  name: null,
  email: null,
  job_title: null,
  company_name: null,
  website_link: null,
  linkedin_url: null,
  linkedin_connection: 'none',
  category: null,
  sources: null,
  intent_skills: [],
  intent_category: null,
  intent_proof_link: null,
  intent_date: null,
  status: 'new',
  lh_user_id: null,
  about_prospect: null,
  created_at: new Date().toISOString()
});

export const ProspectProvider = ({ children }) => {
  const [activeProspect, setActiveProspect] = useState(null);
  const [authUser, setAuthUser] = useState(null); // { id, email, name, role }
  const [authToken, setAuthToken] = useState(null); // JWT for API calls (e.g. change password)
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [isCollapsed, setIsCollapsedRaw] = useState(false);
  const [panelActiveTab, setPanelActiveTabRaw] = useState(null); // null until loaded
  const [panelEditingFromTab, setPanelEditingFromTabRaw] = useState(null);
  const [panelStateLoaded, setPanelStateLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Persist panel state helpers
  const persistPanelState = (patch) => {
    chrome.storage.local.get([PANEL_STATE_KEY]).then((result) => {
      const current = result[PANEL_STATE_KEY] || {};
      chrome.storage.local.set({ [PANEL_STATE_KEY]: { ...current, ...patch } }).catch(() => {});
    }).catch(() => {});
  };

  const setIsCollapsed = (val) => {
    setIsCollapsedRaw(val);
    persistPanelState({ isCollapsed: val });
  };

  const setPanelActiveTab = (val) => {
    setPanelActiveTabRaw(val);
    persistPanelState({ activeTab: val });
  };

  const setPanelEditingFromTab = (val) => {
    setPanelEditingFromTabRaw(val);
    persistPanelState({ editingFromTab: val });
  };

  // Load auth user, draft, and panel state on mount
  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    if (activeProspect === null) {
      chrome.storage.local.remove(DRAFT_STORAGE_KEY).catch(() => {});
    } else {
      chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: activeProspect }).catch(() => {});
    }
  }, [activeProspect, draftLoaded]);

  const loadAuth = async () => {
    try {
      const result = await chrome.storage.local.get([AUTH_STORAGE_KEY, AUTH_TOKEN_KEY, DRAFT_STORAGE_KEY, PANEL_STATE_KEY]);
      const stored = result[AUTH_STORAGE_KEY];
      if (stored && typeof stored === 'object' && stored.id) {
        setAuthUser(stored);
        setUserId(stored.id);
      }
      if (result[AUTH_TOKEN_KEY] && typeof result[AUTH_TOKEN_KEY] === 'string') {
        setAuthToken(result[AUTH_TOKEN_KEY]);
      }
      if (result[DRAFT_STORAGE_KEY] && typeof result[DRAFT_STORAGE_KEY] === 'object') {
        const draft = result[DRAFT_STORAGE_KEY];
        const merged = { ...emptyProspect(), ...draft };
        if (draft.id) merged.id = draft.id;
        if (draft.created_at) merged.created_at = draft.created_at;
        setActiveProspect(merged);
      }
      // Restore panel state
      const ps = result[PANEL_STATE_KEY];
      if (ps && typeof ps === 'object') {
        if (typeof ps.isCollapsed === 'boolean') setIsCollapsedRaw(ps.isCollapsed);
        if (ps.activeTab) setPanelActiveTabRaw(ps.activeTab);
        if (ps.editingFromTab) setPanelEditingFromTabRaw(ps.editingFromTab);
      }
      setPanelStateLoaded(true);
      setDraftLoaded(true);
    } catch (error) {
      console.error('Error loading auth:', error);
      setPanelStateLoaded(true);
      setDraftLoaded(true);
    } finally {
      setAuthLoading(false);
    }
  };

  const login = async (userOrPayload, tokenOrUndefined) => {
    const user = userOrPayload?.user ?? userOrPayload;
    const token = tokenOrUndefined ?? userOrPayload?.token ?? null;
    if (!user || !user.id) return;
    setAuthUser(user);
    setUserId(user.id);
    setAuthToken(token);
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: user,
      ...(token ? { [AUTH_TOKEN_KEY]: token } : {}),
    }).catch(() => {});
  };

  const logout = async () => {
    setAuthUser(null);
    setUserId(null);
    setAuthToken(null);
    setActiveProspect(null);
    setPanelActiveTabRaw(null);
    setPanelEditingFromTabRaw(null);
    setIsCollapsedRaw(false);
    await chrome.storage.local.remove([AUTH_STORAGE_KEY, AUTH_TOKEN_KEY, DRAFT_STORAGE_KEY, PANEL_STATE_KEY]).catch(() => {});
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!authToken) throw new Error('Not authenticated');
    const res = await fetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword: newPassword.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update password');
    return data;
  };

  const startNewProspect = () => {
    setActiveProspect(emptyProspect());
  };

  const updateProspectField = (field, value) => {
    setActiveProspect(prev => {
      const base = prev || emptyProspect();
      const next = { ...base, [field]: value };
      chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: next }).catch(() => {});
      return next;
    });
  };

  const clearProspect = () => {
    setActiveProspect(null);
  };

  const loadProspect = (prospect) => {
    if (!prospect || typeof prospect !== 'object') return;
    const merged = { ...emptyProspect(), ...prospect };
    if (prospect.id) merged.id = prospect.id;
    if (prospect.created_at) merged.created_at = prospect.created_at;
    setActiveProspect(merged);
    chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: merged }).catch(() => {});
  };

  const reloadDraftFromStorage = async () => {
    try {
      const result = await chrome.storage.local.get([DRAFT_STORAGE_KEY]);
      const draft = result[DRAFT_STORAGE_KEY];
      if (draft && typeof draft === 'object') {
        const merged = { ...emptyProspect(), ...draft };
        if (draft.id) merged.id = draft.id;
        if (draft.created_at) merged.created_at = draft.created_at;
        setActiveProspect(merged);
      } else {
        setActiveProspect(null);
      }
    } catch (error) {
      console.error('Error reloading draft:', error);
    }
  };

  const pasteToField = (field, text) => {
    updateProspectField(field, text);
  };

  const saveProspect = async (options = {}) => {
    if (!activeProspect || !userId) {
      throw new Error('No active prospect or user ID');
    }

    setLoading(true);
    try {
      const prospectData = {
        ...activeProspect,
        user_id: userId
      };

      const id = activeProspect.id && String(activeProspect.id).trim();
      const isDraftId = /^\d+$/.test(id || ''); // new draft uses Date.now() => digits only
      const isUpdate = id && id.length >= 32 && !isDraftId;
      const url = isUpdate ? `${API_URL}/prospects/${id}` : `${API_URL}/prospects`;
      const method = isUpdate ? 'PUT' : 'POST';
      const { id: _id, ...payload } = prospectData;
      const body = JSON.stringify(isUpdate ? payload : { ...payload });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body
      });

      if (!response.ok) {
        throw new Error('Failed to save prospect');
      }

      const saved = await response.json();
      if (options.stayOnNewAndReload) {
        loadProspect(saved);
      } else {
        setActiveProspect(null);
        await chrome.storage.local.remove(DRAFT_STORAGE_KEY).catch(() => {});
      }
      setLoading(false);
      return saved;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const value = {
    activeProspect,
    authUser,
    authToken,
    authLoading,
    userId,
    changePassword,
    isCollapsed,
    setIsCollapsed,
    panelActiveTab,
    setPanelActiveTab,
    panelEditingFromTab,
    setPanelEditingFromTab,
    panelStateLoaded,
    login,
    logout,
    startNewProspect,
    updateProspectField,
    clearProspect,
    loadProspect,
    reloadDraftFromStorage,
    pasteToField,
    saveProspect,
    loading
  };

  return (
    <ProspectContext.Provider value={value}>
      {children}
    </ProspectContext.Provider>
  );
};

export const useProspect = () => {
  const context = useContext(ProspectContext);
  if (!context) {
    throw new Error('useProspect must be used within ProspectProvider');
  }
  return context;
};
