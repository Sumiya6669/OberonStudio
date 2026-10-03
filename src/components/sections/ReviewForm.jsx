import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PRODUCTS } from '@/lib/content/site';

/**
 * Форма отзыва. Отзыв уходит в карантин (/api/review → cms.review_inbox) и
 * появляется на сайте только после проверки человеком в панели. Обещать
 * публикацию форма не может — поэтому и не обещает.
 *
 * Контакт нужен, чтобы убедиться, что автор действительно работал с нами;
 * на сайт он не попадает.
 */
const TEXT = {
  ru: {
    title: 'Отзыв о работе с Tinker',
    intro: 'Отзыв появится на сайте после проверки. Контакт нужен только чтобы связаться с вами — он не публикуется.',
    name: 'Имя *', role: 'Должность', company: 'Компания', city: 'Город', product: 'О чём отзыв',
    studio: 'О студии в целом', rating: 'Оценка', body: 'Отзыв * (от 40 знаков, без ссылок)',
    contact: 'Телефон или почта * (не публикуется)',
    consent: 'Согласен, что имя, должность и компания будут опубликованы вместе с отзывом',
    send: 'Отправить на проверку', sending: 'Отправляем…',
    done: 'Спасибо! Отзыв получен и появится на сайте после проверки.',
    close: 'Закрыть', fail: 'Не удалось отправить. Попробуйте позже или напишите нам в Telegram.',
    short: 'Расскажите чуть подробнее: хотя бы пару предложений.',
  },
  kz: {
    title: 'Tinker-мен жұмыс туралы пікір',
    intro: 'Пікір тексерілгеннен кейін сайтта шығады. Байланыс тек сізбен хабарласу үшін керек — ол жарияланбайды.',
    name: 'Аты *', role: 'Лауазымы', company: 'Компания', city: 'Қала', product: 'Пікір не туралы',
    studio: 'Студия туралы жалпы', rating: 'Баға', body: 'Пікір * (кемінде 40 таңба, сілтемесіз)',
    contact: 'Телефон немесе пошта * (жарияланбайды)',
    consent: 'Атым, лауазымым және компаниям пікірмен бірге жариялануына келісемін',
    send: 'Тексеруге жіберу', sending: 'Жіберілуде…',
    done: 'Рахмет! Пікір алынды, тексерілгеннен кейін сайтта шығады.',
    close: 'Жабу', fail: 'Жіберу мүмкін болмады. Кейінірек қайталаңыз немесе Telegram-ға жазыңыз.',
    short: 'Сәл толығырақ жазыңыз: кемінде бір-екі сөйлем.',
  },
  en: {
    title: 'Review of working with Tinker',
    intro: 'Your review appears on the site after a check. Your contact is only for us to reach you — it is never published.',
    name: 'Name *', role: 'Position', company: 'Company', city: 'City', product: 'What is it about',
    studio: 'The studio in general', rating: 'Rating', body: 'Review * (40+ characters, no links)',
    contact: 'Phone or email * (not published)',
    consent: 'I agree that my name, position and company are published with the review',
    send: 'Send for review', sending: 'Sending…',
    done: 'Thank you! Your review is received and will appear after a check.',
    close: 'Close', fail: 'Could not send. Please try later or message us on Telegram.',
    short: 'Please tell a bit more: at least a couple of sentences.',
  },
};

const input = 'w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/25 focus:border-primary/50 focus:outline-none';

export default function ReviewForm({ lang = 'ru', onClose }) {
  const t = TEXT[lang] || TEXT.ru;
  const [form, setForm] = useState({
    name: '', role: '', company: '', city: '', product: '', rating: 5, body: '', contact: '', consent: false,
  });
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.body.trim().length < 40) return setState({ busy: false, done: false, error: t.short });
    setState({ busy: true, done: false, error: '' });
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rating: Number(form.rating), page: window.location.pathname }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.fail);
      setState({ busy: false, done: true, error: '' });
    } catch (err) {
      setState({ busy: false, done: false, error: err.message || t.fail });
    }
  };

  // Портал в body: страница обёрнута в анимированный переход (transform), а внутри
  // него position: fixed привязывается к обёртке, а не к экрану.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/[0.08] bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-white">{t.title}</h3>
          <button type="button" onClick={onClose} aria-label={t.close} className="text-white/30 hover:text-white/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        {state.done ? (
          <div className="space-y-4">
            <p className="text-sm text-white/70">{t.done}</p>
            <button type="button" onClick={onClose}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90">{t.close}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-xs leading-relaxed text-white/45">{t.intro}</p>
            <input className={input} placeholder={t.name} value={form.name} onChange={set('name')} required maxLength={120} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className={input} placeholder={t.role} value={form.role} onChange={set('role')} maxLength={120} />
              <input className={input} placeholder={t.company} value={form.company} onChange={set('company')} maxLength={160} />
              <input className={input} placeholder={t.city} value={form.city} onChange={set('city')} maxLength={80} />
              <select className={input} value={form.rating} onChange={set('rating')} aria-label={t.rating}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{`${t.rating}: ${'★'.repeat(n)}`}</option>)}
              </select>
            </div>
            <select className={input} value={form.product} onChange={set('product')} aria-label={t.product}>
              <option value="">{`${t.product}: ${t.studio}`}</option>
              {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <textarea className={input} rows={5} placeholder={t.body} value={form.body} onChange={set('body')}
              required minLength={40} maxLength={2000} />
            <input className={input} placeholder={t.contact} value={form.contact} onChange={set('contact')} required maxLength={200} />
            <label className="flex items-start gap-2 text-xs text-white/55">
              <input type="checkbox" className="mt-0.5" checked={form.consent} onChange={set('consent')} required />
              <span>{t.consent}</span>
            </label>
            {state.error && <p className="text-xs text-red-400">{state.error}</p>}
            <button type="submit" disabled={state.busy}
              className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
              {state.busy ? t.sending : t.send}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
