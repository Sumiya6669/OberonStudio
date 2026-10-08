/**
 * /stati/<slug> — одна статья.
 *
 * Порядок: путь и метки, заголовок, автор с датой и временем чтения,
 * оглавление (если подзаголовков больше двух), текст, источники, автор
 * подробно, предложение проверить базу и продукты по теме, «Читайте также».
 * Предложение — после текста: статья, которая начинается с «купите»,
 * закрывается раньше, чем прочитывается.
 *
 * Разборы /1c по теме показываются, только если они опубликованы в CMS:
 * ссылка на разбор, которого нет на сайте, вела бы на «страница не найдена».
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Clock, ScanSearch } from 'lucide-react';
import Reveal from '@/components/core/Reveal';
import Breadcrumbs from '@/components/nav/Breadcrumbs';
import ArticleBody, { anchorId, headings } from '@/components/core/ArticleBody';
import AuthorBadge, { AuthorAvatar } from '@/components/core/AuthorBadge';
import PageNotFound from '@/lib/PageNotFound';
import { useAnswers } from '@/lib/site/SiteContentContext';
import { PRODUCTS } from '@/lib/content/site';
import { productHref } from '@/lib/content/answerProducts';
import { getAuthor } from '@/lib/content/authors';
import {
  ARTICLES_PATH, articlePath, articleUi, formatDate, getArticle, readingMinutes, relatedArticles,
} from '@/lib/content/articles';

const label = 'mb-4 text-xs uppercase tracking-[0.3em] text-white/25';

export default function ArticlePage() {
  const { slug } = useParams();
  const article = getArticle(slug);
  const answers = useAnswers();
  if (!article) return <PageNotFound />;

  const ui = articleUi(article.lang);
  const author = getAuthor(article.author);
  const toc = headings(article.body);
  const updated = article.updatedAt && article.updatedAt !== article.publishedAt ? article.updatedAt : null;
  const others = relatedArticles(article, 3);
  const products = (article.related?.products || [])
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean);
  const topicAnswers = (article.related?.answers || [])
    .map((s) => (answers || []).find((a) => a.slug === s))
    .filter(Boolean);

  return (
    <article lang={article.lang || 'ru'} className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-28 pt-28">
        <Reveal>
          <Breadcrumbs
            items={[{ to: '/', label: ui.home }, { to: ARTICLES_PATH, label: ui.label }]}
            current={article.title} />
          <div className="mt-6 flex flex-wrap gap-1.5">
            {(article.tags || []).map((tag) => (
              <span key={tag} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] text-white/55">{tag}</span>
            ))}
          </div>
          <h1 className="mb-6 mt-5 text-[clamp(1.9rem,4vw,3rem)] font-black leading-[1.08] tracking-[-0.03em] text-white">
            {article.title}
          </h1>
          <p className="text-base leading-relaxed text-white/50 sm:text-lg">{article.description}</p>

          <div className="mt-8 flex flex-col gap-4 border-y border-line py-5 sm:flex-row sm:items-center sm:justify-between">
            <AuthorBadge author={author} size={44} />
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/35">
              <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, article.lang)}</time>
              {updated && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{ui.updated} <time dateTime={updated}>{formatDate(updated, article.lang)}</time></span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" /> {ui.minutes(readingMinutes(article))}</span>
            </p>
          </div>
        </Reveal>

        {toc.length > 2 && (
          <Reveal>
            <nav aria-label="Содержание" className="mt-8 rounded-2xl border border-line bg-white/[0.015] p-5">
              <ol className="space-y-1.5 text-sm">
                {toc.map((h, i) => (
                  <li key={h}>
                    <a href={`#${anchorId(i)}`} className="text-white/45 transition-colors hover:text-white">{h}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </Reveal>
        )}

        <div className="mt-10">
          <ArticleBody source={article.body} />
        </div>

        {article.sources?.length > 0 && (
          <section className="mt-12 border-t border-line pt-8">
            <p className={label}>{ui.sources}</p>
            <ul className="space-y-2 text-sm leading-relaxed text-white/45">
              {article.sources.map((s) => (
                <li key={s.label} className="flex gap-3">
                  <span aria-hidden="true" className="shrink-0 select-none text-primary/60">—</span>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                       className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white">{s.label}</a>
                  ) : <span>{s.label}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-white/30">{ui.disclaimer}</p>
          </section>
        )}

        {author && (
          <section className="mt-10 rounded-2xl border border-line bg-white/[0.02] p-6">
            <p className={label}>{ui.by}</p>
            <div className="flex gap-4">
              <AuthorAvatar author={author} size={56} />
              <div className="min-w-0">
                <p className="font-semibold text-white/85">{author.name}</p>
                <p className="text-xs text-white/35">{author.role}</p>
                {author.bio && <p className="mt-3 text-sm leading-relaxed text-white/50">{author.bio}</p>}
              </div>
            </div>
          </section>
        )}

        <section className="mt-10 rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-8">
          <h2 className="text-xl font-black tracking-[-0.02em] text-white sm:text-2xl">{ui.ctaTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/50">{ui.ctaText}</p>
          {products.length > 0 && (
            <>
              <p className="mb-3 mt-6 text-xs uppercase tracking-[0.25em] text-white/25">{ui.products}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {products.map((p) => (
                  <li key={p.id}>
                    <Link to={productHref(p)}
                          className="flex h-full flex-col rounded-xl border border-line bg-background/60 p-4 transition-colors hover:border-white/15">
                      <span className="text-sm font-semibold text-white/80">{p.name}</span>
                      <span className="mt-1 text-xs leading-snug text-white/40">{p.tagline}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/proverka"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary/80">
              <ScanSearch className="h-4 w-4" aria-hidden="true" /> {ui.ctaCheck}
            </Link>
            <Link to="/products?cat=1С"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/20 hover:text-white">
              {ui.ctaProducts} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {topicAnswers.length > 0 && (
          <section className="mt-12">
            <p className={label}>{ui.alsoAnswers}</p>
            <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
              {topicAnswers.map((a) => (
                <Link key={a.slug} to={`/1c/${a.slug}`}
                      className="bg-background p-5 text-sm text-white/50 transition-colors hover:bg-white/[0.02] hover:text-white/80">
                  {a.title}
                </Link>
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="mt-12">
            <p className={label}>{ui.alsoRead}</p>
            <div className="grid gap-3">
              {others.map((a) => (
                <Link key={a.slug} to={articlePath(a.slug)}
                      className="group rounded-xl border border-line p-5 transition-colors hover:border-white/15 hover:bg-white/[0.02]">
                  <span className="block font-semibold text-white/80 group-hover:text-white">{a.title}</span>
                  <span className="mt-1 block text-xs text-white/30">
                    {getAuthor(a.author)?.name || 'Tinker'} · {ui.minutes(readingMinutes(a))}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
