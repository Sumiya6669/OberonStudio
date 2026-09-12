/**
 * /keysy — работы, которые были.
 *
 * Раздел отвечает на вопрос, который человек задаёт про себя после
 * прайса: «а он вообще такое делал?». Отвечать на него общими словами
 * («большой опыт», «120 проектов») бессмысленно — это говорят все.
 * Отвечает конкретная работа: что было сломано, что сделано, чем
 * закончилось и чего в работе не было.
 */
import React from 'react';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useCases, useContentReady } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';

export default function CasesPage() {
  const cases = useCases() || [];
  const ready = useContentReady();

  return (
    <section className="relative overflow-hidden py-28">
      <div className="relative z-10 mx-auto max-w-7xl px-5">
        <Reveal>
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Что уже делалось</p>
          <h1 className="mb-6 max-w-3xl text-[clamp(2rem,4vw,3.4rem)] font-black leading-[1.05] tracking-[-0.03em] text-white">
            Работы, а не<br />список технологий
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/35">
            Клиенты не названы: без их разрешения публиковать названия нельзя,
            а выдумывать их — тем более. Всё остальное здесь настоящее,
            включая раздел «что осталось за кадром».
          </p>
        </Reveal>

        {!ready && !cases.length ? (
          <div className="mt-16 min-h-[30vh]" />
        ) : (
          <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
            {cases.map((c, i) => (
              <Reveal key={c.slug} delay={i * 40}>
                <Link
                  to={`/keysy/${c.slug}`}
                  className="group flex h-full flex-col bg-background p-8 transition-colors duration-300 hover:bg-white/[0.02]">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="text-2xl leading-none">{c.icon}</span>
                    {c.who && (
                      <span className="pt-1 text-xs leading-relaxed text-white/25">{c.who}</span>
                    )}
                  </div>
                  <h2 className="mb-3 text-lg font-semibold leading-snug text-white transition-colors group-hover:text-primary">
                    {c.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-white/35">{c.tagline}</p>
                  {c.stack?.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {c.stack.map((s) => (
                        <span key={s}
                              className="rounded-md border border-line px-2 py-0.5 text-[11px] text-white/30">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="mt-auto pt-6 text-xs text-primary">Разобрать подробно →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal>
          <p className="mt-14 max-w-2xl text-sm leading-relaxed text-white/35">
            Похожая беда? Опишите, как есть —{' '}
            <Link to={CONTACT_PATH} className="text-primary transition-colors hover:text-white">
              напишите мне
            </Link>
            , и я скажу, делал ли такое и сколько это займёт. Если не делал — скажу и это.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
