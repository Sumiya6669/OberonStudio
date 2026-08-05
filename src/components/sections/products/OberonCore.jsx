import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Reveal from '../../core/Reveal';

const CORE_MODULES = [
  { label: 'CRM', icon: '📊', color: '#4d7fff' },
  { label: 'Финансы', icon: '💰', color: '#f0a020' },
  { label: 'Клиенты', icon: '👥', color: '#10d4a8' },
  { label: 'Склад', icon: '📦', color: '#a855f7' },
  { label: 'Посещаемость', icon: '📅', color: '#06b6d4' },
  { label: 'Бронирование', icon: '🗓️', color: '#f472b6' },
  { label: 'AI агент', icon: '🤖', color: '#4d7fff' },
  { label: 'WhatsApp', icon: '💬', color: '#10d4a8' },
  { label: 'Telegram', icon: '✈️', color: '#4d7fff' },
  { label: 'Отчёты', icon: '📋', color: '#a855f7' },
  { label: 'Аналитика', icon: '📈', color: '#f0a020' },
];

export default function OberonCore() {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="mb-20">
      <Reveal>
        <div className="rounded-3xl border border-line bg-surface overflow-hidden relative">
          {/* Header */}
          <div className="relative px-8 py-10 border-b border-line">
            <div className="absolute inset-0 grid-bg opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative flex flex-col lg:flex-row gap-8 items-start lg:items-center">
              <div className="flex-1 max-w-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                    <span className="text-sm">⚙️</span>
                  </div>
                  <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Oberon Core</span>
                </div>
                <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Одна платформа, много отраслевых решений</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Все решения работают на единой платформе <span className="text-white/60">Oberon Core</span>. Вместо создания десятков отдельных систем 
                  мы используем единую архитектуру и набор модулей — это позволяет внедрять быстрее, дешевле и надёжнее.
                </p>
              </div>
              <div className="flex gap-6 flex-shrink-0">
                {[['3x', 'Быстрее'], ['60%', 'Дешевле'], ['99.9%', 'Uptime']].map(([v, l]) => (
                  <div key={l} className="text-center">
                    <p className="text-2xl font-black text-gradient-blue">{v}</p>
                    <p className="text-[10px] text-white/25 mt-1">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modules grid */}
          <div className="p-8">
            <p className="text-[10px] tracking-[0.25em] text-white/20 uppercase mb-5">Модули платформы</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {CORE_MODULES.map((mod, i) => (
                <motion.div
                  key={mod.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  onHoverStart={() => setHovered(mod.label)}
                  onHoverEnd={() => setHovered(null)}
                  className="relative rounded-2xl border border-line p-3 flex flex-col items-center gap-2 cursor-default transition-all duration-300 hover:border-white/15"
                  style={{ background: hovered === mod.label ? `${mod.color}0a` : 'transparent' }}
                >
                  <span className="text-xl">{mod.icon}</span>
                  <span className="text-[10px] text-white/40 text-center font-medium leading-tight">{mod.label}</span>
                  {hovered === mod.label && (
                    <motion.div
                      layoutId="module-glow"
                      className="absolute inset-0 rounded-2xl"
                      style={{ boxShadow: `inset 0 0 20px ${mod.color}15` }}
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Connection line visual */}
            <div className="mt-6 pt-6 border-t border-line flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] text-white/25">Все продукты используют общие модули</span>
              </div>
              <span className="text-white/10 hidden sm:block">·</span>
              <span className="text-[10px] text-white/20">Единая база данных</span>
              <span className="text-white/10 hidden sm:block">·</span>
              <span className="text-[10px] text-white/20">API-first архитектура</span>
              <span className="text-white/10 hidden sm:block">·</span>
              <span className="text-[10px] text-white/20">Безопасность enterprise-уровня</span>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
