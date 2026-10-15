/**
 * /products/<id> — страница одного расширения 1С.
 *
 * Порядок блоков — порядок вопросов бухгалтера, пришедшего из поиска по
 * запросу «проверка контрагента 1С»: что это и про меня ли это → сколько
 * стоит → как выглядит → что именно находит → что продукт делает с базой и
 * что остаётся за мной → вопросы → где почитать подробнее. Кнопка
 * бесплатной экспресс-проверки — и в начале, и в конце: она ничего не
 * стоит и только читает базу, поэтому просить о ней можно сразу.
 *
 * Тексты — src/lib/content/productPages.js; название, описание проблемы,
 * возможности и цена — из каталога (src/lib/content/site.js), чтобы карточка
 * и страница не разошлись. Только по-русски, как разборы /1c.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, Check, ScanSearch } from 'lucide-react';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import Breadcrumbs from '@/components/nav/Breadcrumbs';
import { useAnswers } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';
import PageNotFound from '@/lib/PageNotFound';
import { tenge } from '@/lib/money';
import { PRODUCTS } from '@/lib/content/site';
import { ARTICLES, articlePath } from '@/lib/content/articles';
import { PROVERKA_PATH } from '@/lib/content/answerProducts';
import {
  PRODUCT_PAGE_IDS, getProductPage, productPagePath, productScreens, relatedAnswers, relatedArticles,
} from '@/lib/content/productPages';

const label = 'mb-5 text-xs uppercase tracking-[0.3em] text-white/25';
const h2 = 'mb-5 text-xl font-black tracking-[-0.02em] text-white sm:text-2xl';

const btnMain = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-snow transition-colors hover:bg-primary/80';
const btnSecond = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/20 hover:text-white';

function Buttons() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link to={PROVERKA_PATH} className={btnMain}>
        <ScanSearch className="h-4 w-4" aria-hidden="true" /> Проверить базу бесплатно
      </Link>
      <Link to={CONTACT_PATH} className={btnSecond}>
        Связаться <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function Price({ product }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-5 sm:p-6">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-white/30">Внедрение</p>
          <p className="text-xl font-black text-white">
            {product.price ? `от ${tenge(product.price)}` : 'по запросу'}
          </p>
        </div>
        {product.subscription ? (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-white/30">Подписка в месяц</p>
            <p className="text-xl font-black text-white">от {tenge(product.subscription)}</p>
          </div>
        ) : null}
      </div>
      {product.note && <p className="mt-3 text-xs leading-relaxed text-white/40">{product.note}</p>}
    </div>
  );
}

function Bullets({ items, marker = 'check', color }) {
  return (
    <ul className="space-y-3">
      {items.map((line) => (
        <li key={line} className="flex gap-3 text-sm leading-relaxed text-white/60">
          {marker === 'check'
            ? <Check className="tk-tint mt-[3px] h-4 w-4 shrink-0" style={{ '--tint': color }} aria-hidden="true" />
            : <span className="mt-[1px] shrink-0 select-none text-primary/60" aria-hidden="true">—</span>}
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function Screen({ s, first }) {
  return (
    <figure className="m-0">
      <picture>
        <source media="(max-width: 640px)" srcSet={s.srcSmall} />
        <img
          src={s.src}
          width={s.width}
          height={s.height}
          alt={s.alt}
          loading={first ? 'eager' : 'lazy'}
          decoding="async"
          className="block h-auto w-full rounded-xl border border-line bg-snow shot-frame"
        />
      </picture>
      <figcaption className="mt-3 text-sm leading-relaxed text-white/55">
        {s.caption}
        <span className="mt-1 block text-xs text-white/30">{s.note}</span>
      </figcaption>
    </figure>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const answers = useAnswers();
  const found = getProductPage(id);
  if (!found) return <PageNotFound />;

  const { product, page } = found;
  const screens = productScreens(id);
  const topicAnswers = relatedAnswers(id, answers);
  const topicArticles = relatedArticles(id, ARTICLES);
  const others = PRODUCT_PAGE_IDS
    .filter((x) => x !== id)
    .map((x) => PRODUCTS.find((p) => p.id === x))
    .filter(Boolean);

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
      <div className="relative z-10 mx-auto max-w-4xl px-5 pb-28 pt-28">
        {/* Первый экран без проявления: заголовок и цена должны быть видны сразу. */}
        <Breadcrumbs
          items={[{ to: '/', label: 'Главная' }, { to: '/products', label: 'Продукты' }]}
          current={product.name} />

        {/* На телефоне значок над заголовком: рядом он сжимал длинный H1 в узкую колонку. */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl"
            style={{ background: `${product.color}12`, borderColor: `${product.color}30` }}
            aria-hidden="true"
          >
            {product.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-white/30">
              Расширение 1С · {product.name}
            </p>
            <h1 className="mt-2 text-[clamp(1.7rem,3.4vw,2.8rem)] font-black leading-[1.1] tracking-[-0.03em] text-white">
              {page.h1}
            </h1>
          </div>
        </div>
        <p className="mt-5 text-base font-semibold text-white/70">{product.tagline}</p>
        <p className="mt-4 text-base leading-relaxed text-white/55">{product.description}</p>
        <p className="mt-3 text-sm text-white/40">
          Для 1С:Бухгалтерии для Казахстана 3.0 и 1С:Комплексной автоматизации для Казахстана 2.4.
        </p>

        <div className="mt-8 space-y-5">
          <Price product={product} />
          <Buttons />
        </div>

        <div className="mt-16 space-y-16">
          <Reveal>
            <h2 className={h2}>Что делает</h2>
            <div className="space-y-4">
              {page.lead.map((p) => (
                <p key={p} className="text-base leading-relaxed text-white/60">{p}</p>
              ))}
            </div>
          </Reveal>

          {screens.length > 0 && (
            <Reveal>
              <p className={label}>Как это выглядит в 1С</p>
              <div className="space-y-10">
                {screens.map((s, i) => <Screen key={s.src} s={s} first={i === 0} />)}
              </div>
            </Reveal>
          )}

          <Reveal>
            <h2 className={h2}>Какие проблемы находит</h2>
            <Bullets items={page.finds} color={product.color} />
          </Reveal>

          <Reveal>
            <h2 className={h2}>Что умеет</h2>
            <Bullets items={product.features} color={product.color} />
          </Reveal>

          <Reveal>
            <div className="rounded-2xl border border-line bg-white/[0.02] p-6 sm:p-8">
              <h2 className={h2}>Для БухКз 3.0 и КА 2.4: что остаётся под контролем бухгалтера</h2>
              <Bullets
                marker="dash"
                items={[
                  'Ставится отдельным расширением — для Бухгалтерии для Казахстана 3.0 и для Комплексной автоматизации 2.4 свой файл. Типовая конфигурация не меняется, снимать её с поддержки не нужно.',
                  ...page.control,
                  'Настройки — токены, получатели в Telegram, расписание — меняет только администратор продукта. Регламентные задания поставляются выключенными.',
                ]}
              />
              <Link to="/bezopasnost"
                    className="mt-6 inline-flex items-center gap-2 text-sm text-primary transition-colors hover:text-white">
                Что продукты делают с базой 1С — подробно <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>

          <Reveal>
            <h2 className={h2}>Вопросы и ответы</h2>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {page.faq.map(({ q, a }) => (
                <details key={q} className="group bg-white/[0.01] open:bg-white/[0.03]">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 text-sm font-semibold text-white/80 marker:hidden hover:text-white [&::-webkit-details-marker]:hidden">
                    <span>{q}</span>
                    <span className="mt-0.5 shrink-0 text-white/30 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-white/55">{a}</p>
                </details>
              ))}
            </div>
          </Reveal>

          {(topicAnswers.length > 0 || topicArticles.length > 0) && (
            <Reveal>
              <h2 className={h2}>По теме</h2>
              <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
                {topicAnswers.map((a) => (
                  <Link key={a.slug} to={`/1c/${a.slug}`}
                        className="bg-background p-5 transition-colors hover:bg-white/[0.02]">
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-white/25">Разбор</span>
                    <span className="mt-1 block text-sm text-white/65">{a.title}</span>
                  </Link>
                ))}
                {topicArticles.map((a) => (
                  <Link key={a.slug} to={articlePath(a.slug)}
                        className="bg-background p-5 transition-colors hover:bg-white/[0.02]">
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-white/25">Статья</span>
                    <span className="mt-1 block text-sm text-white/65">{a.title}</span>
                  </Link>
                ))}
                {/* Нечётное число плиток: последняя растягивается, а не оставляет серую дыру. */}
                {(topicAnswers.length + topicArticles.length) % 2 === 1 && (
                  <span className="hidden bg-background sm:block" aria-hidden="true" />
                )}
              </div>
            </Reveal>
          )}

          <Reveal>
            <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-8">
              <h2 className="text-xl font-black tracking-[-0.02em] text-white sm:text-2xl">
                Сначала — бесплатная экспресс-проверка
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                Внешняя обработка .epf для БухКз 3.0 и КА 2.4: только читает базу, в интернет не выходит и за
                пару минут показывает ЭСФ без выписки, просроченную дебиторку, ошибки СНТ и ВС, неразнесённый банк,
                неверные ИИН/БИН и встречные долги. По результату станет видно, нужен ли вам «{product.name}».
              </p>
              <div className="mt-6"><Buttons /></div>
            </section>
          </Reveal>

          <Reveal>
            <p className={label}>Другие расширения 1С</p>
            <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
              {others.map((p) => (
                <Link key={p.id} to={productPagePath(p.id)}
                      className="bg-background p-5 transition-colors hover:bg-white/[0.02]">
                  <span className="block text-sm text-white/65">
                    <span className="mr-2" aria-hidden="true">{p.icon}</span>{p.name}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-white/30">{p.tagline}</span>
                </Link>
              ))}
              {others.length % 2 === 1 && <span className="hidden bg-background sm:block" aria-hidden="true" />}
            </div>
            <Link to="/products?cat=1С"
                  className="mt-5 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white">
              Все продукты и цены <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
