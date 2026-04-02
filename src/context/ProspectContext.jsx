import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProspectContext = createContext();

import { API_URL } from '../config.js';
const DRAFT_STORAGE_KEY = 'prospectDraft';
const AUTH_STORAGE_KEY = 'authUser';
const AUTH_TOKEN_KEY = 'authToken';
const PANEL_STATE_KEY = 'panelState'; // { activeTab, editingFromTab, isCollapsed }
const LAST_VIEWED_CONTEXT_KEY = 'lastViewedProspectContext';
const TAB_DRAFT_STORAGE_PREFIX = 'prospectDraft:tab:';
const TAB_PANEL_STATE_PREFIX = 'panelState:tab:';
const RESTORE_CONTEXT_MAX_AGE_MS = 30 * 60 * 1000;

const getTabDraftKey = (tabId) => `${TAB_DRAFT_STORAGE_PREFIX}${tabId}`;
const getTabPanelStateKey = (tabId) => `${TAB_PANEL_STATE_PREFIX}${tabId}`;

const isPersistedProspectId = (id) => {
  const normalized = typeof id === 'string' ? id.trim() : '';
  return normalized.length >= 32 && !/^\d+$/.test(normalized);
};

const getActiveTabId = async () => {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return typeof tabs?.[0]?.id === 'number' ? tabs[0].id : null;
  } catch (error) {
    console.warn('Unable to resolve active tab ID:', error);
    return null;
  }
};

const readStorage = async (keys) => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return {};
  try {
    return await chrome.storage.local.get(keys);
  } catch (error) {
    console.warn('Failed to read local extension storage:', error);
    return {};
  }
};

const writeStorage = async (entries) => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    await chrome.storage.local.set(entries);
  } catch (error) {
    console.warn('Failed to write local extension storage:', error);
  }
};

