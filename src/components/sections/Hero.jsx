import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import NeuralCanvas from '../core/NeuralCanvas';
import MagBtn from '../core/MagBtn';
import Counter from '../core/Counter';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n/LangContext';
import { CONTACT_PATH, PROJECTS_PATH } from '@/lib/routes';

function RotatingWord({ words }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('visible');

  useEffect(() => {
    const id = setInterval(() => {
      setPhase('out');
      setTimeout(() => {
        setIdx(i => (i + 1) % words.length);
        setPhase('in');
        setTimeout(() => setPhase('visible'), 20);
      }, 320);
    }, 2800);
    return () => clearInterval(id);
  }, [words]);

  const style = {
    display: 'inline-block',
    minWidth: '14ch',
    transition: phase === 'out' ? 'opacity 0.28s ease, transform 0.28s ease' : phase === 'in' ? 'none' : 'opacity 0.28s ease, transform 0.28s ease',
    opacity: phase === 'out' ? 0 : phase === 'in' ? 0 : 1,
    transform: phase === 'out' ? 'translateY(-6px)' : phase === 'in' ? 'translateY(6px)' : 'translateY(0)',
    willChange: 'opacity, transform',
  };

  return (
    <span className="text-gradient-blue" style={style}>
      {words[idx]}
    </span>
  );
}

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="absolute -inset-8 rounded-3xl bg-primary/5 blur-3xl" />
      <div className="relative glass rounded-2xl overflow-hidden border border-white/10">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 mx-3 h-5 rounded-md bg-white/[0.04] flex items-center px-2">
            <span className="text-[9px] text-white/20">oberon.studio/admin</span>
          </div>
          <div className="w-6 h-5 rounded bg-white/[0.04]" />
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'AI запросов', val: '12.4K' },
              { label: 'Автоматизаций', val: '347' },
              { label: 'Экономия', val: '68%' },
            ].map((s, i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <p className="text-[9px] text-white/30 mb-1">{s.label}</p>
                <p className="text-sm font-bold text-white">{s.val}</p>
                <span className="text-[8px] text-emerald-400">↑ 12%</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] text-white/40">Активность AI агентов</p>
              <div className="flex gap-1">
                {['1д', '7д', '30д'].map((t, i) => (
                  <span key={t} className={`text-[8px] px-2 py-0.5 rounded-md ${i === 1 ? 'bg-primary/30 text-primary' : 'text-white/20'}`}>{t}</span>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1 h-14">
              {[30, 55, 42, 70, 58, 85, 72, 90, 65, 88, 75, 95].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 1.2 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-1 rounded-sm origin-bottom"
                  style={{ height: `${h}%`, background: i === 11 ? 'hsl(220 100% 60%)' : `hsl(220 100% 60% / ${0.15 + (i / 11) * 0.25})` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 space-y-2">
            <p className="text-[9px] text-white/30 mb-2">Активные процессы</p>
            {[
              { name: 'AI → CRM sync', status: 'running', color: 'bg-emerald-400' },
              { name: 'Telegram bot handler', status: 'active', color: 'bg-primary' },
              { name: '1C data pipeline', status: 'syncing', color: 'bg-amber-400' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${p.color} animate-pulse`} />
                <span className="text-[9px] text-white/50 flex-1">{p.name}</span>
                <span className="text-[8px] text-white/20">{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const { t } = useLang();
  const h = t.hero;
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const statsData = [
    { n: 120, suf: '+', static: null },
    { n: 8, suf: '+', static: null },
    { n: 5, suf: '+', static: null },
    { n: null, suf: '', static: '24/7' },
  ];
  const heroTitle = null;
  const heroSubtitle = h.sub;
  const primaryCta = h.ctaPrimary;
  const secondaryCta = h.ctaSecondary;

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-100" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(220 100% 60% / 0.08) 0%, transparent 70%)' }} />
      <div className="absolute inset-0"><NeuralCanvas /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background opacity-60" />
      <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-beam pointer-events-none" style={{ top: '40%' }} />

      <motion.div style={{ y, opacity }} className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-5 pt-28 pb-20">
          <div className="grid lg:grid-cols-[1fr_1fr] gap-16 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-8"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]" />
                <span className="text-xs text-white/50 tracking-wide">{h.available}</span>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1 }}>
                {heroTitle ? (
                  <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-black leading-[1.0] tracking-[-0.04em] mb-6 text-gradient-white">
                    {heroTitle}
                  </h1>
                ) : (
                  <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-black leading-[1.0] tracking-[-0.04em] mb-6">
                    <span className="text-gradient-white block">{h.headline1} <RotatingWord words={h.words} /></span>
                    <span className="text-gradient-white block">{h.headline2}</span>
                    <span className="text-gradient-blue block">{h.headline3}</span>
                    <span className="text-gradient-blue block">{h.headline4}</span>
                  </h1>
                )}
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="text-base text-white/40 leading-relaxed max-w-md mb-10 font-light"
              >
                {heroSubtitle}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.8 }}
                className="flex flex-col sm:flex-row gap-3 mb-14"
              >
                <MagBtn>
                  <Link
                    to={CONTACT_PATH}
                    className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl
                      bg-primary text-white text-sm font-semibold overflow-hidden
                      shadow-[0_0_30px_hsl(220_100%_60%/0.3)] hover:shadow-[0_0_50px_hsl(220_100%_60%/0.5)]
                      transition-shadow duration-500"
                  >
                    <span className="relative z-10">{primaryCta}</span>
                    <svg className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </Link>
                </MagBtn>
                <MagBtn>
                  <Link
                    to={PROJECTS_PATH}
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl
                      border border-white/10 text-sm font-medium text-white/50
                      hover:text-white/80 hover:border-white/20 transition-all duration-300"
                  >
                    {secondaryCta}
                  </Link>
                </MagBtn>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3, duration: 0.8 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
                {statsData.map((s, i) => (
                  <div key={i} className="glass rounded-xl px-4 py-3 border border-white/[0.06] text-center">
                    {s.static ? (
                      <span className="text-xl font-black text-white tabular-nums">{s.static}</span>
                    ) : (
                      <Counter to={s.n} suffix={s.suf} className="text-xl font-black text-white tabular-nums" />
                    )}
                    <p className="text-[10px] text-white/25 mt-0.5 leading-tight">{h.stats[i].label}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block"
            >
              <DashboardMockup />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
