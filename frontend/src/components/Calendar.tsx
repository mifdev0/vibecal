'use client';

import React, { useState } from 'react';
import { parseTitleAndLocation } from '../lib/utils';

interface CalendarProps {
  events: any[];
  view: string;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  setView: (v: string) => void;
  lang: 'id' | 'en';
}

const CATEGORY_STYLES: Record<string, string> = {
  'Work': 'bg-[#7C74C9]/15 border border-[#7C74C9]/30 text-[#3D3A6B] font-bold rounded-lg',
  'Social': 'bg-[#5C8A6E]/15 border border-[#5C8A6E]/30 text-[#3D3A6B] font-bold rounded-lg',
  'Health': 'bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#3D3A6B] font-bold rounded-lg',
  'Me-Time': 'bg-[#E8856A]/15 border border-[#E8856A]/30 text-[#3D3A6B] font-bold rounded-lg',
};

const CATEGORY_BADGE: Record<string, { text: string; cls: string }> = {
  'Work': { text: 'Work ✎', cls: 'bg-[#7C74C9]/20 text-[#3D3A6B] border border-[#7C74C9]/30' },
  'Social': { text: 'Social 🗲', cls: 'bg-[#5C8A6E]/20 text-[#3D3A6B] border border-[#5C8A6E]/30' },
  'Health': { text: 'Health ♡', cls: 'bg-[#F59E0B]/20 text-[#3D3A6B] border border-[#F59E0B]/30' },
  'Me-Time': { text: 'Me-Time ☺', cls: 'bg-[#E8856A]/20 text-[#3D3A6B] border border-[#E8856A]/30' },
};