const removeStorage = async (keys) => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    await chrome.storage.local.remove(keys);
  } catch (error) {
    console.warn('Failed to remove local extension storage:', error);
  }
};

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
  const [currentTabId, setCurrentTabId] = useState(null);
  const [isCollapsed, setIsCollapsedRaw] = useState(false);
  const [panelActiveTab, setPanelActiveTabRaw] = useState(null); // null until loaded
  const [panelEditingFromTab, setPanelEditingFromTabRaw] = useState(null);
  const [panelStateLoaded, setPanelStateLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const buildPanelState = useCallback((overrides = {}) => ({
    activeTab: panelActiveTab,
    editingFromTab: panelEditingFromTab,
    isCollapsed,
    ...overrides,
  }), [panelActiveTab, panelEditingFromTab, isCollapsed]);

  const persistLastViewedContext = useCallback(async (nextProspect, nextPanelState) => {
    if (!nextProspect) {
      await removeStorage([LAST_VIEWED_CONTEXT_KEY]);
      return;
    }

    await writeStorage({
      [LAST_VIEWED_CONTEXT_KEY]: {
        prospectId: nextProspect.id || null,
        prospect: nextProspect,
        panelState: nextPanelState,
        sourceTabId: currentTabId,
        savedAt: Date.now(),
      },
    });
  }, [currentTabId]);

  const persistPanelState = useCallback(async (patch) => {
    const nextState = buildPanelState(patch);
    const storageEntries = { [PANEL_STATE_KEY]: nextState };
    if (currentTabId != null) {
      storageEntries[getTabPanelStateKey(currentTabId)] = nextState;
    }
    await writeStorage(storageEntries);
    if (activeProspect) {
      await persistLastViewedContext(activeProspect, nextState);
    }
  }, [activeProspect, buildPanelState, currentTabId, persistLastViewedContext]);

  const applyStoredProspect = useCallback((prospect) => {
    if (!prospect || typeof prospect !== 'object') {
      setActiveProspect(null);
      return null;
    }
    const merged = { ...emptyProspect(), ...prospect };
    if (prospect.id) merged.id = prospect.id;
    if (prospect.created_at) merged.created_at = prospect.created_at;
    setActiveProspect(merged);
    return merged;
  }, []);

  const restoreProspectById = useCallback(async (prospectId, fallbackProspect = null) => {
    if (!isPersistedProspectId(prospectId)) {
      return applyStoredProspect(fallbackProspect);
    }
    try {
      const res = await fetch(`${API_URL}/prospects/${prospectId}`);
      if (!res.ok) throw new Error('Failed to load saved prospect');
      const fetched = await res.json();
      return applyStoredProspect(fetched);
    } catch (error) {
      console.warn('Falling back to stored prospect context:', error);
      return applyStoredProspect(fallbackProspect);
    }
  }, [applyStoredProspect]);

  const restoreContextFromStorage = useCallback(async ({ tabId, includeLastViewedFallback = true }) => {
    const tabDraftKey = tabId != null ? getTabDraftKey(tabId) : null;
    const tabPanelStateKey = tabId != null ? getTabPanelStateKey(tabId) : null;
    const keys = [
      DRAFT_STORAGE_KEY,
      PANEL_STATE_KEY,
      LAST_VIEWED_CONTEXT_KEY,
      ...(tabDraftKey ? [tabDraftKey] : []),
      ...(tabPanelStateKey ? [tabPanelStateKey] : []),
    ];
    const result = await readStorage(keys);
    const tabDraft = tabDraftKey ? result[tabDraftKey] : null;
    const tabPanelState = tabPanelStateKey ? result[tabPanelStateKey] : null;
    const globalDraft = result[DRAFT_STORAGE_KEY];
    const globalPanelState = result[PANEL_STATE_KEY];
    const lastViewed = result[LAST_VIEWED_CONTEXT_KEY];

    const savedPanelState = tabPanelState || globalPanelState || null;
    if (savedPanelState && typeof savedPanelState === 'object') {
      if (typeof savedPanelState.isCollapsed === 'boolean') setIsCollapsedRaw(savedPanelState.isCollapsed);
      setPanelActiveTabRaw(savedPanelState.activeTab || null);
      setPanelEditingFromTabRaw(savedPanelState.editingFromTab || null);
    }

    const savedDraft = tabDraft || globalDraft || null;
    if (savedDraft && typeof savedDraft === 'object') {
      await restoreProspectById(savedDraft.id, savedDraft);
      return;
    }

    const lastViewedIsFresh =
      includeLastViewedFallback &&
      lastViewed &&
      typeof lastViewed === 'object' &&
      typeof lastViewed.savedAt === 'number' &&
      Date.now() - lastViewed.savedAt <= RESTORE_CONTEXT_MAX_AGE_MS;

    if (lastViewedIsFresh) {
      const fallbackPanelState = lastViewed.panelState && typeof lastViewed.panelState === 'object'
        ? lastViewed.panelState
        : null;
      if (!savedPanelState && fallbackPanelState) {
        if (typeof fallbackPanelState.isCollapsed === 'boolean') setIsCollapsedRaw(fallbackPanelState.isCollapsed);
        setPanelActiveTabRaw(fallbackPanelState.activeTab || null);
        setPanelEditingFromTabRaw(fallbackPanelState.editingFromTab || null);
      }
      await restoreProspectById(lastViewed.prospectId, lastViewed.prospect || null);
      return;
    }

    setActiveProspect(null);
  }, [applyStoredProspect, restoreProspectById]);

  const persistDraftState = useCallback(async (nextProspect) => {
    const storageEntries = {};
    const removalKeys = [];

    if (nextProspect === null) {
      removalKeys.push(DRAFT_STORAGE_KEY);
      if (currentTabId != null) removalKeys.push(getTabDraftKey(currentTabId));
    } else {
      storageEntries[DRAFT_STORAGE_KEY] = nextProspect;
      if (currentTabId != null) storageEntries[getTabDraftKey(currentTabId)] = nextProspect;
    }

    if (Object.keys(storageEntries).length > 0) await writeStorage(storageEntries);
    if (removalKeys.length > 0) await removeStorage(removalKeys);

    await persistLastViewedContext(nextProspect, buildPanelState());
  }, [buildPanelState, currentTabId, persistLastViewedContext]);

  const rememberProspectContext = useCallback(async (prospect, overrides = {}) => {
    if (!prospect) return;
    await persistLastViewedContext(prospect, buildPanelState(overrides));
  }, [buildPanelState, persistLastViewedContext]);

  const refreshCurrentTabContext = useCallback(async () => {
    const tabId = await getActiveTabId();
    setCurrentTabId(tabId);
    return tabId;
  }, []);

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
    persistDraftState(activeProspect);
  }, [activeProspect, draftLoaded, persistDraftState]);

  const loadAuth = async () => {
    try {
      const [result, tabId] = await Promise.all([
        readStorage([AUTH_STORAGE_KEY, AUTH_TOKEN_KEY]),
        refreshCurrentTabContext(),
      ]);
      const stored = result[AUTH_STORAGE_KEY];
      if (stored && typeof stored === 'object' && stored.id) {
        setAuthUser(stored);
        setUserId(stored.id);
      }
      if (result[AUTH_TOKEN_KEY] && typeof result[AUTH_TOKEN_KEY] === 'string') {
        setAuthToken(result[AUTH_TOKEN_KEY]);
      }
      await restoreContextFromStorage({ tabId, includeLastViewedFallback: true });
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
    setCurrentTabId(null);
    setPanelActiveTabRaw(null);
    setPanelEditingFromTabRaw(null);
    setIsCollapsedRaw(false);
    const keysToRemove = [AUTH_STORAGE_KEY, AUTH_TOKEN_KEY, DRAFT_STORAGE_KEY, PANEL_STATE_KEY, LAST_VIEWED_CONTEXT_KEY];
    if (currentTabId != null) {
      keysToRemove.push(getTabDraftKey(currentTabId), getTabPanelStateKey(currentTabId));
    }
    await removeStorage(keysToRemove);
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
      persistDraftState(next);
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
    persistDraftState(merged);
  };

  const reloadDraftFromStorage = async () => {
    try {
      const tabId = currentTabId != null ? currentTabId : await refreshCurrentTabContext();
      await restoreContextFromStorage({ tabId, includeLastViewedFallback: true });
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
        const keysToRemove = [DRAFT_STORAGE_KEY];
        if (currentTabId != null) keysToRemove.push(getTabDraftKey(currentTabId));
        await removeStorage(keysToRemove);
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
    currentTabId,
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
    rememberProspectContext,
    refreshCurrentTabContext,
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
