'use client';

import React, { useState, useRef } from 'react';

interface PromptBarProps {
  onSend: (prompt: string) => Promise<void>;
  onUploadImage?: (base64Image: string) => Promise<void>;
  isLoading: boolean;
  lang: 'id' | 'en';
}

const PromptBar: React.FC<PromptBarProps> = ({ onSend, onUploadImage, isLoading, lang }) => {
  const [prompt, setPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    await onSend(prompt);
    setPrompt('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File foto terlalu besar. Maksimal 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Str = reader.result as string;
      if (onUploadImage) {
        await onUploadImage(base64Str);
      }
    };
    reader.onerror = () => {
      alert("Gagal membaca file gambar.");
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Browser belum mendukung Speech Recognition. Gunakan Google Chrome.");
        return;
      }
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'id-ID';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (event: any) => {
        setPrompt(event.results[0][0].transcript);
        setIsRecording(false);
      };
      recognitionRef.current.onerror = () => setIsRecording(false);
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="fixed bottom-24 md:bottom-8 left-0 w-full flex justify-center px-container-padding-mobile z-[60]">
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-[#C5C0F0] rounded-2xl p-2 pr-2 pl-6 flex items-center gap-4 shadow-xl max-w-xl w-full sketch-border"
        style={{ fontFamily: "'Fredoka', sans-serif" }}
      >
        {/* Mic / Sparkle icon */}
        <button
          type="button"
          onClick={toggleRecording}
          className="shrink-0 hover:scale-110 active:scale-90 transition-transform text-[#3D3A6B] flex items-center justify-center"
        >
          {isRecording ? (
            <span className="material-symbols-outlined text-[#DC2626] animate-pulse">mic</span>
          ) : (
            <span className="material-symbols-outlined text-[#E8856A]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          )}
        </button>

        {/* Upload schedule button */}
        {onUploadImage && (
          <label className="shrink-0 cursor-pointer p-1 hover:bg-[#E8856A]/10 rounded-full flex items-center justify-center hover:scale-110 active:scale-90 transition-transform text-[#3D3A6B]" title="Unggah jadwal (Gambar, PDF, Word)">
            <input
              type="file"
              accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              className="hidden"
              onChange={handleImageUpload}
              disabled={isLoading}
            />
            <span className="material-symbols-outlined text-[#E8856A]">attach_file</span>
          </label>
        )}

        {/* Input */}
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={lang === 'id' ? 'Rencanakan kegiatanmu...' : 'Plan your next vibe...'}
          className="bg-transparent border-none focus:ring-0 text-[#3D3A6B] flex-grow font-body-md italic py-2 placeholder:text-[#3D3A6B]/40 outline-none"
          disabled={isLoading}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          className="doodle-btn bg-[#E8856A] text-white w-10 h-10 rounded-full flex items-center justify-center transition-all hover:rotate-12 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isLoading ? (
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined">arrow_upward</span>
          )}
        </button>
      </form>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-error text-on-error px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          Listening...
        </div>
      )}
    </div>
  );
};

export default PromptBar;
