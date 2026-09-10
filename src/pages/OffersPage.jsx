/**
 * /uslugi — что можно купить, с ценами.
 *
 * Отличие от раздела «Услуги»: там перечислено, что я умею, здесь — что
 * именно человек покупает и за сколько. Это разные вопросы, и второй
 * задаётся позже: сначала человек понимает, что сам не справится, и только
 * потом хочет знать предмет сделки.
 *
 * Пустая цена показывается как «по запросу». Это правда: для части работ
 * цена действительно зависит от объёма, и притворяться иначе значит
 * назвать цифру, которую потом придётся объяснять.
 */
import React from 'react';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useOffers, useContentReady } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';

export const priceLabel = (offer) => {
  if (!offer?.priceFrom) return 'Цена по запросу';
  const value = Number(offer.priceFrom).toLocaleString('ru-RU');
  return `от ${value} ₸${offer.unit ? ` ${offer.unit}` : ''}`;
};

export default function OffersPage() {
  const offers = useOffers() || [];
  const ready = useContentReady();

  return (
    <section className="relative overflow-hidden py-28">
      <div className="relative z-10 mx-auto max-w-7xl px-5">
        <Reveal>
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Что купить</p>
          <h1 className="mb-6 max-w-3xl text-[clamp(2rem,4vw,3.5rem)] font-black tracking-[-0.03em] text-white">
            Понятные работы<br />с понятным предметом
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/35">
            В каждой — что входит, что не входит и как проходит. Раздел «что не
            входит» здесь не для формальности: лучше отказаться до разговора,
            чем после трёх встреч.
          </p>
        </Reveal>

        {offers.length === 0 && !ready ? (
          <div className="mt-16 h-40" />
        ) : offers.length === 0 ? (
          <p className="mt-16 text-sm text-white/30">
            Раздел готовится.{' '}
            <Link to={CONTACT_PATH} className="text-primary hover:text-white">Напишите</Link>
            {' '}— обсудим задачу напрямую.
          </p>
        ) : (
          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            {offers.map((o, i) => (
              <Reveal key={o.slug} delay={i * 0.06}>
                <Link
                  to={`/uslugi/${o.slug}`}
                  className={`group flex h-full flex-col rounded-2xl border p-7 transition-all duration-300
                    ${o.accent
                      ? 'border-primary/30 bg-primary/[0.04] hover:border-primary/50'
                      : 'border-line bg-white/[0.015] hover:border-white/20'}`}>
                  <div className="mb-5 text-2xl leading-none">{o.icon}</div>
                  <h2 className="text-lg font-semibold text-white">{o.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/40">{o.tagline}</p>

                  {o.included.length > 0 && (
                    <ul className="mt-5 space-y-2">
                      {o.included.slice(0, 4).map((line, k) => (
                        <li key={k} className="flex gap-2 text-xs leading-relaxed text-white/45">
                          <span className="mt-[3px] text-primary/60">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-6">
                    <div className={`text-sm font-semibold ${o.priceFrom ? 'text-white' : 'text-white/45'}`}>
                      {priceLabel(o)}
                    </div>
                    {o.term && <div className="mt-1 text-xs text-white/25">{o.term}</div>}
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary">
                      Подробно
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 16 16">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                              strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        {offers.length > 0 && (
          <Reveal>
            <p className="mt-12 max-w-2xl text-sm leading-relaxed text-white/30">
              Задача не подходит ни под одну?{' '}
              <Link to={CONTACT_PATH} className="text-primary hover:text-white">Напишите</Link>
              {' '}как есть — разовые доработки и интеграции считаются по часам,
              и оценку я называю до начала работ.
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
