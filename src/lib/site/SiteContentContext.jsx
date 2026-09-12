/**
 * Содержимое публичного сайта из базы — с откатом на то, что зашито в код.
 *
 * Правило одно и оно важнее остального кода в этом файле: если в базе для
 * раздела ничего не опубликовано, сайт показывает прежнее содержимое.
 * Не пустой блок, не заглушку, не «загрузка…» навсегда — именно прежнее.
 * Поэтому все хуки ниже возвращают null, когда данных нет, а страницы
 * трактуют null как «бери своё».
 *
 * Отсюда следует, что неудачный запрос к базе тоже безвреден: ошибка сети
 * даёт null, а null означает «как было». Сайт не может «сломаться из-за CMS».
 *
 * Ключи полей в базе намеренно совпадают с теми, что уже ждёт вёрстка
 * (title/desc/features у услуги, text/role/company у отзыва), поэтому
 * страницы меняются на одну строку, а не переписываются.
 */
import React from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n/LangContext';

const SiteContentContext = React.createContext({ content: null, ready: false });

export function SiteContentProvider({ children, initialContent = null }) {
  const { lang } = useLang();
  // Содержимое, вшитое на сборке: страницы собираются с ним, поэтому робот
  // видит опубликованный текст, а не пустой div.
  const [byLocale, setByLocale] = React.useState(() => (
    initialContent ? { [initialContent.locale || 'ru']: initialContent } : {}
  ));
  const [ready, setReady] = React.useState(!isSupabaseConfigured);
  // Один запрос на язык за сеанс. Даже если содержимое пришло со сборки,
  // один раз перечитываем: сборка могла быть неделю назад.
  const asked = React.useRef(new Set());

  React.useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    if (asked.current.has(lang)) return undefined;
    asked.current.add(lang);
    let alive = true;
    supabase
      .rpc('site_content', { p_locale: lang })
      .then(({ data, error }) => {
        if (!alive) return;
        // Ошибку намеренно не показываем посетителю: для него это не событие.
        // Сайт просто остаётся на том содержимом, что уже есть.
        if (error) {
          setByLocale((prev) => (prev[lang] ? prev : { ...prev, [lang]: { failed: true } }));
        } else {
          setByLocale((prev) => ({ ...prev, [lang]: data }));
        }
        setReady(true);
      });
    return () => { alive = false; };
  }, [lang]);

  const content = byLocale[lang] && !byLocale[lang].failed ? byLocale[lang] : null;

  const value = React.useMemo(() => ({ content, ready, lang }), [content, ready, lang]);
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

const useContent = () => React.useContext(SiteContentContext).content;

/**
 * Пришёл ли ответ из базы.
 *
 * Нужно там, где «нет записи» и «ещё не спросили» — разные вещи. Для услуг
 * и отзывов разницы нет: пока нет данных, показывается вариант из кода.
 * А для разборов по 1С вариант из кода не существует, и поспешное «такой
 * страницы нет» вместо ожидания — это пустая страница вместо ответа.
 */
export const useContentReady = () => React.useContext(SiteContentContext).ready;

/** Записи справочника или null, если ничего не опубликовано. */
function useCollection(code) {
  const content = useContent();
  const items = content?.collections?.[code];
  return React.useMemo(() => (items?.length ? items : null), [items]);
}

/** Настройка сайта из базы либо значение из кода. */
export function useSiteSetting(key, fallback) {
  const content = useContent();
  const value = content?.settings?.[key];
  return value === undefined || value === null || value === '' ? fallback : value;
}

/** Тексты страницы: null, если страница не опубликована. */
export function usePageText(slug) {
  const content = useContent();
  const page = content?.pages?.find((p) => p.slug === slug);
  return page?.text || null;
}

/** Опубликованные блоки страницы или null. */
export function usePageBlocks(slug) {
  const content = useContent();
  const page = content?.pages?.find((p) => p.slug === slug);
  return page?.blocks?.length ? page.blocks : null;
}

/* ── Справочники в тех же формах, которые уже ждёт вёрстка ────────────────── */

export function useServices() {
  const items = useCollection('service');
  return React.useMemo(() => items && items.map((it) => ({
    title: it.text?.title || '',
    tag: it.props?.tag || '',
    desc: it.text?.desc || '',
    items: it.text?.features || [],
    icon: it.props?.icon || null,
    priceFrom: it.props?.price_from ?? null,
  })), [items]);
}

export function useProjects() {
  const items = useCollection('work');
  return React.useMemo(() => items && items.map((it, i) => ({
    id: `cms-${it.slug || i}`,
    slug: it.slug || `case-${i + 1}`,
    title: it.text?.title || '',
    description: it.text?.desc || '',
    industry: it.props?.industry || 'Case',
    technologies: it.props?.tech || [],
    result: it.text?.result || '',
    client_name: null,
    image_url: it.props?.image || null,
    year: it.props?.year ?? null,
  })), [items]);
}

