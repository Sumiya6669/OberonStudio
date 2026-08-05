import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Zap } from 'lucide-react';

function fmt(n) {
  if (!n) return 'по запросу';
  return n >= 1000000
    ? `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M ₸`
    : `${(n / 1000).toFixed(0)} 000 ₸`;
}

export default function ProductCard({ product, index, onDemo, onOrder }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: (index % 3) * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-3xl border border-line bg-surface overflow-hidden flex flex-col transition-all duration-500 hover:border-white/10 hover:shadow-[0_0_40px_rgba(0,0,0,0.4)]"
    >
      {/* Top glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${product.color}08, transparent 60%)` }}
      />

      {/* Popular badge */}
      {product.popular && (
        <div className="absolute top-4 right-4 z-10">
          <span className="flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/25 uppercase tracking-wider">
            <Zap className="w-2.5 h-2.5" /> Популярное
          </span>
        </div>
      )}

      <div className="relative p-6 flex flex-col flex-1">
        {/* Icon + name */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border transition-all duration-300 group-hover:scale-110"
            style={{ background: `${product.color}12`, borderColor: `${product.color}25` }}
          >
            {product.icon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-bold text-white/90 leading-tight mb-1">{product.name}</h3>
            <p className="text-[11px] text-white/35 leading-tight">{product.tagline}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-white/40 leading-relaxed mb-4">{product.description}</p>

        {/* Category tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {product.categories.map(c => (
            <span key={c} className="text-[9px] px-2 py-0.5 rounded-full border font-medium" style={{ color: product.color, borderColor: `${product.color}30`, background: `${product.color}0d` }}>
              {c}
            </span>
          ))}
        </div>

        {/* Features toggle */}
        <div className="mb-5">
          <div className={`grid grid-cols-2 gap-x-3 gap-y-1.5 overflow-hidden transition-all duration-500 ${expanded ? '' : 'max-h-[72px]'}`}>
            {product.features.map(f => (
              <div key={f} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 flex-shrink-0" style={{ color: product.color, opacity: 0.7 }} />
                <span className="text-[10px] text-white/35 leading-tight">{f}</span>
              </div>
            ))}
          </div>
          {product.features.length > 4 && (
            <button onClick={() => setExpanded(!expanded)} className="mt-2 text-[10px] text-white/20 hover:text-white/50 transition-colors">
              {expanded ? 'Свернуть ↑' : `+${product.features.length - 4} ещё →`}
            </button>
          )}
        </div>

        {/* Price block */}
        <div className="mt-auto">
          <div className="rounded-2xl border border-line bg-surface-2 p-3.5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-white/20 uppercase tracking-wide mb-1">Внедрение</p>
                <p className="text-base font-black text-white">{product.price ? `от ${fmt(product.price)}` : fmt(product.price)}</p>
              </div>
              {product.subscription && (
                <>
                  <div className="w-px h-8 bg-line" />
                  <div className="text-right">
                    <p className="text-[9px] text-white/20 uppercase tracking-wide mb-1">Подписка/мес</p>
                    <p className="text-base font-black text-white">от {fmt(product.subscription)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onDemo(product)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-line text-white/40 hover:text-white/70 hover:border-white/15 transition-all"
            >
              Запросить демо
            </button>
            <button
              onClick={() => onOrder(product)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all"
              style={{ background: `${product.color}20`, border: `1px solid ${product.color}35` }}
            >
              Заказать <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