export default function Calendar({ events, view, currentDate, setCurrentDate, setView, lang }: CalendarProps) {
  const [todayDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const getEventsForDate = (date: Date) =>
    events.filter(ev => {
      const ed = new Date(ev.start_time);
      return ed.getFullYear() === date.getFullYear() && ed.getMonth() === date.getMonth() && ed.getDate() === date.getDate();
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const isToday = (date: Date) =>
    date.getFullYear() === todayDate.getFullYear() && date.getMonth() === todayDate.getMonth() && date.getDate() === todayDate.getDate();

  const dayNames = lang === 'id' 
    ? ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // 1. WEEK VIEW CALCULATIONS & RENDERING
  const currentWeekStart = (() => {
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(currentDate);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  })();

  const getWeekDays = (start: Date) =>
    Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });

  const weekDays = getWeekDays(currentWeekStart);

  // 2. MONTH VIEW CALCULATIONS
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    
    let startDayOfWeek = firstDay.getDay();
    // Adjust so Monday is index 0:
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days: Date[] = [];
    
    // Prev month padding
    const prevMonthEnd = new Date(year, month, 0);
    const prevMonthEndVal = prevMonthEnd.getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthEndVal - i));
    }
    
    // Current month days
    const currentMonthEnd = new Date(year, month + 1, 0);
    const totalDays = currentMonthEnd.getDate();
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Next month padding
    const remaining = days.length % 7;
    if (remaining > 0) {
      const pad = 7 - remaining;
      for (let i = 1; i <= pad; i++) {
        days.push(new Date(year, month + 1, i));
      }
    }

    // Pad up to 42 cells (6 rows)
    while (days.length < 42) {
      const lastDay = days[days.length - 1];
      const nextDay = new Date(lastDay);
      nextDay.setDate(lastDay.getDate() + 1);
      days.push(nextDay);
    }
    
    return days;
  };

  const formatEventTime = (startTimeStr: string, endTimeStr: string) => {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    const sh = start.getHours().toString().padStart(2, '0');
    const sm = start.getMinutes().toString().padStart(2, '0');
    const eh = end.getHours().toString().padStart(2, '0');
    const em = end.getMinutes().toString().padStart(2, '0');
    return `${sh}:${sm} - ${eh}:${em}`;
  };

  const getEventDuration = (startTimeStr: string, endTimeStr: string) => {
    const diff = (new Date(endTimeStr).getTime() - new Date(startTimeStr).getTime()) / 60000;
    if (diff < 60) return `${diff} min`;
    return `${Math.round(diff / 10) / 6} hrs`;
  };

  // Render Day View
  if (view === 'timeGridDay') {
    const dayEvents = getEventsForDate(currentDate);
    const active = isToday(currentDate);
    const dayLabel = dayNames[currentDate.getDay()];
    const dayNum = currentDate.getDate();
    const monthNames = lang === 'id'
      ? ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
      : ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayMonth = monthNames[currentDate.getMonth()];
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

    // Breakdown stats
    const stats = dayEvents.reduce((acc, ev) => {
      acc[ev.vibe_category] = (acc[ev.vibe_category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column: Dashboard Detail Card */}
        <div
          className={`bento-card rounded-xl p-4 md:p-6 border-2 flex flex-col gap-4 md:gap-6 relative overflow-hidden bg-surface-container-lowest dark:bg-inverse-surface ${
            active ? 'border-primary shadow-lg ring-4 ring-primary/10' : 'border-outline-variant/30'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-label-bold font-bold tracking-widest text-[#3D3A6B] uppercase" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              {lang === 'id' ? `Vibe ${dayLabel}` : `${dayLabel} Vibe`}
            </span>
            {active && (
              <span className="material-symbols-outlined text-primary animate-pulse" style={{ fontSize: '24px', fontVariationSettings: "'FILL' 1" }}>
                stars
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <span className="text-[96px] font-extrabold text-[#E8856A] leading-none tracking-tighter" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              {dayNum}
            </span>
            <span className="text-headline-md font-bold opacity-80" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              {dayMonth} {currentDate.getFullYear()}
            </span>
          </div>

          <div className="h-[1px] bg-outline-variant/30" />

          {/* Day Breakdown Stats */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-60" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              {lang === 'id' ? 'Ringkasan Vibe' : 'Vibe Summary'}
            </h4>
            {dayEvents.length === 0 ? (
              <p className="text-sm opacity-50 italic text-on-surface">{lang === 'id' ? 'Kertas kosong! Mari isi hari ini dengan energi.' : "Blank paper! Let's fill this day with energy."}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">{lang === 'id' ? `${dayEvents.length} Vibe direncanakan hari ini:` : `${dayEvents.length} Vibes scheduled today:`}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.keys(stats).map(cat => {
                    const count = stats[cat];
                    const badge = CATEGORY_BADGE[cat] || { text: cat, cls: 'bg-primary text-on-primary' };
                    return (
                      <span key={cat} className={`${badge.cls} text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-xs`}>
                        {cat}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Decorative watermark */}
          <div className="absolute bottom-2 right-2 opacity-[0.03] pointer-events-none text-on-surface dark:text-inverse-on-surface" style={{ transform: 'scale(2) rotate(15deg)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '120px' }}>auto_awesome</span>
          </div>
        </div>

        {/* Right Column: Daily Agenda Timeline */}
        <div className="lg:col-span-2 bento-card bg-surface-container-low rounded-xl p-4 md:p-6 border border-outline-variant/30 min-h-[350px] md:min-h-[400px] flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
              <h3 className="text-headline-md font-bold text-[#3D3A6B]" style={{ fontFamily: "'Fredoka', sans-serif" }}>{lang === 'id' ? 'Agenda Harian' : 'Daily Agenda'}</h3>
            </div>
            {isWeekend && (
              <span className="text-[10px] bg-secondary-container/20 border border-secondary-container text-secondary px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                {lang === 'id' ? 'Akhir Pekan' : 'Weekend'}
              </span>
            )}
          </div>

          {dayEvents.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/20 rounded-xl p-8 text-center bg-surface-container-lowest/20">
              <span className="material-symbols-outlined text-outline-variant/50 text-[48px] mb-3">edit_calendar</span>
              <h4 className="text-lg font-bold opacity-80 text-[#3D3A6B]" style={{ fontFamily: "'Fredoka', sans-serif" }}>{lang === 'id' ? 'Hari ini kosong! ✦' : 'Today is empty! ✦'}</h4>
              <p className="text-sm opacity-50 mt-1 max-w-sm text-[#3D3A6B]">
                {lang === 'id' ? 'Belum ada jadwal yang direncanakan. Ketik rencana di bar prompt di bawah (misal: "Deep work jam 9 pagi") untuk mengisinya!' : 'No plans scheduled yet. Type your plans in the prompt bar below (e.g. "Deep work at 9 AM") to fill it!'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-2">
               {dayEvents.map((ev, idx) => {
                const cls = CATEGORY_STYLES[ev.vibe_category] || CATEGORY_STYLES['Work'];
                const badge = CATEGORY_BADGE[ev.vibe_category];
                const { title, location } = parseTitleAndLocation(ev.title);
                return (
                  <div
                    key={ev.id || idx}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 bg-surface-container-lowest p-4 border border-outline-variant/20 rounded-xl hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 sm:w-40 shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                      <span className="text-label-bold font-bold text-[#3D3A6B]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatEventTime(ev.start_time, ev.end_time)}
                      </span>
                    </div>

                    <div className="flex-grow">
                      <h4 className="text-body-lg font-bold text-[#3D3A6B]">{title}</h4>
                      {location && (
                        <div className="flex items-center gap-1 text-xs text-[#3D3A6B] mt-0.5 font-bold opacity-80">
                          <span className="material-symbols-outlined text-[#E8856A]" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>location_on</span>
                          {location}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1 opacity-70 text-xs text-[#3D3A6B]">
                        <span>{lang === 'id' ? 'Durasi: ' : 'Duration: '}{getEventDuration(ev.start_time, ev.end_time)}</span>
                        {ev.raw_prompt && <span className="italic truncate max-w-[200px]">"{ev.raw_prompt}"</span>}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {badge && (
                        <span className={`${badge.cls} text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-xs`}>
                          {badge.text}
                        </span>
                      )}
                      <span className={`${cls} text-[10px] px-3 py-1 rounded-lg font-semibold uppercase`}>
                        {ev.vibe_category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Month View
  if (view === 'dayGridMonth') {
    const monthDays = getMonthDays(currentDate);

    return (
      <div className="flex flex-col">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 md:gap-3 mb-2 text-center text-[10px] md:text-xs font-bold tracking-widest opacity-60 uppercase text-[#3D3A6B]" style={{ fontFamily: "'Fredoka', sans-serif" }}>
          {(lang === 'id' ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map(label => (
            <div key={label} className="py-1">{label}</div>
          ))}
        </div>

        {/* 6-row Bento Grid */}
        <div className="grid grid-cols-7 gap-1 md:gap-3">
          {monthDays.map((day, idx) => {
            const dayEvents = getEventsForDate(day);
            const active = isToday(day);
            const dayNum = day.getDate();
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={idx}
                onClick={() => {
                  setCurrentDate(day);
                  setView('timeGridDay');
                }}
                className={`bento-card min-h-[60px] sm:min-h-[90px] md:min-h-[130px] p-1 md:p-3 flex flex-col gap-1 md:gap-1.5 border rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden ${
                  active 
                    ? 'border-2 border-primary shadow-lg ring-4 ring-primary/10 bg-surface-container-lowest dark:bg-inverse-surface' 
                    : 'border-outline-variant/20 bg-surface-container-low dark:bg-surface-variant/10'
                } ${!isCurrentMonth ? 'opacity-30' : ''}`}
              >
                {/* Cell Header */}
                <div className="flex justify-between items-center w-full mb-1">
                  <span 
                    className={`text-xs md:text-sm font-bold tracking-wider ${active ? 'text-primary dark:text-primary-fixed-dim font-extrabold' : 'text-on-surface dark:text-inverse-on-surface opacity-80'}`}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {dayNum}
                  </span>
                  {active && (
                    <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim scale-75 md:scale-90" style={{ fontVariationSettings: "'FILL' 1" }}>
                      stars
                    </span>
                  )}
                  {dayEvents.length > 0 && !active && isCurrentMonth && (
                    <span className="text-[9px] font-bold text-primary dark:text-primary-fixed-dim bg-primary/10 dark:bg-primary-fixed-dim/20 px-1.5 py-0.5 rounded-full md:hidden">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Event Indicators - Desktop Version */}
                <div className="hidden md:flex flex-col gap-1 overflow-y-hidden max-h-[80px] w-full">
                  {dayEvents.slice(0, 3).map((ev, j) => {
                    const cls = CATEGORY_STYLES[ev.vibe_category] || CATEGORY_STYLES['Work'];
                    const { title, location } = parseTitleAndLocation(ev.title);
                    return (
                      <div
                        key={ev.id || j}
                        className={`${cls} text-[9px] px-1.5 py-0.5 rounded-md truncate font-bold tracking-wide w-full flex items-center justify-between gap-1`}
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                        title={location ? `${title} (${location})` : title}
                      >
                        <span className="truncate">{title}</span>
                        {location && (
                          <span className="material-symbols-outlined text-[#E8856A] shrink-0" style={{ fontSize: '10px', fontVariationSettings: "'FILL' 1" }}>location_on</span>
                        )}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span className="text-[8px] opacity-50 italic pl-1 font-bold text-[#3D3A6B]">
                      +{dayEvents.length - 3} {lang === 'id' ? 'lagi' : 'more'}
                    </span>
                  )}
                </div>

                {/* Event Indicators - Mobile Version (Colored Dots) */}
                <div className="flex md:hidden flex-row flex-wrap gap-1 mt-auto">
                  {dayEvents.slice(0, 4).map((ev, j) => {
                    let dotColor = 'bg-[#7C74C9]'; // Work (Purple)
                    if (ev.vibe_category === 'Social') dotColor = 'bg-[#5C8A6E]'; // Social (Green)
                    if (ev.vibe_category === 'Health') dotColor = 'bg-[#F59E0B]'; // Health (Amber)
                    if (ev.vibe_category === 'Me-Time') dotColor = 'bg-[#E8856A]'; // Me-Time (Red)
                    return (
                      <div key={ev.id || j} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    );
                  })}
                  {dayEvents.length > 4 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-outline-variant/60 flex items-center justify-center text-[5px] font-bold">+</div>
                  )}
                </div>

                {/* Weekend dots watermark */}
                {isWeekend && dayEvents.length === 0 && (
                  <div className="absolute bottom-1 right-1 opacity-[0.1] text-xs pointer-events-none text-on-surface dark:text-inverse-on-surface">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>holiday_village</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. Render Week View (Default)
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3 md:gap-4">
      {weekDays.map((day, idx) => {
        const dayEvents = getEventsForDate(day);
        const active = isToday(day);
        const dayLabel = dayNames[day.getDay()];
        const dayNum = day.getDate();
        const isEmpty = dayEvents.length === 0;
        const isWeekend = idx >= 5;

        // Today card — special styling matching reference WED card
        if (active) {
          return (
            <div
              key={idx}
              onClick={() => {
                setCurrentDate(day);
                setView('timeGridDay');
              }}
              className="bento-card rounded-xl p-3 md:p-4 border-2 border-primary shadow-lg ring-4 ring-primary/10 min-h-[140px] md:min-h-[300px] flex flex-col gap-2 md:gap-3 scale-[1.02] relative overflow-hidden bg-surface-container-lowest dark:bg-inverse-surface cursor-pointer hover:shadow-2xl transition-all duration-200"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-label-bold font-bold tracking-wider text-primary dark:text-primary-fixed-dim" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {dayLabel} {dayNum}
                </span>
                <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>
                  stars
                </span>
              </div>

              {dayEvents.map((ev, j) => {
                const cls = CATEGORY_STYLES[ev.vibe_category] || CATEGORY_STYLES['Work'];
                const { title, location } = parseTitleAndLocation(ev.title);
                return (
                  <div key={ev.id || j} className={`${cls} p-2 rounded-lg text-label-sm flex flex-col gap-0.5`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    <span className="font-semibold">{title}</span>
                    {location && (
                      <span className="flex items-center gap-0.5 text-[10px] opacity-75 font-bold">
                        <span className="material-symbols-outlined text-[#E8856A] shrink-0" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>location_on</span>
                        <span className="truncate">{location}</span>
                      </span>
                    )}
                  </div>
                );
              })}

              {isEmpty && (
                <div className="bg-surface-container-high border border-outline-variant/30 p-2 rounded-lg text-label-sm opacity-60 italic" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                  {lang === 'id' ? 'Belum ada rencana...' : 'No plans yet...'}
                </div>
              )}

              {/* Decorative watermark */}
              <div className="absolute bottom-2 right-2 opacity-5 pointer-events-none text-on-surface dark:text-inverse-on-surface" style={{ transform: 'scale(1.5) rotate(12deg)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '100px' }}>auto_awesome</span>
              </div>
            </div>
          );
        }

        // Normal day card
        return (
          <div
            key={idx}
            onClick={() => {
              setCurrentDate(day);
              setView('timeGridDay');
            }}
            className={`cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 bento-card rounded-xl p-3 md:p-4 border border-outline-variant/30 min-h-[140px] md:min-h-[300px] flex flex-col gap-2 md:gap-3 bg-surface-container-low dark:bg-surface-variant/10 ${isEmpty && isWeekend ? 'vibe-dot-grid' : ''}`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-label-bold font-bold tracking-wider opacity-60 text-on-surface dark:text-inverse-on-surface font-bold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {dayLabel} {dayNum}
              </span>
              {dayEvents.length > 0 && (() => {
                const badge = CATEGORY_BADGE[dayEvents[0].vibe_category];
                if (badge) {
                  return <span className={`${badge.cls} text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold`}>{badge.text}</span>;
                }
                return null;
              })()}
            </div>

            {dayEvents.map((ev, j) => {
              const cls = CATEGORY_STYLES[ev.vibe_category] || CATEGORY_STYLES['Work'];
              const { title, location } = parseTitleAndLocation(ev.title);
              return (
                <div key={ev.id || j} className={`${cls} p-2 rounded-lg text-label-sm flex flex-col gap-0.5`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <span className="font-semibold">{title}</span>
                  {location && (
                    <span className="flex items-center gap-0.5 text-[10px] opacity-75 font-bold">
                      <span className="material-symbols-outlined text-[#E8856A] shrink-0" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>location_on</span>
                      <span className="truncate">{location}</span>
                    </span>
                  )}
                </div>
              );
            })}

            {isEmpty && isWeekend && (
              <div className="bg-primary-container/10 border-dashed border-2 border-primary-container text-primary p-2 rounded-lg text-label-sm italic text-center" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                {lang === 'id' ? 'Hari Bebas' : 'Open Day'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
