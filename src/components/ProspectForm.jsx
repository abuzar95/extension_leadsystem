import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProspect } from '../context/ProspectContext';
import { API_URL } from '../config.js';
import {
  User,
  Mail,
  Building2,
  Globe,
  FileText,
  Loader2,
  Save,
  ChevronDown,
  Target,
  Calendar,
  Briefcase,
  Linkedin,
  ExternalLink,
  X,
  Link2,
} from './icons';

const inputBase =
  'w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors';

const InputWithIcon = ({ icon: Icon, placeholder, value, onChange, type = 'text', ...props }) => (
  <div className="relative">
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} pr-10`}
      {...props}
    />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
      {Icon && <Icon className="w-4 h-4" strokeWidth={2} />}
    </span>
  </div>
);

const SelectWithIcon = ({ value, onChange, children, ...props }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} pr-10 appearance-none cursor-pointer`}
      {...props}
    >
      {children}
    </select>
    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
      <ChevronDown className="w-4 h-4" strokeWidth={2} />
    </span>
  </div>
);

const SectionHeading = ({ children }) => (
  <h3 className="text-sm font-bold text-slate-800 mb-3">{children}</h3>
);

const FieldLabel = ({ children }) => (
  <label className="block text-xs font-medium text-slate-600 mb-1.5">{children}</label>
);

const RequiredLabel = ({ children }) => (
  <label className="block text-xs font-medium text-slate-600 mb-1.5">
    {children} <span className="text-red-500" aria-label="required">*</span>
  </label>
);

