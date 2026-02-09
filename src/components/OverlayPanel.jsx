import React from 'react';
import { useProspect } from '../context/ProspectContext';
import ProspectForm from './ProspectForm';
import './OverlayPanel.css';

const OverlayPanel = () => {
  const { activeProspect, isCollapsed, setIsCollapsed, startNewProspect, userId } = useProspect();

  return (
    <div className={`overlay-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {!isCollapsed ? (
        <>
          <div className="overlay-header">
            <div className="overlay-header-content">
              <div className="overlay-header-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <path d="M20 8v6M23 11h-6"></path>
                </svg>
                <span>Prospect Manager</span>
              </div>
              <div className="overlay-header-actions">
                <button
                  className="overlay-btn-icon"
                  onClick={() => setIsCollapsed(true)}
                  title="Collapse"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="overlay-content">
            {!activeProspect ? (
              <div className="overlay-empty-state">
                <div className="empty-state-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <path d="M20 8v6M23 11h-6"></path>
                  </svg>
                </div>
                <h3 className="empty-state-title">Ready to capture prospects</h3>
                <p className="empty-state-description">
                  Start a new prospect session and use copy-paste to quickly fill in data
                </p>
                <button className="btn-primary btn-large" onClick={startNewProspect}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Start New Prospect
                </button>
              </div>
            ) : (
              <div className="overlay-prospect-active">
                <div className="active-prospect-indicator">
                  <div className="indicator-dot"></div>
                  <span>Active Prospect Session</span>
                </div>
                <ProspectForm />
              </div>
            )}

            <div className="overlay-footer">
              <div className="user-info">
                <span className="user-info-label">User ID:</span>
                <span className="user-info-value">{userId?.substring(0, 20)}...</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="overlay-collapsed">
          <button
            className="overlay-expand-btn"
            onClick={() => setIsCollapsed(false)}
            title="Expand"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default OverlayPanel;
