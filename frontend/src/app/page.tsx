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
  // Push notifications disabled
  return;
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

  // Landing Page & Navigation
  const [landingPageActive, setLandingPageActive] = useState(true);

  // Profile / Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editProfilePic, setEditProfilePic] = useState<string | null>(null);
  const [editCurrentPassword, setEditCurrentPassword] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Username Availability Checking
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingRegisterUsername, setCheckingRegisterUsername] = useState(false);
  const [registerUsernameAvailable, setRegisterUsernameAvailable] = useState<boolean | null>(null);

  // Feedback Forum States
  const [currentTab, setCurrentTab] = useState<'calendar' | 'forum'>('calendar');
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDesc, setFeedbackDesc] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('Masukan');
  const [feedbackImage, setFeedbackImage] = useState<string | null>(null);
  const [forumError, setForumError] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Editing feedback post state
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editFeedbackTitle, setEditFeedbackTitle] = useState('');
  const [editFeedbackDesc, setEditFeedbackDesc] = useState('');
  const [editFeedbackCategory, setEditFeedbackCategory] = useState('Masukan');
  const [editFeedbackImage, setEditFeedbackImage] = useState<string | null>(null);

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
        setLandingPageActive(false);
      } catch (e) {
        console.error('Failed to parse saved user:', e);
        localStorage.removeItem('vibecal_user');
        setLandingPageActive(true);
      }
    } else {
      setLandingPageActive(true);
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
    setLandingPageActive(false);
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
    
    if (registerUsernameAvailable === false) {
      setAuthError('Username sudah digunakan oleh orang lain');
      return;
    }

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

  // Profile Settings functions
  const openSettings = () => {
    if (!user) return;
    setEditFullName(user.full_name || '');
    setEditUsername(user.username || '');
    setEditProfilePic(user.profile_picture || null);
    setEditCurrentPassword('');
    setEditNewPassword('');
    setEditConfirmPassword('');
    setEditError(null);
    setEditSuccess(null);
    setUsernameAvailable(null);
    setShowSettingsModal(true);
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setEditError('Hanya diperbolehkan mengunggah file PNG atau JPG');
      return;
    }

    const maxSize = 1 * 1024 * 1024; // 1MB size limit
    if (file.size > maxSize) {
      setEditError('Ukuran gambar terlalu besar. Maksimal ukuran file PNG/JPG adalah 1MB.');
      return;
    }

    setEditError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditProfilePic(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    if (editNewPassword && editNewPassword !== editConfirmPassword) {
      setEditError('Password baru dan konfirmasi password tidak cocok');
      return;
    }

    if (usernameAvailable === false) {
      setEditError('Username sudah digunakan');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/update-profile`, {
        userId: user.id,
        full_name: editFullName,
        username: editUsername,
        profile_picture: editProfilePic,
        current_password: editCurrentPassword,
        new_password: editNewPassword
      });

      const { status, user: updatedUser } = response.data;
      if (status === 'success') {
        setEditSuccess('Profil berhasil diperbarui!');
        setUser(updatedUser);
        localStorage.setItem('vibecal_user', JSON.stringify(updatedUser));
        setTimeout(() => {
          setShowSettingsModal(false);
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      setEditError(err.response?.data?.error || 'Gagal memperbarui profil');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!editUsername || !showSettingsModal || editUsername.toLowerCase().trim() === user?.username) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }
    
    setCheckingUsername(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/check-username`, {
          username: editUsername,
          currentUserId: user?.id
        });
        setUsernameAvailable(response.data.available);
      } catch (err) {
        console.error('Error checking username:', err);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [editUsername, showSettingsModal]);

  useEffect(() => {
    if (!username.trim() || authMode !== 'register') {
      setRegisterUsernameAvailable(null);
      setCheckingRegisterUsername(false);
      return;
    }

    setCheckingRegisterUsername(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/check-username`, {
          username: username.trim(),
        });
        setRegisterUsernameAvailable(response.data.available);
      } catch (err) {
        console.error('Error checking register username:', err);
      } finally {
        setCheckingRegisterUsername(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [username, authMode]);
  // Forum Logic & Functions
  const fetchFeedbacks = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/feedback`);
      setFeedbacks(res.data);
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
    }
  };

  useEffect(() => {
    if (currentTab === 'forum') {
      fetchFeedbacks();
    }
  }, [currentTab]);

  const handleFeedbackImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setForumError('Hanya diperbolehkan melampirkan file PNG atau JPG');
      return;
    }

    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      setForumError('Ukuran gambar maksimal adalah 1MB.');
      return;
    }

    setForumError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFeedbackImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setForumError(null);

    if (!feedbackTitle.trim() || !feedbackDesc.trim()) {
      setForumError('Judul dan Deskripsi wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/feedback`, {
        userId,
        title: feedbackTitle,
        description: feedbackDesc,
        category: feedbackCategory,
        image_url: feedbackImage
      });

      if (response.data.status === 'success') {
        setFeedbacks([response.data.feedback, ...feedbacks]);
        setFeedbackTitle('');
        setFeedbackDesc('');
        setFeedbackImage(null);
        const fileInput = document.getElementById('feedback-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (err: any) {
      console.error(err);
      setForumError(err.response?.data?.error || 'Gagal mengirim masukan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent, feedbackId: string) => {
    e.preventDefault();
    const commentText = commentInputs[feedbackId];
    if (!commentText || !commentText.trim()) return;

    try {
      const response = await axios.post(`${API_BASE_URL}/api/feedback/comment`, {
        feedbackId,
        userId,
        content: commentText.trim()
      });

      if (response.data.status === 'success') {
        setFeedbacks(feedbacks.map(f => f.id === feedbackId ? response.data.feedback : f));
        setCommentInputs({ ...commentInputs, [feedbackId]: '' });
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus masukan ini?')) return;

    try {
      const response = await axios.delete(`${API_BASE_URL}/api/feedback?feedbackId=${feedbackId}&userId=${userId}`);
      if (response.data.status === 'success') {
        setFeedbacks(feedbacks.filter(f => f.id !== feedbackId));
      }
    } catch (err: any) {
      console.error('Error deleting feedback:', err);
      alert(err.response?.data?.error || 'Gagal menghapus masukan');
    }
  };

  const handleStartEditFeedback = (fb: any) => {
    setEditingFeedbackId(fb.id);
    setEditFeedbackTitle(fb.title);
    setEditFeedbackDesc(fb.description);
    setEditFeedbackCategory(fb.category);
    setEditFeedbackImage(fb.image_url);
    setForumError(null);
  };

  const handleCancelEdit = () => {
    setEditingFeedbackId(null);
    setEditFeedbackTitle('');
    setEditFeedbackDesc('');
    setEditFeedbackImage(null);
    setForumError(null);
  };

  const handleEditFeedbackImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setForumError('Hanya diperbolehkan melampirkan file PNG atau JPG');
      return;
    }

    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      setForumError('Ukuran gambar maksimal adalah 1MB.');
      return;
    }

    setForumError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditFeedbackImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setForumError(null);

    if (!editFeedbackTitle.trim() || !editFeedbackDesc.trim()) {
      setForumError('Judul dan Deskripsi wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/api/feedback`, {
        feedbackId: editingFeedbackId,
        userId,
        title: editFeedbackTitle,
        description: editFeedbackDesc,
        category: editFeedbackCategory,
        image_url: editFeedbackImage
      });

      if (response.data.status === 'success') {
        setFeedbacks(feedbacks.map(f => f.id === editingFeedbackId ? response.data.feedback : f));
        handleCancelEdit();
      }
    } catch (err: any) {
      console.error(err);
      setForumError(err.response?.data?.error || 'Gagal mengedit masukan');
    } finally {
      setIsLoading(false);
    }
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

  if (!user && landingPageActive) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-[#3D3A6B]" style={{ fontFamily: "'Fredoka', sans-serif" }}>
        {/* Landing Page Header */}
        <header className="w-full px-6 py-4 flex justify-between items-center z-50 backdrop-blur-xl bg-surface/90 border-b-2 border-[#3D3A6B]/30 sticky top-0">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="VibeCal Logo" className="h-10 w-10 object-contain select-none" />
            <span className="text-xl md:text-2xl font-extrabold select-none">VibeCal</span>
          </div>
          <button 
            onClick={() => {
              setAuthMode('login');
              setLandingPageActive(false);
            }}
            className="doodle-btn px-5 py-2 font-bold text-sm bg-white hover:bg-[#E8856A]/10 text-[#3D3A6B] cursor-pointer"
          >
            Masuk ✦
          </button>
        </header>

        {/* Hero Section */}
        <main className="flex-grow flex flex-col items-center justify-center px-6 py-16 text-center max-w-4xl mx-auto relative z-10">
          {/* Decorative shapes */}
          <div className="absolute top-10 left-0 opacity-10 pointer-events-none animate-bounce" style={{ animationDuration: '6s' }}>
            <span className="material-symbols-outlined text-[#E8856A]" style={{ fontSize: '100px' }}>auto_awesome</span>
          </div>
          <div className="absolute bottom-10 right-0 opacity-10 pointer-events-none animate-pulse" style={{ animationDuration: '4s' }}>
            <span className="material-symbols-outlined text-[#E8856A]" style={{ fontSize: '120px' }}>edit_calendar</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
            Atur Jadwal & Vibe-mu dengan <span className="text-[#E8856A]">AI Planner</span> Premium
          </h1>
          <p className="text-base md:text-lg opacity-85 mb-8 max-w-2xl mx-auto">
            VibeCal menggabungkan kalender pintar, analisis mood, dan asisten AI pintar dalam satu antarmuka artistik doodle yang estetik. Cukup ketik rencana Anda secara natural, dan biarkan AI menyusun harinya untuk Anda.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => {
                setAuthMode('register');
                setLandingPageActive(false);
              }}
              className="doodle-btn px-8 py-3.5 font-extrabold text-md bg-[#E8856A] hover:bg-[#E8856A]/90 text-[#3D3A6B] cursor-pointer text-center"
            >
              Mulai Kalendarmu - Gratis ✦
            </button>
            <button 
              onClick={() => {
                setAuthMode('login');
                setLandingPageActive(false);
              }}
              className="doodle-btn px-8 py-3.5 font-extrabold text-md bg-white hover:bg-gray-100 text-[#3D3A6B] cursor-pointer text-center"
            >
              Coba Masuk ✦
            </button>
          </div>

          {/* Features Bento Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full">
            <div className="bento-card p-6 bg-white hover:shadow-[6px_6px_0px_#3D3A6B] transition-all">
              <span className="material-symbols-outlined text-[#E8856A] text-4xl mb-3">auto_awesome</span>
              <h3 className="font-extrabold text-lg mb-2">Asisten AI Vibe</h3>
              <p className="text-sm opacity-75">Tulis rencana kegiatan Anda dalam kalimat biasa, AI akan otomatis menjadwalkan ke kalender Anda.</p>
            </div>
            <div className="bento-card p-6 bg-white hover:shadow-[6px_6px_0px_#3D3A6B] transition-all">
              <span className="material-symbols-outlined text-[#7C74C9] text-4xl mb-3">palette</span>
              <h3 className="font-extrabold text-lg mb-2">Desain Doodle Estetik</h3>
              <p className="text-sm opacity-75">Tampilan premium bernuansa doodle retro yang memanjakan mata dan membuat produktivitas lebih menyenangkan.</p>
            </div>
            <div className="bento-card p-6 bg-white hover:shadow-[6px_6px_0px_#3D3A6B] transition-all">
              <span className="material-symbols-outlined text-[#5C8A6E] text-4xl mb-3">center_focus_strong</span>
              <h3 className="font-extrabold text-lg mb-2">Ekstrak Instan</h3>
              <p className="text-sm opacity-75">Cukup unggah foto roster, jadwal kuliah, atau shift kerja Anda, dan AI akan merangkum semuanya.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user && !landingPageActive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden" style={{ fontFamily: "'Fredoka', sans-serif, sans-serif" }}>
        {/* Back to Home Button */}
        <button 
          onClick={() => setLandingPageActive(true)}
          className="absolute top-6 left-6 doodle-btn px-4 py-2 text-xs font-bold bg-white text-[#3D3A6B] flex items-center gap-1.5 cursor-pointer z-50 animate-in fade-in"
        >
          <span className="material-symbols-outlined text-xs">arrow_back</span>
          Kembali
        </button>
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
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">{t.usernamePlaceholder}</label>
                  {checkingRegisterUsername && (
                    <span className="text-[10px] text-[#3D3A6B]/60 font-bold flex items-center gap-0.5 animate-pulse">
                      <span className="material-symbols-outlined text-xs animate-spin" style={{ fontSize: '12px' }}>progress_activity</span>
                      Memeriksa...
                    </span>
                  )}
                  {!checkingRegisterUsername && registerUsernameAvailable === true && (
                    <span className="text-[10px] text-[#16A34A] font-bold flex items-center gap-0.5 animate-bounce">
                      <span className="material-symbols-outlined text-xs text-[#16A34A]" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      Username Tersedia
                    </span>
                  )}
                  {!checkingRegisterUsername && registerUsernameAvailable === false && (
                    <span className="text-[10px] text-[#DC2626] font-bold flex items-center gap-0.5 animate-bounce">
                      <span className="material-symbols-outlined text-xs text-[#DC2626]" style={{ fontSize: '12px' }}>cancel</span>
                      Username Sudah Dipakai
                    </span>
                  )}
                </div>
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
              {authMode === 'login' && (
                <div className="flex justify-end mt-1">
                  <a 
                    href="https://wa.me/6285716823315?text=Halo%20Admin%20VibeCal%2C%20saya%20lupa%20password%20dan%20ingin%20meminta%20reset%20password%20akun%20saya." 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-[#E8856A] hover:underline flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-xs" style={{ fontSize: '14px' }}>chat</span> Lupa Password? Hubungi Admin (WA)
                  </a>
                </div>
              )}
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
              {user?.profile_picture ? (
                <img 
                  src={user.profile_picture} 
                  alt="Profile" 
                  className="h-10 w-10 rounded-full object-cover border-2 border-[#3D3A6B] select-none" 
                />
              ) : (
                <img 
                  src="/logo.png" 
                  alt="VibeCal Logo" 
                  className="h-10 w-10 object-contain select-none" 
                />
              )}
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
              <button 
                onClick={() => setCurrentTab(currentTab === 'calendar' ? 'forum' : 'calendar')}
                className={`p-2 rounded-full transition-colors cursor-pointer active:scale-95 flex items-center justify-center ${currentTab === 'forum' ? 'bg-[#E8856A] text-[#3D3A6B]' : 'hover:bg-[#E8856A]/10 text-[#3D3A6B]'}`}
                title={currentTab === 'calendar' ? 'Buka Forum Masukan' : 'Buka Kalender'}
              >
                <span className="material-symbols-outlined">{currentTab === 'calendar' ? 'forum' : 'calendar_today'}</span>
              </button>
              <button 
                onClick={openSettings}
                className="p-2 hover:bg-[#E8856A]/10 rounded-full transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                title="Pengaturan Profil"
              >
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

        {currentTab === 'calendar' ? (
          <>
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
      </>
    ) : (
          /* Feedback Forum Page layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-bento-gap animate-in fade-in duration-300">
            
            {/* Left Side: Submit Feedback Form */}
            <div className="lg:col-span-1">
              <div className="bento-card p-6 bg-white sticky top-24">
                {editingFeedbackId ? (
                  <>
                    <h3 className="text-xl font-extrabold text-[#3D3A6B] mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#E8856A]">edit</span>
                      Edit Masukan
                    </h3>
                    
                    {forumError && (
                      <div className="mb-4 bg-[#DC2626]/10 border-2 border-[#DC2626] rounded-xl px-4 py-2 text-xs font-bold text-[#DC2626] flex items-center gap-2 sketch-border-sm">
                        <span className="material-symbols-outlined text-xs">error</span>
                        <span>{forumError}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveEditFeedback} className="space-y-4">
                      {/* Category Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Kategori</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { name: 'Bug', color: '#DC2626', icon: 'bug_report' },
                            { name: 'Masukan', color: '#5C8A6E', icon: 'lightbulb' },
                            { name: 'Tanya', color: '#7C74C9', icon: 'help' }
                          ].map(cat => (
                            <button
                              key={cat.name}
                              type="button"
                              onClick={() => setEditFeedbackCategory(cat.name)}
                              className={`doodle-btn px-2 py-1.5 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
                                editFeedbackCategory === cat.name 
                                  ? 'bg-[#E8856A] text-[#3D3A6B]' 
                                  : 'bg-white hover:bg-gray-100 text-[#3D3A6B]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm" style={{ color: editFeedbackCategory === cat.name ? '#3D3A6B' : cat.color }}>
                                {cat.icon}
                              </span>
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Title */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Judul</label>
                        <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                          <input
                            type="text"
                            required
                            value={editFeedbackTitle}
                            onChange={e => setEditFeedbackTitle(e.target.value)}
                            placeholder="Misal: Kalender eror di HP"
                            className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Detail Laporan / Ide</label>
                        <div className="bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                          <textarea
                            required
                            rows={4}
                            value={editFeedbackDesc}
                            onChange={e => setEditFeedbackDesc(e.target.value)}
                            placeholder="Jelaskan detail bug atau ide..."
                            className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm resize-none"
                          />
                        </div>
                      </div>

                      {/* Image Attachment */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Foto Pendukung (Opsional)</label>
                        <div className="flex items-center gap-3">
                          <label 
                            htmlFor="edit-feedback-file"
                            className="doodle-btn px-4 py-2 text-xs font-bold bg-white hover:bg-gray-50 text-[#3D3A6B] cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            <span className="material-symbols-outlined text-sm">attach_file</span>
                            Unggah Foto
                          </label>
                          <input
                            id="edit-feedback-file"
                            type="file"
                            accept="image/png, image/jpeg"
                            onChange={handleEditFeedbackImageChange}
                            className="hidden"
                          />
                          <span className="text-[10px] text-gray-500 font-bold uppercase select-none">Maks: 1MB</span>
                        </div>
                        
                        {editFeedbackImage && (
                          <div className="mt-2 relative inline-block">
                            <img 
                              src={editFeedbackImage} 
                              alt="Attachment Preview" 
                              className="h-20 w-auto rounded-lg border-2 border-[#3D3A6B] object-cover" 
                            />
                            <button
                              type="button"
                              onClick={() => setEditFeedbackImage(null)}
                              className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full p-0.5 border border-[#3D3A6B] hover:scale-105 active:scale-95 flex items-center justify-center"
                              style={{ width: '18px', height: '18px' }}
                            >
                              <span className="material-symbols-outlined text-[10px]">close</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="flex-1 doodle-btn bg-white hover:bg-gray-100 text-[#3D3A6B] py-2 rounded-xl font-bold transition-all cursor-pointer text-center text-sm"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="flex-1 doodle-btn bg-[#E8856A] text-[#3D3A6B] py-2 rounded-xl font-extrabold transition-all cursor-pointer text-center text-sm"
                        >
                          Simpan ✦
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-extrabold text-[#3D3A6B] mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#E8856A]">rate_review</span>
                      Kirim Masukan / Bug
                    </h3>
                    
                    {forumError && (
                      <div className="mb-4 bg-[#DC2626]/10 border-2 border-[#DC2626] rounded-xl px-4 py-2 text-xs font-bold text-[#DC2626] flex items-center gap-2 sketch-border-sm">
                        <span className="material-symbols-outlined text-xs">error</span>
                        <span>{forumError}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmitFeedback} className="space-y-4">
                      {/* Category Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Kategori</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { name: 'Bug', color: '#DC2626', icon: 'bug_report' },
                            { name: 'Masukan', color: '#5C8A6E', icon: 'lightbulb' },
                            { name: 'Tanya', color: '#7C74C9', icon: 'help' }
                          ].map(cat => (
                            <button
                              key={cat.name}
                              type="button"
                              onClick={() => setFeedbackCategory(cat.name)}
                              className={`doodle-btn px-2 py-1.5 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
                                feedbackCategory === cat.name 
                                  ? 'bg-[#E8856A] text-[#3D3A6B]' 
                                  : 'bg-white hover:bg-gray-100 text-[#3D3A6B]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm" style={{ color: feedbackCategory === cat.name ? '#3D3A6B' : cat.color }}>
                                {cat.icon}
                              </span>
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Title */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Judul</label>
                        <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                          <input
                            type="text"
                            required
                            value={feedbackTitle}
                            onChange={e => setFeedbackTitle(e.target.value)}
                            placeholder="Misal: Kalender eror di HP"
                            className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Detail Laporan / Ide</label>
                        <div className="bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                          <textarea
                            required
                            rows={4}
                            value={feedbackDesc}
                            onChange={e => setFeedbackDesc(e.target.value)}
                            placeholder="Jelaskan detail bug atau ide fitur baru Anda..."
                            className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm resize-none"
                          />
                        </div>
                      </div>

                      {/* Image Attachment */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Foto Pendukung (Opsional)</label>
                        <div className="flex items-center gap-3">
                          <label 
                            htmlFor="feedback-file"
                            className="doodle-btn px-4 py-2 text-xs font-bold bg-white hover:bg-gray-50 text-[#3D3A6B] cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            <span className="material-symbols-outlined text-sm">attach_file</span>
                            Unggah Foto
                          </label>
                          <input
                            id="feedback-file"
                            type="file"
                            accept="image/png, image/jpeg"
                            onChange={handleFeedbackImageChange}
                            className="hidden"
                          />
                          <span className="text-[10px] text-gray-500 font-bold uppercase select-none">Maks: 1MB (PNG/JPG)</span>
                        </div>
                        
                        {feedbackImage && (
                          <div className="mt-2 relative inline-block">
                            <img 
                              src={feedbackImage} 
                              alt="Attachment Preview" 
                              className="h-20 w-auto rounded-lg border-2 border-[#3D3A6B] object-cover" 
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setFeedbackImage(null);
                                const fileInput = document.getElementById('feedback-file') as HTMLInputElement;
                                if (fileInput) fileInput.value = '';
                              }}
                              className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full p-0.5 border border-[#3D3A6B] hover:scale-105 active:scale-95 flex items-center justify-center"
                              style={{ width: '18px', height: '18px' }}
                            >
                              <span className="material-symbols-outlined text-[10px]">close</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="doodle-btn bg-[#E8856A] text-[#3D3A6B] w-full py-2.5 rounded-xl font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isLoading && <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>progress_activity</span>}
                        Kirim ✦
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>

            {/* Right Side: Feed of Feedbacks */}
            <div className="lg:col-span-2 space-y-6">
              {feedbacks.length === 0 ? (
                <div className="bento-card p-12 bg-white text-center flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-[#3D3A6B]/30 text-5xl mb-3">forum</span>
                  <p className="font-bold text-[#3D3A6B]/75 text-md">Belum ada masukan di forum ini. Jadilah yang pertama!</p>
                </div>
              ) : (
                feedbacks.map((fb) => {
                  const author = fb.author || {};
                  const isAuthorDev = author.email?.toLowerCase() === 'mifthahulamri@gmail.com';
                  const dateStr = new Date(fb.created_at).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  // Category badges
                  const catBadges: Record<string, { bg: string, text: string, icon: string }> = {
                    'Bug': { bg: '#DC262615', text: '#DC2626', icon: 'bug_report' },
                    'Masukan': { bg: '#5C8A6E15', text: '#5C8A6E', icon: 'lightbulb' },
                    'Tanya': { bg: '#7C74C915', text: '#7C74C9', icon: 'help' }
                  };
                  const currentBadge = catBadges[fb.category] || { bg: '#E8856A15', text: '#E8856A', icon: 'chat' };

                  return (
                    <div key={fb.id} className="bento-card p-5 sm:p-6 bg-white space-y-4">
                      
                      {/* Post Header: Profile & Category */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3D3A6B]/10 pb-3">
                        <div className="flex items-center gap-3">
                          {author.profile_picture ? (
                            <img 
                              src={author.profile_picture} 
                              alt="Profile" 
                              className="h-10 w-10 rounded-full object-cover border border-[#3D3A6B]" 
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-[#E8856A]/10 border border-[#3D3A6B] flex items-center justify-center">
                              <span className="material-symbols-outlined text-xl text-[#3D3A6B]">account_circle</span>
                            </div>
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-[#3D3A6B]">{author.full_name || 'Anonim'}</span>
                              <span className="text-xs text-[#3D3A6B]/60 font-semibold">@{author.username || 'username'}</span>
                              {isAuthorDev && (
                                <span className="bg-[#3D3A6B] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-[#E8856A] flex items-center gap-0.5 select-none" style={{ height: '18px' }}>
                                  <span className="material-symbols-outlined text-[9px] text-[#E8856A]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>Dev ✦
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#3D3A6B]/50 font-bold uppercase">{dateStr}</span>
                          </div>
                        </div>

                         {/* Category Badge & Actions */}
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1 border"
                            style={{ backgroundColor: currentBadge.bg, color: currentBadge.text, borderColor: `${currentBadge.text}30` }}
                          >
                            <span className="material-symbols-outlined text-xs">{currentBadge.icon}</span>
                            {fb.category}
                          </span>
                          
                          {(fb.user_id === userId || user?.email?.toLowerCase() === 'mifthahulamri@gmail.com') && (
                            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-[#3D3A6B]/15">
                              {fb.user_id === userId && (
                                <button
                                  onClick={() => handleStartEditFeedback(fb)}
                                  className="p-1 hover:bg-[#E8856A]/15 rounded-md transition-colors cursor-pointer text-[#3D3A6B] hover:text-[#E8856A]"
                                  title="Edit Masukan"
                                >
                                  <span className="material-symbols-outlined text-xs" style={{ fontSize: '14px' }}>edit</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteFeedback(fb.id)}
                                className="p-1 hover:bg-[#DC2626]/15 rounded-md transition-colors cursor-pointer text-[#DC2626]"
                                title="Hapus Masukan"
                              >
                                <span className="material-symbols-outlined text-xs" style={{ fontSize: '14px' }}>delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Post Content */}
                      <div className="space-y-2">
                        <h4 className="text-md font-extrabold text-[#3D3A6B]">{fb.title}</h4>
                        <p className="text-sm text-[#3D3A6B]/80 leading-relaxed whitespace-pre-wrap">{fb.description}</p>
                        
                        {fb.image_url && (
                          <div className="mt-3 overflow-hidden rounded-lg border-2 border-[#3D3A6B] max-w-md">
                            <img 
                              src={fb.image_url} 
                              alt="Feedback Attachment" 
                              className="w-full h-auto object-cover max-h-[300px]" 
                            />
                          </div>
                        )}
                      </div>

                      {/* Comments Section */}
                      <div className="bg-gray-50/50 rounded-xl p-4 border-2 border-[#3D3A6B]/10 space-y-4">
                        <h5 className="text-xs font-extrabold text-[#3D3A6B] uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-xs">forum</span>
                          Komentar ({fb.comments?.length || 0})
                        </h5>
                        
                        {fb.comments && fb.comments.length > 0 && (
                          <div className="space-y-3 divide-y divide-[#3D3A6B]/5">
                            {fb.comments.map((comment: any) => {
                              const isCommentDev = comment.is_developer || comment.username === 'mifdev0';
                              return (
                                <div key={comment.id} className={`pt-3 first:pt-0 flex gap-2 items-start ${isCommentDev ? 'bg-[#E8856A]/5 p-2 rounded-lg' : ''}`}>
                                  {comment.profile_picture ? (
                                    <img 
                                      src={comment.profile_picture} 
                                      alt="Avatar" 
                                      className="h-7 w-7 rounded-full object-cover border border-[#3D3A6B] mt-0.5 shrink-0" 
                                    />
                                  ) : (
                                    <div className="h-7 w-7 rounded-full bg-[#E8856A]/10 border border-[#3D3A6B] flex items-center justify-center shrink-0 mt-0.5">
                                      <span className="material-symbols-outlined text-xs text-[#3D3A6B]">account_circle</span>
                                    </div>
                                  )}
                                  <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-[#3D3A6B]">{comment.user_name}</span>
                                      <span className="text-[10px] text-[#3D3A6B]/60">@{comment.username}</span>
                                      {isCommentDev && (
                                        <span className="bg-[#3D3A6B] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-[#E8856A] flex items-center gap-0.5 select-none" style={{ height: '14px' }}>
                                          <span className="material-symbols-outlined text-[8px] text-[#E8856A]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>Dev ✦
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-[#3D3A6B]/80 mt-1 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add Comment Input Form */}
                        <form onSubmit={(e) => handleAddComment(e, fb.id)} className="flex items-center gap-2 mt-2 pt-2 border-t border-[#3D3A6B]/5">
                          <input
                            type="text"
                            value={commentInputs[fb.id] || ''}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [fb.id]: e.target.value })}
                            placeholder="Tulis balasan atau tanggapan..."
                            className="w-full bg-white sketch-border-sm border-[#3D3A6B] px-3 py-1.5 outline-none text-[#3D3A6B] text-xs focus:ring-1 focus:ring-[#E8856A]"
                          />
                          <button
                            type="submit"
                            className="doodle-btn px-3 py-1.5 bg-[#E8856A] text-[#3D3A6B] text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">send</span>
                            Balas
                          </button>
                        </form>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}
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
      {currentTab === 'calendar' && (
        <PromptBar onSend={handleSendPrompt} onUploadImage={handleUploadImage} isLoading={isLoading} lang={lang} />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 bg-white border-t-2 border-[#3D3A6B]">
        <button 
          onClick={() => setCurrentTab('calendar')}
          className={`flex flex-col items-center justify-center px-4 py-2 hover:bg-[#E8856A]/10 transition-all active:scale-90 cursor-pointer ${currentTab === 'calendar' ? 'doodle-btn bg-[#E8856A] text-[#3D3A6B] rounded-xl' : 'text-[#3D3A6B]'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: currentTab === 'calendar' ? "'FILL' 1" : undefined }}>calendar_month</span>
          <span className="text-label-sm">{t.calendar}</span>
        </button>
        <button 
          onClick={() => setCurrentTab('forum')}
          className={`flex flex-col items-center justify-center px-4 py-2 hover:bg-[#E8856A]/10 transition-all active:scale-90 cursor-pointer ${currentTab === 'forum' ? 'doodle-btn bg-[#E8856A] text-[#3D3A6B] rounded-xl' : 'text-[#3D3A6B]'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: currentTab === 'forum' ? "'FILL' 1" : undefined }}>forum</span>
          <span className="text-label-sm">Forum</span>
        </button>
        <button 
          onClick={openSettings}
          className="flex flex-col items-center justify-center text-[#3D3A6B] px-4 py-2 hover:bg-[#E8856A]/10 transition-all active:scale-90 cursor-pointer"
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="text-label-sm">Profil</span>
        </button>
      </nav>
      {/* Settings / Profile Management Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-[#3D3A6B]/50 backdrop-blur-md flex items-center justify-center z-[100] p-4 overflow-y-auto" style={{ fontFamily: "'Fredoka', sans-serif" }}>
          <div className="bento-card max-w-[480px] w-full p-6 bg-white relative animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-[#3D3A6B] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#E8856A]">manage_accounts</span>
                Pengaturan Profil
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1 hover:bg-[#E8856A]/10 rounded-full transition-colors cursor-pointer text-[#3D3A6B] opacity-60 hover:opacity-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {editError && (
              <div className="mb-4 bg-[#DC2626]/10 border-2 border-[#DC2626] rounded-xl px-4 py-2.5 text-xs font-bold text-[#DC2626] flex items-center gap-2 sketch-border-sm">
                <span className="material-symbols-outlined text-[#DC2626]" style={{ fontSize: '16px' }}>error</span>
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="mb-4 bg-[#5C8A6E]/10 border-2 border-[#5C8A6E] rounded-xl px-4 py-2.5 text-xs font-bold text-[#5C8A6E] flex items-center gap-2 sketch-border-sm">
                <span className="material-symbols-outlined text-[#5C8A6E]" style={{ fontSize: '16px' }}>check_circle</span>
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              
              {/* Profile Picture Upload */}
              <div className="flex flex-col items-center justify-center gap-3 mb-2">
                <div className="relative">
                  {editProfilePic ? (
                    <img 
                      src={editProfilePic} 
                      alt="Preview" 
                      className="h-24 w-24 rounded-full object-cover border-4 border-[#3D3A6B] select-none" 
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-[#E8856A]/10 border-4 border-dashed border-[#3D3A6B] flex items-center justify-center select-none">
                      <span className="material-symbols-outlined text-4xl text-[#3D3A6B]">account_circle</span>
                    </div>
                  )}
                  <label 
                    htmlFor="profile-pic-input"
                    className="absolute bottom-0 right-0 p-1.5 bg-[#E8856A] text-[#3D3A6B] rounded-full border-2 border-[#3D3A6B] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                    title="Ubah Foto Profil"
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontSize: '16px' }}>photo_camera</span>
                  </label>
                  <input 
                    id="profile-pic-input"
                    type="file" 
                    accept="image/png, image/jpeg" 
                    onChange={handleProfilePicChange}
                    className="hidden" 
                  />
                </div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Maksimal file PNG/JPG: 1MB</span>
              </div>

              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Nama Lengkap</label>
                <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                  <span className="material-symbols-outlined text-[#3D3A6B] opacity-60">badge</span>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={e => setEditFullName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm"
                  />
                </div>
              </div>

              {/* Username with Availability Indicator */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#3D3A6B] uppercase tracking-wider">Username</label>
                  <div className="flex items-center gap-1">
                    {checkingUsername && (
                      <span className="text-[10px] text-[#3D3A6B]/60 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs animate-spin" style={{ fontSize: '12px' }}>progress_activity</span>
                        Memeriksa...
                      </span>
                    )}
                    {!checkingUsername && usernameAvailable === true && (
                      <span className="text-[10px] text-[#5C8A6E] font-bold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs text-[#5C8A6E]" style={{ fontSize: '12px' }}>check_circle</span>
                        Username Tersedia
                      </span>
                    )}
                    {!checkingUsername && usernameAvailable === false && (
                      <span className="text-[10px] text-[#DC2626] font-bold flex items-center gap-0.5 animate-bounce">
                        <span className="material-symbols-outlined text-xs text-[#DC2626]" style={{ fontSize: '12px' }}>cancel</span>
                        Username Sudah Dipakai
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-3 py-2 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                  <span className="material-symbols-outlined text-[#3D3A6B] opacity-60">alternate_email</span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-transparent outline-none text-[#3D3A6B] text-sm"
                  />
                </div>
              </div>

              {/* Password Area */}
              <div className="border-2 border-[#3D3A6B]/20 rounded-xl p-3 bg-gray-50/50 space-y-3">
                <h4 className="text-xs font-extrabold text-[#3D3A6B] uppercase tracking-wider">Ubah Password (Opsional)</h4>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#3D3A6B]/70 uppercase tracking-wider">Password Saat Ini</label>
                  <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-2.5 py-1.5 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                    <span className="material-symbols-outlined text-[#3D3A6B] opacity-60 text-sm">lock</span>
                    <input
                      type="password"
                      value={editCurrentPassword}
                      onChange={e => setEditCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent outline-none text-[#3D3A6B] text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3D3A6B]/70 uppercase tracking-wider">Password Baru</label>
                    <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-2.5 py-1.5 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                      <span className="material-symbols-outlined text-[#3D3A6B] opacity-60 text-sm">lock_reset</span>
                      <input
                        type="password"
                        value={editNewPassword}
                        onChange={e => setEditNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent outline-none text-[#3D3A6B] text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3D3A6B]/70 uppercase tracking-wider">Konfirmasi Password</label>
                    <div className="flex items-center bg-white sketch-border-sm border-[#3D3A6B] px-2.5 py-1.5 gap-2 focus-within:ring-2 focus-within:ring-[#E8856A]/50 transition-all">
                      <span className="material-symbols-outlined text-[#3D3A6B] opacity-60 text-sm">enhanced_encryption</span>
                      <input
                        type="password"
                        value={editConfirmPassword}
                        onChange={e => setEditConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent outline-none text-[#3D3A6B] text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 doodle-btn bg-white hover:bg-gray-100 text-[#3D3A6B] py-2 rounded-xl font-bold transition-all cursor-pointer text-center text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLoading || usernameAvailable === false}
                  className="flex-1 doodle-btn bg-[#E8856A] hover:bg-[#E8856A]/90 text-[#3D3A6B] py-2 rounded-xl font-extrabold transition-all cursor-pointer text-center text-sm disabled:opacity-50"
                >
                  Simpan ✦
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
