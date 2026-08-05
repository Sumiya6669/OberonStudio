import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Reveal from '../core/Reveal';
import { useLang } from '@/lib/i18n/LangContext';

const categories = [
  {
    icon: '🧠',
    color: '#4d7fff',
    items: [
      { name: 'OpenAI GPT-4o', color: '#10A37F' },
      { name: 'Claude 3.5 Sonnet', color: '#D97757' },
      { name: 'OpenRouter', color: '#7C3AED' },
      { name: 'LangChain', color: '#4B9CD3' },
      { name: 'LangGraph', color: '#2E86AB' },
      { name: 'RAG', color: '#6366F1' },
      { name: 'Vector DB', color: '#8B5CF6' },
      { name: 'AI Agents', color: '#4d7fff' },
    ],
  },
  {
    icon: '⚡',
    color: '#EA4B71',
    items: [
      { name: 'n8n', color: '#EA4B71' },
      { name: 'Telegram Bot API', color: '#26A5E4' },
      { name: 'WhatsApp API', color: '#25D366' },
      { name: 'Webhooks', color: '#FF6B6B' },
      { name: 'REST API', color: '#4ECDC4' },
      { name: '1C', color: '#FFD700' },
      { name: 'iiko', color: '#FF4757' },
      { name: 'Kaspi / Halyk', color: '#00B4D8' },
    ],
  },
  {
    icon: '⚙️',
    color: '#10d4a8',
    items: [
      { name: 'Python', color: '#3776AB' },
      { name: 'FastAPI', color: '#009688' },
      { name: 'Node.js', color: '#339933' },
      { name: 'PostgreSQL', color: '#4169E1' },
      { name: 'Redis', color: '#DC382D' },
      { name: 'Supabase', color: '#3ECF8E' },
      { name: 'Docker', color: '#2496ED' },
      { name: 'GitHub', color: '#888' },
    ],
  },
  {
    icon: '🎨',
    color: '#61DAFB',
    items: [
      { name: 'React', color: '#61DAFB' },
      { name: 'Next.js', color: '#AAAAAA' },
      { name: 'TypeScript', color: '#3178C6' },
      { name: 'Tailwind CSS', color: '#06B6D4' },
      { name: 'Framer Motion', color: '#0055FF' },
      { name: 'Vercel', color: '#888' },
    ],
  },
  {
    icon: '💳',
    color: '#f0a020',
    items: [
      { name: 'CRM Systems', color: '#F59E0B' },
      { name: 'Stripe', color: '#635BFF' },
      { name: 'Kaspi Pay', color: '#FF3B30' },
      { name: 'Halyk Bank', color: '#00A651' },
    ],
  },
];

// Category labels per language
const CAT_LABELS = {
  ru: ['AI & LLM', 'Автоматизация', 'Backend', 'Frontend', 'CRM & Платёжки'],
  kz: ['AI & LLM', 'Автоматтандыру', 'Backend', 'Frontend', 'CRM & Төлемдер'],
  en: ['AI & LLM', 'Automation', 'Backend', 'Frontend', 'CRM & Payments'],
};

export default function Stack() {
  const { t, lang } = useLang();
  const st = t.stack;
  const [hoveredCat, setHoveredCat] = useState(null);
  const labels = CAT_LABELS[lang] || CAT_LABELS.ru;

  return (
    <section id="stack" className="relative py-28 overflow-hidden">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-gold/5 blur-[150px] pointer-events-none" />
      <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-5">
        <Reveal>
          <div className="mb-16">
            <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-4">{st.label}</p>
            <h2 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-[-0.03em] text-white mb-3">{st.title}</h2>
            <p className="text-sm text-white/30 max-w-lg">{st.sub}</p>
          </div>
        </Reveal>

        <div className="space-y-10">
          {categories.map((cat, ci) => (
            <Reveal key={ci} delay={ci * 0.08}>
              <div onMouseEnter={() => setHoveredCat(ci)} onMouseLeave={() => setHoveredCat(null)}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-base">{cat.icon}</span>
                  <p
                    className="text-xs uppercase tracking-[0.25em] font-semibold transition-colors duration-300"
                    style={{ color: hoveredCat === ci ? cat.color : 'rgba(255,255,255,0.2)' }}
                  >
                    {labels[ci]}
                  </p>
                  <div
                    className="flex-1 h-px transition-all duration-500"
                    style={{ background: hoveredCat === ci ? `linear-gradient(to right, ${cat.color}40, transparent)` : 'rgba(255,255,255,0.05)' }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((item) => (
                    <motion.div
                      key={item.name}
                      whileHover={{ y: -3, scale: 1.04 }}
                      transition={{ duration: 0.2 }}
                      className="group/item relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 border border-line cursor-default hover:border-white/15 transition-all duration-300"
                    >
                      <div
                        className="absolute inset-0 rounded-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"
                        style={{ background: `radial-gradient(circle at 50% 100%, ${item.color}15, transparent 70%)` }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 relative z-10 transition-shadow duration-300 group-hover/item:shadow-[0_0_8px_2px]"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-white/50 group-hover/item:text-white/80 transition-colors duration-300 font-medium relative z-10">{item.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="mt-12 p-5 rounded-2xl border border-line bg-surface-2/50 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">🔧</span>
            </div>
            <p className="text-sm text-white/30 leading-relaxed">{st.note}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
