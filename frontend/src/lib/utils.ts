import { v4 as uuidv4 } from 'uuid';

export const getSessionId = () => {
  if (typeof window === 'undefined') return '';
  let sessionId = localStorage.getItem('vibecal_session_id');
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem('vibecal_session_id', sessionId);
  }
  return sessionId;
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const VIBE_COLORS: Record<string, string> = {
  'Work': '#7C74C9', // Purple (Fokus)
  'Social': '#5C8A6E', // Green (Santai)
  'Health': '#F59E0B', // Amber (Padat)
  'Me-Time': '#E8856A', // Red (Sibuk)
};

export const parseTitleAndLocation = (rawTitle: string) => {
  if (!rawTitle) return { title: '', location: '' };
  const parts = rawTitle.split(' || ');
  let title = parts[0];
  let location = parts[1] || '';
  if (location) {
    // Strip leading emojis like 📍 or brackets and trim spaces
    location = location.replace(/^[(\s📍\u{1F4CD}]+|[)\s]+$/gu, '').trim();
  }
  return { title, location };
};

