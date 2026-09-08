import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal from '../core/Reveal';
import { useLang } from '@/lib/i18n/LangContext';
import { useServices } from '@/lib/site/SiteContentContext';

const servicesMeta = [
  { num: '01', tag: 'FLAGSHIP', tagColor: 'text-primary border-primary/30 bg-primary/5', accent: 'hsl(220 100% 60%)', price: 'от 500 000 ₸' },
  { num: '02', tag: 'PREMIUM', tagColor: 'text-gold border-gold/30 bg-gold/5', accent: 'hsl(43 74% 58%)', price: 'от 700 000 ₸' },
  { num: '03', tag: 'POPULAR', tagColor: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5', accent: 'hsl(160 80% 55%)', price: 'от 800 000 ₸' },
  { num: '04', tag: 'EXPERT', tagColor: 'text-violet-400 border-violet-400/30 bg-violet-400/5', accent: 'hsl(270 80% 65%)', price: 'от 20 000 ₸/час' },
  { num: '05', tag: 'FULL STACK', tagColor: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5', accent: 'hsl(190 90% 55%)', price: 'от 300 000 ₸' },
];

export default function Services() {
  const { t } = useLang();
  const [active, setActive] = useState(null);
  const st = t.services;
  // Контент услуг живёт в i18n — базы данных у сайта нет.
  // Опубликованные услуги перекрывают зашитые. Нет опубликованных — null,
  // и работает прежний список: правка содержимого не может обнулить раздел.
  const fromDb = useServices();
  const services = fromDb ?? st.items.map(item => ({
    title: item.title,
    category: item.tag,
    short_description: item.desc,
    full_description: item.desc,
    features: item.items,
  }));

  return (
    <section id="services" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative z-10 max-w-7xl mx-auto px-5">
        <Reveal>
          <div className="mb-16">
            <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-4">{st.label}</p>
            <h2 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white">{st.title}</h2>
          </div>
        </Reveal>

        <div className="divide-y divide-line">
          {services.map((item, i) => {
            const meta = servicesMeta[i % servicesMeta.length];
            const details = item.features?.length ? item.features : [item.category].filter(Boolean);
            return (
              <Reveal key={meta.num} delay={i * 0.05}>
                <div
                  className={`group relative py-7 cursor-pointer transition-all duration-500 ${active === i ? 'bg-white/[0.02] -mx-5 px-5 rounded-2xl' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <motion.div
                    className="absolute left-0 top-0 bottom-0 w-px"
                    style={{ background: meta.accent }}
                    animate={{ opacity: active === i ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  />
                  <div className="flex items-start gap-6">
                    <span className="text-xs font-mono text-white/15 pt-1 w-6 flex-shrink-0">{meta.num}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white group-hover:text-gradient-blue transition-all duration-300">{item.title}</h3>
                        <span className={`self-start text-[10px] font-medium tracking-widest px-2 py-0.5 rounded-full border ${meta.tagColor}`}>{item.category || meta.tag}</span>
                      </div>
                      <AnimatePresence>
                        {active === i && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <p className="text-sm text-white/40 leading-relaxed mt-2 mb-4 max-w-xl">{item.full_description || item.short_description}</p>
                            <div className="flex flex-wrap gap-2">
                              {details.map(it => (
                                <span key={it} className="text-xs px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40">{it}</span>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <motion.svg
                      className="w-4 h-4 text-white/20 flex-shrink-0 mt-0.5"
                      animate={{ x: active === i ? 4 : 0, opacity: active === i ? 0.6 : 0.2 }}
                      transition={{ duration: 0.3 }}
                      fill="none" viewBox="0 0 16 16"
                    >
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </motion.svg>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