export function useTestimonials() {
  const items = useCollection('review');
  return React.useMemo(() => items && items.map((it, i) => ({
    id: `cms-review-${i}`,
    text: it.text?.text || '',
    name: it.text?.role || it.props?.author || '',
    company: it.text?.company || '',
    rating: it.props?.rating || 5,
    image_url: null,
  })), [items]);
}

export function useFaq() {
  const items = useCollection('faq');
  return React.useMemo(() => items && items.map((it) => ({
    q: it.text?.q || '',
    a: it.text?.a || '',
    topic: it.props?.topic || null,
  })), [items]);
}

/** Группы технологий в той же форме, что зашита в блоке «Стек». */
export function useStack() {
  const items = useCollection('stack');
  return React.useMemo(() => items && items.map((it) => ({
    label: it.text?.title || '',
    note: it.text?.note || '',
    icon: it.props?.icon || '•',
    color: it.props?.color || '#4d7fff',
    items: (it.text?.items || []).map((name) => ({
      name, color: it.props?.color || '#4d7fff',
    })),
  })), [items]);
}

export function useProducts() {
  const items = useCollection('product');
  return React.useMemo(() => items && items.map((it, i) => ({
    id: it.slug || `product-${i}`,
    name: it.text?.name || '',
    tagline: it.text?.tagline || '',
    description: it.text?.description || '',
    features: it.text?.features || [],
    icon: it.props?.icon || '📦',
    color: it.props?.color || '#4d7fff',
    categories: it.props?.categories || [],
    price: it.props?.price ?? null,
    subscription: it.props?.subscription ?? null,
    popular: Boolean(it.props?.popular),
  })), [items]);
}

/**
 * Ответы на конкретные вопросы про 1С — страницы /1c/<slug>.
 *
 * Отдаём как есть, включая пустой список: в отличие от услуг и отзывов,
 * здесь нет варианта «взять из кода». Раздела просто нет, пока в панели
 * ничего не опубликовано, — и это правильнее, чем показать заготовку.
 */
export function useAnswers() {
  const items = useCollection('answer');
  return React.useMemo(() => items && items.map((it) => ({
    slug: it.slug,
    title: it.text?.title || '',
    question: it.text?.question || '',
    lead: it.text?.lead || '',
    symptoms: it.text?.symptoms || [],
    causes: it.text?.causes || [],
    steps: it.text?.steps || [],
    callUs: it.text?.call_us || '',
    seoTitle: it.text?.seo_title || '',
    seoDesc: it.text?.seo_desc || '',
    topic: it.props?.topic || null,
    icon: it.props?.icon || '•',
  })), [items]);
}

/**
 * Офферы — страницы под конкретную покупку: /uslugi/<slug>.
 *
 * Как и разборы, из кода не подставляются: раздела просто нет, пока в
 * панели ничего не опубликовано. Цена может быть пустой — это нормально
 * и означает «по запросу», а не «ошибка».
 */
export function useOffers() {
  const items = useCollection('offer');
  return React.useMemo(() => items && items.map((it) => ({
    slug: it.slug,
    title: it.text?.title || '',
    tagline: it.text?.tagline || '',
    lead: it.text?.lead || '',
    included: it.text?.included || [],
    excluded: it.text?.excluded || [],
    steps: it.text?.steps || [],
    term: it.text?.term || '',
    priceNote: it.text?.price_note || '',
    result: it.text?.result || '',
    seoTitle: it.text?.seo_title || '',
    seoDesc: it.text?.seo_desc || '',
    priceFrom: it.props?.price_from ?? null,
    unit: it.props?.unit || '',
    icon: it.props?.icon || '•',
    accent: Boolean(it.props?.accent),
  })), [items]);
}

/**
 * Кейсы — работы, которые были. Раздел живёт по тем же правилам, что и
 * разборы: только русский язык и только то, что делалось на самом деле.
 */
export function useCases() {
  const items = useCollection('case');
  return React.useMemo(() => items && items.map((it) => ({
    slug: it.slug,
    title: it.text?.title || '',
    tagline: it.text?.tagline || '',
    who: it.text?.who || '',
    situation: it.text?.situation || '',
    work: it.text?.work || [],
    result: it.text?.result || '',
    caveat: it.text?.caveat || '',
    term: it.text?.term || '',
    seoTitle: it.text?.seo_title || '',
    seoDesc: it.text?.seo_desc || '',
    stack: it.props?.stack || [],
    icon: it.props?.icon || '•',
    offerSlug: it.props?.offer_slug || '',
    accent: Boolean(it.props?.accent),
  })), [items]);
}

/**
 * Настройки сайта: то, что задано в панели, поверх зашитого в код.
 *
 * Слияние, а не замена. Пустое или незаданное значение в базе не стирает
 * контакт на сайте — иначе первое же сохранение полупустой формы убрало бы
 * из подвала телефон, и никто не связал бы одно с другим.
 */
export function useSettings(fallback) {
  const content = useContent();
  return React.useMemo(() => {
    const merged = { ...(fallback || {}) };
    for (const [key, value] of Object.entries(content?.settings || {})) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        merged[key] = value;
      }
    }
    return merged;
  }, [content, fallback]);
}
