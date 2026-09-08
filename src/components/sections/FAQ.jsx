import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal from '../core/Reveal';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n/LangContext';
import { useFaq } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';

export default function FAQ() {
  const { t } = useLang();
  const ft = t.faq;
  const [open, setOpen] = useState(null);
  const fromDb = useFaq();
  const items = (fromDb ?? ft.items).map(item => ({ question: item.q, answer: item.a }));

  return (
    <section className="relative py-28 overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-5">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-20 items-start">
          <Reveal>
            <div className="lg:sticky lg:top-32">
              <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-4">{ft.label}</p>
              <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-black tracking-[-0.03em] text-white mb-6">
                {ft.title}<br />{ft.title2}
              </h2>
              <p className="text-sm text-white/30 leading-relaxed">{ft.sub}</p>
              <div className="mt-8">
                <Link to={CONTACT_PATH} className="inline-flex items-center gap-2 text-sm text-primary hover:text-white transition-colors duration-300">
                  {ft.cta}
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>
          </Reveal>

          <div className="space-y-0 divide-y divide-line">
            {items.map((f, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="group py-6 cursor-pointer" onClick={() => setOpen(open === i ? null : i)}>
                  <div className="flex items-center justify-between gap-6">
                    <span className={`text-sm font-medium transition-colors duration-300 ${open === i ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
                      {f.question}
                    </span>
                    <motion.div
                      animate={{ rotate: open === i ? 45 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0 w-6 h-6 rounded-full border border-line group-hover:border-white/20 flex items-center justify-center transition-colors"
                    >
                      <span className="text-white/30 text-sm leading-none">+</span>
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {open === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-white/40 leading-relaxed pt-4 pr-10">{f.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
