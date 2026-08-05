import React from 'react';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

const COMPARE_FEATURES = [
  'Готовая платформа',
  'Быстрое внедрение',
  'Единая архитектура',
  'WhatsApp интеграция',
  'AI функции',
  'Поддержка 24/7',
  'Обновления включены',
  'Гарантия результата',
];

const COLUMNS = [
  {
    label: 'Oberon',
    sub: 'Готовое решение',
    highlight: true,
    values: [true, true, true, true, true, true, true, true],
    color: '#4d7fff',
  },
  {
    label: 'Заказная разработка',
    sub: 'Custom разработчик',
    highlight: false,
    values: [false, false, false, '?', '?', false, false, false],
    color: null,
  },
  {
    label: 'Коробочное ПО',
    sub: 'amoCRM / Bitrix24',
    highlight: false,
    values: [true, true, false, '?', false, false, false, false],
    color: null,
  },
];

export default function ProductCompare({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl bg-surface border border-line rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
          <div>
            <h3 className="font-bold text-white">Сравнение подходов</h3>
            <p className="text-xs text-white/30 mt-0.5">Почему Oberon — лучший выбор</p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/70 transition-colors text-xl">✕</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-6 py-4 text-xs text-white/25 font-medium w-1/3">Критерий</th>
                {COLUMNS.map(col => (
                  <th key={col.label} className={`px-4 py-4 text-center ${col.highlight ? 'bg-primary/5' : ''}`}>
                    <div className={`text-sm font-bold ${col.highlight ? 'text-primary' : 'text-white/50'}`}>{col.label}</div>
                    <div className="text-[10px] text-white/25 mt-0.5">{col.sub}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_FEATURES.map((feat, i) => (
                <tr key={feat} className={`border-t border-line ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                  <td className="px-6 py-3.5 text-xs text-white/40">{feat}</td>
                  {COLUMNS.map(col => (
                    <td key={col.label} className={`px-4 py-3.5 text-center ${col.highlight ? 'bg-primary/5' : ''}`}>
                      {col.values[i] === true ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : col.values[i] === false ? (
                        <X className="w-4 h-4 text-red-400/50 mx-auto" />
                      ) : (
                        <span className="text-xs text-white/20">частично</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-5 border-t border-line flex items-center justify-between gap-4">
          <p className="text-xs text-white/25">Oberon — единственный вариант, где все критерии соответствуют ✓</p>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/80 transition-colors flex-shrink-0">
            Выбрать решение
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
