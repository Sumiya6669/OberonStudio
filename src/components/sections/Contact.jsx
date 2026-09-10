import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Mail, MessageCircle, Phone } from 'lucide-react';
import Reveal from '../core/Reveal';
import { useLang } from '@/lib/i18n/LangContext';
import { submitLead } from '@/lib/leads';
import { SITE_SETTINGS } from '@/lib/content/site';
import { useSettings } from '@/lib/site/SiteContentContext';

export default function Contact() {
  const settings = useSettings(SITE_SETTINGS);
  const { t } = useLang();
  const ct = t.contact;
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  // Расписка из базы: номер обращения и время, до которого обещан ответ.
  // Обещание не пишется здесь словами — иначе сайт и панель однажды
  // разойдутся, и правой окажется панель.
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const sectionRef = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 40,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 40,
      });
    };
    window.addEventListener('mousemove', fn, { passive: true });
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  const channels = [
    { label: 'Telegram', sub: settings.telegram, href: settings.telegram_url, icon: MessageCircle },
    { label: 'WhatsApp', sub: settings.whatsapp, href: settings.whatsapp_url, icon: Phone },
    { label: 'Email', sub: settings.email, href: `mailto:${settings.email}`, icon: Mail },
  ];

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const receipt = await submitLead({ ...form, source: 'contact_form' });
      setReceipt(receipt || null);
      setSent(true);
      setForm({ name: '', phone: '', email: '', company: '', message: '' });
    } catch (err) {
      setError(err.message || 'Не удалось отправить заявку.');
    } finally {
      setSaving(false);
    }
  };

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <section id="contact" ref={sectionRef} className="relative py-36 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface to-background" />
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div
        className="absolute w-[700px] h-[700px] rounded-full pointer-events-none transition-transform duration-700 ease-out"
        style={{ background: 'radial-gradient(circle, hsl(220 100% 60% / 0.06) 0%, transparent 60%)', left: '50%', top: '50%', transform: `translate(calc(-50% + ${mousePos.x}px), calc(-50% + ${mousePos.y}px))` }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full pointer-events-none transition-transform duration-1000 ease-out"
        style={{ background: 'radial-gradient(circle, hsl(43 74% 58% / 0.05) 0%, transparent 60%)', right: '20%', top: '30%', transform: `translate(${-mousePos.x * 0.5}px, ${-mousePos.y * 0.5}px)` }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-5">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
          <div className="text-center lg:text-left">
            <Reveal><p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-8">{ct.label}</p></Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-[clamp(2.5rem,8vw,6.5rem)] font-black tracking-[-0.04em] leading-[1.0] text-white mb-4">{ct.line1}</h2>
            </Reveal>
            <Reveal delay={0.2}>
              <h2 className="text-[clamp(2.5rem,8vw,6.5rem)] font-black tracking-[-0.04em] leading-[1.0] text-gradient-blue mb-8">{ct.line2}</h2>
            </Reveal>
            <Reveal delay={0.3}>
              <h2 className="text-[clamp(2.5rem,8vw,6.5rem)] font-black tracking-[-0.04em] leading-[1.0] text-white mb-12">{ct.line3}</h2>
            </Reveal>

            <Reveal delay={0.4}>
              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                {channels.map((c) => {
                  const Icon = c.icon;
                  return (
                    <motion.a
                      key={c.label}
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-3 px-5 py-3.5 rounded-2xl glass border border-white/[0.06] hover:border-white/15 transition-colors duration-300 group"
                    >
                      <Icon className="w-4 h-4 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">{c.label}</p>
                        <p className="text-xs text-white/25">{c.sub}</p>
                      </div>
                    </motion.a>
                  );
                })}
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <div className="rounded-3xl border border-line bg-surface/80 backdrop-blur-2xl p-6 lg:p-8">
              {sent ? (
                <div className="min-h-[420px] flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3">Заявка принята</h3>

                  {receipt?.ref ? (
                    <>
                      <p className="text-sm text-white/35 max-w-sm">
                        Номер обращения <span className="font-semibold text-white/70">{receipt.ref}</span>
                        {' '}— по нему можно спросить о ходе работы.
                      </p>
                      {receipt.reactBy && (
                        <p className="mt-3 text-sm text-white/50 max-w-sm">
                          Отвечу до{' '}
                          <span className="font-semibold text-primary">
                            {new Date(receipt.reactBy).toLocaleString('ru-RU', {
                              hour: '2-digit', minute: '2-digit',
                              day: '2-digit', month: 'long',
                            })}
                          </span>.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-white/35 max-w-sm">
                      Мы получили обращение и свяжемся с вами в ближайшее рабочее время.
                    </p>
                  )}

                  <button onClick={() => { setSent(false); setReceipt(null); }} className="mt-8 px-5 py-3 rounded-xl border border-primary/20 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors">
                    Отправить ещё одну
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <p className="text-[10px] tracking-[0.25em] text-primary/60 uppercase mb-2">Lead form</p>
                    <h3 className="text-2xl font-black text-white mb-2">Расскажите о задаче</h3>
                    <p className="text-sm text-white/35 mb-6">Ответим в ближайшее рабочее время.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      ['name', 'Имя', 'Алексей'],
                      ['phone', 'Телефон / Telegram', '+7 700 000 0000'],
                      ['email', 'Email', 'name@company.com'],
                      ['company', 'Компания', 'ТОО «Компания»'],
                    ].map(([key, label, placeholder]) => (
                      <label key={key} className="block">
                        <span className="text-[10px] text-white/30 uppercase tracking-wide block mb-1.5">{label}</span>
                        <input
                          value={form[key]}
                          onChange={e => update(key, e.target.value)}
                          required={key === 'name' || key === 'phone'}
                          className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/15 outline-none focus:border-primary/40 transition-colors"
                          placeholder={placeholder}
                        />
                      </label>
                    ))}
                  </div>

                  <label className="block">
                    <span className="text-[10px] text-white/30 uppercase tracking-wide block mb-1.5">Сообщение</span>
                    <textarea
                      value={form.message}
                      onChange={e => update('message', e.target.value)}
                      rows={5}
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/15 outline-none focus:border-primary/40 transition-colors resize-none"
                      placeholder="Что хотите автоматизировать или внедрить?"
                    />
                  </label>

                  {error && <p className="text-sm text-red-300">{error}</p>}

                  <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/80 transition-colors disabled:opacity-50">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Отправляем...' : ct.cta}
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
