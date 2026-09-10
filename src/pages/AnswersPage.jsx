/**
 * /1c — список ответов на конкретные вопросы про 1С.
 *
 * Это не «блог» и не «полезные статьи». Каждая страница отвечает на один
 * запрос, с которым человек приходит в поиск своими словами: «не проводится
 * документ», «не грузится выписка». Список нужен для связности — чтобы
 * между ответами были ссылки, а не только вход из поиска.
 */
import React from 'react';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useAnswers, useContentReady } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';

export default function AnswersPage() {
  const answers = useAnswers() || [];
  const ready = useContentReady();

  return (
    <section className="relative overflow-hidden py-28">
      <div className="relative z-10 mx-auto max-w-7xl px-5">
        <Reveal>
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Ответы</p>
          <h1 className="mb-6 max-w-3xl text-[clamp(2rem,4vw,3.5rem)] font-black tracking-[-0.03em] text-white">
            Частые беды в 1С<br />и что с ними делать
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/35">
            Здесь то, с чем чаще всего обращаются. В каждом разборе сначала то,
            что можно проверить самому, — и только потом, в каких случаях
            действительно нужен программист.
          </p>
        </Reveal>

        {answers.length === 0 && !ready ? (
          <div className="mt-16 h-32" />
        ) : answers.length === 0 ? (
          <p className="mt-16 text-sm text-white/30">
            Разборы готовятся. Если вопрос срочный —{' '}
            <Link to={CONTACT_PATH} className="text-primary hover:text-white">напишите</Link>,
            отвечу лично.
          </p>
        ) : (
          <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
            {answers.map((a, i) => (
              <Reveal key={a.slug} delay={i * 0.05}>
                <Link
                  to={`/1c/${a.slug}`}
                  className="group flex h-full flex-col gap-3 bg-background p-7 transition-colors duration-300 hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span className="text-lg leading-none">{a.icon}</span>
                    {a.topic && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/25">
                        {a.topic}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-white/85 transition-colors group-hover:text-white">
                    {a.title}
                  </h2>
                  <p className="line-clamp-3 text-sm leading-relaxed text-white/35">{a.lead}</p>
                  <span className="mt-auto pt-3 text-xs text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    Разобрать →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
