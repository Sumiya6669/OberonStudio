import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { X, ArrowUpRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_SETTINGS } from '@/lib/content/site';
import { CONTACT_PATH } from '@/lib/routes';

/** Подробности проекта. Стоимость не показываем — её здесь и нет. */
export default function WorkModal({ item, color, onClose }) {
  const { t } = useLang();
  const dt = t.works.detail;

  // Закрытие по Esc и блокировка прокрутки страницы под окном.
  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const stack = Array.isArray(item.technologies) ? item.technologies : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={event => event.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto scrollbar-none
          rounded-3xl border border-line bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
      >
        {/* Шапка с подсветкой в цвет карточки */}
        <div className="relative px-6 sm:px-8 pt-8 pb-6 border-b border-line">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 20% 0%, ${color}14, transparent 65%)` }}
          />
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-5 right-5 z-10 w-8 h-8 rounded-lg flex items-center justify-center
              text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative">
            <span
              className="inline-block text-[10px] font-medium px-2.5 py-1 rounded-full border mb-4"
              style={{ color, borderColor: `${color}35`, background: `${color}12` }}
            >
              {item.industry}
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight pr-10">
              {item.title}
            </h3>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-7 space-y-7">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-white/20 uppercase mb-3">{dt.description}</p>
            <p className="text-sm text-white/50 leading-relaxed">{item.description}</p>
          </div>

          {item.result && (
            <div>
              <p className="text-[10px] tracking-[0.25em] text-white/20 uppercase mb-3">{dt.result}</p>
              <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                <p className="text-sm text-white/60 leading-relaxed">{item.result}</p>
              </div>
            </div>
          )}

          {stack.length > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.25em] text-white/20 uppercase mb-3">{dt.stack}</p>
              <div className="flex flex-wrap gap-1.5">
                {stack.map(tech => (
                  <span
                    key={tech}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to={CONTACT_PATH}
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                bg-primary text-white text-sm font-bold hover:bg-primary/80 transition-colors"
            >
              {dt.cta}
            </Link>
            <a
              href={SITE_SETTINGS.telegram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-6 py-3.5 rounded-xl
                border border-white/10 text-white/60 text-sm font-semibold
                hover:text-white hover:border-white/20 transition-all"
            >
              {dt.ctaSecondary} <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
