import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { useLang } from '@/lib/i18n/LangContext';

function buildConsultantReply(text, lang) {
  const lower = text.toLowerCase();
  const isKz = lang === 'kz';
  const isEn = lang === 'en';

  if (lower.includes('crm') || lower.includes('сrm') || lower.includes('црм')) {
    if (isEn) return 'For CRM, start with the sales pipeline, client lifecycle, roles, and integrations. Oberon can launch a ready CRM base first, then adapt automations and reports to your process.';
    if (isKz) return 'CRM үшін алдымен сату воронкасын, клиент кезеңдерін, рөлдерді және интеграцияларды анықтау керек. Oberon дайын базаны тез іске қосып, кейін процестеріңізге бейімдейді.';
    return 'Для CRM лучше начать с воронки продаж, этапов клиента, ролей и интеграций. Oberon может быстро запустить готовую базу, а затем адаптировать автоматизации и отчёты под ваш процесс.';
  }

  if (lower.includes('ai') || lower.includes('ии') || lower.includes('бот') || lower.includes('agent')) {
    if (isEn) return 'For AI automation, the highest ROI usually comes from lead qualification, support replies, document processing, and manager follow-ups. Describe the repetitive workflow and we can map it to an AI agent.';
    if (isKz) return 'AI автоматтандыруда ең үлкен әсер лидтерді іріктеу, қолдау жауаптары, құжат өңдеу және follow-up процестерінен шығады. Қайталанатын жұмысты сипаттасаңыз, оны AI агентке айналдырамыз.';
    return 'В AI-автоматизации максимальный эффект обычно дают квалификация лидов, ответы поддержки, обработка документов и follow-up менеджеров. Опишите повторяющийся процесс — подберём AI-агента.';
  }

  if (lower.includes('цена') || lower.includes('стоим') || lower.includes('price') || lower.includes('budget')) {
    if (isEn) return 'Ready solutions usually start from 500,000 ₸ for implementation, with optional monthly support. The exact budget depends on integrations, roles, migrations, and AI scope.';
    if (isKz) return 'Дайын шешімдерді енгізу әдетте 500 000 ₸-ден басталады, ай сайынғы қолдау бөлек қосылады. Нақты баға интеграциялар, рөлдер, көшіру және AI көлеміне байланысты.';
    return 'Готовые решения обычно стартуют от 500 000 ₸ за внедрение, поддержка подключается отдельно. Точная стоимость зависит от интеграций, ролей, миграции данных и объёма AI-логики.';
  }

  if (isEn) return 'Sounds like a good fit for an Oberon consultation. Share your business niche, current workflow, and desired result through the form below so the team can prepare a concrete proposal.';
  if (isKz) return 'Бұл Oberon консультациясына жақсы тақырып сияқты. Төмендегі формада бизнес бағытын, қазіргі процесті және қалаған нәтижені жазыңыз — команда нақты ұсыныс дайындайды.';
  return 'Похоже на хорошую задачу для консультации Oberon. Укажите нишу, текущий процесс и желаемый результат в форме ниже — команда подготовит конкретное предложение.';
}

export default function Consultant() {
  const { t, lang } = useLang();
  const ct = t.consultant;

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Reset messages and greeting when language changes
  useEffect(() => {
    setMsgs([{ role: 'assistant', content: ct.greeting }]);
  }, [lang, ct.greeting]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMsgs(p => [...p, { role: 'user', content: text }]);
    setLoading(true);

    const reply = buildConsultantReply(text, lang);
    setMsgs(p => [...p, { role: 'assistant', content: reply }]);
    setLoading(false);
  };

  const messages = msgs || [{ role: 'assistant', content: ct.greeting }];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-20 right-0 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden
              glass-strong border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">AG</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{ct.title}</p>
                <p className="text-[10px] text-emerald-400/80">{ct.online}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/20 hover:text-white/60 transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={scrollRef} className="h-64 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary/20 text-white/80 border border-primary/20'
                      : 'bg-white/[0.05] text-white/60 border border-white/[0.06]'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.05] rounded-xl px-3.5 py-2.5 border border-white/[0.06]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 pb-4">
              <div className="flex gap-2 items-center bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder={ct.placeholder}
                  className="flex-1 bg-transparent text-xs text-white/70 placeholder-white/20 outline-none"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary/40 flex items-center justify-center text-primary transition-colors disabled:opacity-30"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(p => !p)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="relative w-13 h-13 rounded-full"
        style={{ width: 52, height: 52 }}
      >
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-40" style={{ animationDuration: '3s' }} />
        <div className="relative w-full h-full rounded-full bg-primary border border-primary/50 flex items-center justify-center shadow-[0_0_30px_hsl(220_100%_60%/0.4)]">
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <X className="w-5 h-5 text-white" />
              </motion.div>
            ) : (
              <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>
    </div>
  );
}
