import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/lib/i18n/LangContext';
import { LANGUAGES } from '@/lib/i18n/index';

/**
 * Высота раскрытого списка: три языка по ~38px плюс рамки. Нужна, чтобы
 * решить, куда открываться. Число приблизительное и таким и должно быть —
 * это порог «влезет ли», а не вёрстка.
 */
const MENU_HEIGHT = 132;

export default function LangSwitcher() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  // Вверх или вниз. В боковой панели переключатель стоит у самого низа
  // экрана, и список, открытый вниз, обрезался нижним краем окна: было
  // видно два языка из трёх, а третий просто не существовал для человека.
  const [up, setUp] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === lang);

  const toggle = () => {
    if (!open && ref.current) {
      const box = ref.current.getBoundingClientRect();
      setUp(window.innerHeight - box.bottom < MENU_HEIGHT + 16);
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-surface-2
          text-xs font-semibold text-white/50 hover:text-white/80 hover:border-white/20
          transition-all duration-250"
      >
        <span className="text-white/70">{current.label}</span>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-2.5 h-2.5 text-white/30"
          fill="none" viewBox="0 0 10 6"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: up ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: up ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute right-0 w-36 rounded-xl border border-line bg-surface-2
              glass-strong overflow-hidden z-50 shadow-[0_8px_32px_rgba(0,0,0,0.4)]
              ${up ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          >
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs transition-colors duration-200
                  ${lang === l.code ? 'text-primary bg-primary/8' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'}`}
              >
                <span className="font-bold w-6">{l.label}</span>
                <span className="text-white/30">{l.name}</span>
                {lang === l.code && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}