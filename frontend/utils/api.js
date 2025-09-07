// API configuration utility
const getApiBaseUrl = () => {
  // Check if we're in browser environment
  if (typeof window !== 'undefined') {
    // Client-side: check if we're in development or production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // In development, use the Next.js proxy
      return '';
    } else {
      // In production, use the direct backend URL (ngrok or deployed backend)
      return process.env.NEXT_PUBLIC_BACKEND_URL || 'https://16b5aaa3e134.ngrok-free.app';
    }
  }
  
  // Server-side: use localhost
  return 'https://16b5aaa3e134.ngrok-free.app';
};

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  START_INTERVIEW: `${API_BASE_URL}/api/start-interview`,
  SUBMIT_ANSWER: `${API_BASE_URL}/api/submit-answer`,
  END_INTERVIEW: `${API_BASE_URL}/api/end-interview`,
  INTERVIEW_STATUS: `${API_BASE_URL}/api/interview-status`,
};

console.log('API Configuration:', { API_BASE_URL, isDev: process.env.NODE_ENV === 'development' });