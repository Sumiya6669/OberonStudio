/**
 * Мета-теги для текущего маршрута. Один компонент на весь публичный сайт.
 *
 * Стоит в раскладке, а не в каждой странице: девять одинаковых вызовов —
 * это девять мест, где однажды забудут поправить. Здесь же собирается
 * разметка JSON-LD, потому что она зависит от того же самого — от адреса
 * страницы и от опубликованного содержимого.
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '@/lib/i18n/LangContext';
import { SITE_SETTINGS } from '@/lib/content/site';
import {
  useAnswers, useFaq, usePageText, useProducts, useProjects, useServices, useSettings,
} from '@/lib/site/SiteContentContext';
import { Seo } from './Seo';
import { resolvePageSeo } from './pages';
import {
  answerLd, answersListLd, breadcrumbLd, faqLd, organizationLd, productsLd,
  reviewsLd, servicesLd, websiteLd,
} from './jsonld';
import { SITE_NAME } from './pages';
import { useTestimonials } from '@/lib/site/SiteContentContext';
import { buildFallbackTestimonials } from '@/lib/content/portfolio';
import { splitLocale } from '@/lib/i18n/locales';

export default function RouteSeo() {
  const { pathname: fullPath } = useLocation();
  // Язык уже в адресе; всё остальное считается от пути БЕЗ приставки,
  // иначе `/kz/faq` пришлось бы описывать отдельно от `/faq`.
  const { path: pathname } = splitLocale(fullPath);
  const { t, lang } = useLang();
  const settings = useSettings(SITE_SETTINGS);
  const cmsText = usePageText(pathname);

  const services = useServices();
  const projects = useProjects();
  const products = useProducts();
  const faq = useFaq();
  const reviewsDb = useTestimonials();
  const answers = useAnswers();

  // Разборы по 1С описываются не словарём переводов, а своим содержимым:
  // заголовок и описание берутся из самой записи.
  const answer = React.useMemo(() => {
    if (!pathname.startsWith('/1c/')) return null;
    const slug = pathname.slice('/1c/'.length).replace(/\/$/, '');
    return (answers || []).find((a) => a.slug === slug) || null;
  }, [pathname, answers]);

  const seo = React.useMemo(() => {
    if (pathname === '/1c') {
      return {
        ...resolvePageSeo({ path: '/1c', t, lang, cmsText, localised: false }),
        pageName: 'Ответы по 1С',
        title: `Частые вопросы по 1С и что с ними делать — ${SITE_NAME}`,
        description: 'Разборы частых проблем в 1С: не проводится документ, не грузится выписка из банка, ошибки ЭСФ, тормоза, расхождения остатков. Что проверить самому.',
      };
    }
    if (answer) {
      return {
        ...resolvePageSeo({ path: pathname, t, lang, cmsText, localised: false }),
        pageName: answer.title,
        title: `${answer.seoTitle || answer.title} — ${SITE_NAME}`,
        description: answer.seoDesc || answer.lead,
        type: 'article',
      };
    }
    return resolvePageSeo({ path: pathname, t, lang, cmsText });
  }, [pathname, t, lang, cmsText, answer]);

  const jsonLd = React.useMemo(() => {
    const blocks = [organizationLd(settings), websiteLd()];
    const crumb = breadcrumbLd(pathname, seo.pageName || seo.title);
    if (crumb) blocks.push(crumb);

    // Списочная разметка — только там, где такой список действительно
    // на странице. Разметка того, чего на странице нет, — это ошибка.
    if (pathname === '/services') {
      const list = services || (t?.services?.items || []).map((item) => ({
        title: item.title, desc: item.desc,
      }));
      const block = servicesLd(list);
      if (block) blocks.push(block);
    }
    if (pathname === '/faq') {
      const list = faq || t?.faq?.items || [];
      const block = faqLd(list);
      if (block) blocks.push(block);
    }
    if (pathname === '/products') {
      const block = productsLd(products);
      if (block) blocks.push(block);
    }
    if (pathname === '/reviews') {
      const list = reviewsDb || buildFallbackTestimonials(t, lang);
      const block = reviewsLd(list);
      if (block) blocks.push(block);
    }
    if (pathname === '/1c') {
      const block = answersListLd(answers);
      if (block) blocks.push(block);
    }
    if (answer) {
      const block = answerLd(answer);
      if (block) blocks.push(block);
    }
    if (pathname === '/projects') {
      // Проекты размечаются на своей странице; список берётся тот же,
      // что показан, — из базы либо из кода.
      const block = projects && projects.length
        ? { '@context': 'https://schema.org', '@type': 'ItemList',
            name: 'Реализованные проекты',
            itemListElement: projects.slice(0, 30).map((p, i) => ({
              '@type': 'ListItem', position: i + 1,
              item: { '@type': 'CreativeWork', name: p.title, description: p.description },
            })) }
        : null;
      if (block) blocks.push(block);
    }
    return blocks.filter(Boolean);
  }, [pathname, settings, seo.pageName, seo.title, services, faq, products, projects,
      reviewsDb, answers, answer, t, lang]);

  const verification = React.useMemo(() => [
    { name: 'google-site-verification', content: settings.google_verify },
    { name: 'yandex-verification', content: settings.yandex_verify },
  ].filter((item) => item.content), [settings.google_verify, settings.yandex_verify]);

  // pageName нужен только крошкам, в мета-теги он не идёт.
  const { pageName, ...meta } = seo;
  return <Seo {...meta} verification={verification} jsonLd={jsonLd} />;
}
