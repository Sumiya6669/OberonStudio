import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Zap, PlayCircle } from 'lucide-react';
import { hasProductMedia } from './ProductMedia';
import { tenge } from '@/lib/money';

/** Сумма полностью, «1 500 000 ₸», а не «1.5M ₸» (src/lib/money.js). */
function fmt(n) {
  if (!n) return 'по запросу';
  return tenge(n);
}

/**
 * Карточка продукта.
 *
 * Список возможностей раньше обрезался по высоте в 72 пикселя и
 * разворачивался кнопкой «+N ещё», которая появлялась только когда
 * пунктов больше четырёх. У продукта ровно с четырьмя пунктами кнопки
 * не было, а обрезка была: текст кончался на полуслове, и развернуть
 * его было нечем. Поэтому обрезки нет вовсе — карточка показывает всё,
 * а выравнивает их сетка: цена и кнопки прижаты книзу через mt-auto,
 * так что в ряду они на одной линии независимо от длины описания.
 */
export default function ProductCard({ product, index, onDemo, onOrder, onMedia }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: (index % 3) * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-3xl border border-line bg-surface flex flex-col transition-all duration-500 hover:border-white/10 hover:shadow-[0_0_40px_rgba(0,0,0,0.4)]"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${product.color}08, transparent 60%)` }}
      />

      <div className="relative p-7 flex flex-col flex-1">
        {/* Значок, название, бейдж */}
        <div className="flex items-start gap-4 mb-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border transition-all duration-300 group-hover:scale-110"
            style={{ background: `${product.color}12`, borderColor: `${product.color}25` }}
          >
            {product.icon}
          </div>
          {product.popular && (
            <span className="ml-auto flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full
              bg-primary/15 text-primary border border-primary/25 uppercase tracking-wider whitespace-nowrap">
              <Zap className="w-2.5 h-2.5" /> Флагман
            </span>
          )}
        </div>

        <h3 className="text-[17px] font-bold text-white/90 leading-tight mb-1.5">{product.name}</h3>
        <p className="text-[12px] text-white/40 leading-snug mb-4">{product.tagline}</p>

        <p className="text-[13px] text-white/45 leading-relaxed mb-4">{product.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {product.categories.map(c => (
            <span
              key={c}
              className="text-[10px] px-2.5 py-1 rounded-full border font-medium"
              style={{ color: product.color, borderColor: `${product.color}30`, background: `${product.color}0d` }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Возможности: полностью, без обрезки */}
        <ul className="flex flex-col gap-2 mb-7">
          {product.features.map(f => (
            <li key={f} className="flex items-start gap-2">
              <Check
                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                style={{ color: product.color, opacity: 0.75 }}
              />
              <span className="text-[12px] text-white/45 leading-snug">{f}</span>
            </li>
          ))}
        </ul>

        {/* Цена и кнопки — всегда внизу карточки */}
        <div className="mt-auto">
          {/* Экран 1С, сообщение в Telegram и ролик — только у продуктов, для которых они сняты */}
          {onMedia && hasProductMedia(product.id) && (
            <button
              type="button"
              onClick={() => onMedia(product)}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] py-2.5 text-[12px] font-semibold text-primary transition-all hover:border-primary/45 hover:bg-primary/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              Смотреть в работе: 1С, Telegram, видео
            </button>
          )}
          <div className="rounded-2xl border border-line bg-surface-2 p-4 mb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] text-white/25 uppercase tracking-wide mb-1">Внедрение</p>
                <p className="text-[17px] font-black text-white whitespace-nowrap">
                  {product.price ? `от ${fmt(product.price)}` : fmt(product.price)}
                </p>
              </div>
              {product.subscription && (
                <>
                  <div className="w-px h-9 bg-line flex-shrink-0" />
                  <div className="text-right min-w-0">
                    <p className="text-[9px] text-white/25 uppercase tracking-wide mb-1">Подписка/мес</p>
                    <p className="text-[17px] font-black text-white whitespace-nowrap">от {fmt(product.subscription)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Условие цены. У продуктов со счётом по объёму здесь стоит сам
              счёт: цена без него читается как окончательная. */}
          {product.note && (
            <p className="mb-4 text-[11px] text-white/30 leading-snug text-center">{product.note}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onDemo(product)}
              className="flex-1 py-3 rounded-xl text-[12px] font-semibold border border-line text-white/40 hover:text-white/70 hover:border-white/15 transition-all"
            >
              Запросить демо
            </button>
            <button
              onClick={() => onOrder(product)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[12px] font-semibold text-white transition-all"
              style={{ background: `${product.color}20`, border: `1px solid ${product.color}35` }}
            >
              Заказать <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
