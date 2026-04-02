import React, { useState, useEffect, useCallback } from 'react';
import { useProspect } from '../context/ProspectContext';
import ProspectForm from './ProspectForm';
import { UserPlus, MousePointer2, PanelLeftClose, PanelLeft, RefreshCw, List, ArrowLeft, Loader2, Settings } from './icons';
import { Search } from 'lucide-react';
import SettingsPage from './SettingsPage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

import { API_URL } from '../config.js';
import {
  getAllProspectsFromDb,
  replaceAllProspectsInDb,
  upsertProspectInDb,
  getMetaValue,
  setMetaValue,
} from '../utils/prospectIndexedDb.js';

const LAST_SYNC_META_KEY = 'prospects_last_sync_at';
const SYNC_THRESHOLD_MS = 30 * 60 * 1000;
const PKT_TIMEZONE = 'Asia/Karachi';
const PKT_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: PKT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const PKT_DISPLAY_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: PKT_TIMEZONE,
});

const toLeadScoreOutOf10 = (raw) => {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
};

const fromLeadScoreOutOf10 = (outOf10) => {
  if (outOf10 == null || outOf10 === '') return null;
  const n = Number(outOf10);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
};

const toPktDayKey = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return PKT_DAY_FORMATTER.format(d);
};

const formatPktDate = (dateVal) => {
  const dayKey = toPktDayKey(dateVal);
  if (!dayKey) return null;
  const d = new Date(dateVal);
  return PKT_DISPLAY_FORMATTER.format(d);
};

const getOverdueDays = (dateVal) => {
  const followUpDay = toPktDayKey(dateVal);
  const todayDay = toPktDayKey(new Date());
  if (!followUpDay || !todayDay || followUpDay >= todayDay) return 0;
  const followUpUtc = Date.parse(`${followUpDay}T00:00:00Z`);
  const todayUtc = Date.parse(`${todayDay}T00:00:00Z`);
  if (!Number.isFinite(followUpUtc) || !Number.isFinite(todayUtc)) return 0;
  return Math.floor((todayUtc - followUpUtc) / (24 * 60 * 60 * 1000));
};

const getProspectSyncEndpoint = (role, userId) => {
  if (role === 'DC_R' && userId) return `${API_URL}/prospects/user/${userId}`;
  if (role === 'LH' && userId) return `${API_URL}/prospects/lh/${userId}`;
  return `${API_URL}/prospects`;
};

const upsertProspectInList = (list, prospect) => {
  if (!prospect || !prospect.id) return Array.isArray(list) ? list : [];
  const src = Array.isArray(list) ? list : [];
  const idx = src.findIndex((p) => p.id === prospect.id);
  if (idx === -1) return [prospect, ...src];
  const next = [...src];
  next[idx] = prospect;
  return next;
};

const normalizeExternalUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const ProspectExternalLink = ({ prospect, href, className = '', children, onClick, ...props }) => {
  const { rememberProspectContext } = useProspect();
  const normalizedHref = normalizeExternalUrl(href);

  if (!normalizedHref) return null;

  return (
    <a
      href={normalizedHref}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) rememberProspectContext(prospect);
      }}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
};

const ProspectMailLink = ({ prospect, email, className = '', children, onClick, ...props }) => {
  const { rememberProspectContext } = useProspect();
  const normalizedEmail = typeof email === 'string' ? email.trim() : '';

  if (!normalizedEmail) return null;

  return (
    <a
      href={`mailto:${normalizedEmail}`}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) rememberProspectContext(prospect);
      }}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
};

