import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ArrowUpRight, MessageCircle, Phone } from 'lucide-react';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_SETTINGS } from '@/lib/content/site';
import { useAnswers, useCases, useOffers, useSettings } from '@/lib/site/SiteContentContext';
import KeenFace from './KeenFace';
import { submitLead } from '@/lib/leads';
import { readCampaign } from '@/lib/analytics/campaign';
import {
  findAnswer, findInContent, containsContact,
  QUICK_REPLIES, LEAD_PROMPT, LEAD_DONE, LEAD_FAILED, LINK_LABELS,
} from '@/lib/content/knowledge';

/** После стольких реплик клиента предлагаем передать задачу команде. */
const LEAD_AFTER = 3;

/**
 * Кнопки вопроса о согласии на обработку ПД. Это кнопки самого виджета, а не
 * продажника: id с подчёркиваниями, чтобы не совпасть с его кнопками.
 */
const CONSENT_YES = '__consent_yes';
const CONSENT_NO = '__consent_no';

/** Пауза перед ответом — мгновенный отклик выглядит роботизированно. */
function thinkingDelay(text) {
  return Math.min(1600, 500 + text.length * 6);
}

/**
 * Идентификатор разговора для ИИ-продажника: один на вкладку, как и метки
 * кампании. Это не слежка между визитами — закрыл вкладку, разговор новый.
 */
function chatSession() {
  try {
    let id = sessionStorage.getItem('tk_chat_session');
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
      sessionStorage.setItem('tk_chat_session', id);
    }
    return id;
  } catch {
    return '';
  }
}

function campaignSource() {
  const { utm, referrer, landing } = readCampaign();
  return { ...utm, ...(referrer ? { referrer } : {}), ...(landing ? { page: landing } : {}) };
}

function TelegramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-8c.4-.3-.1-.5-.6-.2L6.7 13.1l-4.7-1.5c-1-.3-1-1 .2-1.5l18.4-7.1c.9-.3 1.6.2 1.3 1.3Z" />
    </svg>
  );
}

