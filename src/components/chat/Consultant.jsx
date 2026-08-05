import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ArrowUpRight, MessageCircle, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_SETTINGS } from '@/lib/content/site';
import { submitLead } from '@/lib/leads';
import {
  findAnswer, containsContact,
  QUICK_REPLIES, LEAD_PROMPT, LEAD_DONE, LEAD_FAILED, LINK_LABELS,
} from '@/lib/content/knowledge';

/** После стольких реплик клиента предлагаем передать задачу команде. */
const LEAD_AFTER = 3;

/** Пауза перед ответом — мгновенный отклик выглядит роботизированно. */
function thinkingDelay(text) {
  return Math.min(1600, 500 + text.length * 6);
}

function TelegramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-8c.4-.3-.1-.5-.6-.2L6.7 13.1l-4.7-1.5c-1-.3-1-1 .2-1.5l18.4-7.1c.9-.3 1.6.2 1.3 1.3Z" />
    </svg>
  );
}

export default function Consultant() {
  const { t, lang } = useLang();
  const ct = t.consultant;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [leadAsked, setLeadAsked] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const quickReplies = QUICK_REPLIES[lang] || QUICK_REPLIES.ru;
  const linkLabel = LINK_LABELS[lang] || LINK_LABELS.ru;

  // Диалог начинается заново при смене языка — иначе половина реплик на другом.
  useEffect(() => {
    setMessages([{ role: 'assistant', content: ct.greeting }]);
    setLeadAsked(false);
    setLeadSent(false);
  }, [lang, ct.greeting]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /** Пробует ответить через языковую модель; если она не настроена — null. */
  const askModel = useCallback(async (history) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.reply?.trim() || null;
    } catch {
      return null;
    }
  }, []);

  /** Отправка контакта команде в Telegram. */
  const sendLead = useCallback(async (contactText, history) => {
    const transcript = history
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' | ')
      .slice(0, 900);

    try {
      await submitLead({
        name: 'Обращение из чата',
        phone: contactText.slice(0, 200),
        message: transcript,
        source: 'ai_consultant',
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const respond = useCallback(async (text) => {
    const userMessage = { role: 'user', content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    setTyping(true);

    // Клиент оставил телефон, ник или почту — передаём заявку команде.
    if (!leadSent && containsContact(text)) {
      const ok = await sendLead(text, history);
      const reply = ok ? (LEAD_DONE[lang] || LEAD_DONE.ru) : (LEAD_FAILED[lang] || LEAD_FAILED.ru);
      setLeadSent(ok);
      setTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      return;
    }

    const fromModel = await askModel(history);
    const local = fromModel ? null : findAnswer(text, lang);
    const reply = fromModel || local.text;

    await new Promise(resolve => setTimeout(resolve, thinkingDelay(reply)));

    const userTurns = history.filter(m => m.role === 'user').length;
    const shouldAskLead = !leadAsked && !leadSent && userTurns >= LEAD_AFTER;

    setTyping(false);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: reply, link: local?.link },
      ...(shouldAskLead ? [{ role: 'assistant', content: LEAD_PROMPT[lang] || LEAD_PROMPT.ru }] : []),
    ]);
    if (shouldAskLead) setLeadAsked(true);
  }, [messages, lang, leadAsked, leadSent, askModel, sendLead]);

  const send = (value) => {
    const text = (value ?? input).trim();
    if (!text || typing) return;
    setInput('');
    respond(text);
  };

  const showQuickReplies = messages.length <= 2 && !typing;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-[360px] max-w-[calc(100vw-3rem)] rounded-2xl overflow-hidden
              glass-strong border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          >
            {/* Шапка */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">AG</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{ct.title}</p>
                <p className="text-[10px] text-emerald-400/80">{ct.online}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Закрыть чат"
                className="text-white/20 hover:text-white/60 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Лента сообщений */}
            <div ref={scrollRef} className="h-80 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                      m.role === 'user'
                        ? 'bg-primary/20 text-white/85 border border-primary/20'
                        : 'bg-white/[0.05] text-white/65 border border-white/[0.06]'
                    }`}
                  >
                    {m.content}
                    {m.link && (
                      <Link
                        to={m.link}
                        onClick={() => setOpen(false)}
                        className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-white transition-colors"
                      >
                        {linkLabel} <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.05] rounded-xl px-4 py-3 border border-white/[0.06] flex gap-1">
                    {[0, 1, 2].map(dot => (
                      <motion.span
                        key={dot}
                        className="w-1.5 h-1.5 rounded-full bg-white/40"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.18 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Подсказки */}
            {showQuickReplies && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {quickReplies.map(reply => (
                  <button
                    key={reply}
                    onClick={() => send(reply)}
                    className="text-[10px] px-2.5 py-1.5 rounded-full border border-white/[0.08] text-white/40
                      hover:text-white hover:border-primary/30 hover:bg-primary/5 transition-all duration-300"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Ввод */}
            <div className="px-4 pb-4 pt-2">
              <div className="flex gap-2 items-center bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 focus-within:border-primary/30 transition-colors">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder={ct.placeholder}
                  className="flex-1 bg-transparent text-xs text-white/70 placeholder-white/20 outline-none"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || typing}
                  aria-label="Отправить"
                  className="w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary/40 flex items-center justify-center
                    text-primary transition-colors disabled:opacity-30"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[9px] text-white/15 mt-2 text-center">{ct.disclaimer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Мессенджеры + чат */}
      <div className="flex items-center gap-2.5">
        <motion.a
          href={SITE_SETTINGS.whatsapp_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${SITE_SETTINGS.whatsapp}`}
          title={SITE_SETTINGS.whatsapp}
          whileHover={{ scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.94 }}
          className="w-11 h-11 rounded-full flex items-center justify-center border border-emerald-400/25
            bg-emerald-500/10 text-emerald-400 backdrop-blur-xl
            hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-colors duration-300
            shadow-[0_0_20px_rgba(16,212,168,0.15)]"
        >
          <Phone className="w-[18px] h-[18px]" />
        </motion.a>

        <motion.a
          href={SITE_SETTINGS.telegram_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Telegram ${SITE_SETTINGS.telegram}`}
          title={SITE_SETTINGS.telegram}
          whileHover={{ scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.94 }}
          className="w-11 h-11 rounded-full flex items-center justify-center border border-sky-400/25
            bg-sky-500/10 text-sky-400 backdrop-blur-xl
            hover:bg-sky-500/20 hover:border-sky-400/50 transition-colors duration-300
            shadow-[0_0_20px_rgba(56,189,248,0.15)]"
        >
          <TelegramIcon className="w-[18px] h-[18px]" />
        </motion.a>

        <motion.button
          onClick={() => setOpen(p => !p)}
          aria-label={open ? 'Закрыть чат' : 'Открыть чат с консультантом'}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="relative rounded-full"
          style={{ width: 52, height: 52 }}
        >
          {!open && (
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-40" style={{ animationDuration: '3s' }} />
          )}
          <div className="relative w-full h-full rounded-full bg-primary border border-primary/50 flex items-center justify-center shadow-[0_0_30px_hsl(220_100%_60%/0.4)]">
            <AnimatePresence mode="wait">
              {open ? (
                <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <X className="w-5 h-5 text-white" />
                </motion.div>
              ) : (
                <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <MessageCircle className="w-5 h-5 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
