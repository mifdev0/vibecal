'use client';

import React, { useState, useEffect } from 'react';
import Calendar from '@/components/Calendar';
import PromptBar from '@/components/PromptBar';
import { getSessionId, API_BASE_URL, parseTitleAndLocation, urlBase64ToUint8Array } from '@/lib/utils';
import axios from 'axios';

const translations = {
  id: {
    memproses: "Memproses jadwal...",
    upNext: "Jadwal Mendatang ⌛",
    quickVibes: "Quick Vibes ☺",
    noPlansYet: "Belum ada rencana...",
    noUpcoming: "Belum ada jadwal mendatang. Ketik rencana di bawah!",
    extractFailed: "Gagal membaca jadwal dari file. Pastikan dokumen/gambar jelas dan coba kembali.",
    addFailed: "Gagal menambahkan jadwal.",
    chill: "Chill",
    focus: "Focus",
    chaos: "Chaos",
    busy: "Busy",
    duration: "Durasi: ",
    inProgress: "Sedang berlangsung",
    inMins: (m: number) => `dalam ${m} mnt`,
    inHours: (h: number) => `dalam ${h} jam`,
    inHoursMins: (h: number, m: number) => `dalam ${h} jam ${m} mnt`,
    inDays: (d: number) => `dalam ${d} hari`,
    inDaysHours: (d: number, h: number) => `dalam ${d} hari ${h} jam`,
    journal: "Jurnal",
    calendar: "Kalender",
    vibes: "Vibe",
    insights: "Analisis",
    today: "Hari Ini",
    thisWeek: "Minggu Ini",
    thisMonth: "Bulan Ini",
    vibeAssistant: "Asisten Vibe ✦",
    loginTitle: "Masuk Ke VibeCal ✦",
    registerTitle: "Daftar Akun Baru ✦",
    fullNamePlaceholder: "Nama Lengkap",
    emailPlaceholder: "Email",
    usernamePlaceholder: "Username",
    passwordPlaceholder: "Password",
    loginButton: "Masuk ✦",
    registerButton: "Daftar ✦",
    dontHaveAccount: "Belum punya akun? Daftar disini",
    alreadyHaveAccount: "Sudah punya akun? Masuk disini",
    loginFailed: "Login gagal. Periksa kembali username/email dan password Anda.",
    registerFailed: "Registrasi gagal. Email atau username mungkin sudah digunakan.",
    usernameOrEmailPlaceholder: "Username atau Email",
    logoutTooltip: "Keluar dari akun",
  },
  en: {
    memproses: "Processing schedule...",
    upNext: "Up Next ⌛",
    quickVibes: "Quick Vibes ☺",
    noPlansYet: "No plans yet...",
    noUpcoming: "No upcoming plans. Type your plans below!",
    extractFailed: "Failed to read schedule from file. Make sure the document/image is clear and try again.",
    addFailed: "Failed to add schedule.",
    chill: "Chill",
    focus: "Focus",
    chaos: "Chaos",
    busy: "Busy",
    duration: "Duration: ",
    inProgress: "In progress",
    inMins: (m: number) => `in ${m} min`,
    inHours: (h: number) => `in ${h} hours`,
    inHoursMins: (h: number, m: number) => `in ${h} hours ${m} min`,
    inDays: (d: number) => `in ${d} days`,
    inDaysHours: (d: number, h: number) => `in ${d} days ${h} hours`,
    journal: "Journal",
    calendar: "Calendar",
    vibes: "Vibes",
    insights: "Insights",
    today: "Today",
    thisWeek: "This Week",
    thisMonth: "This Month",
    vibeAssistant: "Vibe Assistant ✦",
    loginTitle: "Sign In to VibeCal ✦",
    registerTitle: "Create New Account ✦",
    fullNamePlaceholder: "Full Name",
    emailPlaceholder: "Email",
    usernamePlaceholder: "Username",
    passwordPlaceholder: "Password",
    loginButton: "Sign In ✦",
    registerButton: "Register ✦",
    dontHaveAccount: "Don't have an account? Sign up",
    alreadyHaveAccount: "Already have an account? Sign in",
    loginFailed: "Login failed. Check your credentials and try again.",
    registerFailed: "Registration failed. Email or username might be taken.",
    usernameOrEmailPlaceholder: "Username or Email",
    logoutTooltip: "Log out",
  }
};

