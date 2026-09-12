/**
 * /keysy/<slug> — одна работа.
 *
 * Порядок разделов повторяет порядок вопросов в голове читателя: что
 * было до, что сделали, чем закончилось, чего в работе НЕ было. Последний
 * раздел здесь не для скромности: кейс без единой шероховатости читается
 * как реклама, а с ней — как отчёт, и это разные уровни доверия.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import Breadcrumbs from '@/components/nav/Breadcrumbs';
import { useCases, useOffers, useContentReady } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';
import PageNotFound from '@/lib/PageNotFound';

export default function CasePage() {
  const { slug } = useParams();
  const cases = useCases();
  const offers = useOffers();
  const ready = useContentReady();
  const item = cases?.find((c) => c.slug === slug);
  const others = (cases || []).filter((c) => c.slug !== slug).slice(0, 4);
  const offer = item?.offerSlug ? (offers || []).find((o) => o.slug === item.offerSlug) : null;

  if (!ready && !item) return <div className="min-h-[60vh]" />;
  if (!item) return <PageNotFound />;

  return (
    <section className="relative overflow-hidden py-28">
      <div className="relative z-10 mx-auto max-w-4xl px-5">
        <Reveal>
          <Breadcrumbs
            items={[{ to: '/', label: 'Главная' }, { to: '/keysy', label: 'Кейсы' }]}
            current={item.title} />
          <div className="mt-6 flex items-start gap-4">
            <span className="text-3xl leading-none">{item.icon}</span>
            <div>
              <h1 className="text-[clamp(1.8rem,3.4vw,3rem)] font-black leading-[1.08] tracking-[-0.03em] text-white">
                {item.title}
              </h1>
              <p className="mt-3 text-base text-white/45">{item.tagline}</p>
            </div>
          </div>
          {item.who && (
            <p className="mt-8 rounded-xl border border-line bg-white/[0.02] px-5 py-4 text-sm leading-relaxed text-white/45">
              {item.who}
            </p>
          )}
        </Reveal>

        <div className="mt-16 space-y-14">
          <Reveal>
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Что было до</p>
            <p className="text-base leading-relaxed text-white/55">{item.situation}</p>
          </Reveal>

          {item.work?.length > 0 && (
            <Reveal>
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Что сделано</p>
              <ul className="space-y-3">
                {item.work.map((line, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/55">
                    <span className="mt-[2px] shrink-0 select-none tabular-nums text-primary/60">
                      {i + 1}.
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {item.result && (
            <Reveal>
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Чем закончилось</p>
              <p className="text-base leading-relaxed text-white/55">{item.result}</p>
            </Reveal>
          )}

          {item.caveat && (
            <Reveal>
              <div className="rounded-2xl border border-line bg-white/[0.02] p-8">
                <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/20">
                  Что осталось за кадром
                </p>
                <p className="text-sm leading-relaxed text-white/45">{item.caveat}</p>
              </div>
            </Reveal>
          )}

          {(item.term || item.stack?.length > 0) && (
            <Reveal>
              <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
                {item.term && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.3em] text-white/20">Сроки</p>
                    <p className="max-w-md text-sm leading-relaxed text-white/55">{item.term}</p>
                  </div>
                )}
                {item.stack?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.3em] text-white/20">Чем сделано</p>
                    <div className="flex flex-wrap gap-2">
                      {item.stack.map((s) => (
                        <span key={s}
                              className="rounded-md border border-line px-2 py-0.5 text-xs text-white/35">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          )}

          {offer && (
            <Reveal>
              <div className="rounded-2xl border border-line bg-white/[0.02] p-8">
                <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/20">
                  Такая же работа
                </p>
                <p className="text-sm leading-relaxed text-white/55">{offer.tagline}</p>
                <Link to={`/uslugi/${offer.slug}`}
                      className="mt-6 inline-flex items-center gap-2 text-sm text-primary transition-colors duration-300 hover:text-white">
                  {offer.title}
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </Reveal>
          )}

          <Reveal>
            <p className="text-sm leading-relaxed text-white/35">
              Похожая задача?{' '}
              <Link to={CONTACT_PATH} className="text-primary transition-colors hover:text-white">
                Опишите её как есть
              </Link>{' '}
              — отвечу в течение часа в рабочее время.
            </p>
          </Reveal>

          {others.length > 0 && (
            <Reveal>
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Другие работы</p>
              <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
                {others.map((c) => (
                  <Link key={c.slug} to={`/keysy/${c.slug}`}
                        className="group bg-background p-5 transition-colors duration-300 hover:bg-white/[0.02]">
                    <div className="mb-2 text-lg leading-none">{c.icon}</div>
                    <div className="text-sm font-medium text-white transition-colors group-hover:text-primary">
                      {c.title}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-white/30">{c.tagline}</div>
                  </Link>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