const SkillsTagInput = ({ icon: Icon, tags, onChange, placeholder }) => {
  const [query, setQuery] = useState('');
  const [allSkills, setAllSkills] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch skills once on mount
  useEffect(() => {
    let cancelled = false;
    const fetchSkills = async () => {
      try {
        const res = await fetch(`${API_URL}/skills`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setAllSkills(data.map((s) => s.name));
        }
      } catch (err) {
        console.error('Failed to fetch skills:', err);
      }
    };
    fetchSkills();
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = allSkills.filter(
    (s) =>
      s.toLowerCase().includes(query.toLowerCase()) &&
      !tags.includes(s)
  );

  const selectSkill = useCallback((skill) => {
    if (!tags.includes(skill)) {
      onChange([...tags, skill]);
    }
    setQuery('');
    setOpen(false);
    setHighlightIdx(0);
    inputRef.current?.focus();
  }, [tags, onChange]);

  const removeTag = (index) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered.length > 0 && highlightIdx < filtered.length) {
        selectSkill(filtered[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && query === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`${inputBase} flex flex-wrap items-center gap-1.5 min-h-[44px] h-auto py-2 cursor-text`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md bg-primary-50 border border-primary-200 px-2 py-0.5 text-xs font-medium text-primary-700 whitespace-nowrap"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              className="ml-0.5 text-primary-400 hover:text-primary-700 leading-none"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : 'Search skills...'}
          className="flex-1 min-w-[80px] border-none outline-none bg-transparent text-sm text-slate-800 placeholder-slate-400 p-0"
        />
        {Icon && (
          <span className="pointer-events-none text-slate-400 ml-auto flex-shrink-0">
            <Icon className="w-4 h-4" strokeWidth={2} />
          </span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-[180px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400">
              {allSkills.length === 0 ? 'Loading skills...' : 'No matching skills'}
            </div>
          ) : (
            filtered.map((skill, i) => (
              <button
                key={skill}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectSkill(skill); }}
                onMouseEnter={() => setHighlightIdx(i)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  i === highlightIdx
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {skill}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── LinkedIn Handler Picker (shown when status = data_refined) ───────
const LHUserPicker = ({ intentCategory, value, onChange }) => {
  const { authToken } = useProspect();
  const [lhUsers, setLhUsers] = useState([]);
  const [loadingLH, setLoadingLH] = useState(false);

  // Fetch LH users once (requires auth)
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    const fetchLH = async () => {
      setLoadingLH(true);
      try {
        const res = await fetch(`${API_URL}/users`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (res.ok) {
          const all = await res.json();
          // Only users with role LH
          const lh = all.filter((u) => u.role === 'LH');
          if (!cancelled) setLhUsers(lh);
        }
      } catch (err) {
        console.error('Failed to fetch LH users:', err);
      } finally {
        if (!cancelled) setLoadingLH(false);
      }
    };
    fetchLH();
    return () => { cancelled = true; };
  }, [authToken]);

  // Filter: show LH users whose linkedin_profile.niche matches the prospect's intent_category
  // Also include users whose niche is "Both" (matches everything), and if prospect intent is "Both", show all LH users
  const matchingUsers = lhUsers.filter((u) => {
    const niche = u.linkedin_profile?.niche;
    if (!niche || !intentCategory) return false;
    if (intentCategory === 'Both' || niche === 'Both') return true;
    return niche === intentCategory;
  });

  return (
    <section>
      <SectionHeading>LinkedIn Handler</SectionHeading>
      <div className="space-y-3">
        <FieldLabel>Assign LH User</FieldLabel>
        <SelectWithIcon
          value={value || ''}
          onChange={onChange}
        >
          <option value="">
            {loadingLH ? 'Loading...' : matchingUsers.length === 0 ? 'No matching LH users' : 'Select LinkedIn handler'}
          </option>
          {matchingUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email} — {u.linkedin_profile?.name || 'No profile'}
            </option>
          ))}
        </SelectWithIcon>
        {matchingUsers.length === 0 && !loadingLH && intentCategory && (
          <p className="text-xs text-amber-600">
            No LH users found with niche matching &quot;{intentCategory}&quot;.
          </p>
        )}
      </div>
    </section>
  );
};

const ensureUrl = (url) => {
  const u = (url || '').trim();
  return !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u;
};

const ProspectForm = ({ stayOnNewAfterSave = false, onSaveSuccess }) => {
  const { activeProspect, updateProspectField, clearProspect, saveProspect, loading, authUser } = useProspect();
  const isDCR = authUser?.role === 'DC_R';

  if (!activeProspect) return null;

  const handleChange = (field, value) => updateProspectField(field, value);

  const hasRequired =
    (activeProspect.category || '').trim() !== '' &&
    (activeProspect.sources || '').trim() !== '' &&
    (activeProspect.status || '').trim() !== '' &&
    (activeProspect.linkedin_url || '').trim() !== '' &&
    (activeProspect.intent_proof_link || '').trim() !== '' &&
    (activeProspect.intent_category || '').trim() !== '' &&
    Array.isArray(activeProspect.intent_skills) && activeProspect.intent_skills.length > 0;
  const canSave = hasRequired && !loading;

  const handleSave = async () => {
    if (!hasRequired) return;
    try {
      await saveProspect({ stayOnNewAndReload: stayOnNewAfterSave });
      const scrollEl = document.querySelector('[data-scroll-container]');
      if (scrollEl) scrollEl.scrollTo(0, 0);
      else window.scrollTo(0, 0);
      if (stayOnNewAfterSave && typeof onSaveSuccess === 'function') {
        onSaveSuccess();
      }
    } catch (error) {
      alert('Error saving prospect: ' + error.message);
    }
  };

  return (
    <div className="rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm space-y-6">
      <p className="text-xs text-slate-500 -mt-1 mb-1">* Required fields</p>
      <section>
        <div className="space-y-3">
          {/* 1. Category */}
          <RequiredLabel>Category</RequiredLabel>
          <SelectWithIcon
            value={activeProspect.category || ''}
            onChange={(v) => handleChange('category', v)}
          >
            <option value="">Select category</option>
            <option value="Entrepreneur">Entrepreneur</option>
            <option value="Subcontractor">Subcontractor</option>
            <option value="SME">SME</option>
            <option value="HR">HR</option>
            <option value="C_Level">C-Level</option>
          </SelectWithIcon>
          {/* Source */}
          <RequiredLabel>Source</RequiredLabel>
          <SelectWithIcon
            value={activeProspect.sources || ''}
            onChange={(v) => handleChange('sources', v)}
          >
            <option value="">Select source</option>
            <option value="upwork">Upwork</option>
            <option value="linkedin">LinkedIn</option>
            <option value="clutch">Clutch</option>
            <option value="crunchbase">Crunchbase</option>
            <option value="producthunt">Product Hunt</option>
            <option value="glassdoor">Glassdoor</option>
            <option value="indeed">Indeed</option>
            <option value="others">Others</option>
          </SelectWithIcon>
          {/* 2. Name */}
          <FieldLabel>Name</FieldLabel>
          <InputWithIcon
            icon={User}
            placeholder="Enter name"
            value={activeProspect.name || ''}
            onChange={(v) => handleChange('name', v)}
          />
          {/* 3. Intent Skills (tags) */}
          <RequiredLabel>Intent Skills</RequiredLabel>
          <SkillsTagInput
            icon={Target}
            tags={Array.isArray(activeProspect.intent_skills) ? activeProspect.intent_skills : []}
            onChange={(tags) => handleChange('intent_skills', tags)}
            placeholder="Search and select skills..."
          />
          {/* 3b. Intent Proof Link */}
          <RequiredLabel>Intent Proof Link</RequiredLabel>
          <InputWithIcon
            icon={Link2}
            type="url"
            placeholder="Paste proof link (e.g. job post URL)"
            value={activeProspect.intent_proof_link || ''}
            onChange={(v) => handleChange('intent_proof_link', v)}
          />
          {(activeProspect.intent_proof_link || '').trim() && (
            <a
              href={ensureUrl(activeProspect.intent_proof_link)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Link2 className="w-4 h-4" strokeWidth={2} />
              Open Proof Link
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
            </a>
          )}
          {/* 3c. Intent Category */}
          <RequiredLabel>Intent Category</RequiredLabel>
          <SelectWithIcon
            value={activeProspect.intent_category || ''}
            onChange={(v) => handleChange('intent_category', v)}
          >
            <option value="">Select intent category</option>
            <option value="Individual">Individual</option>
            <option value="Business">Business</option>
            <option value="Both">Both</option>
          </SelectWithIcon>
          {/* 4. Intent Date */}
          <FieldLabel>Intent date</FieldLabel>
          <div className="relative">
            <input
              type="date"
              value={activeProspect.intent_date ? (typeof activeProspect.intent_date === 'string' ? activeProspect.intent_date.slice(0, 10) : '') : ''}
              onChange={(e) => handleChange('intent_date', e.target.value ? e.target.value + 'T00:00:00.000Z' : null)}
              className={`${inputBase} pr-10`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Calendar className="w-4 h-4" strokeWidth={2} />
            </span>
          </div>
          {/* 5. Company name */}
          <FieldLabel>Company name</FieldLabel>
          <InputWithIcon
            icon={Building2}
            placeholder="Enter company name"
            value={activeProspect.company_name || ''}
            onChange={(v) => handleChange('company_name', v)}
          />
          {/* 6. Designation */}
          <FieldLabel>Designation</FieldLabel>
          <InputWithIcon
            icon={Briefcase}
            placeholder="Enter designation / job title"
            value={activeProspect.job_title || ''}
            onChange={(v) => handleChange('job_title', v)}
          />
          {/* 7. About */}
          <FieldLabel>About</FieldLabel>
          <div className="relative">
            <textarea
              placeholder="Enter notes about the prospect"
              value={activeProspect.about_prospect || ''}
              onChange={(e) => handleChange('about_prospect', e.target.value)}
              rows={4}
              className={`${inputBase} resize-none`}
            />
            <span className="absolute right-3 top-3 pointer-events-none text-slate-400">
              <FileText className="w-4 h-4" strokeWidth={2} />
            </span>
          </div>
        </div>
      </section>

      {/* Contact & status */}
      <section>
        <SectionHeading>Contact & status</SectionHeading>
        <div className="space-y-3">
          <FieldLabel>Email</FieldLabel>
          <InputWithIcon
            icon={Mail}
            type="email"
            placeholder="Email"
            value={activeProspect.email || ''}
            onChange={(v) => handleChange('email', v)}
          />
          <RequiredLabel>LinkedIn URL</RequiredLabel>
          <InputWithIcon
            icon={Linkedin}
            type="url"
            placeholder="LinkedIn profile URL"
            value={activeProspect.linkedin_url || ''}
            onChange={(v) => handleChange('linkedin_url', v)}
          />
          {(activeProspect.linkedin_url || '').trim() && (
            <a
              href={ensureUrl(activeProspect.linkedin_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Linkedin className="w-4 h-4" strokeWidth={2} />
              Open LinkedIn
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
            </a>
          )}
          {!isDCR && (
            <>
              <FieldLabel>LinkedIn connection</FieldLabel>
              <SelectWithIcon
                value={activeProspect.linkedin_connection || 'none'}
                onChange={(v) => handleChange('linkedin_connection', v)}
              >
                <option value="none">None</option>
                <option value="invite">Invite</option>
                <option value="connected">Connected</option>
              </SelectWithIcon>
            </>
          )}
          <FieldLabel>Website URL</FieldLabel>
          <InputWithIcon
            icon={Globe}
            type="url"
            placeholder="Website URL"
            value={activeProspect.website_link || ''}
            onChange={(v) => handleChange('website_link', v)}
          />
          {(activeProspect.website_link || '').trim() && (
            <a
              href={ensureUrl(activeProspect.website_link)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Globe className="w-4 h-4" strokeWidth={2} />
              Open website
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
            </a>
          )}
          <RequiredLabel>Status</RequiredLabel>
          <SelectWithIcon
            value={activeProspect.status || 'new'}
            onChange={(v) => {
              handleChange('status', v);
              // Clear LH assignment when switching away from data_refined
              if (v !== 'data_refined') handleChange('lh_user_id', null);
            }}
          >
            <option value="new">New</option>
            <option value="data_refined">Data Refined</option>
            <option value="use_in_campaign">Use in Campaign</option>
            <option value="pitch">Pitch</option>
          </SelectWithIcon>
        </div>
      </section>

      {/* LinkedIn Handler assignment — shown when status is data_refined */}
      {activeProspect.status === 'data_refined' && (
        <LHUserPicker
          intentCategory={activeProspect.intent_category}
          value={activeProspect.lh_user_id}
          onChange={(v) => handleChange('lh_user_id', v || null)}
        />
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={clearProspect}
          disabled={loading}
          className="flex-1 rounded-lg border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          title={!hasRequired ? 'Fill all required fields (*) to save' : undefined}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-70 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" strokeWidth={2.5} />
              Save Prospect
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProspectForm;
