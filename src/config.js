const mode = import.meta.env.VITE_API_MODE || 'local';

export const API_URL =
  mode === 'vercel'
    ? (import.meta.env.VITE_API_URL_VERCEL || 'https://backend-five-sable-52.vercel.app/api')
    : (import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3001/api');
