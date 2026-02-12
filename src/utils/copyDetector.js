// Smart field detection for copied text

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
const linkedInUrlRegex = /linkedin\.com\/in\//i;
const companyKeywords = ['inc', 'ltd', 'llc', 'corp', 'corporation', 'company', 'co', 'group', 'tech', 'solutions', 'systems', 'services'];

export const detectField = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim().toLowerCase();

  // Email detection
  if (emailRegex.test(trimmed)) {
    return 'email';
  }

  // LinkedIn URL detection (before generic URL)
  if (linkedInUrlRegex.test(trimmed) || trimmed.includes('linkedin.com/in/')) {
    return 'linkedin_url';
  }

  // URL/Website detection
  if (urlRegex.test(trimmed) || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('www.')) {
    return 'website_link';
  }

  // Company name detection
  if (companyKeywords.some(keyword => trimmed.includes(keyword)) || 
      trimmed.length > 3 && trimmed.split(' ').length <= 4) {
    // Check if it looks like a company name
    if (!trimmed.includes('@') && !trimmed.includes('http')) {
      return 'company_name';
    }
  }

  // Name detection (2-4 words, no special chars, not too long)
  const namePattern = /^[a-zA-Z\s]{2,40}$/;
  if (namePattern.test(trimmed) && trimmed.split(' ').length >= 2 && trimmed.split(' ').length <= 4) {
    return 'name';
  }

  // If text is long, likely "about"
  if (trimmed.length > 50) {
    return 'about_prospect';
  }

  return null; // No match found
};

export const getFieldLabel = (field) => {
  const labels = {
    name: 'Name',
    email: 'Email',
    job_title: 'Designation',
    company_name: 'Company Name',
    website_link: 'Website',
    linkedin_url: 'LinkedIn URL',
    category: 'Category',
    sources: 'Source',
    status: 'Status',
    intent_skills: 'Intent Skills',
    intent_date: 'Intent Date',
    about_prospect: 'About'
  };
  return labels[field] || field;
};

export const getAllFields = () => {
  return [
    { value: 'name', label: 'Name', icon: '👤' },
    { value: 'email', label: 'Email', icon: '✉️' },
    { value: 'job_title', label: 'Designation', icon: '💼' },
    { value: 'company_name', label: 'Company', icon: '🏢' },
    { value: 'website_link', label: 'Website', icon: '🌐' },
    { value: 'linkedin_url', label: 'LinkedIn URL', icon: '🔗' },
    { value: 'category', label: 'Category', icon: '📂' },
    { value: 'sources', label: 'Source', icon: '🔗' },
    { value: 'intent_skills', label: 'Intent Skills', icon: '🎯' },
    { value: 'intent_date', label: 'Intent Date', icon: '📅' },
    { value: 'status', label: 'Status', icon: '📊' },
    { value: 'about_prospect', label: 'About', icon: '📄' }
  ];
};