const monthsEN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthsID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const setupNotifications = async (uId: string) => {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    console.log('Push notifications are not supported in this browser.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return;
    }

    const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.warn('VAPID public key is missing from env');
      return;
    }

    // Check if we already have an active subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });
    }

    // Save subscription in database
    await axios.post(`${API_BASE_URL}/api/notifications/subscribe`, {
      userId: uId,
      subscription: subscription
    });

    console.log('Push subscription setup complete');
  } catch (err) {
    console.error('Error during push notification setup:', err);
  }
};

export default function Home() {
  const [events, setEvents] = useState<any[]>([]);
  const [view, setView] = useState('timeGridWeek');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userId, setUserId] = useState('');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const [isMounted, setIsMounted] = useState(false);

  // Authentication State
  const [user, setUser] = useState<any | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);

  // Form inputs
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('vibecal_lang');
    if (saved === 'id' || saved === 'en') {
      setLang(saved as 'id' | 'en');
    }

    const savedUser = localStorage.getItem('vibecal_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setUserId(parsedUser.id);
        fetchEvents(parsedUser.id);
        setupNotifications(parsedUser.id);
      } catch (e) {
        console.error('Failed to parse saved user:', e);
        localStorage.removeItem('vibecal_user');
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('vibecal_lang', lang);
    }
  }, [lang, isMounted]);

  useEffect(() => {
    if (isMounted && user) {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      
      if (action === 'add') {
        setTimeout(() => {
          const inputEl = document.getElementById('prompt-input');
          if (inputEl) {
            inputEl.focus();
          }
        }, 500);
      } else if (action === 'calendar') {
        setTimeout(() => {
          const calendarEl = document.getElementById('calendar-container');
          if (calendarEl) {
            calendarEl.scrollIntoView({ behavior: 'smooth' });
          }
        }, 600);
      }
    }
  }, [isMounted, user]);

  const t = translations[lang];
  const months = lang === 'id' ? monthsID : monthsEN;
  const currentMonth = months[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear().toString();

  const fetchEvents = async (id: string, silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/events?userId=${id}`);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  const setBackendUser = (loggedUser: any) => {
    localStorage.setItem('vibecal_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
    setUserId(loggedUser.id);
    fetchEvents(loggedUser.id);
    setupNotifications(loggedUser.id);
    // Clear forms
    setIdentifier('');
    setPassword('');
    setFullName('');
    setEmail('');
    setUsername('');
    setAuthError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        identifier,
        password
      });
      setBackendUser(response.data.user);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.response?.data?.error || t.loginFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !username || !password) return;
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        full_name: fullName,
        email,
        username,
        password
      });
      setBackendUser(response.data.user);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.response?.data?.error || t.registerFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vibecal_user');
    setUser(null);
    setUserId('');
    setEvents([]);
  };

  const getGreeting = () => {
    const hour = currentDate.getHours();
    if (hour >= 5 && hour < 12) return lang === 'id' ? 'Selamat Pagi' : 'Good Morning';
    if (hour >= 12 && hour < 15) return lang === 'id' ? 'Selamat Siang' : 'Good Afternoon';
    if (hour >= 15 && hour < 18) return lang === 'id' ? 'Selamat Sore' : 'Good Afternoon';
    return lang === 'id' ? 'Selamat Malam' : 'Good Evening';
  };

  const getFirstName = (name: string) => {
    if (!name) return '';
    return name.trim().split(/\s+/)[0];
  };

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'timeGridDay') {
      d.setDate(d.getDate() - 1);
    } else if (view === 'timeGridWeek') {
      d.setDate(d.getDate() - 7);
    } else if (view === 'dayGridMonth') {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'timeGridDay') {
      d.setDate(d.getDate() + 1);
    } else if (view === 'timeGridWeek') {
      d.setDate(d.getDate() + 7);
    } else if (view === 'dayGridMonth') {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSendPrompt = async (prompt: string) => {
    setIsLoading(true);
    const userMessage = { role: 'user' as const, content: prompt };
    const updatedHistory = [...chatHistory, userMessage];

    try {
      // Get timezone offset string (e.g. "+07:00" or "-05:00")
      const tzo = -new Date().getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, '0');
      const offsetStr = `${dif}${pad(tzo / 60)}:${pad(tzo % 60)}`;

      const clientDate = new Date();
      const referenceDateStr = clientDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const dayOfWeekName = clientDate.toLocaleDateString('en-US', { weekday: 'long' });
      const localTimeStr = clientDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

      const response = await axios.post(`${API_BASE_URL}/api/add-event`, { 
        userId, 
        prompt,
        chatHistory: chatHistory, // Send the previous turns context
        currentDate: referenceDateStr,
        dayOfWeek: dayOfWeekName,
        localTime: localTimeStr,
        timezoneOffset: offsetStr,
        lang: lang // Pass active language to the AI
      });
      
      const { status, message, events: updatedEvents } = response.data;

      if (status === 'needs_clarification') {
        // AI needs more information, show the question in the bubble!
        setAssistantMessage(message);
        setChatHistory([...updatedHistory, { role: 'assistant', content: message }]);
      } else {
        // Success! Set the events, and show the success/reminder message
        if (Array.isArray(updatedEvents)) {
          setEvents(updatedEvents);
        }
        setAssistantMessage(message);
        setChatHistory([...updatedHistory, { role: 'assistant', content: message }]);
      }
    } catch (error) {
      console.error('Error adding event:', error);
      alert(t.addFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadImage = async (base64Image: string) => {
    setIsLoading(true);
    try {
      const tzo = -new Date().getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, '0');
      const offsetStr = `${dif}${pad(tzo / 60)}:${pad(tzo % 60)}`;

      const clientDate = new Date();
      const referenceDateStr = clientDate.toLocaleDateString('en-CA');
      const dayOfWeekName = clientDate.toLocaleDateString('en-US', { weekday: 'long' });
      const localTimeStr = clientDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

      const response = await axios.post(`${API_BASE_URL}/api/upload-schedule`, {
        userId,
        image: base64Image,
        currentDate: referenceDateStr,
        dayOfWeek: dayOfWeekName,
        localTime: localTimeStr,
        timezoneOffset: offsetStr
      });

      if (Array.isArray(response.data)) {
        setEvents(prev => [...prev, ...response.data]);
        alert(lang === 'id' ? `Berhasil mengekstrak ${response.data.length} jadwal dari dokumen/foto! ✦` : `Successfully extracted ${response.data.length} events from document/photo! ✦`);
      } else {
        setEvents(prev => [...prev, response.data]);
        alert(lang === 'id' ? `Berhasil mengekstrak jadwal dari dokumen/foto! ✦` : `Successfully extracted events from document/photo! ✦`);
      }
    } catch (error) {
      console.error('Error uploading file schedule:', error);
      alert(t.extractFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter(e => new Date(e.start_time) >= now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 3);
  };

  const formatTime = (s: string) => {
    const d = new Date(s);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getDuration = (start: string, end: string) => {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    if (diff < 60) return `${diff} ${lang === 'id' ? 'mnt' : 'min'}`;
    return `${Math.round(diff / 60)}${lang === 'id' ? ' jam' : 'h'}`;
  };

  const getTimeUntilStart = (startStr: string) => {
    const now = new Date();
    const start = new Date(startStr);
    const diffMs = start.getTime() - now.getTime();
    
    if (diffMs <= 0) return t.inProgress;
    
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return t.inMins(diffMins);
    
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    
    if (diffHours < 24) {
      if (remainingMins === 0) return t.inHours(diffHours);
      return t.inHoursMins(diffHours, remainingMins);
    }
    
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    if (remainingHours === 0) return t.inDays(diffDays);
    return t.inDaysHours(diffDays, remainingHours);
  };

  const upcoming = getUpcomingEvents();

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="material-symbols-outlined text-[#3D3A6B] animate-spin" style={{ fontSize: '32px' }}>progress_activity</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative overflow-hidden" style={{ fontFamily: "'Fredoka', sans-serif, sans-serif" }}>
        {/* Floating background elements for premium aesthetic */}
        <div className="absolute top-10 left-10 opacity-10 pointer-events-none animate-bounce" style={{ animationDuration: '6s' }}>
          <span className="material-symbols-outlined text-[#E8856A]" style={{ fontSize: '100px' }}>auto_awesome</span>
        </div>
        <div className="absolute bottom-10 right-10 opacity-10 pointer-events-none animate-pulse" style={{ animationDuration: '4s' }}>
          <span className="material-symbols-outlined text-[#E8856A]" style={{ fontSize: '120px' }}>edit_calendar</span>
        </div>
        <div className="absolute top-1/4 right-20 opacity-[0.05] pointer-events-none rotate-12">
          <span className="material-symbols-outlined text-[#E8856A]" style={{ fontSize: '140px' }}>mood</span>
        </div>

        <div className="bento-card max-w-[420px] w-full p-8 relative bg-white">
          <div className="text-center mb-6 flex flex-col items-center justify-center">
            <img 
              src="/logo.png" 
              alt="VibeCal Logo" 
              className="h-16 w-16 object-contain select-none mb-3" 
            />
            <h1 className="text-3xl font-extrabold text-[#3D3A6B]" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              VibeCal
            </h1>
            <p className="text-sm opacity-70 mt-1">
              {authMode === 'login' ? t.loginTitle : t.registerTitle}
            </p>
          </div>

          {authError && (
            <div className="mb-4 bg-[#DC2626]/10 border-2 border-[#DC2626] rounded-xl px-4 py-2.5 text-xs font-bold text-[#DC2626] flex items-center gap-2 sketch-border-sm">
              <span className="material-symbols-outlined text-[#DC2626]" style={{ fontSize: '18px' }}>error</span>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {authMode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">{t.fullNamePlaceholder}</label>
                <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                  <span className="material-symbols-outlined text-[#3D3A6B] opacity-60">badge</span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={t.fullNamePlaceholder}
                    className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">
                {authMode === 'login' ? t.usernameOrEmailPlaceholder : t.emailPlaceholder}
              </label>
              <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                <span className="material-symbols-outlined text-[#3D3A6B] opacity-60">
                  {authMode === 'login' ? 'account_circle' : 'mail'}
                </span>
                <input
                  type={authMode === 'login' ? 'text' : 'email'}
                  required
                  value={authMode === 'login' ? identifier : email}
                  onChange={e => authMode === 'login' ? setIdentifier(e.target.value) : setEmail(e.target.value)}
                  placeholder={authMode === 'login' ? t.usernameOrEmailPlaceholder : t.emailPlaceholder}
                  className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm"
                />
              </div>
            </div>

            {authMode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">{t.usernamePlaceholder}</label>
                <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                  <span className="material-symbols-outlined text-[#3D3A6B] opacity-60">alternate_email</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder={t.usernamePlaceholder}
                    className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">{t.passwordPlaceholder}</label>
              <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                <span className="material-symbols-outlined text-[#3D3A6B] opacity-60">lock</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="doodle-btn bg-[#E8856A] text-[#3D3A6B] w-full py-2.5 mt-2 rounded-xl font-extrabold transition-all cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ fontFamily: "'Fredoka', sans-serif" }}
            >
              {isLoading && <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>progress_activity</span>}
              <span>{authMode === 'login' ? t.loginButton : t.registerButton}</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError(null);
              }}
              className="text-xs font-bold text-[#3D3A6B] opacity-75 hover:opacity-100 transition-opacity underline cursor-pointer"
            >
              {authMode === 'login' ? t.dontHaveAccount : t.alreadyHaveAccount}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-background text-[#3D3A6B]"
      style={{ fontFamily: "'Fredoka', sans-serif, sans-serif" }}
    >
      {/* Top Navigation Bar */}
      <header className="w-full px-4 py-3 z-50 backdrop-blur-xl bg-surface/90 sticky top-0 border-b-2 border-[#3D3A6B]/30">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          
          {/* Top row: Logo/Greeting & Actions */}
          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="VibeCal Logo" 
                className="h-10 w-10 object-contain select-none" 
              />
              <div className="flex flex-col">
                <span className="text-xl md:text-2xl font-extrabold text-[#3D3A6B] select-none leading-none" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                  VibeCal
                </span>
                <span className="text-[11px] font-bold text-[#E8856A] uppercase tracking-wider mt-1" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                  Halo {getGreeting()}, {getFirstName(user.full_name)}! ✦
                </span>
              </div>
            </div>

            {/* Quick Actions (only visible on mobile to save vertical space) */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
                className="doodle-btn px-2.5 py-1 text-xs font-bold text-[#3D3A6B] bg-[#E8856A]/10 hover:bg-[#E8856A]/25 transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                style={{ fontFamily: "'Fredoka', sans-serif" }}
              >
                <span className="material-symbols-outlined text-[#3D3A6B]" style={{ fontSize: '14px' }}>language</span>
                {lang === 'id' ? 'ID' : 'EN'}
              </button>
              <button
                onClick={() => fetchEvents(userId)}
                className="p-1.5 hover:bg-[#E8856A]/10 rounded-full transition-colors cursor-pointer active:scale-95"
                title="Sinkronisasi"
              >
                <span className={`material-symbols-outlined text-[#3D3A6B] text-lg ${isSyncing ? 'animate-spin' : ''}`}>
                  {isSyncing ? 'progress_activity' : 'calendar_today'}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="p-1.5 hover:bg-[#DC2626]/10 rounded-full transition-colors cursor-pointer active:scale-95 text-[#DC2626] flex items-center justify-center"
                title={t.logoutTooltip}
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          </div>

          {/* Bottom row on mobile, Right side on desktop: View Selector, Navigation and Date */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* View Selector (Hari, Minggu, Bulan) */}
            <div className="flex bg-white p-1 sketch-border-sm border-[#3D3A6B] gap-1 w-full sm:w-auto">
              {[
                { id: 'timeGridDay', label: lang === 'id' ? 'Hari' : 'Day' },
                { id: 'timeGridWeek', label: lang === 'id' ? 'Minggu' : 'Week' },
                { id: 'dayGridMonth', label: lang === 'id' ? 'Bulan' : 'Month' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`flex-1 sm:flex-initial text-center px-3 py-1.5 md:py-1 rounded-lg text-xs font-bold tracking-wider transition-all cursor-pointer ${
                    view === v.id
                      ? 'doodle-btn bg-[#E8856A] text-[#3D3A6B]'
                      : 'text-[#3D3A6B] opacity-60 hover:opacity-100'
                  }`}
                  style={{ fontFamily: "'Fredoka', sans-serif" }}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Date Navigation & Date Title */}
            <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
              <div className="flex items-center bg-white px-2 py-1 sketch-border-sm border-[#3D3A6B] gap-1">
                <button
                  onClick={handlePrev}
                  className="p-1 hover:bg-[#E8856A]/10 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                  title="Sebelumnya"
                >
                  <span className="material-symbols-outlined text-[#3D3A6B]" style={{ fontSize: '20px' }}>chevron_left</span>
                </button>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-0.5 hover:bg-[#E8856A]/10 rounded-lg text-[11px] font-bold text-[#3D3A6B] transition-all cursor-pointer active:scale-95"
                  style={{ fontFamily: "'Fredoka', sans-serif" }}
                >
                  {view === 'timeGridDay' ? t.today : view === 'timeGridWeek' ? t.thisWeek : t.thisMonth}
                </button>
                <button
                  onClick={handleNext}
                  className="p-1 hover:bg-[#E8856A]/10 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                  title="Selanjutnya"
                >
                  <span className="material-symbols-outlined text-[#3D3A6B]" style={{ fontSize: '20px' }}>chevron_right</span>
                </button>
              </div>

              <h2 className="text-lg md:text-headline-md text-[#3D3A6B] select-none font-bold min-w-[120px] text-right sm:text-left" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                {currentMonth} {currentYear}
              </h2>
            </div>

            {/* Desktop Actions Only */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
                className="doodle-btn px-2.5 py-1 text-xs font-bold text-[#3D3A6B] bg-[#E8856A]/10 hover:bg-[#E8856A]/25 transition-colors cursor-pointer active:scale-95 flex items-center gap-1.5"
                style={{ fontFamily: "'Fredoka', sans-serif" }}
              >
                <span className="material-symbols-outlined text-[#3D3A6B]" style={{ fontSize: '16px' }}>language</span>
                {lang === 'id' ? 'ID' : 'EN'}
              </button>

              <button
                onClick={() => fetchEvents(userId)}
                className="p-2 hover:bg-[#E8856A]/10 rounded-full transition-colors cursor-pointer active:scale-95"
                title="Sinkronisasi"
              >
                <span className={`material-symbols-outlined text-[#3D3A6B] ${isSyncing ? 'animate-spin' : ''}`}>
                  {isSyncing ? 'progress_activity' : 'calendar_today'}
                </span>
              </button>
              <button className="p-2 hover:bg-[#E8856A]/10 rounded-full transition-colors cursor-pointer active:scale-95">
                <span className="material-symbols-outlined text-[#3D3A6B]">settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-[#DC2626]/10 rounded-full transition-colors cursor-pointer active:scale-95 text-[#DC2626] flex items-center justify-center"
                title={t.logoutTooltip}
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 pb-48 md:pb-32">

        {/* Loading indicator */}
        {(isLoading || isSyncing) && (
          <div className="mb-4 flex items-center gap-3 bg-[#E8856A]/10 border-2 border-[#3D3A6B] rounded-xl px-4 py-3 sketch-border-sm">
            <span className="material-symbols-outlined text-[#3D3A6B] animate-spin">progress_activity</span>
            <span className="text-label-bold font-bold text-[#3D3A6B]">{t.memproses}</span>
          </div>
        )}

        {/* Bento Grid Calendar View */}
        <div id="calendar-container">
          <Calendar 
            events={events} 
            view={view} 
            currentDate={currentDate} 
            setCurrentDate={setCurrentDate} 
            setView={setView} 
            lang={lang}
          />
        </div>

        {/* Bottom Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-bento-gap mt-bento-gap">

          {/* Up Next List */}
          <div className="bento-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#3D3A6B]">nest_clock_farsight_analog</span>
              <h3 className="text-headline-md font-bold text-[#3D3A6B]" style={{ fontFamily: "'Fredoka', sans-serif" }}>{t.upNext}</h3>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-label-sm opacity-50 italic">{t.noUpcoming}</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((ev, idx) => {
                  const { title, location } = parseTitleAndLocation(ev.title);
                  const vibeCat = ev.vibe_category || 'Me-Time';
                  const categoryColors: Record<string, string> = {
                    'Work': '#7C74C9',
                    'Social': '#5C8A6E',
                    'Health': '#F59E0B',
                    'Me-Time': '#E8856A',
                  };
                  const categoryColor = categoryColors[vibeCat] || '#3D3A6B';
                  const categoryEmoji = vibeCat === 'Work' ? '✎' : vibeCat === 'Social' ? '🗲' : vibeCat === 'Health' ? '♡' : vibeCat === 'Me-Time' ? '☺' : '✦';
                  
                  return (
                    <div 
                      key={ev.id || idx} 
                      className="relative flex gap-3 p-3 bg-white border-2 border-[#C5C0F0]/50 rounded-xl hover:shadow-[4px_4px_0px_rgba(197,192,240,0.25)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all duration-200 group overflow-hidden"
                    >
                      {/* Left Color-Coded Bar */}
                      <div 
                        className="w-1.5 rounded-full shrink-0 animate-pulse" 
                        style={{ backgroundColor: categoryColor }} 
                      />
                      
                      {/* Right Content Area */}
                      <div className="flex-grow flex flex-col gap-2 min-w-0">
                        {/* Header: Time, Category Badge, Countdown */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Time Badge */}
                            <span 
                              className="text-[11px] font-bold text-[#3D3A6B] bg-[#3D3A6B]/5 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            >
                              <span className="material-symbols-outlined text-[13px]">schedule</span>
                              {formatTime(ev.start_time)}
                            </span>
                            
                            {/* Category Badge */}
                            <span 
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0"
                              style={{ 
                                backgroundColor: `${categoryColor}15`, 
                                color: categoryColor, 
                                borderColor: `${categoryColor}30` 
                              }}
                            >
                              {vibeCat} {categoryEmoji}
                            </span>
                          </div>

                          {/* Countdown Badge */}
                          <span 
                            className="text-[9px] font-bold text-[#3D3A6B] bg-[#E8856A]/15 border border-[#E8856A]/30 px-2 py-0.5 rounded-full shrink-0"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {getTimeUntilStart(ev.start_time)}
                          </span>
                        </div>

                        {/* Body: Title and Location */}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <h4 className="font-bold text-[#3D3A6B] text-sm leading-snug group-hover:text-primary transition-colors break-words">
                            {title}
                          </h4>
                          {location && (
                            <span className="flex items-center gap-1 text-xs text-[#3D3A6B]/70 font-semibold truncate">
                              <span className="material-symbols-outlined text-[#E8856A] text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                              {location}
                            </span>
                          )}
                        </div>

                        {/* Footer: Duration */}
                        <div className="flex items-center justify-between text-[11px] text-[#3D3A6B]/60 font-semibold border-t border-[#C5C0F0]/20 pt-1.5 mt-0.5">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">timelapse</span>
                            {t.duration} {getDuration(ev.start_time, ev.end_time)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Vibes Mood Selector */}
          <div className="bento-card p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#3D3A6B]">mood</span>
              <h3 className="text-headline-md font-bold text-[#3D3A6B]" style={{ fontFamily: "'Fredoka', sans-serif" }}>{t.quickVibes}</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-grow">
              <button
                onClick={() => handleSendPrompt(lang === 'id' ? "Santai sore ini" : "Chill this afternoon")}
                disabled={isLoading}
                className="doodle-btn flex flex-col items-center justify-center gap-2 p-4 bg-[#5C8A6E]/15 text-[#3D3A6B] hover:bg-[#5C8A6E]/30 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[#5C8A6E]" style={{ fontSize: '30px' }}>self_improvement</span>
                <span className="text-xs font-bold uppercase">{lang === 'id' ? 'Santai' : 'Chill'}</span>
              </button>
              <button
                onClick={() => handleSendPrompt(lang === 'id' ? "Deep work session besok pagi" : "Deep work session tomorrow morning")}
                disabled={isLoading}
                className="doodle-btn flex flex-col items-center justify-center gap-2 p-4 bg-[#7C74C9]/15 text-[#3D3A6B] hover:bg-[#7C74C9]/30 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[#7C74C9]" style={{ fontSize: '30px' }}>psychology</span>
                <span className="text-xs font-bold uppercase">{lang === 'id' ? 'Fokus' : 'Focus'}</span>
              </button>
              <button
                onClick={() => handleSendPrompt(lang === 'id' ? "Meeting penting besok jam 10" : "Important meeting tomorrow at 10 AM")}
                disabled={isLoading}
                className="doodle-btn flex flex-col items-center justify-center gap-2 p-4 bg-[#E8856A]/15 text-[#3D3A6B] hover:bg-[#E8856A]/30 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[#E8856A]" style={{ fontSize: '30px' }}>bolt</span>
                <span className="text-xs font-bold uppercase">{lang === 'id' ? 'Sibuk' : 'Chaos'}</span>
              </button>
              <button
                onClick={() => handleSendPrompt(lang === 'id' ? "Gym hari ini sore" : "Gym today afternoon")}
                disabled={isLoading}
                className="doodle-btn flex flex-col items-center justify-center gap-2 p-4 bg-[#F59E0B]/15 text-[#3D3A6B] hover:bg-[#F59E0B]/30 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[#F59E0B]" style={{ fontSize: '30px' }}>sunny</span>
                <span className="text-xs font-bold uppercase">{lang === 'id' ? 'Padat' : 'Busy'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Dynamic Vibe Assistant Speech Bubble */}
      {assistantMessage && (
        <div className="fixed bottom-44 md:bottom-24 left-1/2 -translate-x-1/2 z-[55] w-full max-w-xl px-container-padding-mobile transition-all duration-300">
          <div className="bg-[#FFFFFF] border-2 border-[#3D3A6B] rounded-2xl p-4 shadow-2xl flex gap-3 relative animate-in fade-in slide-in-from-bottom-2 sketch-border text-[#3D3A6B]">
            <span className="material-symbols-outlined text-[#E8856A] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <div className="flex-grow flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#E8856A]" style={{ fontFamily: "'Fredoka', sans-serif" }}>{t.vibeAssistant}</span>
              <p className="text-sm text-[#3D3A6B] leading-relaxed italic pr-6">
                "{assistantMessage}"
              </p>
            </div>
            {/* Dismiss button */}
            <button 
              onClick={() => {
                setAssistantMessage(null);
                setChatHistory([]);
              }}
              className="absolute top-2 right-2 p-1 hover:bg-[#E8856A]/10 rounded-full transition-colors cursor-pointer text-[#3D3A6B] opacity-50 hover:opacity-100"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating AI Prompt Bar */}
      <PromptBar onSend={handleSendPrompt} onUploadImage={handleUploadImage} isLoading={isLoading} lang={lang} />

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 bg-white border-t-2 border-[#3D3A6B]">
        <button className="flex flex-col items-center justify-center text-[#3D3A6B] px-4 py-2 hover:bg-[#E8856A]/10 transition-all active:scale-90 cursor-pointer">
          <span className="material-symbols-outlined">edit_note</span>
          <span className="text-label-sm">{t.journal}</span>
        </button>
        <button className="flex flex-col items-center justify-center doodle-btn bg-[#E8856A] text-[#3D3A6B] rounded-xl px-4 py-2 active:scale-90 cursor-pointer">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
          <span className="text-label-sm">{t.calendar}</span>
        </button>
        <button className="flex flex-col items-center justify-center text-[#3D3A6B] px-4 py-2 hover:bg-[#E8856A]/10 transition-all active:scale-90 cursor-pointer">
          <span className="material-symbols-outlined">mood</span>
          <span className="text-label-sm">{t.vibes}</span>
        </button>
        <button className="flex flex-col items-center justify-center text-[#3D3A6B] px-4 py-2 hover:bg-[#E8856A]/10 transition-all active:scale-90 cursor-pointer">
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-label-sm">{t.insights}</span>
        </button>
      </nav>
    </div>
  );
}
