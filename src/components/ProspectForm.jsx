import React from 'react';
import { useProspect } from '../context/ProspectContext';
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

const ensureUrl = (url) => {
  const u = (url || '').trim();
  return !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u;
};

const ProspectForm = () => {
  const { activeProspect, updateProspectField, clearProspect, saveProspect, loading } = useProspect();

  if (!activeProspect) return null;

  const handleChange = (field, value) => updateProspectField(field, value);

  const hasRequired =
    (activeProspect.category || '').trim() !== '' &&
    (activeProspect.sources || '').trim() !== '' &&
    (activeProspect.status || '').trim() !== '' &&
    (activeProspect.linkedin_url || '').trim() !== '';
  const canSave = hasRequired && !loading;

  const handleSave = async () => {
    if (!hasRequired) return;
    try {
      await saveProspect();
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
          {/* 3. Intent */}
          <FieldLabel>Intent</FieldLabel>
          <InputWithIcon
            icon={Target}
            placeholder="e.g. hiring individual, looking for dev services"
            value={activeProspect.intent || ''}
            onChange={(v) => handleChange('intent', v)}
          />
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
          <FieldLabel>LinkedIn connection</FieldLabel>
          <SelectWithIcon
            value={activeProspect.linkedin_connection || 'none'}
            onChange={(v) => handleChange('linkedin_connection', v)}
          >
            <option value="none">None</option>
            <option value="invite">Invite</option>
            <option value="connected">Connected</option>
          </SelectWithIcon>
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
            onChange={(v) => handleChange('status', v)}
          >
            <option value="new">New</option>
            <option value="data_refined">Data Refined</option>
            <option value="use_in_campaign">Use in Campaign</option>
            <option value="pitch">Pitch</option>
          </SelectWithIcon>
        </div>
      </section>

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
          title={!hasRequired ? 'Fill Category, Source, Status and LinkedIn URL to save' : undefined}
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
