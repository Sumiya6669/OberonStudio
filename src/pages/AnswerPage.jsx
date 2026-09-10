/**
 * /1c/<slug> — разбор одной беды.
 *
 * Порядок блоков не случайный и повторяет порядок разговора с человеком,
 * у которого что-то не работает: сначала короткий ответ, потом «как это
 * выглядит» (чтобы он убедился, что попал по адресу), потом причины, потом
 * что проверить самому. Предложение позвать нас — последним и с условием,
 * а не с первого экрана: страница, которая начинается с «оставьте заявку»,
 * закрывается раньше, чем прочитывается.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useAnswers, useContentReady } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';
import PageNotFound from '@/lib/PageNotFound';

function List({ label, items, marker }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">{label}</p>
      <ul className="space-y-3">
        {items.map((line, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/55">
            <span className="mt-[2px] shrink-0 select-none text-primary/60">
              {marker === 'number' ? `${i + 1}.` : '—'}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnswerPage() {
  const { slug } = useParams();
  const answers = useAnswers();
  const ready = useContentReady();
  const answer = answers?.find((a) => a.slug === slug);
  const others = (answers || []).filter((a) => a.slug !== slug).slice(0, 4);

  // Пока содержимое не приехало, страница молчит, а не объявляет, что её
  // нет. «Не найдено» говорится только после ответа базы — иначе адрес,
  // опубликованный после последней сборки, встречал бы человека
  // сообщением, что такой страницы не существует.
  if (!ready && !answer) return <div className="min-h-[60vh]" />;
  if (!answer) return <PageNotFound />;

  return (
    <section className="relative overflow-hidden py-28">
      <div className="relative z-10 mx-auto max-w-4xl px-5">
        <Reveal>
          <Link to="/1c" className="text-xs text-white/25 transition-colors hover:text-white/60">
            ← Все разборы
          </Link>
          <h1 className="mb-6 mt-6 text-[clamp(1.8rem,3.4vw,3rem)] font-black leading-[1.08] tracking-[-0.03em] text-white">
            {answer.title}
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-white/55">{answer.lead}</p>
        </Reveal>

        <div className="mt-16 space-y-14">
          <Reveal><List label="Как это выглядит" items={answer.symptoms} /></Reveal>
          <Reveal><List label="Отчего бывает" items={answer.causes} /></Reveal>
          <Reveal><List label="Что проверить самому" items={answer.steps} marker="number" /></Reveal>

          {answer.callUs && (
            <Reveal>
              <div className="rounded-2xl border border-line bg-white/[0.02] p-8">
                <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/20">
                  Когда нужен программист
                </p>
                <p className="text-sm leading-relaxed text-white/55">{answer.callUs}</p>
                <Link
                  to={CONTACT_PATH}
                  className="mt-6 inline-flex items-center gap-2 text-sm text-primary transition-colors duration-300 hover:text-white">
                  Написать и описать проблему
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </Reveal>
          )}

          {others.length > 0 && (
            <Reveal>
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Ещё разборы</p>
              <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
                {others.map((a) => (
                  <Link key={a.slug} to={`/1c/${a.slug}`}
                        className="bg-background p-5 text-sm text-white/50 transition-colors hover:bg-white/[0.02] hover:text-white/80">
                    <span className="mr-2">{a.icon}</span>{a.title}
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
