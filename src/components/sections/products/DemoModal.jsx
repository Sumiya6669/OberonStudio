import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { submitLead } from '@/lib/leads';

export default function DemoModal({ product, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', company: '' });
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await submitLead({
        ...form,
        service: product?.name || 'Oberon demo',
        source: 'demo_modal',
        message: `Запрос демо: ${product?.name || 'Oberon Products'}`,
      });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Не удалось отправить заявку.');
    } finally {
      setSaving(false);
    }
  };

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
        className="w-full max-w-md bg-surface border border-line rounded-3xl overflow-hidden shadow-2xl"
      >
        {!sent ? (
          <>
            <div className="px-6 py-6 border-b border-line">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl">{product?.icon || '🚀'}</span>
                <h3 className="font-bold text-white">Запросить демо</h3>
                <button onClick={onClose} className="ml-auto text-white/25 hover:text-white/70">✕</button>
              </div>
              <p className="text-xs text-white/30 mt-1">{product?.name} — онлайн-демонстрация за 30 минут</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {[
                { key: 'name', label: 'Ваше имя', placeholder: 'Алексей К.' },
                { key: 'phone', label: 'Телефон / Telegram', placeholder: '+7 700 000 0000' },
                { key: 'company', label: 'Компания', placeholder: 'ТОО «Название»' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] text-white/25 uppercase tracking-wide block mb-1.5">{f.label}</label>
                  <input
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/15 outline-none focus:border-primary/40 transition-colors"
                    placeholder={f.placeholder}
                    required
                  />
                </div>
              ))}
              <button type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/80 transition-colors mt-2">
                {saving ? 'Отправляем...' : 'Отправить запрос на демо'}
              </button>
              {error && <p className="text-xs text-red-300 text-center">{error}</p>}
              <p className="text-[10px] text-white/15 text-center">Свяжемся в течение 2 часов в рабочее время</p>
            </form>
          </>
        ) : (
          <div className="p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h3 className="font-bold text-white mb-2">Запрос отправлен!</h3>
            <p className="text-sm text-white/35 mb-6">Мы свяжемся с вами в течение 2 часов для назначения демонстрации.</p>
            <button onClick={onClose} className="px-6 py-3 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-semibold hover:bg-primary/20 transition-colors">
              Закрыть
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
