import React, { createContext, useContext, useState, useEffect } from 'react';

const ProspectContext = createContext();

import { API_URL } from '../config.js';
const DRAFT_STORAGE_KEY = 'prospectDraft';
const AUTH_STORAGE_KEY = 'authUser';

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
  intent: null,
  intent_date: null,
  status: 'new',
  about_prospect: null,
  created_at: new Date().toISOString()
});

export const ProspectProvider = ({ children }) => {
  const [activeProspect, setActiveProspect] = useState(null);
  const [authUser, setAuthUser] = useState(null); // { id, email, name, role }
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Load auth user and draft on mount
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
      const result = await chrome.storage.local.get([AUTH_STORAGE_KEY, DRAFT_STORAGE_KEY]);
      const stored = result[AUTH_STORAGE_KEY];
      if (stored && typeof stored === 'object' && stored.id) {
        setAuthUser(stored);
        setUserId(stored.id);
      }
      if (result[DRAFT_STORAGE_KEY] && typeof result[DRAFT_STORAGE_KEY] === 'object') {
        const draft = result[DRAFT_STORAGE_KEY];
        const merged = { ...emptyProspect(), ...draft };
        if (draft.id) merged.id = draft.id;
        if (draft.created_at) merged.created_at = draft.created_at;
        setActiveProspect(merged);
      }
      setDraftLoaded(true);
    } catch (error) {
      console.error('Error loading auth:', error);
      setDraftLoaded(true);
    } finally {
      setAuthLoading(false);
    }
  };

  const login = async (user) => {
    setAuthUser(user);
    setUserId(user.id);
    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: user }).catch(() => {});
  };

  const logout = async () => {
    setAuthUser(null);
    setUserId(null);
    setActiveProspect(null);
    await chrome.storage.local.remove([AUTH_STORAGE_KEY, DRAFT_STORAGE_KEY]).catch(() => {});
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

  const saveProspect = async () => {
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
      setActiveProspect(null);
      await chrome.storage.local.remove(DRAFT_STORAGE_KEY).catch(() => {});
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
    authLoading,
    userId,
    isCollapsed,
    setIsCollapsed,
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
