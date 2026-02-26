import React, { useState, useEffect, useCallback } from 'react';
import { useProspect } from '../context/ProspectContext';
import ProspectForm from './ProspectForm';
import { UserPlus, MousePointer2, PanelLeftClose, PanelLeft, RefreshCw, List, ArrowLeft, Loader2, Settings } from './icons';
import { Search } from 'lucide-react';
import SettingsPage from './SettingsPage';

import { API_URL } from '../config.js';

// ── Shared prospect card ────────────────────────────────────────────
const ProspectCard = ({ prospect, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="ext-card ext-card-interactive ext-card-accent w-full text-left ext-card-body"
  >
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="font-semibold text-slate-800 truncate text-[15px] leading-tight">
        {prospect.name || '—'}
      </div>
      {prospect.company_name && (
        <p className="text-xs text-slate-600 truncate">{prospect.company_name}</p>
      )}
      {prospect.email && (
        <a
          href={`mailto:${prospect.email}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-primary-600 hover:underline truncate block"
        >
          {prospect.email}
        </a>
      )}
      <div className="flex flex-wrap gap-1.5">
        {prospect.category && (
          <span className="ext-badge ext-badge-slate">
            {String(prospect.category).replace('_', '-')}
          </span>
        )}
        {prospect.lead_score != null && (
          <span className="ext-badge bg-amber-100 text-amber-800" title="Lead score">
            Score: {prospect.lead_score}
          </span>
        )}
        {prospect.sources && (
          <span className="ext-badge ext-badge-slate">{prospect.sources}</span>
        )}
        {prospect.status && (
          <span className="ext-badge ext-badge-primary">
            {String(prospect.status).replace('_', ' ')}
          </span>
        )}
      </div>
      {Array.isArray(prospect.intent_skills) && prospect.intent_skills.length > 0 && (
        <div className="pt-1.5 border-t border-slate-100">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Skills</span>
          <div className="flex flex-wrap gap-1.5">
            {prospect.intent_skills.map((skill, i) => (
              <span key={i} className="ext-badge ext-badge-primary">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 border-t border-slate-100">
        {prospect.linkedin_url && (
          <a
            href={prospect.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary-600 hover:underline truncate max-w-full"
          >
            LinkedIn →
          </a>
        )}
        {prospect.website_link && (
          <a
            href={prospect.website_link.startsWith('http') ? prospect.website_link : `https://${prospect.website_link}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary-600 hover:underline truncate max-w-full"
          >
            Website →
          </a>
        )}
      </div>
    </div>
  </button>
);

// ── Prospect list (reusable) ────────────────────────────────────────
const ProspectList = ({ prospects, loading, error, emptyText, onSelect }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" strokeWidth={2} />
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-600 py-4">{error}</p>;
  if (prospects.length === 0) return <p className="text-sm text-slate-500 py-4">{emptyText}</p>;
  return (
    <div className="space-y-3">
      {prospects.map((p) => (
        <ProspectCard key={p.id} prospect={p} onClick={() => onSelect(p)} />
      ))}
    </div>
  );
};

// ── Prospect detail card (read-only) ────────────────────────────────
const DetailRow = ({ label, children }) => {
  if (!children && children !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-slate-100 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm text-slate-800 break-words leading-snug">{children}</span>
    </div>
  );
};

const ProspectDetailCard = ({ prospect, onBack, backLabel, onUpdated }) => {
  const { authUser } = useProspect();
  const [leadScore, setLeadScore] = useState(prospect?.lead_score ?? '');
  const [linkedinConnection, setLinkedinConnection] = useState(prospect?.linkedin_connection || 'none');
  const [linkedinProfileId, setLinkedinProfileId] = useState(prospect?.linkedin_profile_id || '');
  const [nextFollowUpDate, setNextFollowUpDate] = useState(prospect?.next_follow_up_date ? prospect.next_follow_up_date.slice(0, 10) : '');
  const [pitchDescription, setPitchDescription] = useState(prospect?.pitch_description || '');
  const [pitchedSource, setPitchedSource] = useState(prospect?.pitched_source || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // Reset fields when prospect changes — default profile to user's if prospect has none
  useEffect(() => {
    if (prospect) {
      setLeadScore(prospect.lead_score ?? '');
      setLinkedinConnection(prospect.linkedin_connection || 'none');
      setLinkedinProfileId(
        prospect.linkedin_profile_id || authUser?.linkedin_profile_id || ''
      );
      setNextFollowUpDate(prospect.next_follow_up_date ? prospect.next_follow_up_date.slice(0, 10) : '');
      setPitchDescription(prospect.pitch_description || '');
      setPitchedSource(prospect.pitched_source || '');
      setSaveMsg(null);
    }
  }, [prospect, authUser]);

  if (!prospect) return null;

  const STATUS_COLORS = {
    new: 'bg-blue-100 text-blue-700',
    data_refined: 'bg-amber-100 text-amber-700',
    use_in_campaign: 'bg-indigo-100 text-indigo-700',
    pitch: 'bg-violet-100 text-violet-700',
    LNC: 'bg-red-100 text-red-700',
    B_LNC: 'bg-red-50 text-red-600',
    LC: 'bg-emerald-100 text-emerald-700',
    B_LC: 'bg-emerald-50 text-emerald-600',
    COMMUNICATION: 'bg-purple-100 text-purple-700',
    TRASH: 'bg-slate-200 text-slate-600',
  };

  const CATEGORY_COLORS = {
    Individual: 'bg-sky-100 text-sky-700',
    Business: 'bg-amber-100 text-amber-700',
    Both: 'bg-violet-100 text-violet-700',
  };

  // Determine current phase based on prospect status
  const isLNCPhase = prospect.status === 'LNC' || prospect.status === 'B_LNC';
  const isLCPhase = prospect.status === 'LC' || prospect.status === 'B_LC';
  const isAssignedPhase = prospect.status === 'data_refined';

  // Validation depends on which phase we are in
  const canSave = isLCPhase
    ? !!nextFollowUpDate                                         // LC phase: follow-up date required
    : isLNCPhase
      ? linkedinConnection === 'connected' && !!linkedinProfileId // LNC → LC requires "connected"
      : linkedinConnection === 'invite' && !!linkedinProfileId;   // Assigned → LNC requires "invite"

  // Compute the target status for display
  const getTargetStatus = () => {
    if (isLCPhase) return prospect.status; // LC phase doesn't change status
    if (isLNCPhase) return prospect.email ? 'B_LC' : 'LC';
    return prospect.email ? 'B_LNC' : 'LNC';
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      let body;

      if (isLCPhase) {
        // LC phase: update follow-up, lead score, pitch fields + auto-set last_contacted_at
        body = {
          lead_score: leadScore === '' ? null : Number(leadScore),
          next_follow_up_date: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : null,
          pitch_description: pitchDescription || null,
          pitched_source: pitchedSource || null,
          last_contacted_at: new Date().toISOString(), // auto-timestamp on update
        };
      } else {
        // Assigned / LNC phase: status transition
        const newStatus = getTargetStatus();
        body = {
          lead_score: leadScore === '' ? null : Number(leadScore),
          linkedin_connection: linkedinConnection,
          linkedin_profile_id: linkedinProfileId || null,
          status: newStatus,
        };
      }

      const res = await fetch(`${API_URL}/prospects/${prospect.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');

      const successText = isLCPhase
        ? 'Saved — follow-up recorded'
        : `Saved — status set to ${getTargetStatus()}`;
      setSaveMsg({ type: 'success', text: successText });
      if (typeof onUpdated === 'function') onUpdated();
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message || 'Error saving' });
    } finally {
      setSaving(false);
    }
  };

  // Use the logged-in LH user's LinkedIn profile as the available option
  const userProfile = authUser?.linkedin_profile || null;
  // If prospect already has a profile assigned, show that; otherwise show the user's profile
  const availableProfile = prospect.linkedin_profile || userProfile;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        {backLabel || 'Back'}
      </button>

      {/* Header card */}
      <div className="ext-card ext-card-body">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800 truncate">{prospect.name || '—'}</h3>
            {prospect.job_title && <p className="text-sm text-slate-500">{prospect.job_title}</p>}
          </div>
          {prospect.status && (
            <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[prospect.status] || 'bg-slate-100 text-slate-600'}`}>
              {String(prospect.status).replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-1">
          {prospect.category && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
              {String(prospect.category).replace('_', '-')}
            </span>
          )}
          {prospect.intent_category && (
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${CATEGORY_COLORS[prospect.intent_category] || 'bg-slate-100 text-slate-600'}`}>
              {prospect.intent_category}
            </span>
          )}
          {prospect.sources && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
              {prospect.sources}
            </span>
          )}
          {prospect.priority && (
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
              prospect.priority === 'high' ? 'bg-red-100 text-red-700' :
              prospect.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {prospect.priority} priority
            </span>
          )}
        </div>
      </div>

      {/* Contact & company info */}
      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">Contact & Company</h4>
        </div>
        <div className="ext-card-body">
        <DetailRow label="Email">
          {prospect.email && (
            <a href={`mailto:${prospect.email}`} className="text-primary-600 hover:underline">{prospect.email}</a>
          )}
        </DetailRow>
        <DetailRow label="Company">{prospect.company_name}</DetailRow>
        <DetailRow label="Company Size">{prospect.company_size}</DetailRow>
        <DetailRow label="Location">{prospect.location}</DetailRow>
        <DetailRow label="Website">
          {prospect.website_link && (
            <a href={prospect.website_link} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">{prospect.website_link}</a>
          )}
        </DetailRow>
        <DetailRow label="LinkedIn">
          {prospect.linkedin_url && (
            <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">{prospect.linkedin_url}</a>
          )}
        </DetailRow>
        </div>
      </div>

      {/* Intent info */}
      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">Intent</h4>
        </div>
        <div className="ext-card-body">
        <DetailRow label="Intent Category">{prospect.intent_category}</DetailRow>
        <DetailRow label="Intent Skills">
          {prospect.intent_skills && prospect.intent_skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {prospect.intent_skills.map((s, i) => (
                <span key={i} className="ext-badge ext-badge-primary">{s}</span>
              ))}
            </div>
          ) : null}
        </DetailRow>
        <DetailRow label="Intent Proof Link">
          {prospect.intent_proof_link && (
            <a href={prospect.intent_proof_link} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">{prospect.intent_proof_link}</a>
          )}
        </DetailRow>
        <DetailRow label="Intent Date">
          {prospect.intent_date && new Date(prospect.intent_date).toLocaleDateString()}
        </DetailRow>
        </div>
      </div>

      {/* Editable fields for LH */}
      <div className="ext-card overflow-hidden border-primary-200/60 space-y-4 ext-card-body">
        <h4 className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Update</h4>

        {/* ── LC Phase fields ── */}
        {isLCPhase ? (
          <>
            {/* Next Follow-up Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Next Follow-up Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Lead Score */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lead Score</label>
              <input
                type="number"
                min="0"
                max="100"
                value={leadScore}
                onChange={(e) => setLeadScore(e.target.value)}
                placeholder="0 – 100"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Pitch Description */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pitch Description</label>
              <textarea
                value={pitchDescription}
                onChange={(e) => setPitchDescription(e.target.value)}
                placeholder="Describe the pitch…"
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Pitched Source */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pitched Source</label>
              <select
                value={pitchedSource}
                onChange={(e) => setPitchedSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">— Select —</option>
                <option value="linkedin">LinkedIn</option>
                <option value="email">Email</option>
                <option value="number">Number</option>
              </select>
            </div>

            {/* Validation hint */}
            {!canSave && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1">
                <p className="text-xs font-semibold text-amber-700">Required to save:</p>
                <p className="text-xs text-amber-600">• Set a Next Follow-up Date</p>
              </div>
            )}

            {/* Info: last_contacted_at will be auto-set */}
            {canSave && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-center">
                <p className="text-xs text-slate-500">
                  Last Contacted will be set to <span className="font-semibold text-slate-700">now</span> on save
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Assigned / LNC Phase fields ── */}
            {/* Lead Score */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lead Score</label>
              <input
                type="number"
                min="0"
                max="100"
                value={leadScore}
                onChange={(e) => setLeadScore(e.target.value)}
                placeholder="0 – 100"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* LinkedIn Connection */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">LinkedIn Connection</label>
              <select
                value={linkedinConnection}
                onChange={(e) => setLinkedinConnection(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="none">None</option>
                <option value="invite">Invite</option>
                <option value="connected">Connected</option>
              </select>
            </div>

            {/* LinkedIn Profile (from logged-in LH user) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">LinkedIn Profile</label>
              {availableProfile ? (
                <select
                  value={linkedinProfileId}
                  onChange={(e) => setLinkedinProfileId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">— Select Profile —</option>
                  <option value={availableProfile.id}>
                    {availableProfile.name}{availableProfile.niche ? ` (${availableProfile.niche})` : ''}
                  </option>
                </select>
              ) : (
                <p className="text-xs text-amber-600 py-1.5">No LinkedIn profile linked to your account. Contact admin.</p>
              )}
            </div>

            {/* Validation hints */}
            {!canSave && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1">
                <p className="text-xs font-semibold text-amber-700">Required to save:</p>
                {isLNCPhase ? (
                  linkedinConnection !== 'connected' && (
                    <p className="text-xs text-amber-600">• Set LinkedIn Connection to "Connected"</p>
                  )
                ) : (
                  linkedinConnection !== 'invite' && (
                    <p className="text-xs text-amber-600">• Set LinkedIn Connection to "Invite"</p>
                  )
                )}
                {!linkedinProfileId && (
                  <p className="text-xs text-amber-600">• Select a LinkedIn Profile</p>
                )}
              </div>
            )}

            {/* Status preview */}
            {canSave && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-center">
                <p className="text-xs text-slate-500">
                  Status will be set to{' '}
                  <span className={`font-semibold ${isLNCPhase ? 'text-emerald-600' : 'text-red-600'}`}>
                    {getTargetStatus()}
                  </span>
                  {prospect.email ? ' (email present)' : ' (no email)'}
                </p>
              </div>
            )}
          </>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSave}
          title={!canSave ? (isLCPhase ? 'Set a follow-up date to save' : 'Complete required fields to save') : ''}
          className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              Saving…
            </>
          ) : (
            'Save Changes'
          )}
        </button>

        {saveMsg && (
          <p className={`text-xs font-medium text-center ${saveMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {saveMsg.text}
          </p>
        )}
      </div>

      {/* About */}
      {prospect.about_prospect && (
        <div className="ext-card overflow-hidden">
          <div className="ext-card-header">
            <h4 className="ext-card-header-title">About</h4>
          </div>
          <div className="ext-card-body">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{prospect.about_prospect}</p>
          </div>
        </div>
      )}

      {/* Pitch info (if any) */}
      {(prospect.pitch_description || prospect.pitched_source || prospect.pitch_date) && (
        <div className="ext-card overflow-hidden">
          <div className="ext-card-header">
            <h4 className="ext-card-header-title">Pitch</h4>
          </div>
          <div className="ext-card-body">
          <DetailRow label="Pitch Description">{prospect.pitch_description}</DetailRow>
          <DetailRow label="Pitched Source">{prospect.pitched_source}</DetailRow>
          <DetailRow label="Pitch Date">{prospect.pitch_date && new Date(prospect.pitch_date).toLocaleDateString()}</DetailRow>
          <DetailRow label="Pitch Response">{prospect.pitch_response}</DetailRow>
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">Details</h4>
        </div>
        <div className="ext-card-body">
        <DetailRow label="Created">{prospect.created_at && new Date(prospect.created_at).toLocaleDateString()}</DetailRow>
        <DetailRow label="Last Contacted">{prospect.last_contacted_at && new Date(prospect.last_contacted_at).toLocaleDateString()}</DetailRow>
        <DetailRow label="Next Follow-up">{prospect.next_follow_up_date && new Date(prospect.next_follow_up_date).toLocaleDateString()}</DetailRow>
        <DetailRow label="Campaign">{prospect.campaign_name}</DetailRow>
        </div>
      </div>
    </div>
  );
};

// ── DC_R Tabs component ─────────────────────────────────────────────
const DC_R_TABS = [
  { key: 'new', label: 'New' },
  { key: 'redefine', label: 'Redefine' },
  { key: 'assigned', label: 'Assigned' },
];

const DCRTabsView = ({ onRequestCaptureSelection }) => {
  const {
    activeProspect, startNewProspect, clearProspect, loadProspect, userId,
    panelActiveTab, setPanelActiveTab, panelEditingFromTab, setPanelEditingFromTab, panelStateLoaded
  } = useProspect();
  const activeTab = panelActiveTab && DC_R_TABS.some((t) => t.key === panelActiveTab) ? panelActiveTab : 'new';
  const setActiveTab = setPanelActiveTab;
  const editingFromTab = panelEditingFromTab;
  const setEditingFromTab = setPanelEditingFromTab;
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newTabSearch, setNewTabSearch] = useState('');
  const [newTabCategory, setNewTabCategory] = useState('');
  const [newTabDateFrom, setNewTabDateFrom] = useState('');
  const [newTabDateTo, setNewTabDateTo] = useState('');
  const [newTabSkill, setNewTabSkill] = useState('');
  const [skills, setSkills] = useState([]);
  const wasEditingRef = React.useRef(false); // tracks if user was in form (not cleared manually)

  // Fetch skills for filter
  useEffect(() => {
    fetch(`${API_URL}/skills`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]));
  }, []);

  const fetchUserProspects = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/prospects/user/${userId}`);
      if (!res.ok) throw new Error('Failed to load prospects');
      const data = await res.json();
      setProspects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error loading prospects');
      setProspects([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch prospects when switching to any list tab, or when userId changes
  useEffect(() => {
    if (activeTab === 'new' || activeTab === 'redefine' || activeTab === 'assigned') {
      fetchUserProspects();
    }
  }, [activeTab, fetchUserProspects]);

  // After a successful save: if NOT stay-on-new, activeProspect goes null → switch to Redefine tab.
  // If stay-on-new, activeProspect is reloaded (never null) so we stay on New tab.
  useEffect(() => {
    if (activeProspect) {
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      setEditingFromTab(null);
      setActiveTab('redefine');
      fetchUserProspects();
    }
  }, [activeProspect, fetchUserProspects]);

  const stayOnNewAfterSave = activeTab === 'new' || editingFromTab === 'new';
  const handleSaveSuccess = () => {
    setEditingFromTab('new');
    setActiveTab('new');
    fetchUserProspects();
  };

  const handleSelectProspect = (p, fromTab) => {
    loadProspect(p);
    setEditingFromTab(fromTab);
  };

  const handleBackToTab = () => {
    // Manual back — disable the save-detection so it doesn't jump to redefine
    wasEditingRef.current = false;
    clearProspect();
    setEditingFromTab(null);
  };

  // Filter prospects per tab
  const newProspects = prospects.filter((p) => p.status === 'new');

  // Apply search + filters for New tab
  const newTabSearchLower = newTabSearch.trim().toLowerCase();
  const newProspectsFiltered = newProspects.filter((p) => {
    // Search
    if (newTabSearchLower) {
      const name = (p.name || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const company = (p.company_name || '').toLowerCase();
      const category = (p.category || '').toLowerCase();
      const source = (p.sources || '').toLowerCase();
      const status = (p.status || '').toLowerCase();
      const matchesSearch = name.includes(newTabSearchLower) || email.includes(newTabSearchLower) ||
        company.includes(newTabSearchLower) || category.includes(newTabSearchLower) ||
        source.includes(newTabSearchLower) || status.includes(newTabSearchLower);
      if (!matchesSearch) return false;
    }
    // Category filter
    if (newTabCategory && p.category !== newTabCategory) return false;
    // Date filter (created_at)
    if (newTabDateFrom || newTabDateTo) {
      const createdAt = p.created_at ? new Date(p.created_at) : null;
      if (!createdAt) return false;
      const createdDate = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
      if (newTabDateFrom) {
        const fromDate = new Date(newTabDateFrom);
        if (createdDate < fromDate) return false;
      }
      if (newTabDateTo) {
        const toDate = new Date(newTabDateTo);
        if (createdDate > toDate) return false;
      }
    }
    // Skill filter (intent_skills contains selected skill name)
    if (newTabSkill) {
      const skillNames = Array.isArray(p.intent_skills) ? p.intent_skills : [];
      const selectedSkillName = skills.find((s) => s.id === newTabSkill)?.name || newTabSkill;
      if (!skillNames.some((s) => (s || '').toLowerCase() === (selectedSkillName || '').toLowerCase())) return false;
    }
    return true;
  });
  const redefineProspects = prospects.filter((p) => p.status === 'data_refined' && !p.lh_user_id);
  const assignedProspects = prospects.filter((p) => p.status === 'data_refined' && !!p.lh_user_id);

  // If editing a prospect loaded from a tab list, show the form with a back button
  if (activeProspect && editingFromTab) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleBackToTab}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Back to {DC_R_TABS.find((t) => t.key === editingFromTab)?.label || 'list'}
        </button>
<div className="ext-card ext-card-body py-2.5 flex flex-row items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Editing Prospect</span>
              </div>
        <ProspectForm
          stayOnNewAfterSave={stayOnNewAfterSave}
          onSaveSuccess={handleSaveSuccess}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="ext-card ext-card-body p-1 flex">
        {DC_R_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              wasEditingRef.current = false;
              clearProspect();
              setEditingFromTab(null);
              setActiveTab(tab.key);
            }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'new' && (
        <>
          {!activeProspect ? (
            <div className="space-y-4">
              {/* Create new section */}
              <div className="ext-card ext-card-body">
                <h3 className="text-base font-bold text-slate-800 mb-1.5">
                  Capture New Prospect
                </h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  Select text and copy (Ctrl+C), or start a new session.
                </p>
                <div className="space-y-2.5">
                  {typeof onRequestCaptureSelection === 'function' && (
                    <button
                      type="button"
                      onClick={onRequestCaptureSelection}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <MousePointer2 className="w-4 h-4" strokeWidth={2} />
                      Capture selection
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFromTab(null);
                      startNewProspect();
                    }}
                    className="w-full rounded-lg bg-primary-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" strokeWidth={2.5} />
                    Start New Prospect
                  </button>
                </div>
              </div>

              {/* List of prospects with 'new' status */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    New Prospects ({newProspectsFiltered.length}
                    {newTabSearch.trim() || newTabCategory || newTabDateFrom || newTabDateTo || newTabSkill ? ` of ${newProspects.length}` : ''})
                  </h3>
                  <button type="button" onClick={fetchUserProspects} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors shrink-0" title="Refresh">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" strokeWidth={2} />
                  <input
                    type="search"
                    placeholder="Search by name, email, company..."
                    value={newTabSearch}
                    onChange={(e) => setNewTabSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Category</label>
                    <select
                      value={newTabCategory}
                      onChange={(e) => setNewTabCategory(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">All</option>
                      <option value="Entrepreneur">Entrepreneur</option>
                      <option value="Subcontractor">Subcontractor</option>
                      <option value="SME">SME</option>
                      <option value="HR">HR</option>
                      <option value="C_Level">C-Level</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Created (From)</label>
                    <input
                      type="date"
                      value={newTabDateFrom}
                      onChange={(e) => setNewTabDateFrom(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Created (To)</label>
                    <input
                      type="date"
                      value={newTabDateTo}
                      onChange={(e) => setNewTabDateTo(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Skill</label>
                    <select
                      value={newTabSkill}
                      onChange={(e) => setNewTabSkill(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">All</option>
                      {skills.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <ProspectList
                  prospects={newProspectsFiltered}
                  loading={loading}
                  error={error}
                  emptyText={
                    (newTabSearch.trim() || newTabCategory || newTabDateFrom || newTabDateTo || newTabSkill)
                      ? 'No matching prospects.'
                      : "No prospects with 'New' status."
                  }
                  onSelect={(p) => handleSelectProspect(p, 'new')}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="ext-card ext-card-body py-2.5 flex flex-row items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Active Prospect Session</span>
              </div>
              <ProspectForm
                stayOnNewAfterSave={stayOnNewAfterSave}
                onSaveSuccess={handleSaveSuccess}
              />
            </div>
          )}
        </>
      )}

      {activeTab === 'redefine' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Data Refined ({redefineProspects.length})</h3>
            <button type="button" onClick={fetchUserProspects} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={redefineProspects}
            loading={loading}
            error={error}
            emptyText="No data-refined prospects pending LH assignment."
            onSelect={(p) => handleSelectProspect(p, 'redefine')}
          />
        </div>
      )}

      {activeTab === 'assigned' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">LH Assigned ({assignedProspects.length})</h3>
            <button type="button" onClick={fetchUserProspects} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={assignedProspects}
            loading={loading}
            error={error}
            emptyText="No data-refined prospects with LH assigned yet."
            onSelect={(p) => handleSelectProspect(p, 'assigned')}
          />
        </div>
      )}
    </div>
  );
};

// ── LH Tabs component ───────────────────────────────────────────────
const LH_TABS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'lnc', label: 'LNC' },
  { key: 'lc', label: 'LC' },
  { key: 'task', label: 'Task' },
  { key: 'dashboard', label: 'Dashboard' },
];

const LH_CATEGORIES = ['Entrepreneur', 'Subcontractor', 'SME', 'HR', 'C_Level'];
const LH_LEAD_SCORE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1-25', label: '1–25' },
  { value: '26-50', label: '26–50' },
  { value: '51-75', label: '51–75' },
  { value: '76-100', label: '76–100' },
  { value: 'no_score', label: 'No score' },
];

const applyLHFilters = (list, { search, category, skill, leadScore }, skills) => {
  if (!list || !Array.isArray(list)) return [];
  const searchLower = (search || '').trim().toLowerCase();
  return list.filter((p) => {
    if (searchLower) {
      const name = (p.name || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const company = (p.company_name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const sources = (p.sources || '').toLowerCase();
      const status = (p.status || '').toLowerCase();
      const matches = name.includes(searchLower) || email.includes(searchLower) ||
        company.includes(searchLower) || cat.includes(searchLower) ||
        sources.includes(searchLower) || status.includes(searchLower);
      if (!matches) return false;
    }
    if (category && p.category !== category) return false;
    if (skill) {
      const skillNames = Array.isArray(p.intent_skills) ? p.intent_skills : [];
      const selectedName = skills.find((s) => s.id === skill)?.name || skill;
      if (!skillNames.some((s) => (s || '').toLowerCase() === (selectedName || '').toLowerCase())) return false;
    }
    if (leadScore) {
      const ls = p.lead_score;
      if (leadScore === 'no_score') {
        if (ls != null && ls !== '') return false;
      } else {
        const [min, max] = leadScore.split('-').map(Number);
        const n = typeof ls === 'number' ? ls : Number(ls);
        if (Number.isNaN(n)) return false;
        if (n < min || n > max) return false;
      }
    }
    return true;
  });
};

const LHTabsView = () => {
  const {
    activeProspect, clearProspect, loadProspect, userId,
    panelActiveTab, setPanelActiveTab, panelEditingFromTab, setPanelEditingFromTab, panelStateLoaded
  } = useProspect();
  const activeTab = panelActiveTab && LH_TABS.some((t) => t.key === panelActiveTab) ? panelActiveTab : 'assigned';
  const setActiveTab = setPanelActiveTab;
  const editingFromTab = panelEditingFromTab;
  const setEditingFromTab = setPanelEditingFromTab;
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lhSearch, setLhSearch] = useState('');
  const [lhCategory, setLhCategory] = useState('');
  const [lhSkill, setLhSkill] = useState('');
  const [lhLeadScore, setLhLeadScore] = useState('');
  const [skills, setSkills] = useState([]);
  const wasEditingRef = React.useRef(false);

  useEffect(() => {
    fetch(`${API_URL}/skills`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]));
  }, []);

  const fetchLHProspects = useCallback(async (overrideTab) => {
    const tab = overrideTab ?? activeTab;
    if (!userId && tab !== 'lnc' && tab !== 'lc') return;
    setLoading(true);
    setError(null);
    try {
      let url;
      if (tab === 'lnc') {
        url = `${API_URL}/prospects?status=LNC,B_LNC`;
      } else if (tab === 'lc') {
        url = `${API_URL}/prospects?status=LC,B_LC`;
      } else {
        url = `${API_URL}/prospects/lh/${userId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load prospects');
      const data = await res.json();
      setProspects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error loading prospects');
      setProspects([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab]);

  // Fetch when switching to list tabs (including task)
  useEffect(() => {
    if (['assigned', 'lnc', 'lc', 'task'].includes(activeTab)) {
      fetchLHProspects();
    }
  }, [activeTab, fetchLHProspects]);

  // After save, refresh and go to assigned tab
  useEffect(() => {
    if (activeProspect) {
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      setEditingFromTab(null);
      setActiveTab('assigned');
      fetchLHProspects('assigned');
    }
  }, [activeProspect, fetchLHProspects]);

  const handleSelectProspect = (p, fromTab) => {
    loadProspect(p);
    setEditingFromTab(fromTab);
  };

  const handleBackToTab = () => {
    wasEditingRef.current = false;
    clearProspect();
    setEditingFromTab(null);
  };

  // Filter prospects per tab
  const assignedProspects = prospects.filter((p) => p.status === 'data_refined');
  const lncProspects = prospects.filter((p) => p.status === 'LNC' || p.status === 'B_LNC');
  const lcProspects = prospects.filter((p) => p.status === 'LC' || p.status === 'B_LC');

  // Task tab: prospects whose next_follow_up_date is today (use local date to avoid timezone bugs)
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const toLocalDateString = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const taskProspects = prospects.filter((p) => {
    const followUpLocal = toLocalDateString(p.next_follow_up_date);
    return followUpLocal && followUpLocal === todayLocal;
  });

  const lhFilters = { search: lhSearch, category: lhCategory, skill: lhSkill, leadScore: lhLeadScore };
  const hasLhFilters = !!(lhSearch.trim() || lhCategory || lhSkill || lhLeadScore);

  const assignedProspectsFiltered = applyLHFilters(assignedProspects, lhFilters, skills);
  const lncProspectsFiltered = applyLHFilters(lncProspects, lhFilters, skills);
  const lcProspectsFiltered = applyLHFilters(lcProspects, lhFilters, skills);
  const taskProspectsFiltered = applyLHFilters(taskProspects, lhFilters, skills);

  const prospectsFiltered = applyLHFilters(prospects, lhFilters, skills);
  const totalProspects = prospectsFiltered.length;
  const statusCounts = prospectsFiltered.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  // If viewing a prospect detail from a tab
  if (activeProspect && editingFromTab) {
    return (
      <ProspectDetailCard
        prospect={activeProspect}
        onBack={handleBackToTab}
        backLabel={`Back to ${LH_TABS.find((t) => t.key === editingFromTab)?.label || 'list'}`}
        onUpdated={fetchLHProspects}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab bar — compact for 5 tabs */}
      <div className="flex rounded-lg bg-white border border-slate-200 p-1 shadow-sm">
        {LH_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              wasEditingRef.current = false;
              clearProspect();
              setEditingFromTab(null);
              setActiveTab(tab.key);
            }}
            className={`flex-1 py-2 px-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters — shared across list tabs and dashboard */}
      {['assigned', 'lnc', 'lc', 'task', 'dashboard'].includes(activeTab) && (
        <div className="ext-card ext-card-body space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" strokeWidth={2} />
              <input
                type="search"
                placeholder="Search..."
                value={lhSearch}
                onChange={(e) => setLhSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={lhCategory}
              onChange={(e) => setLhCategory(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-0"
              title="Category"
            >
              <option value="">All categories</option>
              {LH_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={lhSkill}
              onChange={(e) => setLhSkill(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-0"
              title="Skill"
            >
              <option value="">All skills</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={lhLeadScore}
              onChange={(e) => setLhLeadScore(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-0"
              title="Lead Score"
            >
              {LH_LEAD_SCORE_OPTIONS.map((o) => (
                <option key={o.value || 'any'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Assigned tab */}
      {activeTab === 'assigned' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Assigned ({assignedProspectsFiltered.length}{hasLhFilters ? ` of ${assignedProspects.length}` : ''})
            </h3>
            <button type="button" onClick={fetchLHProspects} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={assignedProspectsFiltered}
            loading={loading}
            error={error}
            emptyText={hasLhFilters ? 'No matching prospects.' : 'No prospects assigned to you yet.'}
            onSelect={(p) => handleSelectProspect(p, 'assigned')}
          />
        </div>
      )}

      {/* LNC tab */}
      {activeTab === 'lnc' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              LNC ({lncProspectsFiltered.length}{hasLhFilters ? ` of ${lncProspects.length}` : ''})
            </h3>
            <button type="button" onClick={fetchLHProspects} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={lncProspectsFiltered}
            loading={loading}
            error={error}
            emptyText={hasLhFilters ? 'No matching prospects.' : 'No prospects in LNC status.'}
            onSelect={(p) => handleSelectProspect(p, 'lnc')}
          />
        </div>
      )}

      {/* LC tab */}
      {activeTab === 'lc' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              LC ({lcProspectsFiltered.length}{hasLhFilters ? ` of ${lcProspects.length}` : ''})
            </h3>
            <button type="button" onClick={fetchLHProspects} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={lcProspectsFiltered}
            loading={loading}
            error={error}
            emptyText={hasLhFilters ? 'No matching prospects.' : 'No prospects in LC status.'}
            onSelect={(p) => handleSelectProspect(p, 'lc')}
          />
        </div>
      )}

      {/* Task tab */}
      {activeTab === 'task' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Today&apos;s Follow-ups ({taskProspectsFiltered.length}{hasLhFilters ? ` of ${taskProspects.length}` : ''})
            </h3>
            <button type="button" onClick={fetchLHProspects} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={taskProspectsFiltered}
            loading={loading}
            error={error}
            emptyText={hasLhFilters ? 'No matching prospects.' : "No follow-ups scheduled for today."}
            onSelect={(p) => handleSelectProspect(p, 'task')}
          />
        </div>
      )}

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">
            Dashboard{hasLhFilters ? ` (${totalProspects} of ${prospects.length} shown)` : ''}
          </h3>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="ext-card ext-card-body">
              <p className="text-xs font-medium text-slate-500">Total Assigned</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalProspects}</p>
            </div>
            <div className="ext-card ext-card-body">
              <p className="text-xs font-medium text-slate-500">LNC</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{(statusCounts['LNC'] || 0) + (statusCounts['B_LNC'] || 0)}</p>
            </div>
            <div className="ext-card ext-card-body">
              <p className="text-xs font-medium text-slate-500">LC</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{(statusCounts['LC'] || 0) + (statusCounts['B_LC'] || 0)}</p>
            </div>
            <div className="ext-card ext-card-body">
              <p className="text-xs font-medium text-slate-500">Communication</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{statusCounts['COMMUNICATION'] || 0}</p>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="ext-card overflow-hidden">
            <div className="ext-card-header">
              <h4 className="ext-card-header-title">Status Breakdown</h4>
            </div>
            <div className="ext-card-body space-y-2">
              {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{status.replace('_', ' ')}</span>
                  <span className="text-sm font-semibold text-slate-800">{count}</span>
                </div>
              ))}
              {Object.keys(statusCounts).length === 0 && (
                <p className="text-sm text-slate-400">No data yet.</p>
              )}
            </div>
          </div>

          <button type="button" onClick={fetchLHProspects} className="w-full rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
            Refresh Data
          </button>
        </div>
      )}
    </div>
  );
};

// ── Default view for non-DC_R/LH roles ──────────────────────────────
const DefaultView = ({ onRequestCaptureSelection }) => {
  const { activeProspect, startNewProspect, clearProspect, loadProspect } = useProspect();
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

  if (viewMode === 'prospects') {
    return (
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
        <ProspectList
          prospects={prospects}
          loading={prospectsLoading}
          error={prospectsError}
          emptyText="No prospects saved yet."
          onSelect={(p) => {
            loadProspect(p);
            setFromProspectsList(true);
            setViewMode('home');
          }}
        />
      </div>
    );
  }

  if (!activeProspect) {
    return (
      <div className="ext-card ext-card-body">
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
    );
  }

  return (
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
  );
};

// ── Main OverlayPanel ───────────────────────────────────────────────
const OverlayPanel = ({ onRequestCaptureSelection }) => {
  const { isCollapsed, setIsCollapsed, reloadDraftFromStorage, authUser, logout } = useProspect();
  const [panelView, setPanelView] = React.useState('main'); // 'main' | 'settings'

  const isDCR = authUser?.role === 'DC_R';
  const isLH = authUser?.role === 'LH';

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
          {/* Header */}
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

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
            <div className="flex-1 overflow-y-auto scroll-thin p-4" data-scroll-container>
              {panelView === 'settings' ? (
                <SettingsPage onBack={() => setPanelView('main')} />
              ) : isDCR ? (
                <DCRTabsView onRequestCaptureSelection={onRequestCaptureSelection} />
              ) : isLH ? (
                <LHTabsView />
              ) : (
                <DefaultView onRequestCaptureSelection={onRequestCaptureSelection} />
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col text-xs text-slate-500 truncate min-w-0 flex-1">
                  <span className="font-medium text-slate-700 truncate">{authUser?.name || authUser?.email || '—'}</span>
                  <span className="text-[11px] text-slate-400">{authUser?.role || ''}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPanelView('settings')}
                    title="Settings"
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Settings className="w-4 h-4" strokeWidth={2} />
                  </button>
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
