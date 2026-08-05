import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal from '../core/Reveal';
import { useLang } from '@/lib/i18n/LangContext';

const STEP_COLORS = ['#4d7fff','#10d4a8','#f0a020','#a855f7','#4d7fff','#10d4a8','#f0a020','#4d7fff','#10d4a8'];

export default function Process() {
  const { t } = useLang();
  const pt = t.process;
  const [active, setActive] = useState(null);

  return (
    <section id="process" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface to-background" />
      <div className="absolute inset-0 grid-bg opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto px-5">
        <Reveal>
          <div className="mb-16">
            <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-4">{pt.label}</p>
            <h2 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white mb-3">{pt.title}</h2>
            <p className="text-sm text-white/30 max-w-lg">{pt.sub}</p>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-16 items-start">
          <div className="space-y-0">
            {pt.steps.map((s, i) => (
              <Reveal key={i} delay={i * 0.04}>
                <div
                  className="group relative py-5 cursor-pointer"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <motion.div
                    className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
                    style={{ background: STEP_COLORS[i] }}
                    animate={{ opacity: active === i ? 1 : 0, scaleY: active === i ? 1 : 0.3 }}
                    transition={{ duration: 0.25 }}
                  />
                  <div className={`flex gap-5 pl-4 border-b transition-colors duration-300 pb-5 ${active === i ? 'border-white/10' : 'border-line'}`}>
                    <span className="text-xs font-mono text-white/15 pt-0.5 w-6 flex-shrink-0 group-hover:text-white/30 transition-colors">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors duration-300">{s.title}</h3>
                        <span
                          className="text-[9px] px-2 py-0.5 rounded-full border font-medium"
                          style={{ color: STEP_COLORS[i], borderColor: `${STEP_COLORS[i]}30`, background: `${STEP_COLORS[i]}10` }}
                        >
                          {s.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/25 mb-2">{s.sub}</p>
                      <AnimatePresence>
                        {active === i && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="text-xs text-white/40 leading-relaxed overflow-hidden"
                          >
                            {s.desc}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                      animate={{
                        backgroundColor: active === i ? STEP_COLORS[i] : 'rgba(255,255,255,0.08)',
                        boxShadow: active === i ? `0 0 8px ${STEP_COLORS[i]}80` : 'none',
                      }}
                      transition={{ duration: 0.25 }}
                    />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <div className="lg:sticky lg:top-28">
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl pointer-events-none" />
                <div className="relative glass rounded-2xl overflow-hidden border border-line p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-xs text-white/30 font-mono">{pt.liveLabel}</p>
                  </div>
                  <div className="relative">
                    <div className="absolute left-[7px] top-0 bottom-0 w-px bg-white/5" />
                    <div className="space-y-3">
                      {pt.steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div
                            className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 relative z-10"
                            style={{ borderColor: i <= 4 ? STEP_COLORS[i] : 'rgba(255,255,255,0.1)', background: i <= 4 ? `${STEP_COLORS[i]}20` : 'transparent' }}
                          />
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                whileInView={{ width: i < 4 ? '100%' : i === 4 ? '70%' : i === 5 ? '20%' : '0%' }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.4 + i * 0.1, duration: 0.7 }}
                                className="h-full rounded-full"
                                style={{ background: STEP_COLORS[i] }}
                              />
                            </div>
                            <span className="text-[9px] text-white/20 w-20 truncate">{s.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-line">
                      <p className="text-[9px] text-white/20 mb-1">{pt.prototypeLabel}</p>
                      <p className="text-xl font-bold text-white">{pt.prototypeVal}</p>
                      <p className="text-[9px] text-white/20">{pt.prototypeDesc}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-line">
                      <p className="text-[9px] text-white/20 mb-1">{pt.guaranteeLabel}</p>
                      <p className="text-xl font-bold text-white">{pt.guaranteeVal}</p>
                      <p className="text-[9px] text-white/20">{pt.guaranteeDesc}</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] text-primary/70 leading-relaxed">{pt.note}</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}