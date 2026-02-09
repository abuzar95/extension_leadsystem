import React, { createContext, useContext, useState, useEffect } from 'react';

const ProspectContext = createContext();

const DEFAULT_ADMIN_USER_ID = 'aef5e700-1401-4e3f-bd54-5be9d645df0f';
const API_URL = 'http://localhost:3001/api';

export const ProspectProvider = ({ children }) => {
  const [activeProspect, setActiveProspect] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserId();
  }, []);

  const loadUserId = async () => {
    try {
      const result = await chrome.storage.local.get(['userId']);
      const id = result.userId || DEFAULT_ADMIN_USER_ID;
      setUserId(id);
      if (!result.userId) {
        await chrome.storage.local.set({ userId: id });
      }
    } catch (error) {
      console.error('Error loading user ID:', error);
      setUserId(DEFAULT_ADMIN_USER_ID);
    }
  };

  const startNewProspect = () => {
    setActiveProspect({
      id: Date.now().toString(),
      name: null,
      email: null,
      number: null,
      company_name: null,
      website_link: null,
      category: null,
      sources: null,
      status: 'new',
      about_prospect: null,
      created_at: new Date().toISOString()
    });
  };

  const updateProspectField = (field, value) => {
    if (!activeProspect) {
      startNewProspect();
    }
    setActiveProspect(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearProspect = () => {
    setActiveProspect(null);
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

      const response = await fetch(`${API_URL}/prospects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prospectData)
      });

      if (!response.ok) {
        throw new Error('Failed to save prospect');
      }

      const saved = await response.json();
      setActiveProspect(null);
      setLoading(false);
      return saved;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const value = {
    activeProspect,
    userId,
    isCollapsed,
    setIsCollapsed,
    startNewProspect,
    updateProspectField,
    clearProspect,
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
