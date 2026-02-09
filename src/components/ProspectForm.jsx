import React from 'react';
import { useProspect } from '../context/ProspectContext';
import './ProspectForm.css';

const ProspectForm = () => {
  const { activeProspect, updateProspectField, clearProspect, saveProspect, loading } = useProspect();

  if (!activeProspect) return null;

  const handleChange = (field, value) => {
    updateProspectField(field, value);
  };

  const handleSave = async () => {
    try {
      await saveProspect();
      // Success handled in context
    } catch (error) {
      alert('Error saving prospect: ' + error.message);
    }
  };

  return (
    <div className="prospect-form">
      <div className="form-group">
        <label className="form-label">
          <span className="form-label-icon">👤</span>
          Name
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="Enter name"
          value={activeProspect.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          <span className="form-label-icon">✉️</span>
          Email
        </label>
        <input
          type="email"
          className="form-input"
          placeholder="Enter email"
          value={activeProspect.email || ''}
          onChange={(e) => handleChange('email', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          <span className="form-label-icon">📞</span>
          Phone Number
        </label>
        <input
          type="tel"
          className="form-input"
          placeholder="Enter phone number"
          value={activeProspect.number || ''}
          onChange={(e) => handleChange('number', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          <span className="form-label-icon">🏢</span>
          Company Name
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="Enter company name"
          value={activeProspect.company_name || ''}
          onChange={(e) => handleChange('company_name', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          <span className="form-label-icon">🌐</span>
          Website Link
        </label>
        <input
          type="url"
          className="form-input"
          placeholder="Enter website URL"
          value={activeProspect.website_link || ''}
          onChange={(e) => handleChange('website_link', e.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            <span className="form-label-icon">📂</span>
            Category
          </label>
          <select
            className="form-select"
            value={activeProspect.category || ''}
            onChange={(e) => handleChange('category', e.target.value)}
          >
            <option value="">Select Category</option>
            <option value="Entrepreneur">Entrepreneur</option>
            <option value="Subcontractor">Subcontractor</option>
            <option value="SME">SME</option>
            <option value="HR">HR</option>
            <option value="C_Level">C-Level</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            <span className="form-label-icon">🔗</span>
            Source
          </label>
          <select
            className="form-select"
            value={activeProspect.sources || ''}
            onChange={(e) => handleChange('sources', e.target.value)}
          >
            <option value="">Select Source</option>
            <option value="upwork">Upwork</option>
            <option value="linkedin">LinkedIn</option>
            <option value="clutch">Clutch</option>
            <option value="crunchbase">Crunchbase</option>
            <option value="producthunt">Product Hunt</option>
            <option value="glassdoor">Glassdoor</option>
            <option value="indeed">Indeed</option>
            <option value="others">Others</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          <span className="form-label-icon">📊</span>
          Status
        </label>
        <select
          className="form-select"
          value={activeProspect.status || 'new'}
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="new">New</option>
          <option value="data_refined">Data Refined</option>
          <option value="use_in_campaign">Use in Campaign</option>
          <option value="pitch">Pitch</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">
          <span className="form-label-icon">📄</span>
          About Prospect
        </label>
        <textarea
          className="form-textarea"
          placeholder="Enter notes about the prospect"
          value={activeProspect.about_prospect || ''}
          onChange={(e) => handleChange('about_prospect', e.target.value)}
          rows={4}
        />
      </div>

      <div className="form-actions">
        <button
          className="btn-secondary"
          onClick={clearProspect}
          disabled={loading}
        >
          Clear
        </button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save Prospect
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProspectForm;