export default function Consultant() {
  const SETTINGS = useSettings(SITE_SETTINGS);
  const { t, lang } = useLang();
  const ct = t.consultant;
  const cs = t.consent;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [leadAsked, setLeadAsked] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  // Разговор ведёт ИИ-продажник: согласие, карточку и контакт собирает он, а
  // не виджет. Узнаём это по первому ответу /api/chat.
  const [agentMode, setAgentMode] = useState(false);
  // Контакт, оставленный в чате, до согласия на обработку ПД никуда не
  // уходит: лежит здесь, пока человек не нажмёт «Согласен(на)».
  const [pendingContact, setPendingContact] = useState(null);
  const [chatConsent, setChatConsent] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const quickReplies = QUICK_REPLIES[lang] || QUICK_REPLIES.ru;
  const linkLabel = LINK_LABELS[lang] || LINK_LABELS.ru;

  // Опубликованное содержимое сайта: работы, разборы, кейсы. Разделы есть
  // только по-русски, поэтому искать в них имеет смысл только по-русски —
  // сослаться на страницу, которой на языке собеседника нет, не помощь.
  const answers = useAnswers();
  const offers = useOffers();
  const cases = useCases();
  const published = React.useMemo(
    () => (lang === 'ru' ? { answers, offers, cases } : null),
    [lang, answers, offers, cases],
  );

  // Диалог начинается заново при смене языка — иначе половина реплик на другом.
  useEffect(() => {
    setMessages([{ role: 'assistant', content: ct.greeting }]);
    setLeadAsked(false);
    setLeadSent(false);
    setPendingContact(null);
  }, [lang, ct.greeting]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /**
   * Пробует ответить через продажника или языковую модель; если ни того, ни
   * другого нет — null. `raw` — то, что уходит продажнику (id кнопки согласия
   * вместо её надписи).
   */
  const askModel = useCallback(async (history, raw) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          session: chatSession(),
          text: raw,
          source: campaignSource(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.agent) setAgentMode(true);
      if (!response.ok) return null;
      if (data.agent) return { text: data.reply?.trim() || '', buttons: data.buttons || [], agent: true };
      return data.reply?.trim() ? { text: data.reply.trim(), buttons: [] } : null;
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
        // Сюда попадаем только после кнопки «Согласен(на)» — см. respond.
        consent: true,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const respond = useCallback(async (text, label) => {
    const userMessage = { role: 'user', content: label || text };
    // кнопки под прошлыми ответами больше не нужны: выбор сделан
    const history = [...messages.map(m => (m.buttons ? { ...m, buttons: undefined } : m)), userMessage];
    setMessages(history);
    setTyping(true);

    // Ответ на вопрос о согласии. Отправляется тот контакт, что человек
    // оставил до вопроса, и та переписка, что была на тот момент.
    if (pendingContact && (text === CONSENT_YES || text === CONSENT_NO)) {
      const pending = pendingContact;
      setPendingContact(null);
      if (text === CONSENT_NO) {
        setTyping(false);
        setMessages(prev => [...prev, { role: 'assistant', content: cs.chatDeclined }]);
        return;
      }
      setChatConsent(true);
      const ok = await sendLead(pending.text, pending.history);
      const reply = ok ? (LEAD_DONE[lang] || LEAD_DONE.ru) : (LEAD_FAILED[lang] || LEAD_FAILED.ru);
      setLeadSent(ok);
      setTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      return;
    }
    // Человек не ответил на вопрос, а написал дальше — вопрос снят.
    if (pendingContact) setPendingContact(null);

    // Клиент оставил телефон, ник или почту — передаём заявку команде, но
    // только с согласия на обработку ПД (ст. 7–8 Закона РК о ПД).
    // С продажником этого не делаем: контакт он берёт сам и только после согласия.
    if (!agentMode && !leadSent && containsContact(text)) {
      if (!chatConsent) {
        setPendingContact({ text, history });
        setTyping(false);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: cs.chatAsk,
          link: '/privacy#consent',
          linkText: cs.link,
          linkNewTab: true,
          buttons: [{ id: CONSENT_YES, label: cs.chatYes }, { id: CONSENT_NO, label: cs.chatNo }],
        }]);
        return;
      }
      const ok = await sendLead(text, history);
      const reply = ok ? (LEAD_DONE[lang] || LEAD_DONE.ru) : (LEAD_FAILED[lang] || LEAD_FAILED.ru);
      setLeadSent(ok);
      setTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      return;
    }

    // Порядок важен. Сначала модель: она видит весь разговор. Если ключа нет
    // или она не ответила — ищем среди опубликованного на сайте, и только в
    // последнюю очередь берём заготовку из кода. Заготовка последняя именно
    // потому, что она единственная, которая устаревает молча.
    const fromModel = await askModel(history, text);
    if (fromModel?.agent && !fromModel.text) {    // диалог у человека, продажник промолчал
      setTyping(false);
      return;
    }
    const local = fromModel
      ? null
      : (published && findInContent(text, published)) || findAnswer(text, lang);
    const reply = fromModel?.text || local.text;

    await new Promise(resolve => setTimeout(resolve, thinkingDelay(reply)));

    const userTurns = history.filter(m => m.role === 'user').length;
    const shouldAskLead = !agentMode && !fromModel?.agent && !leadAsked && !leadSent && userTurns >= LEAD_AFTER;

    setTyping(false);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: reply, link: local?.link, buttons: fromModel?.buttons?.length ? fromModel.buttons : undefined },
      ...(shouldAskLead ? [{ role: 'assistant', content: LEAD_PROMPT[lang] || LEAD_PROMPT.ru }] : []),
    ]);
    if (shouldAskLead) setLeadAsked(true);
  }, [messages, lang, leadAsked, leadSent, agentMode, askModel, sendLead, published,
      pendingContact, chatConsent, cs]);

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
                  <KeenFace size={20} className="text-primary" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{ct.title}</p>
                <p className="text-[10px] text-white/35 truncate">
                  {ct.role}
                  {' · '}
                  <span className="text-emerald-400/80">{ct.online}</span>
                </p>
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
                        // Условия согласия — в новой вкладке: разговор и
                        // ждущий согласия контакт остаются на месте.
                        {...(m.linkNewTab
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : { onClick: () => setOpen(false) })}
                        className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-white transition-colors"
                      >
                        {m.linkText || linkLabel} <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    )}
                    {m.buttons?.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.buttons.map(b => (
                          <button
                            key={b.id}
                            onClick={() => !typing && respond(b.id, b.label)}
                            className="text-[11px] px-2.5 py-1.5 rounded-full border border-primary/30 text-white/80
                              hover:text-white hover:bg-primary/10 transition-all duration-300"
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
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
          href={SETTINGS.whatsapp_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${SETTINGS.whatsapp}`}
          title={SETTINGS.whatsapp}
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
          href={SETTINGS.telegram_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Telegram ${SETTINGS.telegram}`}
          title={SETTINGS.telegram}
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