// ── Shared prospect card ────────────────────────────────────────────
const ProspectCard = ({ prospect, onClick, dueLabel = null }) => (
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
        <ProspectMailLink
          prospect={prospect}
          email={prospect.email}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-primary-600 hover:underline truncate block"
        >
          {prospect.email}
        </ProspectMailLink>
      )}
      <div className="flex flex-wrap gap-1.5">
        {prospect.category && (
          <span className="ext-badge ext-badge-slate">
            {String(prospect.category).replace('_', '-')}
          </span>
        )}
        {prospect.lead_score != null && (
          <span className="ext-badge bg-amber-100 text-amber-800" title="Lead score">
            Score: {toLeadScoreOutOf10(prospect.lead_score)}
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
      {dueLabel && (
        <div className="pt-1 border-t border-slate-100">
          <span className="inline-flex items-center rounded-md bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-semibold">
            {dueLabel}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 border-t border-slate-100">
        {prospect.linkedin_url && (
          <ProspectExternalLink
            prospect={prospect}
            href={prospect.linkedin_url}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary-600 hover:underline truncate max-w-full"
          >
            LinkedIn →
          </ProspectExternalLink>
        )}
        {prospect.website_link && (
          <ProspectExternalLink
            prospect={prospect}
            href={prospect.website_link}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary-600 hover:underline truncate max-w-full"
          >
            Website →
          </ProspectExternalLink>
        )}
        {prospect.intent_proof_link && (
          <ProspectExternalLink
            prospect={prospect}
            href={prospect.intent_proof_link}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary-600 hover:underline truncate max-w-full"
          >
            Intent Proof →
          </ProspectExternalLink>
        )}
      </div>
    </div>
  </button>
);

// ── Prospect list (reusable) ────────────────────────────────────────
const ProspectList = ({ prospects, loading, error, emptyText, onSelect, getDueLabel }) => {
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
        <ProspectCard
          key={p.id}
          prospect={p}
          dueLabel={typeof getDueLabel === 'function' ? getDueLabel(p) : null}
          onClick={() => onSelect(p)}
        />
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

const DCRDetailCard = ({ prospect, onBack, backLabel }) => {
  if (!prospect) return null;

  const statusLabel = prospect.status ? String(prospect.status).replace(/_/g, ' ') : '—';

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

      <div className="ext-card ext-card-body">
        <h3 className="text-lg font-bold text-slate-800">{prospect.name || '—'}</h3>
        <p className="text-sm text-slate-500">{prospect.company_name || '—'}</p>
      </div>

      {(prospect.website_link || prospect.linkedin_url || prospect.intent_proof_link) && (
        <div className="ext-card overflow-hidden">
          <div className="ext-card-body py-2.5">
            <div className="flex flex-wrap gap-2">
              {prospect.website_link && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.website_link}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Website
                </ProspectExternalLink>
              )}
              {prospect.linkedin_url && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.linkedin_url}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  LinkedIn
                </ProspectExternalLink>
              )}
              {prospect.intent_proof_link && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.intent_proof_link}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Intent Proof
                </ProspectExternalLink>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">Basic Info</h4>
        </div>
        <div className="ext-card-body">
          <DetailRow label="Email">{prospect.email || '—'}</DetailRow>
          <DetailRow label="Job Title">{prospect.job_title || '—'}</DetailRow>
          <DetailRow label="Website">
            {prospect.website_link ? (
              <ProspectExternalLink
                prospect={prospect}
                href={prospect.website_link}
                className="text-primary-600 hover:underline truncate block"
              >
                {prospect.website_link}
              </ProspectExternalLink>
            ) : '—'}
          </DetailRow>
          <DetailRow label="LinkedIn">
            {prospect.linkedin_url ? (
              <ProspectExternalLink
                prospect={prospect}
                href={prospect.linkedin_url}
                className="text-primary-600 hover:underline truncate block"
              >
                {prospect.linkedin_url}
              </ProspectExternalLink>
            ) : '—'}
          </DetailRow>
          <DetailRow label="Intent Proof Link">
            {prospect.intent_proof_link ? (
              <ProspectExternalLink
                prospect={prospect}
                href={prospect.intent_proof_link}
                className="text-primary-600 hover:underline truncate block"
              >
                {prospect.intent_proof_link}
              </ProspectExternalLink>
            ) : '—'}
          </DetailRow>
          <DetailRow label="Intent Skills">
            {Array.isArray(prospect.intent_skills) && prospect.intent_skills.length > 0 ? prospect.intent_skills.join(', ') : '—'}
          </DetailRow>
          <DetailRow label="Category">{prospect.category || '—'}</DetailRow>
          <DetailRow label="Intent Category">{prospect.intent_category || '—'}</DetailRow>
          <DetailRow label="Source">{prospect.sources || '—'}</DetailRow>
          <DetailRow label="Status">{statusLabel}</DetailRow>
          <DetailRow label="About Prospect">{prospect.about_prospect || '—'}</DetailRow>
        </div>
      </div>

      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">Assignments & Follow-up</h4>
        </div>
        <div className="ext-card-body">
          <DetailRow label="LH User ID">{prospect.lh_user_id || '—'}</DetailRow>
          <DetailRow label="Lead Score (LH)">{prospect.lead_score == null ? '—' : prospect.lead_score}</DetailRow>
          <DetailRow label="Next Follow-up (LH)">{formatPktDate(prospect.next_follow_up_date) || '—'}</DetailRow>
          <DetailRow label="Last Contacted (LH)">{formatPktDate(prospect.last_contacted_at) || '—'}</DetailRow>
          <DetailRow label="Lead Score (EM)">{prospect.lead_score_em == null ? '—' : prospect.lead_score_em}</DetailRow>
          <DetailRow label="Next Follow-up (EM)">{formatPktDate(prospect.next_follow_up_em) || '—'}</DetailRow>
          <DetailRow label="Last Contacted (EM)">{formatPktDate(prospect.last_contacted_at_em) || '—'}</DetailRow>
        </div>
      </div>

      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">Meta</h4>
        </div>
        <div className="ext-card-body">
          <DetailRow label="Created">{formatPktDate(prospect.created_at) || '—'}</DetailRow>
          <DetailRow label="Pitched Source">{prospect.pitched_source || '—'}</DetailRow>
          <DetailRow label="Pitch Description">{prospect.pitch_description || '—'}</DetailRow>
          <DetailRow label="Pitched Description (EM)">{prospect.pitched_description_em || '—'}</DetailRow>
          <DetailRow label="Response (LH)">{prospect.response_lh == null ? '—' : prospect.response_lh ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Response (EM)">{prospect.response_em == null ? '—' : prospect.response_em ? 'Yes' : 'No'}</DetailRow>
        </div>
      </div>
    </div>
  );
};

const ProspectDetailCard = ({ prospect, onBack, backLabel, onUpdated }) => {
  const { authUser } = useProspect();
  const [leadScore, setLeadScore] = useState(
    prospect?.lead_score != null ? (toLeadScoreOutOf10(prospect.lead_score) ?? '') : ''
  );
  const [linkedinConnection, setLinkedinConnection] = useState(prospect?.linkedin_connection || 'none');
  const [linkedinProfileId, setLinkedinProfileId] = useState(prospect?.linkedin_profile_id || '');
  const [nextFollowUpDate, setNextFollowUpDate] = useState(prospect?.next_follow_up_date ? prospect.next_follow_up_date.slice(0, 10) : '');
  const [pitchDescription, setPitchDescription] = useState(prospect?.pitch_description || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // Reset fields when prospect changes — default profile to user's if prospect has none
  useEffect(() => {
    if (prospect) {
      setLeadScore(
        prospect.lead_score != null ? (toLeadScoreOutOf10(prospect.lead_score) ?? '') : ''
      );
      setLinkedinConnection(prospect.linkedin_connection || 'none');
      setLinkedinProfileId(
        prospect.linkedin_profile_id || authUser?.linkedin_profile_id || ''
      );
      setNextFollowUpDate(prospect.next_follow_up_date ? prospect.next_follow_up_date.slice(0, 10) : '');
      setPitchDescription(prospect.pitch_description || '');
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
          lead_score: leadScore === '' ? null : fromLeadScoreOutOf10(leadScore),
          next_follow_up_date: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : null,
          pitch_description: pitchDescription || null,
          pitched_source: 'linkedin',
          last_contacted_at: new Date().toISOString(), // auto-timestamp on update
        };
      } else {
        // Assigned / LNC phase: status transition
        const newStatus = getTargetStatus();
        body = {
          lead_score: leadScore === '' ? null : fromLeadScoreOutOf10(leadScore),
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
      const updatedProspect = await res.json();

      const successText = isLCPhase
        ? 'Saved — follow-up recorded'
        : `Saved — status set to ${getTargetStatus()}`;
      setSaveMsg({ type: 'success', text: successText });
      if (typeof onUpdated === 'function') onUpdated(updatedProspect);
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
      {(prospect.website_link || prospect.linkedin_url || prospect.intent_proof_link) && (
        <div className="ext-card overflow-hidden">
          <div className="ext-card-body py-2.5">
            <div className="flex flex-wrap gap-2">
              {prospect.website_link && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.website_link}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Website
                </ProspectExternalLink>
              )}
              {prospect.linkedin_url && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.linkedin_url}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  LinkedIn
                </ProspectExternalLink>
              )}
              {prospect.intent_proof_link && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.intent_proof_link}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Intent Proof
                </ProspectExternalLink>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">Contact & Company</h4>
        </div>
        <div className="ext-card-body">
        <DetailRow label="Email">
          {prospect.email && (
            <ProspectMailLink prospect={prospect} email={prospect.email} className="text-primary-600 hover:underline">
              {prospect.email}
            </ProspectMailLink>
          )}
        </DetailRow>
        <DetailRow label="Company">{prospect.company_name}</DetailRow>
        <DetailRow label="Company Size">{prospect.company_size}</DetailRow>
        <DetailRow label="Location">{prospect.location}</DetailRow>
        <DetailRow label="Website">
          {prospect.website_link && (
            <ProspectExternalLink prospect={prospect} href={prospect.website_link} className="text-primary-600 hover:underline truncate block">
              {prospect.website_link}
            </ProspectExternalLink>
          )}
        </DetailRow>
        <DetailRow label="LinkedIn">
          {prospect.linkedin_url && (
            <ProspectExternalLink prospect={prospect} href={prospect.linkedin_url} className="text-primary-600 hover:underline truncate block">
              {prospect.linkedin_url}
            </ProspectExternalLink>
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
            <ProspectExternalLink prospect={prospect} href={prospect.intent_proof_link} className="text-primary-600 hover:underline truncate block">
              {prospect.intent_proof_link}
            </ProspectExternalLink>
          )}
        </DetailRow>
        <DetailRow label="Intent Date">
          {formatPktDate(prospect.intent_date)}
        </DetailRow>
        </div>
      </div>

      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">EM (read-only)</h4>
        </div>
        <div className="ext-card-body">
          <DetailRow label="Lead Score (EM)">{prospect.lead_score_em == null ? '—' : prospect.lead_score_em}</DetailRow>
          <DetailRow label="Pitched Description (EM)">{prospect.pitched_description_em ? prospect.pitched_description_em : '—'}</DetailRow>
          <DetailRow label="Next Follow-up (EM)">
            {formatPktDate(prospect.next_follow_up_em) || '—'}
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
                max="10"
                value={leadScore}
                onChange={(e) => setLeadScore(e.target.value)}
                placeholder="0 – 10"
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
                max="10"
                value={leadScore}
                onChange={(e) => setLeadScore(e.target.value)}
                placeholder="0 – 10"
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
          <DetailRow label="Pitch Date">{formatPktDate(prospect.pitch_date)}</DetailRow>
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
        <DetailRow label="Created">{formatPktDate(prospect.created_at)}</DetailRow>
        <DetailRow label="Last Contacted">{formatPktDate(prospect.last_contacted_at)}</DetailRow>
        <DetailRow label="Next Follow-up">{formatPktDate(prospect.next_follow_up_date)}</DetailRow>
        <DetailRow label="Campaign">{prospect.campaign_name}</DetailRow>
        </div>
      </div>
    </div>
  );
};

// ── DC_R Dashboard tab (mirrors dashboard_leadsystem /dcr page) ───────
const STATUS_STYLE_DCR = {
  new: { bg: '#e3f2fd', text: '#1565c0' },
  data_refined: { bg: '#f3e5f5', text: '#7b1fa2' },
  use_in_campaign: { bg: '#fff8e1', text: '#f57f17' },
  pitch: { bg: '#e8f5e9', text: '#2e7d32' },
  LNC: { bg: '#fce4ec', text: '#c62828' },
  B_LNC: { bg: '#fbe9e7', text: '#d84315' },
  LC: { bg: '#e0f7fa', text: '#00838f' },
  B_LC: { bg: '#e0f2f1', text: '#00695c' },
  COMMUNICATION: { bg: '#ede7f6', text: '#4527a0' },
  TRASH: { bg: '#efebe9', text: '#4e342e' },
};
const STATUS_LABELS_DCR = {
  new: 'New', data_refined: 'Data Refined', use_in_campaign: 'Use in Campaign', pitch: 'Pitch',
  LNC: 'LNC', B_LNC: 'B-LNC', LC: 'LC', B_LC: 'B-LC', COMMUNICATION: 'Communication', TRASH: 'Trash',
};
const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4445'];

const formatSource = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');
const formatCategory = (c) => (c === 'Uncategorized' ? c : c.replace(/_/g, '-'));

const DCRDashboardTab = ({ prospects = [], onSyncNow, syncing }) => {
  const list = Array.isArray(prospects) ? prospects : [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const isWithinRange = (dateVal, start, end) => {
    if (!dateVal) return false;
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return false;
    return d >= start && d < end;
  };

  const stats = {
    totalProspects: list.length,
    todaysProspects: list.filter((p) => isWithinRange(p.created_at, startOfToday, endOfToday)).length,
    thisWeeksProspects: list.filter((p) => isWithinRange(p.created_at, startOfWeek, endOfToday)).length,
    newProspects: list.filter((p) => p.status === 'new').length,
    dataRefinedProspects: list.filter((p) => p.status === 'data_refined').length,
    assignedToLH: list.filter((p) => !!p.lh_user_id).length,
  };

  const cardCls = 'ext-card ext-card-body';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">DC&R Dashboard</h3>
        <button type="button" onClick={onSyncNow} disabled={syncing} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-60">
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      <section>
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">My DC&R Statistics</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Total Prospects</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{stats?.totalProspects ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Today&apos;s</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{stats?.todaysProspects ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">This Week&apos;s</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{stats?.thisWeeksProspects ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Assigned Leads</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{stats?.assignedToLH ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">New Prospects</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{stats?.newProspects ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Data Refined</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{stats?.dataRefinedProspects ?? '—'}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

// ── DC_R Tabs component ─────────────────────────────────────────────
const DC_R_TABS = [
  { key: 'new', label: 'New' },
  { key: 'redefine', label: 'Redefine' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'dashboard', label: 'Dashboard' },
];

const DCRTabsView = ({ onRequestCaptureSelection, prospects = [], dataLoading = false, dataError = null, onSyncNow, onUpsertProspect }) => {
  const {
    activeProspect, startNewProspect, clearProspect, loadProspect,
    panelActiveTab, setPanelActiveTab, panelEditingFromTab, setPanelEditingFromTab, panelStateLoaded
  } = useProspect();
  const activeTab = panelActiveTab && DC_R_TABS.some((t) => t.key === panelActiveTab) ? panelActiveTab : 'new';
  const setActiveTab = setPanelActiveTab;
  const editingFromTab = panelEditingFromTab;
  const setEditingFromTab = setPanelEditingFromTab;
  const [newTabSearch, setNewTabSearch] = useState('');
  const [newTabCategory, setNewTabCategory] = useState('');
  const [newTabIntentCategory, setNewTabIntentCategory] = useState('');
  const [newTabDateFrom, setNewTabDateFrom] = useState('');
  const [newTabDateTo, setNewTabDateTo] = useState('');
  const [newTabSkill, setNewTabSkill] = useState('');
  const [newFiltersExpanded, setNewFiltersExpanded] = useState(true);
  const [skills, setSkills] = useState([]);
  const wasEditingRef = React.useRef(false); // tracks if user was in form (not cleared manually)

  // Fetch skills for filter
  useEffect(() => {
    fetch(`${API_URL}/skills`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]));
  }, []);

  // After a successful save: if NOT stay-on-new, activeProspect goes null → switch to Redefine tab.
  // If stay-on-new, activeProspect is reloaded (never null) so we stay on New tab.
  useEffect(() => {
    if (activeProspect) {
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      setEditingFromTab(null);
      setActiveTab('redefine');
    }
  }, [activeProspect]);

  const stayOnNewAfterSave = activeTab === 'new' || editingFromTab === 'new';
  const handleSaveSuccess = (savedProspect) => {
    if (savedProspect && typeof onUpsertProspect === 'function') onUpsertProspect(savedProspect);
    if (stayOnNewAfterSave) {
      setEditingFromTab('new');
      setActiveTab('new');
    }
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
    // Intent category filter
    if (newTabIntentCategory && p.intent_category !== newTabIntentCategory) return false;
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
  const assignedProspects = prospects.filter((p) => !!p.lh_user_id);

  // DCR detail rules:
  // - Assigned tab: read-only detail
  // - New/Data Refined tabs: editable form
  if (activeProspect && editingFromTab) {
    if (editingFromTab === 'assigned') {
      return (
        <DCRDetailCard
          prospect={activeProspect}
          onBack={handleBackToTab}
          backLabel={`Back to ${DC_R_TABS.find((t) => t.key === editingFromTab)?.label || 'list'}`}
        />
      );
    }

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
                    {newTabSearch.trim() || newTabCategory || newTabIntentCategory || newTabDateFrom || newTabDateTo || newTabSkill ? ` of ${newProspects.length}` : ''})
                  </h3>
                  <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors shrink-0" title="Sync">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                  </button>
                </div>
                <div className="ext-card ext-card-body border-primary-200/70 bg-primary-50/20 sticky top-2 z-10">
                  <button
                    type="button"
                    onClick={() => setNewFiltersExpanded((v) => !v)}
                    className="w-full flex items-center justify-between text-left mb-2"
                    title={newFiltersExpanded ? 'Collapse filters' : 'Expand filters'}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Filters</p>
                    <span className="inline-flex items-center gap-2 text-[11px] text-slate-500">
                      Search and narrow results
                      <span className="text-slate-600">{newFiltersExpanded ? '▾' : '▸'}</span>
                    </span>
                  </button>
                  {newFiltersExpanded && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" strokeWidth={2} />
                        <input
                          type="search"
                          placeholder="Search by name, email, company..."
                          value={newTabSearch}
                          onChange={(e) => setNewTabSearch(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-slate-600 uppercase">Category</label>
                          <select
                            value={newTabCategory}
                            onChange={(e) => setNewTabCategory(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
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
                          <label className="text-[10px] font-semibold text-slate-600 uppercase">Intent Category</label>
                          <select
                            value={newTabIntentCategory}
                            onChange={(e) => setNewTabIntentCategory(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                          >
                            <option value="">All</option>
                            <option value="Individual">Individual</option>
                            <option value="Business">Business</option>
                            <option value="Both">Both</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-slate-600 uppercase">Created (From)</label>
                          <input
                            type="date"
                            value={newTabDateFrom}
                            onChange={(e) => setNewTabDateFrom(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-slate-600 uppercase">Created (To)</label>
                          <input
                            type="date"
                            value={newTabDateTo}
                            onChange={(e) => setNewTabDateTo(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-slate-600 uppercase">Skill</label>
                          <select
                            value={newTabSkill}
                            onChange={(e) => setNewTabSkill(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                          >
                            <option value="">All</option>
                            {skills.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <ProspectList
                  prospects={newProspectsFiltered}
                  loading={dataLoading}
                  error={dataError}
                  emptyText={
                    (newTabSearch.trim() || newTabCategory || newTabIntentCategory || newTabDateFrom || newTabDateTo || newTabSkill)
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
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={redefineProspects}
            loading={dataLoading}
            error={dataError}
            emptyText="No data-refined prospects pending LH assignment."
            onSelect={(p) => handleSelectProspect(p, 'redefine')}
          />
        </div>
      )}

      {activeTab === 'assigned' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">LH Assigned ({assignedProspects.length})</h3>
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={assignedProspects}
            loading={dataLoading}
            error={dataError}
            emptyText="No data-refined prospects with LH assigned yet."
            onSelect={(p) => handleSelectProspect(p, 'assigned')}
          />
        </div>
      )}

      {activeTab === 'dashboard' && (
        <DCRDashboardTab prospects={prospects} onSyncNow={onSyncNow} syncing={dataLoading} />
      )}
    </div>
  );
};

// ── LH Dashboard tab (DB aggregation only) ─────────────────────────────
const formatCategoryLH = (c) => (c === 'Uncategorized' ? c : c.replace(/_/g, '-'));

const LHDashboardTab = ({ localProspects = [], onSyncNow, syncing }) => {
  const lhUserProspects = Array.isArray(localProspects) ? localProspects : [];
  const [categoryChartData, setCategoryChartData] = useState([]);
  const [categoryChartMinLeadScore, setCategoryChartMinLeadScore] = useState('');
  const [chartLoading, setChartLoading] = useState(true);
  const todayLocal = toPktDayKey(new Date());
  const lhStats = {
    totalProspectsAllTime: lhUserProspects.length,
    assignedProspects: lhUserProspects.filter((p) => p.status === 'data_refined').length,
    totalLCProspectsAllTime: lhUserProspects.filter((p) => p.status === 'LC' || p.status === 'B_LC').length,
    totalLNCProspectsAllTime: lhUserProspects.filter((p) => p.status === 'LNC' || p.status === 'B_LNC').length,
    lcNotPitchedYet: lhUserProspects.filter((p) => (p.status === 'LC' || p.status === 'B_LC') && !p.last_contacted_at).length,
    todaysTasks: lhUserProspects.filter((p) => {
      const followUpLocal = toPktDayKey(p.next_follow_up_date);
      return !!followUpLocal && followUpLocal === todayLocal && (
        p.status === 'LC' || p.status === 'B_LC' || p.status === 'LNC' || p.status === 'B_LNC'
      );
    }).length,
    overdueTasks: lhUserProspects.filter((p) => {
      const followUpLocal = toPktDayKey(p.next_follow_up_date);
      return !!followUpLocal && followUpLocal < todayLocal && (
        p.status === 'LC' || p.status === 'B_LC' || p.status === 'LNC' || p.status === 'B_LNC'
      );
    }).length,
  };

  useEffect(() => {
    setChartLoading(true);
    try {
      const minLeadScoreRaw = categoryChartMinLeadScore.trim();
      const minLeadScore =
        minLeadScoreRaw ? parseInt(minLeadScoreRaw, 10) : null;

      const counts = new Map();
      for (const p of lhUserProspects) {
        const isLCPhase = p.status === 'LC' || p.status === 'B_LC';
        if (!isLCPhase) continue;
        if (minLeadScore != null && !Number.isNaN(minLeadScore)) {
          const lsOutOf10 = p.lead_score == null ? null : Number(p.lead_score);
          if (lsOutOf10 == null || Number(lsOutOf10) < minLeadScore) continue;
        }
        const category = p.category == null ? 'Uncategorized' : p.category;
        counts.set(category, (counts.get(category) || 0) + 1);
      }

      const data = Array.from(counts.entries()).map(([category, count]) => ({
        category,
        count,
      }));

      // Match backend sorting: keep "Uncategorized" at the end.
      data.sort((a, b) => (
        a.category === 'Uncategorized'
          ? 1
          : b.category === 'Uncategorized'
            ? -1
            : String(a.category).localeCompare(String(b.category))
      ));

      setCategoryChartData(data);
    } catch {
      setCategoryChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, [categoryChartMinLeadScore, lhUserProspects]);

  const cardCls = 'ext-card ext-card-body';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Dashboard</h3>
        <button type="button" onClick={onSyncNow} disabled={syncing} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-60">
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {/* Statistics (DB aggregation) */}
      <section>
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Statistics</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Total prospects (all time)</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{lhStats?.totalProspectsAllTime ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Assigned prospects</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{lhStats?.assignedProspects ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Total LC Prospects (all time)</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{lhStats?.totalLCProspectsAllTime ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Total LNC Prospects (all time)</p>
            <p className="text-xl font-bold text-red-600 mt-0.5">{lhStats?.totalLNCProspectsAllTime ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Today&apos;s Tasks</p>
            <p className="text-xl font-bold text-primary-600 mt-0.5">{lhStats?.todaysTasks ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">Overdue Tasks</p>
            <p className="text-xl font-bold text-red-600 mt-0.5">{lhStats?.overdueTasks ?? '—'}</p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-medium text-slate-500">LC Not Pitched Yet</p>
            <p className="text-xl font-bold text-violet-600 mt-0.5">{lhStats?.lcNotPitchedYet ?? '—'}</p>
          </div>
        </div>
      </section>

      {/* Prospects by Category (vertical bar chart, DB aggregation, optional min lead score) */}
      <section className={cardCls}>
        <h4 className="text-xs font-semibold text-slate-700 mb-2">LC Prospects by Category</h4>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="text-[11px] text-slate-500" htmlFor="lh-cat-min-score">Min lead score:</label>
          <input
            id="lh-cat-min-score"
            type="number"
            min={0}
            max={10}
            placeholder="Any"
            value={categoryChartMinLeadScore}
            onChange={(e) => setCategoryChartMinLeadScore(e.target.value)}
            className="w-16 rounded border border-slate-200 px-2 py-1 text-xs"
            title="Only count prospects with lead_score ≥ this value"
          />
          <span className="text-[11px] text-slate-500">
            {categoryChartMinLeadScore.trim() ? `lead_score ≥ ${categoryChartMinLeadScore}` : 'All prospects'}
          </span>
        </div>
        {chartLoading ? (
          <p className="text-xs text-slate-500 py-6 text-center">Loading chart…</p>
        ) : categoryChartData.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No data for this filter.</p>
        ) : (
          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryChartData.map((d) => ({ ...d, name: formatCategoryLH(d.category) }))}
                margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value) => [value ?? 0, 'Prospects']}
                  labelFormatter={(label) => `Category: ${label}`}
                  contentStyle={{ borderRadius: 6, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
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
const LH_PITCH_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'not_pitched', label: 'Not pitched yet' },
];
const EM_LAST_CONTACTED_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'not_contacted', label: 'Not Contacted' },
];

const hasEmailValue = (email) => (email || '').trim() !== '';

const matchesEMPreference = (prospect, emType) => {
  const intentCategory = String(prospect?.intent_category || '').toLowerCase();
  const category = String(prospect?.category || '').toLowerCase();
  const normalized = intentCategory || category;

  if (emType === 'business') {
    return normalized === 'business' || normalized === 'both';
  }
  if (emType === 'individual') {
    return normalized === 'individual' || normalized === 'both';
  }
  return false;
};

const getStatusAfterEmailUpdate = (currentStatus) => {
  if (currentStatus === 'LC') return 'B_LC';
  if (currentStatus === 'LNC') return 'B_LNC';
  return currentStatus;
};

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
    if ((leadScore || '').trim() !== '') {
      const min = Number(leadScore);
      if (Number.isNaN(min)) return false;
      const nOutOf10 = p.lead_score == null ? null : Number(p.lead_score);
      if (nOutOf10 == null || Number.isNaN(nOutOf10)) return false;
      if (nOutOf10 < min) return false;
    }
    return true;
  });
};

const applyEMFilters = (list, { search, skill, leadScore }, skills) => {
  if (!list || !Array.isArray(list)) return [];
  const searchLower = (search || '').trim().toLowerCase();
  return list.filter((p) => {
    if (searchLower) {
      const name = (p.name || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const company = (p.company_name || '').toLowerCase();
      const category = (p.category || '').toLowerCase();
      const intentCategory = (p.intent_category || '').toLowerCase();
      const source = (p.sources || '').toLowerCase();
      const status = (p.status || '').toLowerCase();
      const matches = name.includes(searchLower) || email.includes(searchLower) ||
        company.includes(searchLower) || category.includes(searchLower) ||
        intentCategory.includes(searchLower) || source.includes(searchLower) ||
        status.includes(searchLower);
      if (!matches) return false;
    }
    if (skill) {
      const skillNames = Array.isArray(p.intent_skills) ? p.intent_skills : [];
      const selectedName = skills.find((s) => s.id === skill)?.name || skill;
      if (!skillNames.some((s) => (s || '').toLowerCase() === (selectedName || '').toLowerCase())) return false;
    }
    if ((leadScore || '').trim() !== '') {
      const min = Number(leadScore);
      if (Number.isNaN(min)) return false;
      const n = p.lead_score_em == null ? null : Number(p.lead_score_em);
      if (n == null || Number.isNaN(n)) return false;
      if (n < min) return false;
    }
    return true;
  });
};

const LHTabsView = ({ prospects = [], dataLoading = false, dataError = null, onSyncNow, onUpsertProspect }) => {
  const {
    activeProspect, clearProspect, loadProspect,
    panelActiveTab, setPanelActiveTab, panelEditingFromTab, setPanelEditingFromTab, panelStateLoaded
  } = useProspect();
  const activeTab = panelActiveTab && LH_TABS.some((t) => t.key === panelActiveTab) ? panelActiveTab : 'assigned';
  const setActiveTab = setPanelActiveTab;
  const editingFromTab = panelEditingFromTab;
  const setEditingFromTab = setPanelEditingFromTab;
  const [lhSearch, setLhSearch] = useState('');
  const [lhCategory, setLhCategory] = useState('');
  const [lhSkill, setLhSkill] = useState('');
  const [lhLeadScore, setLhLeadScore] = useState('');
  const [lhPitchStatus, setLhPitchStatus] = useState('');
  const [lhTaskSort, setLhTaskSort] = useState('overdue_first');
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [skills, setSkills] = useState([]);
  const wasEditingRef = React.useRef(false);

  useEffect(() => {
    fetch(`${API_URL}/skills`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]));
  }, []);

  // After save, refresh and go to assigned tab
  useEffect(() => {
    if (activeProspect) {
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      setEditingFromTab(null);
      setActiveTab('assigned');
    }
  }, [activeProspect]);

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

  // Task tab: prospects with follow-up date today or overdue (null excluded)
  const todayLocal = toPktDayKey(new Date());
  const taskProspects = prospects.filter((p) => {
    const followUpLocal = toPktDayKey(p.next_follow_up_date);
    if (!followUpLocal) return false;
    return followUpLocal <= todayLocal;
  });

  const lhFilters = { search: lhSearch, category: lhCategory, skill: lhSkill, leadScore: lhLeadScore };
  const hasLhFilters = !!(lhSearch.trim() || lhCategory || lhSkill || lhLeadScore);

  const assignedProspectsFiltered = applyLHFilters(assignedProspects, lhFilters, skills);
  const lncProspectsFiltered = applyLHFilters(lncProspects, lhFilters, skills);
  const lcProspectsFilteredBase = applyLHFilters(lcProspects, lhFilters, skills);
  const lcProspectsFiltered = lhPitchStatus === 'not_pitched'
    ? lcProspectsFilteredBase.filter((p) => !p.last_contacted_at)
    : lcProspectsFilteredBase;
  const taskProspectsFilteredBase = applyLHFilters(taskProspects, lhFilters, skills);
  const taskProspectsFiltered = [...taskProspectsFilteredBase].sort((a, b) => {
    const aOverdue = getOverdueDays(a.next_follow_up_date);
    const bOverdue = getOverdueDays(b.next_follow_up_date);
    if (lhTaskSort === 'today_first') return aOverdue - bOverdue;
    return bOverdue - aOverdue; // default overdue first
  });

  // If viewing a prospect detail from a tab
  if (activeProspect && editingFromTab) {
    return (
      <ProspectDetailCard
        prospect={activeProspect}
        onBack={handleBackToTab}
        backLabel={`Back to ${LH_TABS.find((t) => t.key === editingFromTab)?.label || 'list'}`}
        onUpdated={onUpsertProspect}
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

      {/* Filters — shared across list tabs only (dashboard uses its own stats) */}
      {['assigned', 'lnc', 'lc', 'task'].includes(activeTab) && (
        <div className="ext-card ext-card-body space-y-2 border-primary-200/70 bg-primary-50/20 sticky top-2 z-10">
          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-left"
            title={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Filters</p>
            <span className="inline-flex items-center gap-2 text-[11px] text-slate-500">
              Search and narrow results
              <span className="text-slate-600">{filtersExpanded ? '▾' : '▸'}</span>
            </span>
          </button>
          {filtersExpanded && (
            <div className="grid grid-cols-1 gap-2">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" strokeWidth={2} />
                <input
                  type="search"
                  placeholder="Search..."
                  value={lhSearch}
                  onChange={(e) => setLhSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <select
                value={lhCategory}
                onChange={(e) => setLhCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
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
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
                title="Skill"
              >
                <option value="">All skills</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                value={lhLeadScore}
                onChange={(e) => setLhLeadScore(e.target.value)}
                placeholder="Min lead score"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
                title="Lead Score (minimum)"
              />
              {activeTab === 'lc' && (
                <select
                  value={lhPitchStatus}
                  onChange={(e) => setLhPitchStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
                  title="Pitch Status"
                >
                  {LH_PITCH_STATUS_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              {activeTab === 'task' && (
                <select
                  value={lhTaskSort}
                  onChange={(e) => setLhTaskSort(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
                  title="Task Sort"
                >
                  <option value="overdue_first">Overdue first</option>
                  <option value="today_first">Today first</option>
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {/* Assigned tab */}
      {activeTab === 'assigned' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Assigned ({assignedProspectsFiltered.length}{hasLhFilters ? ` of ${assignedProspects.length}` : ''})
            </h3>
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={assignedProspectsFiltered}
            loading={dataLoading}
            error={dataError}
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
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={lncProspectsFiltered}
            loading={dataLoading}
            error={dataError}
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
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={lcProspectsFiltered}
            loading={dataLoading}
            error={dataError}
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
              Due Follow-ups ({taskProspectsFiltered.length}{hasLhFilters ? ` of ${taskProspects.length}` : ''})
            </h3>
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={taskProspectsFiltered}
            loading={dataLoading}
            error={dataError}
            emptyText={hasLhFilters ? 'No matching prospects.' : "No due follow-ups."}
            getDueLabel={(p) => {
              const overdueDays = getOverdueDays(p.next_follow_up_date);
              return overdueDays > 0 ? `Due by ${overdueDays} day${overdueDays > 1 ? 's' : ''}` : null;
            }}
            onSelect={(p) => handleSelectProspect(p, 'task')}
          />
        </div>
      )}

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && (
        <LHDashboardTab localProspects={prospects} onSyncNow={onSyncNow} syncing={dataLoading} />
      )}
    </div>
  );
};

const EMDetailCard = ({ prospect, detailTab, onBack, backLabel, onUpdated }) => {
  const isNheDetail = detailTab === 'nhe';
  const [email, setEmail] = useState(prospect?.email || '');
  const [leadScoreEm, setLeadScoreEm] = useState(prospect?.lead_score_em ?? '');
  const [pitchedDescriptionEm, setPitchedDescriptionEm] = useState(prospect?.pitched_description_em || '');
  const [nextFollowUpEm, setNextFollowUpEm] = useState(prospect?.next_follow_up_em ? prospect.next_follow_up_em.slice(0, 10) : '');
  const [responseEm, setResponseEm] = useState(
    prospect?.response_em == null ? '' : (prospect.response_em ? 'true' : 'false')
  );
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    if (!prospect) return;
    setEmail(prospect.email || '');
    setLeadScoreEm(prospect.lead_score_em ?? '');
    setPitchedDescriptionEm(prospect.pitched_description_em || '');
    setNextFollowUpEm(prospect.next_follow_up_em ? prospect.next_follow_up_em.slice(0, 10) : '');
    setResponseEm(prospect.response_em == null ? '' : (prospect.response_em ? 'true' : 'false'));
    setSaveMsg(null);
  }, [prospect]);

  if (!prospect) return null;
  const normalizedLeadScore = leadScoreEm == null ? '' : String(leadScoreEm).trim();
  const leadScoreNum = normalizedLeadScore === '' ? NaN : Number(normalizedLeadScore);
  const hasValidLeadScore = normalizedLeadScore !== '' && !Number.isNaN(leadScoreNum) && leadScoreNum >= 0 && leadScoreNum <= 10;
  const hasValidPitchDescription = (pitchedDescriptionEm || '').trim() !== '';
  const hasValidNextFollowUp = (nextFollowUpEm || '').trim() !== '';
  const hasRequiredEmFields = hasValidLeadScore && hasValidPitchDescription && hasValidNextFollowUp;

  const handleSave = async (override = {}) => {
    if (!isNheDetail && !hasRequiredEmFields) {
      setSaveMsg({ type: 'error', text: 'Fill required EM fields first' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = {
        lead_score_em: leadScoreEm === '' ? null : Number(leadScoreEm),
        pitched_description_em: pitchedDescriptionEm.trim() ? pitchedDescriptionEm.trim() : null,
        next_follow_up_em: nextFollowUpEm ? new Date(nextFollowUpEm).toISOString() : null,
        response_em: responseEm === '' ? null : responseEm === 'true',
        ...override,
      };
      const res = await fetch(`${API_URL}/prospects/${prospect.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      const updatedProspect = await res.json();
      setSaveMsg({ type: 'success', text: 'Saved' });
      if (typeof onUpdated === 'function') onUpdated(updatedProspect);
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message || 'Error saving' });
    } finally {
      setSaving(false);
    }
  };

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

      <div className="ext-card ext-card-body">
        <h3 className="text-lg font-bold text-slate-800">{prospect.name || '—'}</h3>
        <p className="text-sm text-slate-500">{prospect.company_name || '—'}</p>
      </div>

      {(prospect.website_link || prospect.linkedin_url || prospect.intent_proof_link) && (
        <div className="ext-card overflow-hidden">
          <div className="ext-card-body py-2.5">
            <div className="flex flex-wrap gap-2">
              {prospect.website_link && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.website_link}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Website
                </ProspectExternalLink>
              )}
              {prospect.linkedin_url && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.linkedin_url}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  LinkedIn
                </ProspectExternalLink>
              )}
              {prospect.intent_proof_link && (
                <ProspectExternalLink
                  prospect={prospect}
                  href={prospect.intent_proof_link}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Intent Proof
                </ProspectExternalLink>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="ext-card overflow-hidden">
        <div className="ext-card-header"><h4 className="ext-card-header-title">Basic Info</h4></div>
        <div className="ext-card-body">
          <DetailRow label="Email">{prospect.email || '—'}</DetailRow>
          <DetailRow label="Website">
            {prospect.website_link && (
              <ProspectExternalLink prospect={prospect} href={prospect.website_link} className="text-primary-600 hover:underline truncate block">
                {prospect.website_link}
              </ProspectExternalLink>
            )}
          </DetailRow>
          <DetailRow label="LinkedIn">
            {prospect.linkedin_url && (
              <ProspectExternalLink prospect={prospect} href={prospect.linkedin_url} className="text-primary-600 hover:underline truncate block">
                {prospect.linkedin_url}
              </ProspectExternalLink>
            )}
          </DetailRow>
          <DetailRow label="Intent Proof Link">
            {prospect.intent_proof_link && (
              <ProspectExternalLink prospect={prospect} href={prospect.intent_proof_link} className="text-primary-600 hover:underline truncate block">
                {prospect.intent_proof_link}
              </ProspectExternalLink>
            )}
          </DetailRow>
          <DetailRow label="Intent Skills">
            {Array.isArray(prospect.intent_skills) && prospect.intent_skills.length > 0 ? prospect.intent_skills.join(', ') : '—'}
          </DetailRow>
          <DetailRow label="Category">{prospect.category || '—'}</DetailRow>
          <DetailRow label="Intent Category">{prospect.intent_category || '—'}</DetailRow>
          <DetailRow label="Status">{prospect.status || '—'}</DetailRow>
          <DetailRow label="Source">{prospect.sources || '—'}</DetailRow>
          <DetailRow label="Last Contacted (EM)">{formatPktDate(prospect.last_contacted_at_em)}</DetailRow>
        </div>
      </div>

      <div className="ext-card overflow-hidden">
        <div className="ext-card-header">
          <h4 className="ext-card-header-title">LH (read-only)</h4>
        </div>
        <div className="ext-card-body">
          <DetailRow label="Lead Score (LH)">{prospect.lead_score == null ? '—' : prospect.lead_score}</DetailRow>
          <DetailRow label="Pitch Description (LH)">{prospect.pitch_description ? prospect.pitch_description : '—'}</DetailRow>
          <DetailRow label="Next Follow-up (LH)">
            {formatPktDate(prospect.next_follow_up_date) || '—'}
          </DetailRow>
        </div>
      </div>

      {isNheDetail ? (
        <div className="ext-card overflow-hidden border-primary-200/60 space-y-4 ext-card-body">
          <h4 className="text-xs font-semibold text-primary-600 uppercase tracking-wider">NHE Update</h4>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Add email address"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSave({ email: email.trim() || null, status: getStatusAfterEmailUpdate(prospect.status) })}
            disabled={saving}
            className="w-full rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update Email'}
          </button>
          {saveMsg && (
            <p className={`text-xs font-medium text-center ${saveMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {saveMsg.text}
            </p>
          )}
        </div>
      ) : (
        <div className="ext-card overflow-hidden border-primary-200/60 space-y-4 ext-card-body">
          <h4 className="text-xs font-semibold text-primary-600 uppercase tracking-wider">EM Update</h4>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Lead Score (EM) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={leadScoreEm}
              onChange={(e) => setLeadScoreEm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Pitched Description (EM) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={pitchedDescriptionEm}
              onChange={(e) => setPitchedDescriptionEm(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Next Follow-up (EM) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={nextFollowUpEm}
              onChange={(e) => setNextFollowUpEm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Response (EM)</label>
            <select
              value={responseEm}
              onChange={(e) => setResponseEm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Not set</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSave({ last_contacted_at_em: new Date().toISOString() })}
              disabled={saving || !hasRequiredEmFields}
              className="rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Mark Contacted
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !hasRequiredEmFields}
              className="rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
          {!hasRequiredEmFields && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-700 mb-1">Required to save:</p>
              {!hasValidLeadScore && <p className="text-xs text-amber-600">• Lead Score (EM) between 0 and 10</p>}
              {!hasValidPitchDescription && <p className="text-xs text-amber-600">• Pitched Description (EM)</p>}
              {!hasValidNextFollowUp && <p className="text-xs text-amber-600">• Next Follow-up (EM)</p>}
            </div>
          )}

          {saveMsg && (
            <p className={`text-xs font-medium text-center ${saveMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {saveMsg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const EM_TABS = [
  { key: 'nhe', label: 'NHE' },
  { key: 'he', label: 'HE' },
  { key: 'task', label: 'Task' },
  { key: 'dashboard', label: 'Dashboard' },
];

const EMTabsView = ({ prospects = [], dataLoading = false, dataError = null, onSyncNow, onUpsertProspect }) => {
  const {
    activeProspect, clearProspect, loadProspect, authUser,
    panelActiveTab, setPanelActiveTab, panelEditingFromTab, setPanelEditingFromTab,
  } = useProspect();
  const activeTab = panelActiveTab && EM_TABS.some((t) => t.key === panelActiveTab) ? panelActiveTab : 'nhe';
  const [emSearch, setEmSearch] = useState('');
  const [emSkill, setEmSkill] = useState('');
  const [emLeadScore, setEmLeadScore] = useState('');
  const [emHeLastContacted, setEmHeLastContacted] = useState('');
  const [emTaskSort, setEmTaskSort] = useState('overdue_first');
  const [emFiltersExpanded, setEmFiltersExpanded] = useState(true);
  const [skills, setSkills] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/skills`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]));
  }, []);

  const emType = authUser?.em_prospect_type || null;
  const categoryMatched = prospects.filter((p) => matchesEMPreference(p, emType));
  const nheProspectsBase = categoryMatched.filter((p) => !hasEmailValue(p.email));
  const heProspectsBase = categoryMatched.filter((p) => hasEmailValue(p.email));
  const todayLocal = toPktDayKey(new Date());
  const tasksProspectsBase = categoryMatched.filter((p) => {
    if (!p.next_follow_up_em) return false;
    const local = toPktDayKey(p.next_follow_up_em);
    if (!local) return false;
    return local <= todayLocal;
  });
  const emTodayTasksCount = tasksProspectsBase.filter((p) => {
    const local = toPktDayKey(p.next_follow_up_em);
    if (!local) return false;
    return local === todayLocal;
  }).length;
  const emOverdueTasksCount = tasksProspectsBase.filter((p) => {
    const local = toPktDayKey(p.next_follow_up_em);
    if (!local) return false;
    return local < todayLocal;
  }).length;
  const emFilters = { search: emSearch, skill: emSkill, leadScore: emLeadScore };
  const hasEmFilters = !!(emSearch.trim() || emSkill || emLeadScore || (activeTab === 'he' && emHeLastContacted));
  const nheProspects = applyEMFilters(nheProspectsBase, emFilters, skills);
  const heProspectsFilteredBase = applyEMFilters(heProspectsBase, emFilters, skills);
  const heProspects = emHeLastContacted === 'contacted'
    ? heProspectsFilteredBase.filter((p) => !!p.last_contacted_at_em)
    : emHeLastContacted === 'not_contacted'
      ? heProspectsFilteredBase.filter((p) => !p.last_contacted_at_em)
      : heProspectsFilteredBase;
  const tasksProspects = applyEMFilters(tasksProspectsBase, emFilters, skills).sort((a, b) => {
    const aOverdue = getOverdueDays(a.next_follow_up_em);
    const bOverdue = getOverdueDays(b.next_follow_up_em);
    if (emTaskSort === 'today_first') return aOverdue - bOverdue;
    return bOverdue - aOverdue;
  });
  const pitchedCount = categoryMatched.filter((p) => !!p.last_contacted_at_em).length;

  const handleSelectProspect = (p, fromTab) => {
    loadProspect(p);
    setPanelEditingFromTab(fromTab);
  };

  if (activeProspect && panelEditingFromTab) {
    return (
      <EMDetailCard
        prospect={activeProspect}
        detailTab={panelEditingFromTab}
        onBack={() => {
          clearProspect();
          setPanelEditingFromTab(null);
        }}
        backLabel={`Back to ${EM_TABS.find((t) => t.key === panelEditingFromTab)?.label || 'list'}`}
        onUpdated={onUpsertProspect}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-white border border-slate-200 p-1 shadow-sm">
        {EM_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              clearProspect();
              setPanelEditingFromTab(null);
              setPanelActiveTab(tab.key);
            }}
            className={`flex-1 py-2 px-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === tab.key ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!emType && (
        <div className="ext-card ext-card-body">
          <p className="text-sm text-amber-700">No EM prospect type configured. Ask admin to set your EM type.</p>
        </div>
      )}

      {['nhe', 'he', 'task'].includes(activeTab) && (
        <div className="ext-card ext-card-body space-y-2 border-primary-200/70 bg-primary-50/20 sticky top-2 z-10">
          <button
            type="button"
            onClick={() => setEmFiltersExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-left"
            title={emFiltersExpanded ? 'Collapse filters' : 'Expand filters'}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Filters</p>
            <span className="inline-flex items-center gap-2 text-[11px] text-slate-500">
              Search and narrow results
              <span className="text-slate-600">{emFiltersExpanded ? '▾' : '▸'}</span>
            </span>
          </button>
          {emFiltersExpanded && (
            <div className="grid grid-cols-1 gap-2">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" strokeWidth={2} />
                <input
                  type="search"
                  placeholder="Search..."
                  value={emSearch}
                  onChange={(e) => setEmSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <select
                value={emSkill}
                onChange={(e) => setEmSkill(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
                title="Skill"
              >
                <option value="">All skills</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                value={emLeadScore}
                onChange={(e) => setEmLeadScore(e.target.value)}
                placeholder="Min lead score"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
                title="Lead Score (minimum)"
              />
              {activeTab === 'he' && (
                <select
                  value={emHeLastContacted}
                  onChange={(e) => setEmHeLastContacted(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
                  title="Last Contacted (EM)"
                >
                  {EM_LAST_CONTACTED_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              {activeTab === 'task' && (
                <select
                  value={emTaskSort}
                  onChange={(e) => setEmTaskSort(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 px-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-0"
                  title="Task Sort"
                >
                  <option value="overdue_first">Overdue first</option>
                  <option value="today_first">Today first</option>
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'nhe' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              NHE ({nheProspects.length}{hasEmFilters ? ` of ${nheProspectsBase.length}` : ''})
            </h3>
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList prospects={nheProspects} loading={dataLoading} error={dataError} emptyText={hasEmFilters ? 'No matching prospects.' : 'No prospects without email.'} onSelect={(p) => handleSelectProspect(p, 'nhe')} />
        </div>
      )}

      {activeTab === 'he' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              HE ({heProspects.length}{hasEmFilters ? ` of ${heProspectsBase.length}` : ''})
            </h3>
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList prospects={heProspects} loading={dataLoading} error={dataError} emptyText={hasEmFilters ? 'No matching prospects.' : 'No prospects with email.'} onSelect={(p) => handleSelectProspect(p, 'he')} />
        </div>
      )}

      {activeTab === 'task' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Due Tasks ({tasksProspects.length}{hasEmFilters ? ` of ${tasksProspectsBase.length}` : ''})
            </h3>
            <button type="button" onClick={onSyncNow} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sync">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
            </button>
          </div>
          <ProspectList
            prospects={tasksProspects}
            loading={dataLoading}
            error={dataError}
            emptyText={hasEmFilters ? 'No matching prospects.' : 'No due follow-ups.'}
            getDueLabel={(p) => {
              const overdueDays = getOverdueDays(p.next_follow_up_em);
              return overdueDays > 0 ? `Due by ${overdueDays} day${overdueDays > 1 ? 's' : ''}` : null;
            }}
            onSelect={(p) => handleSelectProspect(p, 'task')}
          />
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-3">
          <div className="ext-card ext-card-body">
            <p className="text-[11px] font-medium text-slate-500">Total prospects without email</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{nheProspects.length}</p>
          </div>
          <div className="ext-card ext-card-body">
            <p className="text-[11px] font-medium text-slate-500">Total prospects with email</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{heProspects.length}</p>
          </div>
          <div className="ext-card ext-card-body">
            <p className="text-[11px] font-medium text-slate-500">Total pitched prospects</p>
            <p className="text-xl font-bold text-primary-600 mt-0.5">{pitchedCount}</p>
          </div>
          <div className="ext-card ext-card-body">
            <p className="text-[11px] font-medium text-slate-500">Today&apos;s Tasks</p>
            <p className="text-xl font-bold text-primary-600 mt-0.5">{emTodayTasksCount}</p>
          </div>
          <div className="ext-card ext-card-body">
            <p className="text-[11px] font-medium text-slate-500">Overdue Tasks</p>
            <p className="text-xl font-bold text-red-600 mt-0.5">{emOverdueTasksCount}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Default view for non-DC_R/LH roles ──────────────────────────────
const DefaultView = ({ onRequestCaptureSelection, prospects = [], dataLoading = false, dataError = null, onSyncNow }) => {
  const { activeProspect, startNewProspect, clearProspect, loadProspect } = useProspect();
  const [viewMode, setViewMode] = useState('home'); // 'home' | 'prospects'
  const [fromProspectsList, setFromProspectsList] = useState(false);

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
        <button type="button" onClick={onSyncNow} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors">
          Sync Now
        </button>
        <ProspectList
          prospects={prospects}
          loading={dataLoading}
          error={dataError}
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
  const { isCollapsed, setIsCollapsed, reloadDraftFromStorage, authUser, logout, userId } = useProspect();
  const [panelView, setPanelView] = React.useState('main'); // 'main' | 'settings'
  const [cachedProspects, setCachedProspects] = useState([]);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [cacheError, setCacheError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [cacheReady, setCacheReady] = useState(false);

  const isDCR = authUser?.role === 'DC_R';
  const isLH = authUser?.role === 'LH';
  const isEM = authUser?.role === 'EM';

  const loadCacheFromIndexedDb = useCallback(async () => {
    setCacheLoading(true);
    setCacheError(null);
    try {
      const [localProspects, localLastSync] = await Promise.all([
        getAllProspectsFromDb(),
        getMetaValue(LAST_SYNC_META_KEY),
      ]);
      setCachedProspects(Array.isArray(localProspects) ? localProspects : []);
      setLastSyncedAt(typeof localLastSync === 'string' ? localLastSync : null);
    } catch (err) {
      setCacheError(err?.message || 'Failed to load local cache');
      setCachedProspects([]);
    } finally {
      setCacheLoading(false);
      setCacheReady(true);
    }
  }, []);

  const syncProspectsNow = useCallback(async () => {
    if (!authUser?.role) return;
    setIsSyncing(true);
    setCacheError(null);
    try {
      const endpoint = getProspectSyncEndpoint(authUser.role, userId);
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to sync prospects');
      const list = await res.json();
      const normalized = Array.isArray(list) ? list : [];
      await replaceAllProspectsInDb(normalized);
      const nowIso = new Date().toISOString();
      await setMetaValue(LAST_SYNC_META_KEY, nowIso);
      setCachedProspects(normalized);
      setLastSyncedAt(nowIso);
    } catch (err) {
      setCacheError(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [authUser, userId]);

  const upsertLocalProspect = useCallback(async (prospect) => {
    if (!prospect || !prospect.id) return;
    try {
      await upsertProspectInDb(prospect);
      setCachedProspects((prev) => upsertProspectInList(prev, prospect));
    } catch (err) {
      setCacheError(err?.message || 'Failed to update local cache');
    }
  }, []);

  useEffect(() => {
    loadCacheFromIndexedDb();
  }, [loadCacheFromIndexedDb]);

  useEffect(() => {
    if (!cacheReady || !authUser?.role) return;
    const neverSynced = !lastSyncedAt;
    const stale = !neverSynced && (Date.now() - new Date(lastSyncedAt).getTime() > SYNC_THRESHOLD_MS);
    if (neverSynced || stale) syncProspectsNow();
  }, [cacheReady, authUser, lastSyncedAt, syncProspectsNow]);

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
                <button
                  type="button"
                  onClick={syncProspectsNow}
                  title={isSyncing ? 'Syncing prospects...' : 'Sync prospects now'}
                  disabled={isSyncing}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} strokeWidth={2} />
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
                <DCRTabsView
                  onRequestCaptureSelection={onRequestCaptureSelection}
                  prospects={cachedProspects}
                  dataLoading={cacheLoading || isSyncing}
                  dataError={cacheError}
                  onSyncNow={syncProspectsNow}
                  onUpsertProspect={upsertLocalProspect}
                />
              ) : isLH ? (
                <LHTabsView
                  prospects={cachedProspects}
                  dataLoading={cacheLoading || isSyncing}
                  dataError={cacheError}
                  onSyncNow={syncProspectsNow}
                  onUpsertProspect={upsertLocalProspect}
                />
              ) : isEM ? (
                <EMTabsView
                  prospects={cachedProspects}
                  dataLoading={cacheLoading || isSyncing}
                  dataError={cacheError}
                  onSyncNow={syncProspectsNow}
                  onUpsertProspect={upsertLocalProspect}
                />
              ) : (
                <DefaultView
                  onRequestCaptureSelection={onRequestCaptureSelection}
                  prospects={cachedProspects}
                  dataLoading={cacheLoading || isSyncing}
                  dataError={cacheError}
                  onSyncNow={syncProspectsNow}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col text-xs text-slate-500 truncate min-w-0 flex-1">
                  <span className="font-medium text-slate-700 truncate">{authUser?.name || authUser?.email || '—'}</span>
                  <span className="text-[11px] text-slate-400">
                    {authUser?.role || ''}{lastSyncedAt ? ` • Synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : ' • Not synced yet'}
                  </span>
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
