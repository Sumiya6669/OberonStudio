import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import Reveal from '../core/Reveal';
import { useLang } from '@/lib/i18n/LangContext';
import { buildFallbackProjects } from '@/lib/content/portfolio';
import WorkModal from './WorkModal';

const COLORS = ['#4d7fff', '#f0a020', '#10d4a8', '#a855f7', '#f472b6', '#06b6d4'];

function WorkCard({ item, color, onOpen }) {
  const [hover, setHover] = useState(false);
  const { t } = useLang();
  const stack = Array.isArray(item.technologies) ? item.technologies : [];

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-2xl overflow-hidden border border-line cursor-pointer flex-shrink-0 w-full
        h-full flex flex-col text-left outline-none hover:border-white/12
        focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
    >
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}08, transparent 70%)` }} />
      <div className="relative h-44 overflow-hidden border-b border-line">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        ) : null}
        <div className="absolute inset-3 rounded-xl glass border border-white/8 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
            {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/10" />)}
            <div className="ml-2 flex-1 h-3.5 rounded bg-white/[0.03] flex items-center px-2">
              <span className="text-[8px] text-white/15">{(item.slug || item.title || 'case').toLowerCase()}.case</span>
            </div>
          </div>
          <div className="p-3 space-y-1.5">
            {[75, 50, 90, 35].map((w, i) => (
              <motion.div
                key={i}
                className="h-1.5 rounded-full"
                style={{ width: `${w}%`, background: color, opacity: 0.12 + i * 0.05 }}
                animate={hover ? { width: [`${w}%`, `${Math.min(w + 12, 96)}%`, `${w}%`] } : {}}
                transition={{ duration: 1.8, delay: i * 0.15, repeat: hover ? Infinity : 0 }}
              />
            ))}
          </div>
        </div>
        <div className="absolute top-5 right-5">
          <span className="text-[9px] font-medium px-2 py-1 rounded-full border" style={{ color, borderColor: `${color}35`, background: `${color}12` }}>
            {item.industry || 'Case'}
          </span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-1.5">
          <h3 className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">{item.title}</h3>
          <span className="text-[10px] text-white/20 ml-2 flex-shrink-0">{item.client_name || 'Oberon'}</span>
        </div>
        <p className="text-xs text-white/35 leading-relaxed mb-3 line-clamp-2">{item.description}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {stack.slice(0, 5).map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/25">{t}</span>
          ))}
        </div>
        {item.result && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] text-white/20 line-clamp-1">{item.result}</span>
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-line flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white/30 group-hover:text-primary transition-colors">
            {t.works.detail.open}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 text-white/20 group-hover:text-primary transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </motion.div>
  );
}

export default function Works() {
  const { t, lang } = useLang();
  const wt = t.works;
  const [activeTab, setActiveTab] = useState('Все');
  const [selected, setSelected] = useState(null);
  const cases = useMemo(() => buildFallbackProjects(t, lang), [t, lang]);

  const tabs = useMemo(() => ['Все', ...Array.from(new Set(cases.map(item => item.industry).filter(Boolean)))], [cases]);
  const filtered = activeTab === 'Все' ? cases : cases.filter(item => item.industry === activeTab);

  return (
    <section id="works" className="relative py-28 overflow-hidden">
      <div className="absolute right-0 top-0 w-96 h-96 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="relative z-10 max-w-7xl mx-auto px-5">
        <Reveal>
          <div className="mb-10">
            <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-4">{wt.label}</p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h2 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white">
                {wt.title}<br />{wt.title2}
              </h2>
              <p className="text-sm text-white/30 max-w-xs">{wt.sub}</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="flex flex-wrap gap-2 mb-8">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-250 ${
                  activeTab === tab
                    ? 'bg-primary/15 text-primary border border-primary/25'
                    : 'bg-surface-2 text-white/30 border border-line hover:text-white/60 hover:border-white/15'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filtered.length === 0 ? (
              <div className="py-12 text-sm text-white/20">{wt.emptyText}</div>
            ) : filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="h-full"
              >
                <WorkCard
                  item={item}
                  index={i}
                  color={COLORS[i % COLORS.length]}
                  onOpen={() => setSelected({ item, color: COLORS[i % COLORS.length] })}
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        <Reveal delay={0.2}>
          <p className="text-xs text-white/15 text-center mt-8">{wt.footer(filtered.length)}</p>
        </Reveal>
      </div>

      <AnimatePresence>
        {selected && (
          <WorkModal
            item={selected.item}
            color={selected.color}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
