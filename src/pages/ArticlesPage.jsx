/**
 * /stati — «Статьи экспертов»: авторские материалы длиннее разборов /1c.
 *
 * Интерфейс на трёх языках, статьи — на языке оригинала. Поэтому ссылка
 * на статью идёт без языковой приставки (/stati/<slug> из любой версии
 * списка), а на /kz и /en у карточки стоит пометка о языке текста.
 *
 * Статьи — файлы в src/lib/content/articles/, авторы — authors.js.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, PenLine } from 'lucide-react';
import Reveal from '@/components/core/Reveal';
import { LocaleLink } from '@/components/nav/LocaleLink';
import { AuthorAvatar } from '@/components/core/AuthorBadge';
import { useLang } from '@/lib/i18n/LangContext';
import { CONTACT_PATH } from '@/lib/routes';
import { getAuthor } from '@/lib/content/authors';
import {
  ARTICLES, ARTICLES_UI, articlePath, formatDate, readingMinutes,
} from '@/lib/content/articles';

export default function ArticlesPage() {
  const { lang } = useLang();
  const ui = { ...ARTICLES_UI.ru, ...(ARTICLES_UI[lang] || {}) };

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-28">
        <Reveal>
          <p className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/25">
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> {ui.label}
          </p>
          <h1 className="max-w-4xl text-[clamp(2.1rem,5vw,3.6rem)] font-black leading-[1.05] tracking-[-0.04em] text-white">
            {ui.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/45">{ui.sub}</p>
        </Reveal>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-14">
        {ARTICLES.length === 0 ? (
          <p className="text-sm text-white/35">{ui.empty}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {ARTICLES.map((a, i) => {
              const author = getAuthor(a.author);
              const otherLang = a.lang && a.lang !== lang && ui.origLang;
              return (
                <Reveal key={a.slug} delay={i * 0.05}>
                  <Link
                    to={articlePath(a.slug)}
                    hrefLang={a.lang || 'ru'}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-white/[0.015] p-6 transition-colors duration-300 hover:border-white/15 hover:bg-white/[0.03]"
                  >
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {(a.tags || []).map((tag) => (
                        <span key={tag} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] text-white/55">
                          {tag}
                        </span>
                      ))}
                      {otherLang && (
                        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/35">{otherLang}</span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold leading-snug text-white/90 transition-colors group-hover:text-white">
                      {a.title}
                    </h2>
                    <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-white/40">{a.description}</p>
                    <div className="mt-auto flex items-center gap-3 pt-6">
                      <AuthorAvatar author={author} size={32} />
                      <div className="min-w-0 text-xs leading-snug">
                        <p className="truncate font-semibold text-white/70">{author?.name || 'Tinker'}</p>
                        <p className="flex flex-wrap items-center gap-x-2 text-white/30">
                          <time dateTime={a.publishedAt}>{formatDate(a.publishedAt, lang)}</time>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" /> {ui.minutes(readingMinutes(a))}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-5 px-5 pb-28 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <div className="h-full rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-9">
            <h2 className="text-[clamp(1.4rem,2.8vw,2rem)] font-black leading-tight tracking-[-0.03em] text-white">
              {ui.becomeTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">{ui.becomeText}</p>
            <LocaleLink
              to={CONTACT_PATH}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary/80"
            >
              {ui.becomeCta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LocaleLink>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="h-full rounded-3xl border border-line bg-white/[0.015] p-6 sm:p-9">
            <h2 className="text-lg font-bold text-white">{ui.answersTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/45">{ui.answersText}</p>
            {/* Разборы есть только по-русски: ссылка без приставки, как в меню. */}
            <Link to="/1c" className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-white">
              {ui.answersCta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
